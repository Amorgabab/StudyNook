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

const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, shell, nativeImage, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const { Store } = require('./store.js');
const { SessionEngine } = require('./session.js');
const Iron = require('../shared/iron.js');
const { Guardian } = require('./guardian.js');
const { SyncServer } = require('./sync-server.js');
const processes = require('./processes.js');
const progress = require('../shared/progress.js');

const catalog = require('../shared/catalog.js');
const NookRules = require('../../extension/rules.js');
const NookLinks = require('../shared/links.js');
const dedupe = (arr) => arr.filter((x, i) => arr.indexOf(x) === i);

const APP_ROOT = path.join(__dirname, '..', '..');          // project folder
// Packaged (installed) apps keep data in the user's AppData room; dev keeps it in the project folder.
const DATA_DIR = app.isPackaged ? app.getPath('userData') : path.join(APP_ROOT, 'data');
const SOUNDS_DIR = app.isPackaged ? path.join(app.getPath('userData'), 'sounds') : path.join(APP_ROOT, 'assets', 'sounds');
const EXT_DIR = app.isPackaged ? path.join(process.resourcesPath, 'extension') : path.join(APP_ROOT, 'extension');
const UI = (f) => path.join(__dirname, '..', 'ui', f);
const ASSET = (f) => path.join(APP_ROOT, 'assets', f);

let store, session, guardian, server;
let win = null, miniWin = null, remindWin = null, tray = null;
let extConnected = false;
let lastAmbientAward = 0;
let gateCleared = false;   // iron session: window-close gate passed?
const SOUND_IDS = new Set(['rain', 'waves', 'fire', 'cafe']);

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
  store.mutate((d) => {
    d.feed = d.feed || [];
    d.feed.unshift({
      t: Date.now(), emoji: '⚡', kind: 'warn',
      text: iron
        ? `Previous session was interrupted (${why}) — Iron Session: no credit for ${minutes} min`
        : `Previous session was interrupted (${why}) — ${minutes} focused min credited`
    });
    if (d.feed.length > 40) d.feed.length = 40;
  });
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
  store.mutate((d) => {
    d.feed = d.feed || [];
    d.feed.unshift({
      t: Date.now(), emoji: '🕯️', kind: 'info',
      text: 'StudyNook restarted after closing unexpectedly — your focus session picked up right where it left off'
    });
    if (d.feed.length > 40) d.feed.length = 40;
  });
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

/* ------------------------------------------------------------
   Boot
------------------------------------------------------------ */
if (!app.requestSingleInstanceLock()) { app.quit(); }
app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('StudyNook');
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });   // sounds drop-in folder always exists
  migrateOldData();
  store = new Store(path.join(DATA_DIR, 'data.json'));
  progress.refreshStreak(store.data);
  ensureBackups();

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
        fs.writeFileSync(f, JSON.stringify(st));
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
    onExtStatus: (ok) => { extConnected = ok; pushSnapshot(); }
  });
  server.start();
  setInterval(pollExtStatus, 10000);

  createMainWindow();
  createTray();
  setInterval(() => { if (store.data.settings.miniWindow && session.isActive()) ensureMini(); else hideMini(); }, 2000);

  registerIpc();
});

