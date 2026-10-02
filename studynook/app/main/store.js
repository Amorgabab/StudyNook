/* ============================================================
   StudyNook · store.js — your data, in ONE readable JSON file
   ------------------------------------------------------------
   Everything is saved to <project>/data/data.json so you can
   open it, back it up, or edit it yourself. No databases,
   no cloud, no mystery.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const TaskDays = require('../shared/taskdays.js');
const Iron = require('../shared/iron.js');

function defaultData() {
  return {
    v: 1,
    profile: { name: '' },
    pet: { name: 'Mochi', totalFocusMin: 0, stage: 0, pets: 0 },
    xp: 0,
    level: 1,
    streak: { current: 0, best: 0, lastFocusDay: null },
    settings: {
      timer: { workMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: false, strict: false, iron: false, ironLockDays: 4, ironLockedUntil: 0 },
      sound: { ui: true, chimes: true, volume: 0.6 },
      guardian: { enabled: true, mode: 'block', action: 'gentle', graceSec: 15, scanSec: 3, onlyDuringSessions: true },
      theme: 'auto',       // auto | light | dark
      miniWindow: true,
      bridgeAllowOrigins: false   // SECURITY: cross-origin access to the localhost bridge (off = extension-only)
    },
    apps: { block: [], allow: [], allowOnce: {} },   // allowOnce: {norm: untilMs} (temporary)
    subjects: ['Math', 'Science', 'English', 'History', 'Computer science', 'Other'],
    notes: [],              // {id, title, body, updatedAt}
    sites: {
      enabled: true,
      mode: 'block',       // block | allow
      when: 'session',     // session | always
      block: ['youtube.com', 'twitter.com', 'x.com', 'reddit.com', 'twitch.tv', 'instagram.com', 'tiktok.com', 'facebook.com'],
      allow: ['wikipedia.org', 'google.com', 'docs.google.com', 'drive.google.com', 'classroom.google.com', 'chatgpt.com', 'github.com', 'stackoverflow.com']
    },
    ext: { token: crypto.randomBytes(16).toString('hex'), code: makeCode(), lastSeen: 0, version: '' },
    tasks: [],           // single source of truth — a task with date/at IS the Week Schedule (no second store)
    sessions: [],          // capped at 500
    daily: {},             // "YYYY-MM-DD": {min, sessions, kills, tasks}
    counters: { kills: 0, pets: 0, ambientMin: 0, sessionsTotal: 0, abandons: 0, tasksDone: 0 },
    achievements: {},      // id -> ISO date
    onboarded: false,
    feed: []               // last 40 activity lines for the home view
  };
}
function makeCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no look-alikes
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[crypto.randomInt(0, abc.length)];
  return s;
}

function deepMerge(base, extra) {
  // Fill missing keys from base into extra (keeps user values, adds new defaults)
  for (const k of Object.keys(base)) {
    if (extra[k] === undefined) extra[k] = JSON.parse(JSON.stringify(base[k]));
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k])) {
      deepMerge(base[k], extra[k]);
    }
  }
  return extra;
}

/* ---------- defensive sanitization (load + import) ----------
   Coerces known fields to sane types/ranges. Unknown fields are
   PRESERVED (we never destroy data we don't understand). */
function num(v, def, min, max) { if (v === null || v === undefined || v === '') return def; const n = Number(v); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def; }
function str(v, def, max) { return typeof v === 'string' ? v.slice(0, max) : def; }
function arr(v) { return Array.isArray(v) ? v : []; }
function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
/* SECURITY: study-source URLs must be plain http(s) links. Anything else
   (file:, javascript:, custom schemes, garbage) is dropped at load/import —
   the same rule tasks:addSource applies when you add a link. */
