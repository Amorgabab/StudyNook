/* ============================================================
   StudyNook · main.js — application entry point
   ------------------------------------------------------------
   Wires together:
     store.js      → your data (data/data.json)
     session.js    → focus timer engine
     guardian.js   → app blocker
     sync-server.js→ localhost bridge for the Chrome extension
     windows       → main window, mini floating timer, reminder card
     tray          → little nest icon in your taskbar
   Every UI action arrives over IPC (see preload.js) and every
   interesting moment is broadcast back as an event.
   ============================================================ */
'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, shell, dialog, nativeImage, nativeTheme, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const { Store } = require('./store.js');
const { clampToArea } = require('./bounds.js');
const { writeFileAtomic } = require('./atomic.js');
const { SessionEngine } = require('./session.js');
const Iron = require('../shared/iron.js');
const { Guardian } = require('./guardian.js');
const { SyncServer } = require('./sync-server.js');
const progress = require('../shared/progress.js');

const Lifecycle = require('./lifecycle.js');
const I18n = require('../shared/i18n.js');
const Prefs = require('../shared/uiprefs.js');
const { registerIpc } = require('./ipc.js');
const { createWatch } = require('./watch.js');
const { createSnapshots } = require('./snapshot.js');

const APP_ROOT = path.join(__dirname, '..', '..');          // project folder
// Packaged (installed) apps keep data in the user's AppData room; dev keeps it in the project folder.
const DATA_DIR = app.isPackaged ? app.getPath('userData') : path.join(APP_ROOT, 'data');
const SOUNDS_DIR = app.isPackaged ? path.join(app.getPath('userData'), 'sounds') : path.join(APP_ROOT, 'assets', 'sounds');
const EXT_DIR = app.isPackaged ? path.join(process.resourcesPath, 'extension') : path.join(APP_ROOT, 'extension');
const UI = (f) => path.join(__dirname, '..', 'ui', f);
const ASSET = (f) => path.join(APP_ROOT, 'assets', f);
// Plain-text trail of boots, quits, crashes and watchdog relaunches (data/lifecycle.log).
const lifeLog = Lifecycle.makeLogger(path.join(DATA_DIR, 'lifecycle.log'), 'app');

let store, session, guardian, server;
let win = null, miniWin = null, remindWin = null, tray = null;
let rendererReloads = 0;     // crash-reload budget for the main window
const START_HIDDEN = process.argv.includes('--hidden');   // launched at Windows sign-in → stay in the tray

/** Text in the user's chosen language (same dictionary as the windows). */
const T = (key, vars) => I18n.t(key, vars, Prefs.normLang(store && store.data.settings.language));
const mins = (n) => { I18n.setLang(Prefs.normLang(store && store.data.settings.language)); return I18n.minutes(n); };
function addFeed(d, entry) {
  d.feed = d.feed || [];
  d.feed.unshift(Object.assign({ t: Date.now(), emoji: '' }, entry));
  if (d.feed.length > 40) d.feed.length = 40;
}
/** Resolved light/dark right now (for native window backgrounds before the page paints). */
function resolvedTheme() { return Prefs.resolveTheme(store ? store.data.settings.theme : 'system', nativeTheme.shouldUseDarkColors, new Date().getHours()); }

/* ---------- interrupted-session recovery (task manager / crash / power loss) ----------
   The engine persists its exact state to session.json every few seconds.
   On boot we RESTORE it instead of wiping it: after an "End task" kill the
   session continues right where it left off (dead time doesn't count), so
   you never have to start from scratch. Only genuinely unrecoverable states
   (stale/corrupt file, or a focus whose full length elapsed while dead) are
   salvaged as credit + a feed note. */
const SESSION_FILE = () => path.join(DATA_DIR, 'session.json');
const STALE_MS = 12 * 60 * 60 * 1000;   // older than this → not worth restoring

function readSessionFile() {
  const f = SESSION_FILE();
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; }
}