app.on('window-all-closed', () => { app.quit(); });
app.on('before-quit', () => {
  try { guardian.stop(); server.stop(); store.saveNow(); } catch (e) {}
});
process.on('uncaughtException', (e) => {
  console.error('[crash]', e);
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
    frame: false, title: 'StudyNook', backgroundColor: '#FDF6EC'
  }));
  win.loadFile(UI('index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });
  // Iron session: Alt+F4 / OS close during focus → open the gate instead.
  // Any running session: the window is unclosable (nook stays open).
  win.on('close', (e) => {
    if (!store) return;
    if (session && session.isIronFocus() && !gateCleared) {
      e.preventDefault();
      broadcast('iron-gate', {});
      return;
    }
    if (session && session.isRunning()) {
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
  miniWin.once('ready-to-show', () => miniWin.show());
  miniWin.on('closed', () => { miniWin = null; });
}
function hideMini() { if (miniWin && !miniWin.isDestroyed() && miniWin.isVisible()) miniWin.hide(); }

function showReminderWindow(payload) {
  if (!remindWin || remindWin.isDestroyed()) {
    remindWin = new BrowserWindow(baseWindowOpts({
      width: 430, height: 250, frame: false, alwaysOnTop: true, resizable: false,
      skipTaskbar: false, center: true, backgroundColor: '#FFFCF6'
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
  const menu = Menu.buildFromTemplate([
    { label: 'Open StudyNook', click: () => { win && (win.show(), win.focus()); } },
    { label: 'Start / resume focus', click: () => { session.isActive() ? session.resume() : session.start({ mode: 'pomodoro' }); } },
    { label: 'Pause', click: () => session.pause() },
    { label: 'Stop session', click: () => session.stop({ abandon: false }) },
    { type: 'separator' },
    { label: 'Let me breathe (pause guard 5 min)', click: () => { guardian.pauseFor(5); pushSnapshot(); } },
    { type: 'separator' },
    { label: 'Quit StudyNook', click: () => {
      if (session && session.isRunning()) { notify('Session running', 'End or finish your focus session before quitting StudyNook.'); return; }
      app.quit();
    } }
  ]);
  tray.setToolTip('StudyNook');
  tray.setContextMenu(menu);
  tray.on('click', () => { win && (win.show(), win.focus()); });
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
      dd.feed = dd.feed || [];
      dd.feed.unshift({ t: now, emoji: '🍅', kind: 'good', xp: r.xpGained, text: `Completed a ${info.minutes} min focus${info.label ? ' · ' + info.label : ''}` });
      if (dd.feed.length > 40) dd.feed.length = 40;
      return r;
    });
    sendRewardEvents(res.events);
    broadcast('session-event', { kind: 'focus-complete', minutes: info.minutes, xp: res.xpGained, kills: info.kills });
    notify('Focus complete! 🌷', `${info.minutes} minutes of cozy deep work. Break time, ${d.pet.name} is proud.`);
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
      dd.feed = dd.feed || [];
      dd.feed.unshift({ t: now, emoji: strict ? '🌧️' : '🌤️', kind: strict ? 'warn' : 'good', xp: strict ? 0 : r.xpGained, text: strict ? `Session ended early — strict mode, no XP this time (${info.minutes} min)` : `Session ended early after ${info.minutes} min (XP for the time focused)` });
      if (dd.feed.length > 40) dd.feed.length = 40;
      return r;
    });
    sendRewardEvents(res.events);
    broadcast('session-event', { kind: 'abandon', minutes: info.minutes });
  }
  else if (info.phase === 'short' || info.phase === 'long') {
    if (info.completed) {
      broadcast('session-event', { kind: 'break-end', phase: info.phase });
      notify('Break over ☀️', 'Stretch, sip water, and begin the next round when ready.');
      store.mutate((dd) => { dd.feed = dd.feed || []; dd.feed.unshift({ t: now, emoji: '☀️', kind: 'info', text: 'Break finished — next round is waiting' }); if (dd.feed.length > 40) dd.feed.length = 40; });
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
      d.feed = d.feed || [];
      d.feed.unshift({ t: now, emoji: '🧸', kind: 'info', text: `Gently closed ${ev.label} (${ev.count} process${ev.count > 1 ? 'es' : ''})` });
      if (d.feed.length > 40) d.feed.length = 40;
    });
    broadcast('guard', ev);
    const earned = grantAchievements({});
    void earned;
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
    store.mutate((d) => { d.feed = d.feed || []; d.feed.unshift({ t: Date.now(), emoji: a.emoji, kind: 'good', text: 'Achievement unlocked: ' + a.name }); if (d.feed.length > 40) d.feed.length = 40; });
  }
  return res;
}

function notify(title, body) {
  try {
    if (Notification.isSupported()) new Notification({ title, body, icon: ASSET('icon-32.png') }).show();
  } catch (e) {}
}

function pollExtStatus() {
  const ok = server.connected();
  if (ok !== extConnected) { extConnected = ok; pushSnapshot(); }
}

/* ------------------------------------------------------------
   Snapshot → everything the UI needs, in one object
------------------------------------------------------------ */
function buildSnapshot() {
  const d = store.data;
  return {
    now: Date.now(),
    platform: process.platform,
    appVersion: require('../../package.json').version,
    data: {
      v: d.v, profile: d.profile, pet: d.pet, xp: d.xp, level: d.level,
      streak: d.streak, settings: d.settings, apps: d.apps, sites: d.sites,
      subjects: d.subjects, notes: d.notes,
      tasks: d.tasks, sessions: d.sessions.slice(0, 60), daily: d.daily,
      counters: d.counters, achievements: d.achievements, onboarded: d.onboarded,
      feed: d.feed || []
    },
    session: session.publicState(),
    guardian: { armed: guardian.isArmed(), pausedMinLeft: guardian.pausedMinLeft() },
    ext: { connected: extConnected, lastSeen: d.ext.lastSeen, version: d.ext.version, code: d.ext.code, bridgeError: server.error || null },
    extPath: EXT_DIR,
    soundsPath: SOUNDS_DIR,
    pendingReminder: guardian.pendingReminder
  };
}
let pushTimer = null;
function pushSnapshot() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => { pushTimer = null; broadcast('snapshot', buildSnapshot()); }, 120);
}
function broadcast(channel, payload) {
  for (const w of [win, miniWin, remindWin]) {
    if (w && !w.isDestroyed()) w.webContents.send(channel, payload);
  }
}