const NookLinks = require('../shared/links.js');
function sanitizeSourceUrl(u) {
  const s = NookLinks.normalize(u);
  return s ? s.slice(0, 500) : '';
}
function sanitizeData(d) {
  d = obj(d);
  const nowMs = Date.now();   // used for allowOnce expiry pruning below
  d.xp = num(d.xp, 0, 0, 1e9);
  d.level = num(d.level, 1, 1, 999);
  const s = obj(d.settings); d.settings = s;
  const t = obj(s.timer); s.timer = t;
  t.workMin = num(t.workMin, 25, 1, 600); t.shortMin = num(t.shortMin, 5, 1, 120);
  t.longMin = num(t.longMin, 15, 1, 240); t.rounds = num(t.rounds, 4, 1, 24);
  t.autoStartBreaks = !!t.autoStartBreaks; t.autoStartFocus = !!t.autoStartFocus;
  t.strict = !!t.strict;
  /* Iron fields — tamper-proof. A hand-edit of data.json can never switch
     iron off while the self-lock still runs (resolveIron keeps it ON, so the
     countdown and the no-pause rules stay consistent), garbage values are
     clamped, and an expired lock cleans itself up instead of leaving a stale
     "0h 0m" / stuck pill behind. */
  Iron.normalizeFields(t, Date.now());
  const g = obj(s.guardian); s.guardian = g;
  g.enabled = g.enabled !== false;
  g.mode = g.mode === 'allow' ? 'allow' : 'block';
  g.action = ['gentle', 'instant', 'remind'].includes(g.action) ? g.action : 'gentle';
  g.graceSec = num(g.graceSec, 15, 1, 600); g.scanSec = num(g.scanSec, 3, 1, 60);
  g.onlyDuringSessions = g.onlyDuringSessions !== false;
  /* Iron strictness at rest: with iron in effect (switch on OR self-lock
     still running — a hand-edit can't clear the lock), the stored guard
     settings must already BE the hardened ones — otherwise the UI would
     show "gentle warn" or "guard off" while the engine secretly acts
     differently. Strict mode is forced on too, so early ends never earn XP
     during an iron promise. Sites are NEVER touched: your "during focus /
     always" choice there is free will. Same pure helpers the renderer uses
     → zero drift between what you see and what runs. */
  if (Iron.resolveIron(t.iron, t.ironLockedUntil, Date.now())) {
    Object.assign(g, Iron.effectiveGuard(g, true));
    Object.assign(t, Iron.effectiveTimer(t, true));
  }
  const snd = obj(s.sound); s.sound = snd;
  snd.ui = snd.ui !== false; snd.chimes = snd.chimes !== false; snd.volume = num(snd.volume, 0.6, 0, 1);
  s.theme = ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto';
  s.miniWindow = s.miniWindow !== false;
  s.bridgeAllowOrigins = s.bridgeAllowOrigins === true;   // SECURITY: explicit opt-in only
  d.profile = obj(d.profile); d.profile.name = str(d.profile.name, '', 40);
  d.pet = obj(d.pet);
  d.pet.name = str(d.pet.name, 'Mochi', 20);
  d.pet.totalFocusMin = num(d.pet.totalFocusMin, 0, 0, 1e8);
  d.pet.stage = num(d.pet.stage, 0, 0, 5);
  d.pet.pets = num(d.pet.pets, 0, 0, 1e9);
  d.streak = obj(d.streak);
  d.streak.current = num(d.streak.current, 0, 0, 36500);
  d.streak.best = num(d.streak.best, 0, 0, 36500);
  d.streak.lastFocusDay = typeof d.streak.lastFocusDay === 'string' ? d.streak.lastFocusDay : null;
  d.subjects = arr(d.subjects).filter((x) => typeof x === 'string').map((x) => x.slice(0, 40)).slice(0, 40);
  d.notes = arr(d.notes).filter((n) => n && typeof n === 'object').map((n) => ({
    id: str(n.id, 'n' + Math.random().toString(36).slice(2), 40), title: str(n.title, '', 120),
    body: str(n.body, '', 50000), updatedAt: num(n.updatedAt, 0, 0, 8.64e15)
  }));
  d.tasks = arr(d.tasks).filter((t) => t && typeof t === 'object').map((t) => Object.assign({}, t, {
    id: str(t.id, 't' + Math.random().toString(36).slice(2), 40), text: str(t.text, '', 200),
    subject: str(t.subject, '', 40), est: num(t.est, 1, 1, 99), min: num(t.min, 0, 0, 6000),
    done: !!t.done, pomosDone: num(t.pomosDone, 0, 0, 1e6),
    date: TaskDays.normDate(t.date) || null, // optional planned day (kept for legacy data; the schedule UI is gone)
    at: normAt(t.at),                          // optional start time 'HH:MM' — garbage becomes null
    sources: arr(t.sources).filter((x) => x && typeof x.url === 'string').map((x) => ({ url: sanitizeSourceUrl(x.url), addedAt: num(x.addedAt, 0, 0, 8.64e15) })).filter((x) => x.url)
  }));
  migrateLegacySchedule(d);
  const sites = obj(d.sites); d.sites = sites;
  sites.enabled = sites.enabled !== false;
  sites.mode = sites.mode === 'allow' ? 'allow' : 'block';
  sites.when = sites.when === 'always' ? 'always' : 'session';
  sites.block = arr(sites.block).filter((x) => typeof x === 'string').map((x) => x.slice(0, 200)).slice(0, 500);
  sites.allow = arr(sites.allow).filter((x) => typeof x === 'string').map((x) => x.slice(0, 200)).slice(0, 500);
  const apps = obj(d.apps); d.apps = apps;
  for (const k of ['block', 'allow']) {
    apps[k] = arr(apps[k]).filter((e) => e && typeof e === 'object').map((e) => ({
      id: str(e.id, 'a' + Math.random().toString(36).slice(2), 40), label: str(e.label, '', 60),
      emoji: str(e.emoji, '📦', 8), enabled: e.enabled !== false,
      procs: arr(e.procs).filter((p) => typeof p === 'string').map((p) => p.slice(0, 60))
    }));
  }
  apps.allowOnce = obj(apps.allowOnce);
  /* SECURITY: allowOnce directly gates process kills — validate every value
     (numbers only), drop expired grants, and cap the map size so a hostile
     import can neither bloat memory nor plant forever-valid kill exemptions. */
  {
    const ao = {};
    let kept = 0;
    for (const k of Object.keys(apps.allowOnce)) {
      if (kept >= 200) break;
      const v = Number(apps.allowOnce[k]);
      if (!Number.isFinite(v) || v <= nowMs) continue;   // garbage or already expired → gone
      ao[String(k).slice(0, 60)] = Math.min(v, 8.64e15);
      kept++;
    }
    apps.allowOnce = ao;
  }
  d.sessions = arr(d.sessions).slice(0, 500);
  d.daily = obj(d.daily);
  d.counters = obj(d.counters);
  for (const k of ['kills', 'pets', 'ambientMin', 'sessionsTotal', 'abandons', 'tasksDone']) d.counters[k] = num(d.counters[k], 0, 0, 1e9);
  d.achievements = obj(d.achievements);
  d.feed = arr(d.feed).slice(0, 40).filter((r) => r && typeof r === 'object');
  for (const r of d.feed) {
    r.t = num(r.t, 0, 0, 8.7e15); r.emoji = str(r.emoji, '🌱', 8); r.text = str(r.text, '', 160);
    const k = str(r.kind, '', 8); r.kind = (k === 'good' || k === 'warn') ? k : 'info';
    r.xp = num(r.xp, 0, 0, 9999);
  }
  d.ext = obj(d.ext);
  d.ext.token = str(d.ext.token, '', 64); d.ext.code = str(d.ext.code, '', 6);
  d.onboarded = !!d.onboarded;
  return d;
}