/** Credit + feed note for a session that can't be resumed any more. */
function salvageInterruptedSession(s, why) {
  try { fs.unlinkSync(SESSION_FILE()); } catch (e) {}
  if (!s || !s.active) return;
  const minutes = Math.floor((s.accumSec || 0) / 60);
  const iron = store.data.settings.timer.iron;
  if (minutes > 0 && !iron) {
    store.mutate((d) => progress.focusRewards(d, minutes, false, { abandoned: true }));
  }
  const whyKey = { 'the focus round finished while the app was closed': 'main.why.finished', 'unknown phase in saved state': 'main.why.corrupt' }[why] || 'main.why.closed';
  store.mutate((d) => addFeed(d, { kind: 'warn', text: T(iron ? 'main.feed.interruptedIron' : 'main.feed.interrupted', { why: T(whyKey), min: mins(minutes) }) }));
}

function recoverInterruptedSession() {
  const s = readSessionFile();
  if (!s) return;
  if (!s.active) { try { fs.unlinkSync(SESSION_FILE()); } catch (e) {} return; }
  const age = Date.now() - (Number(s.savedAt) || 0);
  if (!(s.savedAt > 0) || age > STALE_MS) { salvageInterruptedSession(s, 'app closed mid-focus'); return; }
  // Pure pre-flight check (shared with the engine so both agree on the math):
  // a running FOCUS whose entire length elapsed while the app was dead has
  // nothing left to resume — bank whatever was actually focused and move on.
  const chk = SessionEngine.recoverable(s);
  if (!chk.ok) { salvageInterruptedSession(s, chk.why); return; }
  // Otherwise: restore exactly where it was left off. session.restore()
  // rebuilds the countdown from the saved state (dead time is free), starts
  // the tick loop, and re-derives the iron flag — then we keep persisting so
  // another kill can be recovered again. Wrapped in try/catch so even a bug
  // or a half-corrupt snapshot can never block the app from booting: worst
  // case we fall back to salvaging the earned minutes.
  let st = null;
  try { st = session.restore(s); } catch (e) { console.error('[recover]', e); st = null; }
  if (!st || !st.active) { salvageInterruptedSession(s, 'app closed mid-focus'); return; }
  session._persist();
  lifeLog('session-restored', { phase: st.phase, remainingSec: st.remainingSec });
  store.mutate((d) => addFeed(d, { kind: 'info', text: T('main.feed.restored') }));
}

/* ---------- one-time migration from the old folder-based install ---------- */
function migrateOldData() {
  try {
    if (!app.isPackaged) return;
    const target = path.join(DATA_DIR, 'data.json');
    if (fs.existsSync(target)) return;
    const dl = app.getPath('downloads');
    const cands = [
      path.join(dl, 'studynook', 'studynook', 'data', 'data.json'),
      path.join(dl, 'studynook', 'data', 'data.json')
    ];
    for (const c of cands) {
      if (fs.existsSync(c)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.copyFileSync(c, target);
        console.log('[migrate] imported your data from', c);
        return;
      }
    }
  } catch (e) { console.error('[migrate]', e.message); }
}

