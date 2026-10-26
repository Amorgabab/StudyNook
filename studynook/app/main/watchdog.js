/* ============================================================
   StudyNook · watchdog.js — relaunch the app if it dies mid-session
   ------------------------------------------------------------
   session.js already persists the live session to data/session.json
   and main.js resumes it on boot ("dead time is free"). What was
   missing is something to START the app again after an "End task" or
   a crash. This is that something.

   How it works
   • While a session exists, main.js calls ensure(), which launches a
     tiny background copy of THIS file (the app's own runtime in plain
     Node mode via ELECTRON_RUN_AS_NODE — nothing extra to install).
   • It launches in two hops (--stage1 spawns the real watchdog and
     exits) so the watchdog is an orphan, not a child of the app: an
     "End task" on the app's process tree does not take it along.
   • Every 2 s the watchdog checks the app's PID:
       – app alive, session active   → keep watching
       – app alive, session over     → exit (next session starts a new one)
       – app gone, NO active session → normal quit, exit quietly
       – app gone, session active    → relaunch the app, log it, and
         keep watching the new PID. The relaunched app resumes the
         session from session.json.
   • Crash-loop guard: at most 5 relaunches per 10 minutes (the history
     lives in a file so it survives watchdog restarts), then it gives
     up and logs why — a broken install must not respawn forever.
   • Ending a session properly (finish / End early / Iron gate) deletes
     session.json, which is exactly the "don't restart me" signal.

   Honest limits: it is a speed bump, not a lock. Killing every
   StudyNook.exe at once (Details tab / taskkill /IM) kills the
   watchdog too; PID reuse right after a crash could delay a restart.
   Everything it does is appended to data/lifecycle.log.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { makeLogger } = require('./lifecycle.js');

const POLL_MS = 2000;
const STALE_MS = 12 * 60 * 60 * 1000;     // same cut-off main.js uses to ignore an old session.json
const MAX_RESTARTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const IDLE_POLLS = 3;                      // ~6 s of "alive but no session" before the watchdog retires

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/* ---------- the decision logic (pure: every effect is injected) ---------- */
class Watchdog {
  /**
   * @param o
   *   mainPid                       PID of the app being watched
   *   now()                         ms clock
   *   isAlive(pid)                  → bool
   *   readSession()                 → parsed session.json or null
   *   readHistory() / writeHistory(arr)   relaunch timestamps (crash-loop guard)
   *   relaunch()                    → new PID or null
   *   log(event, extra)
   */
  constructor(o) { this.o = o; this.pid = o.mainPid; this.idle = 0; }

  sessionActive() {
    const s = this.o.readSession();
    return !!(s && s.active && Number(s.savedAt) > 0 && this.o.now() - Number(s.savedAt) <= STALE_MS);
  }

  /** One poll. Returns: alive | idle-exit | clean-exit | relaunched | relaunch-failed | gave-up */
  tick() {
    const o = this.o;
    if (o.isAlive(this.pid)) {
      if (this.sessionActive()) { this.idle = 0; return 'alive'; }
      return ++this.idle >= IDLE_POLLS ? 'idle-exit' : 'alive';
    }
    if (!this.sessionActive()) { o.log('app closed, no active session — watchdog done', { pid: this.pid }); return 'clean-exit'; }

    const now = o.now();
    const history = (o.readHistory() || []).filter((t) => now - t < WINDOW_MS);
    if (history.length >= MAX_RESTARTS) {
      o.log('giving up: app keeps closing (' + MAX_RESTARTS + ' relaunches in 10 min)', { pid: this.pid });
      return 'gave-up';
    }
    history.push(now);
    o.writeHistory(history);
    o.log('app closed mid-session — relaunching', { attempt: history.length, deadPid: this.pid });
    const np = o.relaunch();
    if (np) { this.pid = np; this.idle = 0; o.log('relaunched', { pid: np }); return 'relaunched'; }
    o.log('relaunch failed — will retry');
    return 'relaunch-failed';
  }
}