/* ---------- one-time migration: legacy recurring blocks → dated tasks ----------
   Older builds stored a SEPARATE Week Schedule system (d.schedule = recurring
   blocks). The unified design says d.tasks[] is the single source of truth, so
   on first load we convert every valid block into a real task planned for the
   CURRENT week (actual calendar dates — never a recurrence engine), remember
   which block ids were converted (so re-runs can never duplicate), then delete
   the old structure entirely. Unmappable garbage is skipped safely.
   Self-contained on purpose: the shared weeksched module was retired together
   with the separate-schedule UI, but this migration must stay forever so no
   existing user data is ever silently discarded. */
const LEGACY_MAX_BLOCKS = 12; // hard cap the old grid enforced

/** Optional start time 'HH:MM' → normalized string or null. A dated task never needs a time. */
function normAt(v) {
  if (typeof v !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}

/** Legacy block → safe object, or null when unusable (mirrors the old sanitizer). */
function sanitizeLegacyBlock(b) {
  if (!b || typeof b !== 'object') return null;
  const subject = typeof b.subject === 'string' ? b.subject.slice(0, 40) : '';
  const label = typeof b.label === 'string' ? b.label.slice(0, 60) : '';
  const min = Math.max(0, Math.min(600, Math.round(Number(b.min) || 0)));
  const at = normAt(b.at); // keep as much usable info as maps safely
  const days = Array.isArray(b.days) ? b.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6).slice(0, 8) : [];
  if (!subject && !label) return null;
  if (!days.length) return null;
  return { id: String(b.id || '').slice(0, 40), subject, label, min, at, days };
}

