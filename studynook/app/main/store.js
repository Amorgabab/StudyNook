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

function defaultData() {
  return {
    v: 1,
    profile: { name: '' },
    pet: { name: 'Mochi', totalFocusMin: 0, stage: 0, pets: 0 },
    xp: 0,
    level: 1,
    streak: { current: 0, best: 0, lastFocusDay: null },
    settings: {
      timer: { workMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: false, strict: false },
      sound: { ui: true, chimes: true, volume: 0.6 },
      guardian: { enabled: true, mode: 'block', action: 'gentle', graceSec: 15, scanSec: 3, onlyDuringSessions: true },
      theme: 'auto',       // auto | light | dark
      miniWindow: true
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
    tasks: [],
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
function sanitizeData(d) {
  d = obj(d);
  d.xp = num(d.xp, 0, 0, 1e9);
  d.level = num(d.level, 1, 1, 999);
  const s = obj(d.settings); d.settings = s;
  const t = obj(s.timer); s.timer = t;
  t.workMin = num(t.workMin, 25, 1, 600); t.shortMin = num(t.shortMin, 5, 1, 120);
  t.longMin = num(t.longMin, 15, 1, 240); t.rounds = num(t.rounds, 4, 1, 24);
  t.autoStartBreaks = !!t.autoStartBreaks; t.autoStartFocus = !!t.autoStartFocus;
  t.strict = !!t.strict; t.iron = !!t.iron;
  t.ironLockDays = num(t.ironLockDays, 4, 1, 30);
  t.ironLockedUntil = num(t.ironLockedUntil, 0, 0, 8.64e15);
  const g = obj(s.guardian); s.guardian = g;
  g.enabled = g.enabled !== false;
  g.mode = g.mode === 'allow' ? 'allow' : 'block';
  g.action = ['gentle', 'instant', 'remind'].includes(g.action) ? g.action : 'gentle';
  g.graceSec = num(g.graceSec, 15, 1, 600); g.scanSec = num(g.scanSec, 3, 1, 60);
  g.onlyDuringSessions = g.onlyDuringSessions !== false;
  const snd = obj(s.sound); s.sound = snd;
  snd.ui = snd.ui !== false; snd.chimes = snd.chimes !== false; snd.volume = num(snd.volume, 0.6, 0, 1);
  s.theme = ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto';
  s.miniWindow = s.miniWindow !== false;
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
    sources: arr(t.sources).filter((x) => x && typeof x.url === 'string').map((x) => ({ url: String(x.url).slice(0, 500), addedAt: num(x.addedAt, 0, 0, 8.64e15) }))
  }));
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
  d.sessions = arr(d.sessions).slice(0, 500);
  d.daily = obj(d.daily);
  d.counters = obj(d.counters);
  for (const k of ['kills', 'pets', 'ambientMin', 'sessionsTotal', 'abandons', 'tasksDone']) d.counters[k] = num(d.counters[k], 0, 0, 1e9);
  d.achievements = obj(d.achievements);
  d.feed = arr(d.feed).slice(0, 40);
  d.ext = obj(d.ext);
  d.ext.token = str(d.ext.token, '', 64); d.ext.code = str(d.ext.code, '', 6);
  d.onboarded = !!d.onboarded;
  return d;
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
    const r = fn(this.data);
    this.save();
    return r;
  }
  addFeed(text, emoji) {
    this.data.feed = this.data.feed || [];
    this.data.feed.unshift({ t: Date.now(), text, emoji: emoji || '✨' });
    if (this.data.feed.length > 40) this.data.feed.length = 40;
  }
}

module.exports = { Store, defaultData, deepMerge, sanitizeData };