/* ---------- daily automatic backups (keep newest 7) ---------- */
function writeBackup() {
  const dir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const name = `backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.json`;
  fs.writeFileSync(path.join(dir, name), JSON.stringify(store.data, null, 2));
  return name;
}
function ensureBackups() {
  try {
    const dir = path.join(DATA_DIR, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const p = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    let all = fs.readdirSync(dir).filter((f) => f.startsWith('backup-')).sort();
    if (!all.some((f) => f.includes(today))) { writeBackup(); all = fs.readdirSync(dir).filter((f) => f.startsWith('backup-')).sort(); }
    while (all.length > 7) fs.unlinkSync(path.join(dir, all.shift()));
  } catch (e) { console.error('[backup]', e.message); }
}

/* Everything the extracted modules (ipc.js, watch.js, snapshot.js) need.
   Live objects (store, session, guardian, server) are added in whenReady. */
const ctx = {
  app, ipcMain, shell, dialog, nativeTheme, DATA_DIR, SOUNDS_DIR, EXT_DIR,
  extConnected: false,     // is the Chrome extension talking to the bridge?
  gateCleared: false,      // iron session: window-close gate passed?
  T, notify, broadcast, pushSnapshot, addFeed, lifeLog, snapshotFor,
  grantXp, sendRewardEvents, grantAchievements, writeBackup, applyLoginItem, buildTrayMenu, hideReminderWindow, quitApp: () => app.quit(),
  win: () => win
};

/* ------------------------------------------------------------
   Boot
------------------------------------------------------------ */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

app.whenReady().then(() => {
  // A second copy must not boot at all: it would race the first for the data
  // files, session.json recovery and the bridge port while it quits.
  if (!gotLock) return;
  if (process.platform === 'win32') app.setAppUserModelId('StudyNook');
  // Sounds are optional. A read-only folder here used to throw out of boot and
  // leave the student with no window at all.
  try { fs.mkdirSync(SOUNDS_DIR, { recursive: true }); } catch (e) { console.error('[sounds]', e.message); }
  migrateOldData();
  store = new Store(path.join(DATA_DIR, 'data.json'));
  lifeLog('boot', { version: app.getVersion(), packaged: app.isPackaged, afterWatchdogRelaunch: process.argv.includes('--restarted-by-watchdog') });
  progress.refreshStreak(store.data);
  ensureBackups();
  applyLoginItem();
  // "System" theme: follow Windows live; every window re-resolves from the snapshot.
  nativeTheme.on('updated', () => pushSnapshot());

  /* --- headless smoke-test hook (used by `npm run smoke`) --- */
  if (process.env.NOOK_SMOKE) {
    const logFile = path.join(DATA_DIR, 'smoke.log');
    const slog = (m) => { try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(logFile, new Date().toISOString() + ' ' + m + '\n'); } catch (e) {} };
    global.__slog = slog;
    setTimeout(() => { slog('SMOKE OK — app booted, quitting'); store.saveNow(); app.quit(); }, 6000);
    process.on('uncaughtException', (e) => { slog('SMOKE CRASH ' + (e && e.stack || e)); app.exit(1); });
  }

  session = new SessionEngine({
    getSettings: () => store.data.settings.timer,
    isIronLocked: () => Iron.isLocked(store.data.settings.timer.ironLockedUntil, Date.now()),
    onTick: (st) => broadcast('tick', st),
    onState: () => pushSnapshot(),
    onPhaseEnd: (info) => handlePhaseEnd(info),
    persist: (st) => {
      try {
        const f = SESSION_FILE();
        if (!st) { if (fs.existsSync(f)) fs.unlinkSync(f); return; }
        fs.mkdirSync(DATA_DIR, { recursive: true });
        writeFileAtomic(f, JSON.stringify(st));
      } catch (e) {}
    }
  });

  // After an "End task" kill / crash: resume the persisted session exactly
  // where it left off (dead time doesn't count) instead of acting like it
  // never started. Must run after `session` exists — restore() starts the
  // tick loop and pushes the fresh snapshot to the window once it opens.
  recoverInterruptedSession();

  guardian = new Guardian({
    store,
    session,
    onEvent: (ev) => handleGuardEvent(ev),
    showReminder: (payload) => { showReminderWindow(payload); broadcast('reminder', payload); },
    hideReminder: () => { hideReminderWindow(); broadcast('reminder', null); }
  });
  guardian.start();

  server = new SyncServer({
    store, session,
    guardianArmed: () => guardian.isArmed(),
    onExtStatus: (ok) => { ctx.extConnected = ok; pushSnapshot(); }
  });
  server.start();
  Object.assign(ctx, { store, session, guardian, server });
  ctx.snapshots = createSnapshots(ctx);
  const watch = createWatch(ctx);
  setInterval(watch.pollExtStatus, 10000);

  createMainWindow();
  createTray();
  screen.on('display-metrics-changed', clampMini);
  screen.on('display-removed', clampMini);
  setInterval(() => { if (store.data.settings.miniWindow && session.isActive()) ensureMini(); else hideMini(); watch.ensureWatchdog(); }, 2000);

  registerIpc(ctx);
});