/** Convert every valid legacy block into dated tasks (idempotent via migratedFrom). */
function migrateBlocks(rawSchedule, weekOfStr) {
  const out = [], sourceIds = [];
  let sched = rawSchedule;
  if (typeof sched === 'string') { try { sched = JSON.parse(sched); } catch (_) { sched = null; } }
  if (!sched || typeof sched !== 'object' || Array.isArray(sched)) return { tasks: out, sourceIds };
  const ref = TaskDays.normDate(weekOfStr) || TaskDays.toKey(new Date());
  const dates = TaskDays.weekDates(TaskDays.weekStart(ref)); // Mon..Sun of the reference week
  const ids = Object.keys(sched).slice(0, LEGACY_MAX_BLOCKS * 2);
  for (const id of ids) {
    const b = sanitizeLegacyBlock(sched[id]);
    if (!b) continue; // junk / empty / day-less → skip, never crash
    sourceIds.push(b.id || id);
    for (const di of b.days) {
      const key = dates[di];
      if (!key) continue;
      const text = ((b.subject || '') + ' ' + (b.label || '')).trim() || 'Scheduled study block';
      out.push({
        id: 'tms-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '') + '-' + di,
        text: text.slice(0, 200),
        subject: b.subject.slice(0, 40),
        est: Math.max(1, Math.min(8, Math.ceil((b.min || 25) / 25))), // honest Pomodoro estimate
        min: b.min || 0,
        done: false, pomosDone: 0,
        date: key,
        at: b.at || null, // preserve the legacy start time when it maps safely
        sources: [], createdAt: Date.now(), completedAt: null,
        migratedFrom: String(id).slice(0, 40)
      });
    }
  }
  return { tasks: out, sourceIds };
}

function migrateLegacySchedule(d) {
  const hasBlocks = d.schedule && typeof d.schedule === 'object' && !Array.isArray(d.schedule) && Object.keys(d.schedule).length > 0;
  if (!hasBlocks) { delete d.schedule; return false; } // no legacy data → guarantee it's gone
  const done = obj(d.migratedSchedules);
  const existing = new Set(d.tasks.map((t) => t && t.migratedFrom).filter(Boolean));
  const { tasks, sourceIds } = migrateBlocks(d.schedule, TaskDays.toKey(new Date()));
  let added = 0;
  for (const t of tasks) {
    if (done[t.migratedFrom] || existing.has(t.migratedFrom)) continue; // idempotent guards
    d.tasks.push(t); added++;
  }
  for (const id of sourceIds) done[id] = new Date().toISOString();
  d.migratedSchedules = done;
  delete d.schedule; // only now does the old structure disappear
  return added > 0;
}

