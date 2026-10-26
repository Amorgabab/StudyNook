/* ============================================================
   StudyNook · watch.js — background watchers run from main.js
   ------------------------------------------------------------
   • pollExtStatus   every 10 s: bridge status, "extension went quiet"
                     warning, and (Iron focus only) closing the browser
   • ensureWatchdog  keeps the auto-restart helper alive during sessions
   State lives in this closure; everything else comes in through ctx.
   ============================================================ */
'use strict';

const path = require('path');
const processes = require('./processes.js');
const ExtWatch = require('../shared/extwatch.js');
const ExtFinder = require('./extfinder.js');
const Watchdog = require('./watchdog.js');

function createWatch(ctx) {
  const { app, store, session, guardian, server, T, notify, broadcast, addFeed, pushSnapshot, lifeLog, DATA_DIR, EXT_DIR } = ctx;
  let extGoneWarned = false;   // one "blocker went quiet" warning per silence

  function pollExtStatus() {
    const ok = server.connected();
    if (ok !== ctx.extConnected) { ctx.extConnected = ok; pushSnapshot(); }
    watchExtension();
    enforceBlocker();
  }

  /* Iron focus only: Chrome cannot stop anyone removing/disabling an extension,
     so if the blocker is gone the app closes the browser it lived in — but only
     after the browser has been open for REPAIR_MS with the extension silent,
     which leaves time to re-enable it. Closing restarts that window. */
  let browserSeenSince = null, enforcing = false;
  async function enforceBlocker() {
    if (enforcing) return;
    enforcing = true;
    try {
      const d = store.data, st = session.publicState(), now = Date.now();
      const proc = ExtWatch.browserProcess(d.ext.browser);
      const silent = now - (d.ext.lastSeen || 0) > ExtWatch.SILENT_MS;
      if (!(st.active && st.phase === 'focus' && st.blockActive && d.sites.enabled && proc && silent)) { browserSeenSince = null; return; }
      const running = (await processes.listProcesses()).some((p) => p.norm === proc);
      if (!running) { browserSeenSince = null; return; }
      if (!browserSeenSince) browserSeenSince = now;
      if (!ExtWatch.shouldCloseBrowser({ ironFocus: true, sitesEnabled: d.sites.enabled, lastSeen: d.ext.lastSeen, now, browser: d.ext.browser, runningSince: browserSeenSince })) return;
      const closed = await guardian.killNow(proc);
      browserSeenSince = null;
      lifeLog('iron-closed-browser', { proc, closed });
      if (closed) {
        store.mutate((dd) => addFeed(dd, { kind: 'warn', text: T('main.feed.ironBrowser') }));
        broadcast('toast', { title: T('main.toast.browserClosed.t'), msg: T('main.toast.browserClosed.d') });
        pushSnapshot();
      }
    } catch (e) { lifeLog('enforce-blocker-error', e.message); }
    finally { enforcing = false; }
  }

  /* Auto-recovery: while a session exists keep a background watchdog alive that
     relaunches the app if it is closed or killed mid-session (see watchdog.js).
     Checked every ~10 s; cheap when one is already running. */
  let lastWatchdogCheck = 0;
  function ensureWatchdog() {
    if (process.env.NOOK_SMOKE || !session || !session.isActive()) return;
    const now = Date.now();
    if (now - lastWatchdogCheck < 10000) return;
    lastWatchdogCheck = now;
    try {
      const started = Watchdog.ensure({
        execPath: process.execPath,
        scriptPath: path.join(__dirname, 'watchdog.js'),
        mainPid: process.pid,
        dataDir: DATA_DIR,
        launch: [process.execPath].concat(app.isPackaged ? [] : [app.getAppPath()])
      });
      if (started) lifeLog('watchdog-started', { watching: process.pid });
    } catch (e) { lifeLog('watchdog-start-failed', e.message); }
  }

  /* Chrome extension removed/disabled (or Chrome closed) in the middle of a
     focus: website blocking silently stops. Say so once, loudly enough to see. */
  function watchExtension() {
    const d = store.data;
    const st = session.publicState();
    const focusing = st.active && st.phase === 'focus' && (st.running || st.blockActive);
    if (!focusing || Date.now() - (d.ext.lastSeen || 0) <= ExtWatch.SILENT_MS) { extGoneWarned = false; return; }
    const warn = ExtWatch.shouldWarn({ focusing, sitesEnabled: d.sites.enabled, lastSeen: d.ext.lastSeen, now: Date.now(), warned: extGoneWarned });
    if (!warn) return;
    extGoneWarned = true;
    let hint = T('main.n.extGone.hint');
    try { hint = T('ext.status.' + ExtFinder.detect({ extDir: EXT_DIR }).status + '.d'); } catch (e) {}   // say exactly what state the browser is in
    const ironNote = st.blockActive && d.ext.browser ? ' ' + T('main.n.extGone.iron') : '';
    const msg = T('main.n.extGone.d', { hint }) + ironNote;
    notify(T('main.n.extGone.t'), msg, 'blocker');
    broadcast('toast', { title: T('main.n.extGone.t'), msg });
    store.mutate((dd) => addFeed(dd, { kind: 'warn', text: T('main.feed.extGone') }));
    pushSnapshot();
  }

  return { pollExtStatus, ensureWatchdog };
}

module.exports = { createWatch };