app.on('window-all-closed', () => { lifeLog('window-all-closed'); app.quit(); });
app.on('before-quit', () => {
  lifeLog('before-quit', { sessionActive: !!(session && session.isActive()) });
  try { guardian.stop(); server.stop(); store.saveNow(); } catch (e) {}
});
process.on('uncaughtException', (e) => {
  console.error('[crash]', e);
  lifeLog('uncaughtException', String((e && e.message) || e));
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.appendFileSync(path.join(DATA_DIR, 'crash.log'), new Date().toISOString() + ' ' + (e && e.stack || e) + '\n'); } catch (_) {}
});

/* ------------------------------------------------------------
   Windows
------------------------------------------------------------ */
function baseWindowOpts(extra) {
  return Object.assign({
    icon: ASSET('icon-256.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  }, extra);
}

function createMainWindow() {
  win = new BrowserWindow(baseWindowOpts({
    width: 1180, height: 780, minWidth: 960, minHeight: 640,
    frame: false, title: 'StudyNook', backgroundColor: resolvedTheme() === 'dark' ? '#171513' : '#F7F5F2'
  }));
  win.loadFile(UI('index.html'));
  // Started at sign-in → stay in the tray, unless a session was just restored.
  win.on('show', () => pushSnapshot());
  win.on('restore', () => pushSnapshot());
  win.once('ready-to-show', () => { if (!START_HIDDEN || session.isActive()) win.show(); });
  win.on('closed', () => { win = null; });
  // If the UI process crashes mid-session the student is left with a blank,
  // unclosable window and no timer. Reload it (the snapshot is re-pulled).
  win.webContents.on('render-process-gone', (_e, details) => {
    if (details && details.reason === 'clean-exit') return;
    lifeLog('render-process-gone', details && details.reason);
    if (rendererReloads++ >= 5) return;   // not a crash loop
    setTimeout(() => { if (win && !win.isDestroyed()) win.reload(); }, 500);
  });
  // Iron session: Alt+F4 / OS close during focus → open the gate instead.
  // Any running session: the window is unclosable (nook stays open).
  // Any existing session (RUNNING OR PAUSED) makes the window unclosable —
  // pausing only stops the clock, it must never let you bail out of the
  // nook mid-promise. Iron focus additionally routes through the typed
  // good-bye gate (iron.js) before an early end is allowed.
  win.on('close', (e) => {
    if (!store) return;
    if (session && session.isIronFocus() && !ctx.gateCleared) {
      e.preventDefault();
      broadcast('iron-gate', {});
      return;
    }
    if (session && session.isActive()) {
      e.preventDefault();
      broadcast('close-blocked', {});
    }
  });
  if (global.__slog) {
    win.webContents.on('console-message', (_e, level, message) => global.__slog('renderer[' + level + ']: ' + message));
    win.webContents.on('did-fail-load', (_e, code, desc) => global.__slog('renderer FAIL: ' + code + ' ' + desc));
  }
  /* SECURITY FIX (defense-in-depth): window.open used to hand ANY url string
     straight to shell.openExternal — a renderer bug or hostile link could
     launch non-browser handlers (file:, custom schemes). Same http(s) rule
     the audited open:url handler already enforces; legit links unchanged. */
  const safeExternal = (url) => { if (/^https?:\/\//i.test(String(url || ''))) shell.openExternal(String(url)); };
  win.webContents.setWindowOpenHandler(({ url }) => { safeExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => {
    // The UI is loaded from file:// and never navigates on its own; anything
    // else (http/file pushes from a compromised page) is refused.
    if (!/^file:/.test(String(url || ''))) e.preventDefault();
  });
}

function ensureMini() {
  if (miniWin && !miniWin.isDestroyed()) { if (!miniWin.isVisible()) miniWin.show(); return; }
  miniWin = new BrowserWindow(baseWindowOpts({
    width: 250, height: 74, frame: false, alwaysOnTop: true, resizable: false,
    skipTaskbar: true, transparent: true, hasShadow: false, focusable: false
  }));
  miniWin.loadFile(UI('mini.html'));
  miniWin.once('ready-to-show', () => { clampMini(); miniWin.show(); });
  // The pill can be dragged by its icon; never let it leave the screen.
  miniWin.on('will-move', (e, next) => {
    const fit = clampToArea(next, screen.getDisplayMatching(next).workArea);
    if (fit.x !== next.x || fit.y !== next.y) { e.preventDefault(); miniWin.setBounds(fit); }
  });
  miniWin.on('moved', clampMini);
  miniWin.on('closed', () => { miniWin = null; });
}
function clampMini() {
  if (!miniWin || miniWin.isDestroyed()) return;
  const b = miniWin.getBounds(), fit = clampToArea(b, screen.getDisplayMatching(b).workArea);
  if (fit.x !== b.x || fit.y !== b.y) miniWin.setBounds(fit);
}
function hideMini() { if (miniWin && !miniWin.isDestroyed() && miniWin.isVisible()) miniWin.hide(); }

function showReminderWindow(payload) {
  if (!remindWin || remindWin.isDestroyed()) {
    remindWin = new BrowserWindow(baseWindowOpts({
      width: 430, height: 250, frame: false, alwaysOnTop: true, resizable: false,
      skipTaskbar: false, center: true, backgroundColor: resolvedTheme() === 'dark' ? '#211E1B' : '#FFFFFF'
    }));
    remindWin.loadFile(UI('reminder.html'));
    remindWin.on('closed', () => { remindWin = null; });
  }
  if (!remindWin.isVisible()) remindWin.show();
  remindWin.focus();
}
function hideReminderWindow() { if (remindWin && !remindWin.isDestroyed() && remindWin.isVisible()) remindWin.hide(); }

function createTray() {
  const img = nativeImage.createFromPath(ASSET('icon-32.png'));
  if (img.isEmpty()) return; // assets missing → skip tray gracefully
  tray = new Tray(img.resize({ width: 16, height: 16 }));
  tray.setToolTip('StudyNook');
  tray.on('click', () => { win && (win.show(), win.focus()); });
  buildTrayMenu();
}
/** (Re)built on start and whenever the language changes. */
function buildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: T('tray.open'), click: () => { win && (win.show(), win.focus()); } },
    { label: T('tray.start'), click: () => { session.isActive() ? session.resume() : session.start({ mode: 'pomodoro' }); } },
    { label: T('tray.pause'), click: () => session.pause() },
    { label: T('tray.stop'), click: () => session.stop({ abandon: false }) },
    { type: 'separator' },
    { label: T('tray.breathe'), click: () => { guardian.pauseFor(5); pushSnapshot(); } },
    { type: 'separator' },
    { label: T('tray.quit'), click: () => {
      // isActive() — a PAUSED session is still a session. Quitting (or the
      // window-close gate it relies on) must wait until the focus truly ends.
      if (session && session.isActive()) { notify(T('main.n.running.t'), T('main.n.running.d')); return; }
      app.quit();
    } }
  ]));
}
/** "Start with Windows" (installed app only — a dev run would register electron.exe). */
function applyLoginItem() {
  if (!app.isPackaged) return;
  try { app.setLoginItemSettings({ openAtLogin: !!store.data.settings.startWithWindows, args: ['--hidden'] }); }
  catch (e) { lifeLog('login-item-failed', e.message); }
}

/* ------------------------------------------------------------
   Session outcomes → XP, streaks, achievements, feed
------------------------------------------------------------ */
function grantXp(d, amount) {
  const events = [];
  d.xp = (d.xp || 0) + amount;
  const lvl = progress.levelFromXp(d.xp);
  if (lvl > (d.level || 1)) {
    d.level = lvl;
    events.push({ type: 'levelup', level: lvl, title: progress.titleForLevel(lvl) });
  }
  events.push({ type: 'xp', amount });
  return events;
}

function sendRewardEvents(events) {
  for (const ev of events || []) {
    if (ev.type === 'achievement') broadcast('reward', { kind: 'achievement', id: ev.id, emoji: ev.emoji, name: ev.name, desc: ev.desc });
    else if (ev.type === 'levelup') broadcast('reward', { kind: 'levelup', level: ev.level, title: ev.title });
    else if (ev.type === 'stageup') broadcast('reward', { kind: 'stageup', stage: ev.stage });
  }
}

function killCount(kills) { return (kills || []).reduce((a, k) => a + k.count, 0); }

function handlePhaseEnd(info) {
  const d = store.data;
  const now = Date.now();

  if (info.phase === 'focus' && info.completed) {
    const res = store.mutate((dd) => {
      const r = progress.focusRewards(dd, info.minutes, true, { kills: killCount(info.kills) });
      dd.sessions.unshift({ id: now, start: info.startedAt, end: now, min: info.minutes, completed: true, kills: info.kills, taskId: info.taskId, label: info.label, mode: info.mode });
      if (dd.sessions.length > 500) dd.sessions.length = 500;
      const day = progress.dayStr();
      (dd.daily[day] = dd.daily[day] || { min: 0, sessions: 0, kills: 0, tasks: 0 }).kills += killCount(info.kills);
      if (info.taskId) { const t = dd.tasks.find((t) => t.id === info.taskId); if (t) t.pomosDone = (t.pomosDone || 0) + 1; }
      addFeed(dd, { t: now, kind: 'good', xp: r.xpGained, text: T(info.label ? 'main.feed.focusDoneLabel' : 'main.feed.focusDone', { min: mins(info.minutes), label: info.label }) });
      return r;
    });
    sendRewardEvents(res.events);
    broadcast('session-event', { kind: 'focus-complete', minutes: info.minutes, xp: res.xpGained, kills: info.kills });
    notify(T('main.n.focusDone.t'), T('main.n.focusDone.d', { min: mins(info.minutes), name: d.pet.name }), 'focusEnd');
  }
  else if (info.phase === 'focus' && !info.completed) {
    // ended early (gave up / stopped mid-round)
    /* Strict mode decides XP — and an IRON session is always strict while
       it runs (Iron.effectiveTimer), even if the saved switch says off.
       The UI shows the same view through the same pure helper, so there is
       no "gentle on screen, strict in background" mismatch. */
    const effT = Iron.effectiveTimer(d.settings.timer, session && session.ironAtStart === true);
    const strict = effT.strict && info.abandon;
    const minutes = strict ? 0 : info.minutes;
    const res = store.mutate((dd) => {
      if (info.abandon) dd.counters.abandons = (dd.counters.abandons || 0) + 1;
      const r = progress.focusRewards(dd, minutes, false, { kills: killCount(info.kills), abandoned: true });
      if (info.minutes > 0) {
        dd.sessions.unshift({ id: now, start: info.startedAt, end: now, min: info.minutes, completed: false, kills: info.kills, taskId: info.taskId, label: info.label, mode: info.mode });
        if (dd.sessions.length > 500) dd.sessions.length = 500;
      }
      addFeed(dd, { t: now, kind: strict ? 'warn' : 'good', xp: strict ? 0 : r.xpGained, text: T(strict ? 'main.feed.endedStrict' : 'main.feed.ended', { min: mins(info.minutes) }) });
      return r;
    });
    sendRewardEvents(res.events);
    broadcast('session-event', { kind: 'abandon', minutes: info.minutes });
  }
  else if (info.phase === 'short' || info.phase === 'long') {
    if (info.completed) {
      broadcast('session-event', { kind: 'break-end', phase: info.phase });
      notify(T('main.n.breakDone.t'), T('main.n.breakDone.d'), 'breakEnd');
      store.mutate((dd) => addFeed(dd, { t: now, kind: 'info', text: T('main.feed.breakDone') }));
    } else {
      broadcast('session-event', { kind: 'break-skipped' });
    }
  }
  else if (info.phase === 'session-stop') {
    handlePhaseEnd(Object.assign({}, info, { phase: 'focus', completed: false }));
    return;
  }
  pushSnapshot();
}

function handleGuardEvent(ev) {
  const now = Date.now();
  if (ev.type === 'kill') {
    store.mutate((d) => {
      const day = progress.dayStr();
      (d.daily[day] = d.daily[day] || { min: 0, sessions: 0, kills: 0, tasks: 0 }).kills += ev.count;
      addFeed(d, { t: now, kind: 'info', text: T('main.feed.closedApp', { app: ev.label, n: ev.count }) });
    });
    broadcast('guard', ev);
    grantAchievements({});
    pushSnapshot();
  } else if (ev.type === 'warn') {
    broadcast('guard', ev);
  }
}

function grantAchievements(ctx) {
  const res = store.mutate((d) => {
    const ids = progress.evaluateAchievements(d, ctx || {});
    for (const id of ids) d.achievements[id] = new Date().toISOString();
    return ids;
  });
  const byId = progress.achievementsById();
  for (const id of res) {
    const a = byId[id];
    broadcast('reward', { kind: 'achievement', id, emoji: a.emoji, name: a.name, desc: a.desc });
    store.mutate((d) => addFeed(d, { kind: 'good', text: T('main.feed.achievement', { name: T('ach.' + a.id + '.name') }) }));
  }
  return res;
}

/** kind: 'focusEnd' | 'breakEnd' | 'blocker' (Settings → Notifications); no kind = always shown. */
function notify(title, body, kind) {
  const prefs = (store && store.data.settings.notify) || {};
  if (kind && prefs[kind] === false) return;
  try {
    if (Notification.isSupported()) new Notification({ title, body, icon: ASSET('icon-32.png') }).show();
  } catch (e) {}
}

/* ------------------------------------------------------------
   Pushing state to the windows — each one only gets what it draws
   (see snapshot.js): full for the main window, tiny for the mini
   timer and the warning card. A main window hidden to the tray is
   skipped and repainted when it is shown again.
------------------------------------------------------------ */
const alive = (w) => !!w && !w.isDestroyed();
let pushTimer = null;
function pushSnapshot() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (!ctx.snapshots) return;
    if (alive(win) && win.isVisible() && !win.isMinimized()) win.webContents.send('snapshot', ctx.snapshots.full());
    if (alive(miniWin)) miniWin.webContents.send('snapshot', ctx.snapshots.mini());
    if (alive(remindWin)) remindWin.webContents.send('snapshot', ctx.snapshots.reminder());
  }, 120);
}
function broadcast(channel, payload) {
  // the 1 s timer tick is only drawn by the main window and the mini timer
  const targets = channel === 'tick' ? [win, miniWin] : [win, miniWin, remindWin];
  for (const w of targets) if (alive(w)) w.webContents.send(channel, payload);
}
/** get-snapshot: answer each window with its own, right-sized state. */
function snapshotFor(sender) {
  if (alive(miniWin) && sender === miniWin.webContents) return ctx.snapshots.mini();
  if (alive(remindWin) && sender === remindWin.webContents) return ctx.snapshots.reminder();
  return ctx.snapshots.full();
}
