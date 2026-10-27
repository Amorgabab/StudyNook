/* ============================================================
   StudyNook · ipc.js — every button in the UI lands here
   ------------------------------------------------------------
   registerIpc(ctx) wires every ipcMain handler. The window never
   reaches main.js directly: channel names are whitelisted in
   preload.js, and this file is the other half of that contract
   (tests/ipc.test.js keeps the two lists identical).
   ctx supplies the live objects (store, session, guardian…) and the
   few helpers that still live in main.js (notify, rewards, windows).
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const Iron = require('../shared/iron.js');
const Prefs = require('../shared/uiprefs.js');
const progress = require('../shared/progress.js');
const catalog = require('../shared/catalog.js');
const NookRules = require('../../extension/rules.js');
const NookLinks = require('../shared/links.js');
const ExtFinder = require('./extfinder.js');
const processes = require('./processes.js');

const dedupe = (arr) => arr.filter((x, i) => arr.indexOf(x) === i);
const SOUND_IDS = new Set(['rain', 'waves', 'fire', 'cafe']);

/* settings:set sections that carry a raw value instead of an object */
const RAW_SECTIONS = ['theme', 'miniWindow', 'bridgeAllowOrigins', 'language', 'startWithWindows', 'dailyGoalMin'];

function registerIpc(ctx) {
  const { ipcMain, shell, store, session, guardian, T, broadcast, pushSnapshot, addFeed, grantXp, sendRewardEvents, grantAchievements, writeBackup, applyLoginItem, buildTrayMenu, DATA_DIR, SOUNDS_DIR, EXT_DIR } = ctx;
  let lastAmbientAward = 0;
  const H = (ch, fn) => ipcMain.handle(ch, async (e, payload) => {
    const r = await fn(payload || {}, e);
    return r === undefined ? null : r;
  });

  H('get-snapshot', (_p, e) => ctx.snapshotFor(e && e.sender));

  /* ---- sessions ---- */
  H('session:start', (p) => {
    ctx.gateCleared = false;
    const task = p.taskId ? store.data.tasks.find((t) => t.id === p.taskId) : null;
    const st = session.start({ mode: p.mode || 'pomodoro', freeMin: p.freeMin || 0, taskId: p.taskId || null, label: task ? task.text : (p.label || '') });
    store.mutate((d) => addFeed(d, { kind: 'info', text: T(task ? 'main.feed.startedTask' : 'main.feed.started', { mode: T(st.mode === 'free' ? 'home.mode.free' : 'home.mode.pomodoro'), task: task && task.text }) }));
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
      // the lock runs (Settings UI hides the switch anyway). The WRITE goes
      // through Iron.applyIron — the single authority — so rapid toggling
      // can never slip past the lock check, and the pre-iron gentle guard +
      // sites choices are snapshotted exactly once (inside applyIron) before
      // anything gets hardened. Sites are deliberately left alone here:
      // store.enforceIron() hardens them on every write while the promise
      // runs and hands your old choices back when it ends.
      if (p.section === 'timer' && p.values && p.values.iron !== undefined) {
        Iron.applyIron(d, !!p.values.iron, Date.now());
        if (!p.values.iron && Iron.isLocked(d.settings.timer.ironLockedUntil, Date.now())) return;   // nope.
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
        if (RAW_SECTIONS.includes(p.section)) {
          // these sections send a RAW VALUE, not an object (UI contract)
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
          } else if (p.section === 'notify') {
            if (!['focusEnd', 'breakEnd', 'blocker'].includes(k)) continue;
            v = !!v;
          } else if (k === 'theme') v = Prefs.THEMES.includes(v) ? v : 'system';
          else if (k === 'language') v = Prefs.normLang(v);
          else if (k === 'dailyGoalMin') v = num(v, 120, 0, 720);
          else if (k === 'miniWindow' || k === 'bridgeAllowOrigins' || k === 'startWithWindows' || k === 'closeToTray') v = !!v;
          clean[k] = v;
        }
        if (RAW_SECTIONS.includes(p.section)) {
          d.settings[p.section] = clean[p.section];
        } else if (sec && typeof sec === 'object' && !Array.isArray(sec)) {
          Object.assign(sec, clean);
        }
      }
      /* Iron strictness: timer/guardian edits are filtered through the same
         pure helpers the engine and the UI use — you cannot soften them
         mid-promise, and what gets stored is exactly what will run.
         Sites too: while the promise runs the master switch stays ON
         (store.enforceIron re-asserts this on every write anyway; filtering
         here keeps the returned/stored value honest). The list MODE
         (blocklist/allowlist) and `when` (during focus / always) stay free will. */
      if (Iron.resolveIron(d.settings.timer.iron, d.settings.timer.ironLockedUntil, Date.now())) {
        if (p.section === 'guardian') Object.assign(d.settings.guardian, Iron.effectiveGuard(d.settings.guardian, true));
        if (p.section === 'timer') Object.assign(d.settings.timer, Iron.effectiveTimer(d.settings.timer, true));
      }
      if (p.section === 'sites' || Iron.isLocked(d.settings.timer.ironLockedUntil, Date.now())) {
        Object.assign(d.sites, Iron.effectiveSites(d.sites, true));
      }
    });
    if (p.section === 'guardian' || p.section === 'timer') guardian._loop();   // apply new scan interval / strictness
    if (p.section === 'language') buildTrayMenu();
    if (p.section === 'startWithWindows') applyLoginItem();
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
    const t = { id: 't' + Date.now() + Math.floor(Math.random() * 999), text: String(payload.text || '').trim().slice(0, 200), subject: String(payload.subject || '').trim().slice(0, 40), est: Math.max(1, parseInt(payload.est, 10) || 1), min: Math.max(0, parseInt(payload.min, 10) || 0), done: false, pomosDone: 0, date: null, createdAt: Date.now(), completedAt: null };
    if (!t.text) return null;
    store.mutate((d) => { d.tasks.unshift(t); });
    pushSnapshot();
    return t;
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
      store.mutate((d) => addFeed(d, { kind: 'good', xp: 5, text: T('main.feed.taskDone', { task: done.text }) }));
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

  /* ---- apps (blocklists / allowlists) ---- */
  /* Iron list-freeze gate: while an iron focus EXISTS (running OR paused) or
     the multi-day self-lock runs, the lists are part of the promise — you may
     ADD distractions to the block side, but nothing can be removed, disabled,
     or exempted mid-promise. Both the UI buttons and these IPC handlers check
     the same authority (shared/iron.js listsFrozenState), so what's greyed
     out is exactly what the backend refuses anyway. */
  const listsFrozenNow = () => Iron.listsFrozenState(session.isIronFocus(), Iron.isLocked(store.data.settings.timer.ironLockedUntil, Date.now()));
  H('apps:add', (p) => {
    if (listsFrozenNow() && p.list === 'allow') { pushSnapshot(); return null; }   // new exemption refused mid-promise
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
    if (listsFrozenNow() && p.list === 'allow') return null;   // new exemption refused mid-promise
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
  H('apps:remove', (p) => {
    if (listsFrozenNow()) { broadcast('list-frozen', {}); return false; }   // removals are part of the promise
    store.mutate((d) => { const l = p.list === 'allow' ? 'allow' : 'block'; d.apps[l] = d.apps[l].filter((e) => e.id !== p.id); });
    pushSnapshot();
    return true;
  });
  H('apps:toggle', (p) => {
    if (listsFrozenNow()) { broadcast('list-frozen', {}); return false; }   // disabling is part of the promise
    store.mutate((d) => { const l = p.list === 'allow' ? 'allow' : 'block'; const e = d.apps[l].find((e) => e.id === p.id); if (e) e.enabled = !e.enabled; });
    pushSnapshot();
    return true;
  });
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
      rows.push({ pid: p.pid, name: p.name, norm: p.norm });
    }
    rows.sort((a, b) => a.norm.localeCompare(b.norm));
    return rows.map((r) => ({ pid: r.pid, name: r.name, norm: r.norm, listed: listed.has(r.norm) }));
  });
  H('apps:previewAllow', async () => guardian.previewAllowlist());
  H('apps:killNow', async (p) => guardian.killNow(String(p.norm || '')));

  /* ---- sites ---- */
  H('sites:set', (p) => {
    store.mutate((d) => {
      const patch = (p && p.patch && typeof p.patch === 'object' && !Array.isArray(p.patch)) ? p.patch : {};
      /* SECURITY FIX: enums/booleans were assigned unvalidated — a buggy or
         hostile renderer could persist mode:'banana', which makes rule
         matching fail open (nothing blocks) until the next restart. Same
         value sets the bridge's /sites endpoint and sanitizeData enforce. */
      if (typeof patch.enabled === 'boolean') d.sites.enabled = patch.enabled;
      if (patch.mode === 'block' || patch.mode === 'allow') d.sites.mode = patch.mode;
      if (patch.when === 'session' || patch.when === 'always') d.sites.when = patch.when;
      // normalizeEntry KEEPS paths (youtube.com/shorts stays youtube.com/shorts)
      for (const k of ['block', 'allow']) if (Array.isArray(patch[k])) d.sites[k] = dedupe(patch[k].map((x) => NookRules.normalizeEntry(x)).filter(Boolean)).slice(0, 500);
      /* Iron promise: while the self-lock runs you can NOT switch site
         blocking off — the write is filtered through Iron.effectiveSites
         (the same pure helper the UI renders from), so what you see is
         exactly what the extension gets. The list MODE (blocklist/allowlist)
         and `when` (during focus / always) stay YOUR choice.
         store.enforceIron() re-asserts this on every other write too, so no
         path softens it. */
      Object.assign(d.sites, Iron.effectiveSites(d.sites, Iron.isLocked(d.settings.timer.ironLockedUntil, Date.now())));
    });
    pushSnapshot();
    return true;
  });

  /* ---- extension finder (read-only: is the extension installed / enabled?) ---- */
  H('ext:detect', () => {
    const r = ExtFinder.detect({ extDir: EXT_DIR });
    return { status: r.status, title: T('ext.status.' + r.status + '.t'), detail: T('ext.status.' + r.status + '.d') };
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
      broadcast('toast', { title: T('main.toast.ironPause.t'), msg: T('main.toast.ironPause.d') });
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

  /* ---- misc ---- */
  H('ambient:minute', () => {
    if (Date.now() - lastAmbientAward < 55000) return true;
    lastAmbientAward = Date.now();
    store.mutate((d) => { d.counters.ambientMin = (d.counters.ambientMin || 0) + 1; });
    grantAchievements({});
    return true;
  });
  H('onboarding:done', () => { store.mutate((d) => { d.onboarded = true; }); return true; });
  H('iron:passed', () => { ctx.gateCleared = true; return true; });

  /* ---- windows ---- */
  H('win:min', () => { const w = ctx.win(); if (w) w.minimize(); return true; });
  H('win:close', () => {
    // isActive() covers PAUSED sessions too — the window only closes (to
    // tray) when no session exists at all. During an IRON focus even that
    // isn't free: closing must go through the typed gate first, so the X
    // button raises the gate instead of hiding straight to the tray.
    if (session && session.isActive()) { broadcast('close-blocked', {}); return false; }
    if (session && session.isIronFocus() && !ctx.gateCleared) { broadcast('iron-gate', {}); return false; }
    // Nothing left to protect → really quit, so no process lingers in Task Manager.
    // The guard or website blocking set to "always", or the student's own choice, keep the tray.
    const st = store.data, g = st.settings.guardian || {};
    const keepRunning = st.settings.closeToTray || (g.enabled && g.onlyDuringSessions === false) || (st.sites.enabled && st.sites.when === 'always');
    if (!keepRunning && ctx.quitApp) { ctx.quitApp(); return true; }
    const w = ctx.win();
    if (w) w.hide();   // hiding keeps timer+guard alive in tray
    return true;
  });
  H('win:show-main', () => { const w = ctx.win(); if (w) { w.show(); w.focus(); } return true; });

  /* ---- reminder window buttons ---- */
  H('reminder:allowOnce', (p) => { guardian.allowOnce(String(p.norm || ''), 5); pushSnapshot(); return true; });
  H('reminder:killNow', (p) => guardian.killNow(String(p.norm || '')));
  H('reminder:dismiss', () => { ctx.hideReminderWindow(); broadcast('reminder', null); return true; });
}

module.exports = { registerIpc, RAW_SECTIONS };