/* ---------- starting it from the app ---------- */
const pidFile = (dataDir) => path.join(dataDir, 'watchdog.pid');

function isRunning(dataDir) {
  try { return pidAlive(parseInt(fs.readFileSync(pidFile(dataDir), 'utf8'), 10)); } catch (e) { return false; }
}

/** Launch the watchdog unless one is already running. Returns true if started. */
function ensure(opts) {
  if (isRunning(opts.dataDir)) return false;
  const env = Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' });
  const child = spawn(opts.execPath, [opts.scriptPath, '--stage1', String(opts.mainPid), opts.dataDir, JSON.stringify(opts.launch)], {
    detached: true, stdio: 'ignore', windowsHide: true, env
  });
  child.on('error', () => {});
  child.unref();
  return true;
}

/* ---------- running as the watchdog process ---------- */
function run(argv) {
  const a = argv.slice();
  const stage1 = a[0] === '--stage1';
  if (stage1) a.shift();
  const mainPid = parseInt(a[0], 10);
  const dataDir = a[1];
  let launch;
  try { launch = JSON.parse(a[2]); } catch (e) { launch = null; }
  if (!mainPid || !dataDir || !Array.isArray(launch) || !launch.length) process.exit(2);

  if (stage1) {
    // Hop 1: start the real watchdog detached, then vanish so it is orphaned.
    const c = spawn(process.execPath, [__filename, String(mainPid), dataDir, a[2]], {
      detached: true, stdio: 'ignore', windowsHide: true, env: process.env
    });
    c.on('error', () => {});
    c.unref();
    return process.exit(0);
  }

  const log = makeLogger(path.join(dataDir, 'lifecycle.log'), 'watchdog');
  const histFile = path.join(dataDir, 'watchdog-history.json');
  const pf = pidFile(dataDir);

  // One watchdog per data folder. Exclusive create makes a double start race-safe.
  try { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(pf, String(process.pid), { flag: 'wx' }); }
  catch (e) {
    if (isRunning(dataDir)) return process.exit(0);
    try { fs.writeFileSync(pf, String(process.pid)); } catch (e2) {}
  }
  const release = () => { try { if (parseInt(fs.readFileSync(pf, 'utf8'), 10) === process.pid) fs.unlinkSync(pf); } catch (e) {} };
  process.on('exit', release);

  const wd = new Watchdog({
    mainPid,
    now: Date.now,
    isAlive: pidAlive,
    readSession: () => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'session.json'), 'utf8')); } catch (e) { return null; } },
    readHistory: () => { try { const h = JSON.parse(fs.readFileSync(histFile, 'utf8')); return Array.isArray(h) ? h.filter(Number.isFinite) : []; } catch (e) { return []; } },
    writeHistory: (h) => { try { fs.writeFileSync(histFile, JSON.stringify(h)); } catch (e) {} },
    relaunch: () => {
      try {
        // The watchdog runs with ELECTRON_RUN_AS_NODE=1 — the app must NOT inherit it or it would start as plain Node.
        const env = Object.assign({}, process.env);
        delete env.ELECTRON_RUN_AS_NODE;
        const child = spawn(launch[0], launch.slice(1).concat('--restarted-by-watchdog'), { detached: true, stdio: 'ignore', env });
        child.on('error', (e) => log('relaunch spawn error', e.message));
        child.unref();
        return child.pid || null;
      } catch (e) { log('relaunch threw', e.message); return null; }
    },
    log
  });

  log('watchdog started', { watching: mainPid });
  const timer = setInterval(() => {
    let r;
    try { r = wd.tick(); } catch (e) { log('watchdog error', e.message); return; }
    if (r === 'idle-exit' || r === 'clean-exit' || r === 'gave-up') { clearInterval(timer); log('watchdog exit', r); process.exit(0); }
  }, POLL_MS);
}

if (require.main === module) run(process.argv.slice(2));

module.exports = { Watchdog, ensure, isRunning, pidAlive, POLL_MS, STALE_MS, MAX_RESTARTS, WINDOW_MS, IDLE_POLLS };