/* ------------------------------------------------------------
   IPC — every button in the UI lands here
------------------------------------------------------------ */
function registerIpc() {
  const H = (ch, fn) => ipcMain.handle(ch, async (_e, payload) => {
    const r = await fn(payload || {});
    return r === undefined ? null : r;
  });

  H('get-snapshot', () => buildSnapshot());

  /* ---- sessions ---- */
  H('session:start', (p) => {
    gateCleared = false;
    const task = p.taskId ? store.data.tasks.find((t) => t.id === p.taskId) : null;
    const st = session.start({ mode: p.mode || 'pomodoro', freeMin: p.freeMin || 0, taskId: p.taskId || null, label: task ? task.text : (p.label || '') });
    store.mutate((d) => { d.feed = d.feed || []; d.feed.unshift({ t: Date.now(), emoji: '🌱', kind: 'info', text: `Focus session started (${st.mode === 'free' ? 'free' : 'pomodoro'})${task ? ' · ' + task.text : ''}` }); if (d.feed.length > 40) d.feed.length = 40; });
    pushSnapshot();
    return st;
  });
  H('session:pause', () => session.pause());
  H('session:resume', () => session.resume());
  H('session:skip', () => session.skip());
  H('session:stop', (p) => session.stop({ abandon: !!p.abandon }));

  /* ---- settings & profile ---- */
  H('settings:set', (p) => {
    const Iron = require('../shared/iron.js');
    store.mutate((d) => {
      // Iron lock: enabling starts a self-lock; disabling is refused while
      // the lock runs (Settings UI hides the switch anyway). Turning Iron on
      // also hardens the guard + strict mode — and remembers your pre-iron
      // guard choices so they can be restored when the promise ends.
      // Sites are never touched: "during focus / always" stays YOUR choice.
      if (p.section === 'timer' && p.values && p.values.iron !== undefined) {
        const t = d.settings.timer;
        const locked = Iron.isLocked(t.ironLockedUntil, Date.now());
        if (p.values.iron && !t.iron) {
          d.__ironSaved = { guard: Object.assign({}, d.settings.guardian) };
          t.ironLockedUntil = Iron.makeLock(Date.now(), t.ironLockDays);
        }
        if (!p.values.iron && locked) return;   // nope.
        if (!p.values.iron && t.iron && d.__ironSaved) {
          // Iron off for real → give back the gentle warn / session-only choices
          Object.assign(d.settings.guardian, d.__ironSaved.guard || {});
          delete d.__ironSaved;
        }
      }
      const sec = d.settings[p.section];
      /* SECURITY FIX: settings:set used to Object.assign renderer values with
         no type/range checks, so a buggy or hostile renderer could persist
         e.g. guardian.scanSec = 0.000001 (verified: it survived save() and
         ran until restart). Clamp known fields through the SAME num()/str()
         helpers sanitizeData uses at load/import — legitimate UI values pass
         through untouched; only out-of-range/garbage gets corrected. */
      {
        const { num } = require('./store.js');
        let vals;
        if (p.section === 'theme' || p.section === 'miniWindow' || p.section === 'bridgeAllowOrigins') {
          // these three sections send a RAW VALUE, not an object (UI contract)
          vals = { [p.section]: p.values };
        } else {
          vals = p.values && typeof p.values === 'object' && !Array.isArray(p.values) ? p.values : {};
        }
        const clean = {};
        for (const k of Object.keys(vals)) {
          if (!Object.prototype.hasOwnProperty.call(vals, k)) continue;   // never copy inherited props
          let v = vals[k];
          if (p.section === 'timer') {
            if (k === 'workMin') v = num(v, 25, 1, 600);
            else if (k === 'shortMin') v = num(v, 5, 1, 120);
            else if (k === 'longMin') v = num(v, 15, 1, 240);
            else if (k === 'rounds') v = num(v, 4, 1, 24);
            else if (k === 'ironLockDays') v = num(v, 1, 1, 365);
            else if (k === 'mode') v = (v === 'free' || v === 'pomodoro') ? v : 'pomodoro';
            else if (k === 'iron' || k === 'strict' || k === 'autoStartBreaks' || k === 'autoStartFocus') v = !!v;
            else if (k === 'ironLockedUntil') v = num(v, 0, 0, 8.64e15);
          } else if (p.section === 'guardian') {
            if (k === 'enabled' || k === 'onlyDuringSessions') v = !!v;
            else if (k === 'mode') v = (v === 'allow') ? 'allow' : 'block';
            else if (k === 'action') v = ['gentle', 'instant', 'remind'].includes(v) ? v : 'gentle';
            else if (k === 'graceSec') v = num(v, 15, 1, 600);
            else if (k === 'scanSec') v = num(v, 3, 1, 60);
          } else if (p.section === 'sound') {
            if (k === 'ui' || k === 'chimes') v = !!v;
            else if (k === 'volume') v = num(v, 0.6, 0, 1);
          } else if (k === 'theme') v = ['auto', 'light', 'dark'].includes(v) ? v : 'auto';
          else if (k === 'miniWindow' || k === 'bridgeAllowOrigins') v = !!v;
          clean[k] = v;
        }
        if (p.section === 'theme' || p.section === 'miniWindow' || p.section === 'bridgeAllowOrigins') {
          d.settings[p.section] = clean[p.section];
        } else if (sec && typeof sec === 'object' && !Array.isArray(sec)) {
          Object.assign(sec, clean);
        }
      }
      // Iron strictness: timer/guardian edits are filtered through the same
      // pure helpers the engine and the UI use — you cannot soften them
      // mid-promise, and what gets stored is exactly what will run.
      // (Sites are deliberately NOT filtered — free will there.)
      if (Iron.resolveIron(d.settings.timer.iron, d.settings.timer.ironLockedUntil, Date.now())) {
        if (p.section === 'guardian') Object.assign(d.settings.guardian, Iron.effectiveGuard(d.settings.guardian, true));
        if (p.section === 'timer') Object.assign(d.settings.timer, Iron.effectiveTimer(d.settings.timer, true));
      }
    });
    if (p.section === 'guardian' || p.section === 'timer') guardian._loop();   // apply new scan interval / strictness
    pushSnapshot();
    return true;
  });
  H('profile:set', (p) => { store.mutate((d) => { d.profile.name = String(p.name || '').slice(0, 40); }); pushSnapshot(); return true; });
  H('pet:rename', (p) => { store.mutate((d) => { d.pet.name = String(p.name || 'Mochi').slice(0, 20); }); pushSnapshot(); return true; });
  H('pet:pet', () => {
    const res = store.mutate((d) => { d.pet.pets = (d.pet.pets || 0) + 1; d.counters.pets = (d.counters.pets || 0) + 1; return progress.evaluateAchievements(d, {}); });
    const byId = progress.achievementsById();
    for (const id of res) { store.mutate((d) => { d.achievements[id] = new Date().toISOString(); }); broadcast('reward', { kind: 'achievement', id, emoji: byId[id].emoji, name: byId[id].name, desc: byId[id].desc }); }
    pushSnapshot();
    return { pets: store.data.counters.pets };
  });

  /* ---- tasks ---- */
  H('tasks:add', (p) => {
    const payload = (p && typeof p === 'object') ? p : {};
    const TaskDays = require('../shared/taskdays.js');
    const { normAt } = require('./store.js'); // sanitizer-owned time validation — one source of truth
    const t = { id: 't' + Date.now() + Math.floor(Math.random() * 999), text: String(payload.text || '').slice(0, 200), subject: String(payload.subject || '').slice(0, 40), est: Math.max(1, parseInt(payload.est, 10) || 1), min: Math.max(0, parseInt(payload.min, 10) || 0), done: false, pomosDone: 0, date: null, createdAt: Date.now(), completedAt: null };
    if (!t.text) return null;
    // A planned day is part of the task now — optional, one field, no second store.
    if (payload.date != null && payload.date !== '') {
      const key = TaskDays.normDate(String(payload.date));
      if (!key) return null; // refuse to create a half-planned task on a bad date
      const planned = store.data.tasks.reduce((n, x) => n + (x.date ? 1 : 0), 0);
      if (planned >= TaskDays.MAX_PLANNED) return null; // sanity cap
      t.date = key;
      t.at = normAt(payload.at); // optional start time; garbage → null
    }
    store.mutate((d) => { d.tasks.unshift(t); });
    pushSnapshot();
    return t;
  });
  H('tasks:setDate', (p) => {
    // Plan a task for a calendar day ('YYYY-MM-DD'), or clear the plan with
    // date:null ("Remove from This Week" — the task itself always stays).
    // Validation is delegated to the shared pure module + store sanitizer.
    const TaskDays = require('../shared/taskdays.js');
    const { normAt } = require('./store.js');
    const payload = (p && typeof p === 'object') ? p : {};
    let key = null;
    if (payload.date != null && payload.date !== '') {
      key = TaskDays.normDate(String(payload.date));
      if (!key) return false; // reject malformed dates explicitly
    }
    const at = key ? normAt(payload.at) : null; // time only travels with a date
    let hit = false;
    store.mutate((d) => {
      const t = d.tasks.find((x) => x.id === payload.id);
      if (!t) return;
      if (key && !t.date) {
        const planned = d.tasks.reduce((n, x) => n + (x.date ? 1 : 0), 0);
        if (planned >= TaskDays.MAX_PLANNED) return; // sanity cap
      }
      t.date = key;
      t.at = at;
      hit = true;
    });
    if (hit) pushSnapshot();
    return hit;
  });
  H('tasks:unschedule', (p) => {
    // "Remove from This Week": clears ONLY the scheduling fields (date + at).
    // The task itself always stays in the list — this is not Delete.
    const payload = (p && typeof p === 'object') ? p : {};
    let hit = false;
    store.mutate((d) => {
      const t = d.tasks.find((x) => x && x.id === payload.id);
      if (!t) return;
      t.date = null;
      t.at = null;
      hit = true;
    });
    if (hit) pushSnapshot();
    return hit;
  });
  H('tasks:toggle', (p) => {
    const done = store.mutate((d) => {
      const t = d.tasks.find((t) => t.id === p.id);
      if (!t) return null;
      t.done = !t.done;
      t.completedAt = t.done ? Date.now() : null;
      if (t.done) {
        d.counters.tasksDone = (d.counters.tasksDone || 0) + 1;
        const day = progress.dayStr();
        (d.daily[day] = d.daily[day] || { min: 0, sessions: 0, kills: 0, tasks: 0 }).tasks += 1;
        return t;
      }
      return t;
    });
    if (done && done.done) {
      const evs = store.mutate((d) => grantXp(d, 5));
      sendRewardEvents(evs);
      grantAchievements({});
      store.mutate((d) => { d.feed = d.feed || []; d.feed.unshift({ t: Date.now(), emoji: '✅', kind: 'good', xp: 5, text: 'Task done: ' + done.text }); if (d.feed.length > 40) d.feed.length = 40; });
    }
    pushSnapshot();
    return true;
  });
  H('tasks:remove', (p) => { store.mutate((d) => { d.tasks = d.tasks.filter((t) => t.id !== p.id); }); pushSnapshot(); return true; });
  H('tasks:addSource', (p) => {
    const u = NookLinks.normalize(p.url);
    if (!u) return false;
    store.mutate((d) => {
      const t = d.tasks.find((t) => t.id === p.id);
      if (!t) return;
      t.sources = t.sources || [];
      if (!t.sources.some((s) => s.url === u)) t.sources.push({ url: u, addedAt: Date.now() });
    });
    pushSnapshot();
    return true;
  });
  H('tasks:removeSource', (p) => {
    store.mutate((d) => {
      const t = d.tasks.find((t) => t.id === p.id);
      if (t && t.sources) t.sources.splice(Math.max(0, parseInt(p.idx, 10) || 0), 1);
    });
    pushSnapshot();
    return true;
  });
  H('open:url', (p) => {
    const u = String(p.url || '');
    if (/^https?:\/\//i.test(u)) shell.openExternal(u);
    return true;
  });

  /* ---- Week-plan actions on tasks (same task record — no second store) ----
     The old recurring-block IPC (schedule:add/update/remove/toggle) is gone:
     planned items ARE tasks now. "Remove from This Week" is simply
     tasks:setDate with date:null — it clears the plan but keeps the task.
     "Delete Task" remains tasks:remove, which deletes it permanently. */
  H('tasks:focusNow', (p) => {
    // Start focusing right from a week-plan row. Refuses politely while a
    // session is already running so this can never hijack an active focus block.
    if (session.isRunning()) return false;
    const payload = (p && typeof p === 'object') ? p : {};
    const t = store.data.tasks.find((x) => x.id === payload.id);
    if (!t || t.done) return false;
    broadcast('focus-request', { taskId: t.id, minutes: Math.max(0, parseInt(t.min, 10) || 0) });
    return true;
  });

  /* ---- apps (blocklists / allowlists) ---- */
  H('apps:add', (p) => {
    const list = p.list === 'allow' ? 'allow' : 'block';
    const entry = { id: 'a' + Date.now() + Math.floor(Math.random() * 999), label: String(p.label || '').slice(0, 60), emoji: p.emoji || '📦', procs: (p.procs || []).map((x) => catalog.normalizeProcName(x)).filter(Boolean), enabled: true };
    if (!entry.label || !entry.procs.length) return null;
    store.mutate((d) => { d.apps[list].push(entry); });
    pushSnapshot();
    return entry;
  });
  H('apps:addCatalog', (p) => {
    const c = catalog.DISTRACTION_CATALOG.find((c) => c.id === p.id);
    if (!c) return null;
    const plat = process.platform === 'darwin' ? 'mac' : process.platform === 'linux' ? 'linux' : 'win';
    const procs = (c.procs[plat] && c.procs[plat].length ? c.procs[plat] : c.procs.win).slice();
    const list = p.list === 'allow' ? 'allow' : 'block';
    const entry = { id: 'a' + Date.now(), label: c.label, emoji: c.emoji || '📦', procs, enabled: true, catalogId: c.id };
    store.mutate((d) => {
      if (d.apps[list].some((e) => e.catalogId === c.id)) return;
      d.apps[list].push(entry);
    });
    pushSnapshot();
    return entry;
  });
  H('apps:remove', (p) => { store.mutate((d) => { const l = p.list === 'allow' ? 'allow' : 'block'; d.apps[l] = d.apps[l].filter((e) => e.id !== p.id); }); pushSnapshot(); return true; });
  H('apps:toggle', (p) => { store.mutate((d) => { const l = p.list === 'allow' ? 'allow' : 'block'; const e = d.apps[l].find((e) => e.id === p.id); if (e) e.enabled = !e.enabled; }); pushSnapshot(); return true; });
  H('apps:scan', async () => {
    const procs = await processes.listProcesses();
    const d = store.data;
    const listed = new Set();
    for (const l of ['block', 'allow']) for (const e of d.apps[l]) for (const p of e.procs) listed.add(p);
    const seen = new Set();
    const rows = [];
    for (const p of procs) {
      if (seen.has(p.norm)) continue;
      seen.add(p.norm);
      rows.push({ pid: p.pid, name: p.name, norm: p.norm, listed });
    }
    rows.sort((a, b) => a.norm.localeCompare(b.norm));
    return rows.map((r) => ({ pid: r.pid, name: r.name, norm: r.norm, listed: listed.has(r.norm) }));
  });
  H('apps:previewAllow', async () => guardian.previewAllowlist());
  H('apps:killNow', async (p) => guardian.killNow(String(p.norm || '')));

  /* ---- sites ---- */
  H('sites:set', (p) => {
    const Iron = require('../shared/iron.js');
    /* IRON FREEZE: while an iron promise runs — the multi-day switch lock
       OR a live iron focus (running or paused) — the Site-blocking ON/OFF
       switch and the Blocklist↔Allowlist mode are FROZEN. The gate is the
       shared pure helper (sitePatchAllowed); the UI draws the same locked
       state, and store.enforceIron() snaps back any drift on every write. */
    const sesNow = session.publicState();
    const ironFocusNow = !!(sesNow && sesNow.active && sesNow.phase === 'focus' && sesNow.iron);
    const patchIn = (p && p.patch && typeof p.patch === 'object' && !Array.isArray(p.patch)) ? p.patch : {};
    if (!Iron.sitePatchAllowed(store.data.settings.timer, ironFocusNow, Date.now(), patchIn)) {
      broadcast('toast', { title: '🔒 Frozen by your iron promise', msg: 'Site blocking stays ON and the block/allow mode can\u2019t flip while iron runs. Lists stay editable — that only ever strengthens the promise.' });
      pushSnapshot();
      return false;
    }
    store.mutate((d) => {
      const patch = patchIn;
      /* SECURITY FIX: enums/booleans were assigned unvalidated — a buggy or
         hostile renderer could persist mode:'banana', which makes rule
         matching fail open (nothing blocks) until the next restart. Same
         value sets the bridge's /sites endpoint and sanitizeData enforce. */
      if (typeof patch.enabled === 'boolean') d.sites.enabled = patch.enabled;
      if (patch.mode === 'block' || patch.mode === 'allow') d.sites.mode = patch.mode;
      if (patch.when === 'session' || patch.when === 'always') d.sites.when = patch.when;
      // normalizeEntry KEEPS paths (youtube.com/shorts stays youtube.com/shorts)
      for (const k of ['block', 'allow']) if (Array.isArray(patch[k])) d.sites[k] = dedupe(patch[k].map((x) => NookRules.normalizeEntry(x)).filter(Boolean)).slice(0, 500);
      /* Iron DOES freeze the two big switches now (see the gate above).
         Everything else in Sites stays FREE WILL: "during focus / always"
         and the lists themselves are yours to edit mid-promise. */
    });
    pushSnapshot();
    return true;
  });

  /* ---- subjects & notes ---- */
  H('subjects:set', (p) => {
    store.mutate((d) => { d.subjects = (Array.isArray(p.list) ? p.list : []).map((x) => String(x || '').trim()).filter(Boolean).slice(0, 40); });
    pushSnapshot();
    return true;
  });
  H('notes:add', () => {
    const n = { id: 'n' + Date.now() + Math.floor(Math.random() * 999), title: '', body: '', updatedAt: Date.now() };
    store.mutate((d) => { d.notes = d.notes || []; d.notes.unshift(n); });
    pushSnapshot();
    return n;
  });
  H('notes:save', (p) => {
    store.mutate((d) => {
      const n = (d.notes || []).find((x) => x.id === p.id);
      if (!n) return;
      if (p.title !== undefined) n.title = String(p.title).slice(0, 120);
      if (p.body !== undefined) n.body = String(p.body).slice(0, 50000);
      n.updatedAt = Date.now();
    });
    return true;   // no snapshot push: called on every keystroke
  });
  H('notes:remove', (p) => { store.mutate((d) => { d.notes = (d.notes || []).filter((x) => x.id !== p.id); }); pushSnapshot(); return true; });

  /* ---- backups & sounds ---- */
  H('data:backupNow', () => ({ name: writeBackup() }));
  H('data:openBackups', () => { shell.openPath(path.join(DATA_DIR, 'backups')); return true; });
  H('data:openSounds', () => { fs.mkdirSync(SOUNDS_DIR, { recursive: true }); shell.openPath(SOUNDS_DIR); return true; });
  H('sound:get', (p) => {
    const id = String(p.id || '');
    if (!SOUND_IDS.has(id)) return { ok: false };
    for (const ext of ['mp3', 'ogg', 'wav', 'm4a']) {
      const f = path.join(SOUNDS_DIR, id + '.' + ext);
      if (fs.existsSync(f)) {
        try { return { ok: true, base64: fs.readFileSync(f).toString('base64') }; } catch (e) { return { ok: false }; }
      }
    }
    return { ok: false };
  });

  /* ---- guardian ---- */
  H('guardian:pause', (p) => {
    const m = parseInt(p.min, 10);
    if (!guardian.pauseFor(isNaN(m) ? 5 : Math.max(0, m))) {
      // Engine-level refusal: in Iron mode the pause never stops blocking.
      broadcast('toast', { title: 'Iron mode', msg: 'The guard stays armed while your promise runs.' });
    }
    pushSnapshot();
    return true;
  });

  /* ---- data ---- */
  H('data:export', () => {
    /* SECURITY FIX: exports used to embed the LIVE bridge secret (ext.token)
       and pairing code — verified present in export output. Users email/save
       these files; anyone holding one could rewrite site blocklists or read
       session data over the localhost bridge until a manual reset. The
       running store keeps its token (extension stays paired); only the
       exported copy is redacted, exactly like the diagnostics blob already
       strips the pairing code. */
    const clone = JSON.parse(JSON.stringify(store.data));
    if (clone.ext) { clone.ext.token = ''; clone.ext.code = ''; }
    return JSON.stringify(clone, null, 2);
  });
  H('data:import', (p) => {
    if (session && session.isRunning()) { broadcast('data-blocked', {}); return false; }
    try {
      const obj2 = JSON.parse(String(p.json || ''));
      if (!obj2 || typeof obj2 !== 'object') throw new Error('bad');
      const { defaultData, deepMerge, sanitizeData } = require('./store.js');
      store.data = sanitizeData(deepMerge(defaultData(), obj2));
      store.saveNow();
      pushSnapshot();
      return true;
    } catch (e) { return false; }
  });
  H('data:reset', () => {
    if (session && session.isRunning()) { broadcast('data-blocked', {}); return false; }
    const { defaultData } = require('./store.js');
    store.data = defaultData();
    store.saveNow();
    pushSnapshot();
    return true;
  });
  H('data:openFolder', () => { shell.openPath(DATA_DIR); return true; });
  H('help:readme', () => { shell.openPath(path.join(APP_ROOT, 'README.md')); return true; });

  /* ---- misc ---- */
  H('ambient:minute', () => {
    if (Date.now() - lastAmbientAward < 55000) return true;
    lastAmbientAward = Date.now();
    store.mutate((d) => { d.counters.ambientMin = (d.counters.ambientMin || 0) + 1; });
    grantAchievements({});
    return true;
  });
  H('onboarding:done', () => { store.mutate((d) => { d.onboarded = true; }); return true; });
  H('iron:passed', () => { gateCleared = true; return true; });

  /* ---- windows ---- */
  H('win:min', () => { win && win.minimize(); return true; });
  H('win:close', () => {
    if (session && session.isRunning()) { broadcast('close-blocked', {}); return false; }
    win && win.hide();   // hiding keeps timer+guard alive in tray
    return true;
  });
  H('win:show-main', () => { if (win) { win.show(); win.focus(); } return true; });

  /* ---- reminder window buttons ---- */
  H('reminder:allowOnce', (p) => { guardian.allowOnce(String(p.norm || ''), 5); pushSnapshot(); return true; });
  H('reminder:killNow', (p) => guardian.killNow(String(p.norm || '')));
  H('reminder:dismiss', () => { hideReminderWindow(); broadcast('reminder', null); return true; });
}