class Store {
  constructor(filePath) {
    this.file = filePath;
    this.data = this.load();
    this._saveTimer = null;
  }
  load() {
    let data = null;
    try {
      if (fs.existsSync(this.file)) {
        data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      }
    } catch (e) {
      // Corrupt file? Keep a backup instead of losing everything.
      try { fs.copyFileSync(this.file, this.file + '.corrupt-' + Date.now()); } catch (_) {}
      data = null;
    }
    if (!data || typeof data !== 'object') data = defaultData();
    else data = sanitizeData(deepMerge(defaultData(), data));
    return data;
  }
  save() { // debounced, atomic
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveNow(), 250);
  }
  saveNow() {
    if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error('[store] save failed:', e.message);
    }
  }
  /** mutate(fn) — change data then save. Returns fn's result. */
  mutate(fn) {
    /* Snapshot the site-blocking switches BEFORE the mutation runs, so a
       flip that slips past the handlers (a stray code path, an import, a
       hand-edited file loaded mid-focus) can be snapped back to the choice
       that was in effect when this iron FOCUS began. The session engine is
       consulted lazily via the `ironFocusActive` flag main keeps mirrored —
       store has no direct session reference. */
    this._captureSitesFreeze();
    const r = fn(this.data);
    this.enforceIron();
    this.save();
    return r;
  }
  /** Remember sites.enabled/mode before every mutation while a LIVE iron
      focus runs (cheap: two primitives). enforceIron() compares the
      snapshot against the post-mutation state and restores it on drift.
      NOT during the bare multi-day lock: with no iron focus in progress
      the site switches are free will (locking them for days stranded
      users who turned iron on with blocking OFF / Blocklist chosen). */
  _captureSitesFreeze() {
    try {
      const d = this.data;
      const t = d && d.settings && d.settings.timer;
      this._sitesBefore = !!(t && t.ironFocusActive && d.sites);
      if (this._sitesBefore) {
        this._sitesFrozen = { enabled: !!d.sites.enabled, mode: d.sites.mode === 'allow' ? 'allow' : 'block' };
      }
    } catch (e) { this._sitesBefore = false; }
  }
  /** Re-assert the iron promise on every write: while the self-lock runs,
      settings.timer.iron is always true — even if something (a hand-edited
      file that got loaded, an import, a stray code path) tried to clear it.
      After the lock expires nothing is forced, so iron can be turned off.
      Iron strictness rides along: with the lock running the guardian stays
      hardened (guard ON + instant close) and strict mode stays on, so stored
      state and enforced state never diverge. The Site-blocking ON/OFF switch
      and the Blocklist↔Allowlist MODE are frozen ONLY while a live iron
      focus runs (snapped back to the pre-mutation snapshot on any drift) —
      never for the bare multi-day lock, which would strand the switches at
      whatever they were when iron was switched on. Sites LISTS and the
      "during focus / always" timing stay free will — only the two big
      switches are guarded, and only mid-focus. */
  enforceIron() {
    try {
      const d = this.data;
      const t = d && d.settings && d.settings.timer;
      if (!t) return;
      if (Iron.isLocked(t.ironLockedUntil, Date.now())) {
        t.iron = true;
        Object.assign(d.settings.guardian, Iron.effectiveGuard(d.settings.guardian, true));
        Object.assign(t, Iron.effectiveTimer(t, true));
        if (this._sitesBefore && this._sitesFrozen && d.sites) {
          d.sites.enabled = !!this._sitesFrozen.enabled;
          d.sites.mode = this._sitesFrozen.mode;
        }
      } else if (d.__ironSaved) {
        // The self-lock just expired → restore the guard choices the
        // user had before they made the iron promise. (Sites were never
        // changed by iron, so there is nothing to restore for them.)
        Object.assign(d.settings.guardian, d.__ironSaved.guard || {});
        delete d.__ironSaved;
      }
      this._sitesBefore = false;   // snapshot consumed — recaptured next mutate
    } catch (e) {}
  }
  addFeed(text, emoji) {
    this.data.feed = this.data.feed || [];
    this.data.feed.unshift({ t: Date.now(), text, emoji: emoji || '✨' });
    if (this.data.feed.length > 40) this.data.feed.length = 40;
  }
}

module.exports = { Store, defaultData, deepMerge, sanitizeData, migrateLegacySchedule, normAt, num, str };
