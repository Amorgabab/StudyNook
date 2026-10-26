'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WD = require('../app/main/watchdog.js');

/* ---------- decision logic, with every effect faked ---------- */
function make(over) {
  const t = { now: 1_800_000_000_000, session: { active: true, savedAt: 1_800_000_000_000 - 5000 }, alive: new Set([100]), history: [], logs: [], relaunches: 0, nextPid: 200 };
  const wd = new WD.Watchdog(Object.assign({
    mainPid: 100,
    now: () => t.now,
    isAlive: (pid) => t.alive.has(pid),
    readSession: () => t.session,
    readHistory: () => t.history.slice(),
    writeHistory: (h) => { t.history = h.slice(); },
    relaunch: () => { t.relaunches++; const p = t.nextPid++; t.alive.add(p); return p; },
    log: (ev) => t.logs.push(ev)
  }, over || {}));
  return { wd, t };
}

suite('watchdog · decisions', () => {
  test('app alive during a session → keeps watching', () => {
    const { wd } = make();
    expect(wd.tick()).toBe('alive');
  });
  test('app alive but session over → retires after a few polls', () => {
    const { wd, t } = make(); t.session = null;
    expect(wd.tick()).toBe('alive');
    expect(wd.tick()).toBe('alive');
    expect(wd.tick()).toBe('idle-exit');
  });
  test('app gone and NO session → normal quit, no relaunch', () => {
    const { wd, t } = make(); t.alive.clear(); t.session = null;
    expect(wd.tick()).toBe('clean-exit');
    expect(t.relaunches).toBe(0);
  });
  test('app gone mid-session → relaunched, history written, new pid watched', () => {
    const { wd, t } = make(); t.alive.clear();
    expect(wd.tick()).toBe('relaunched');
    expect(t.relaunches).toBe(1);
    expect(t.history.length).toBe(1);
    expect(t.logs.some((l) => /relaunching/.test(l))).toBe(true);
    expect(wd.pid).toBe(200);
    expect(wd.tick()).toBe('alive');          // watching the new process now
  });
  test('a session.json older than 12 h is not resurrected', () => {
    const { wd, t } = make(); t.alive.clear(); t.session = { active: true, savedAt: t.now - WD.STALE_MS - 1000 };
    expect(wd.tick()).toBe('clean-exit');
    expect(t.relaunches).toBe(0);
  });
  test('crash loop: gives up after the budget, old attempts expire', () => {
    const { wd, t } = make({ relaunch: () => { return null; } });
    t.alive.clear();
    for (let i = 0; i < WD.MAX_RESTARTS; i++) expect(wd.tick()).toBe('relaunch-failed');
    expect(wd.tick()).toBe('gave-up');
    t.now += WD.WINDOW_MS + 1000;             // window passes → budget refills
    expect(wd.tick()).toBe('relaunch-failed');
  });
});

/* ---------- the real thing: separate processes, a real kill ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await sleep(100); } return false; }

suite('watchdog · real processes', () => {
  test('kill the "app" mid-session → watchdog relaunches it, then retires when the session ends', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-wd-'));
    const sessionFile = path.join(dir, 'session.json');
    const marker = path.join(dir, 'marker.txt');
    const markerScript = path.join(dir, 'fake-app.js');
    // stand-in for the relaunched app: records how it was started, exits once the session file is gone
    fs.writeFileSync(markerScript, [
      "const fs=require('fs'),path=require('path');",
      "const dir=process.argv[2];",
      "fs.writeFileSync(path.join(dir,'marker.txt'), process.argv.slice(3).join(' ')+'|ERAN='+(process.env.ELECTRON_RUN_AS_NODE||'unset'));",
      "setInterval(()=>{ if(!fs.existsSync(path.join(dir,'session.json'))) process.exit(0); }, 300);"
    ].join('\n'));
    fs.writeFileSync(sessionFile, JSON.stringify({ active: true, savedAt: Date.now() }));

    const app = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
    const logFile = path.join(dir, 'lifecycle.log');
    const readLog = () => { try { return fs.readFileSync(logFile, 'utf8'); } catch (e) { return ''; } };
    try {
      const started = WD.ensure({ execPath: process.execPath, scriptPath: path.join(__dirname, '..', 'app', 'main', 'watchdog.js'), mainPid: app.pid, dataDir: dir, launch: [process.execPath, markerScript, dir] });
      expect(started).toBe(true);
      expect(await waitFor(() => /watchdog started/.test(readLog()), 8000)).toBe(true);
      expect(WD.ensure({ execPath: process.execPath, scriptPath: 'x', mainPid: app.pid, dataDir: dir, launch: ['x'] })).toBe(false);   // already running → no duplicate

      app.kill();                                                          // the "End task"
      expect(await waitFor(() => fs.existsSync(marker), 12000)).toBe(true); // relaunched
      const m = fs.readFileSync(marker, 'utf8');
      expect(m).toContain('--restarted-by-watchdog');
      expect(m).toContain('ERAN=unset');                                    // watchdog's node-mode flag must not leak into the app

      fs.unlinkSync(sessionFile);                                          // session ended properly
      expect(await waitFor(() => /watchdog exit/.test(readLog()), 12000)).toBe(true);
      const log = readLog();
      expect(log).toContain('app closed mid-session');
      expect(log).toContain('relaunched');
      expect(await waitFor(() => !WD.isRunning(dir), 4000)).toBe(true);     // pid file released
    } finally {
      try { app.kill(); } catch (e) {}
      try { const p = parseInt(fs.readFileSync(path.join(dir, 'watchdog.pid'), 'utf8'), 10); if (p) process.kill(p); } catch (e) {}
    }
  });
});
