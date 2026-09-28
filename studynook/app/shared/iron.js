/* ============================================================
   StudyNook · iron.js — the Iron Session gate (pure helpers)
   Ending an iron focus early = 60s cool-down + type the exact
   sentence (GitHub delete-account style friction).
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NookIron = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SENTENCE = 'i choose to end my focus early';
  const COOLDOWN_SEC = 60;
  const LOCK_DAYS_DEFAULT = 4;
  function normalize(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function matches(typed, target) { return normalize(typed) === normalize(target || SENTENCE); }
  function lockDays(v) { const n = Number(v); return Number.isFinite(n) ? Math.max(1, Math.min(30, Math.round(n))) : LOCK_DAYS_DEFAULT; }
  function makeLock(now, days) { return (now || Date.now()) + lockDays(days) * 24 * 60 * 60 * 1000; }
  function isLocked(until, now) { return !!until && until > (now || Date.now()); }
  /** Human lock countdown. Never prints a leading "0d" — under 24h it shows h/m only. */
  function remainingHms(until, now) {
    let ms = Math.max(0, (until || 0) - (now || Date.now()));
    const d = Math.floor(ms / 86400000); ms -= d * 86400000;
    const h = Math.floor(ms / 3600000); ms -= h * 3600000;
    const m = Math.floor(ms / 60000);
    return (d > 0 ? d + 'd ' : '') + h + 'h ' + m + 'm';
  }

  /* ---------- the Iron switch itself: one-way, tamper-proof ----------
     resolveIron() is THE authority on whether iron mode is on. Anything
     that reads or writes settings.timer.iron goes through it, so editing
     data.json by hand can never silently turn the promise off:
       • while the self-lock runs → iron stays ON even if the file says
         false (the countdown keeps its meaning instead of going stale);
       • once the lock has expired → the stored value wins again, so the
         user can genuinely switch iron off in Settings.
     applyIron() is the matching write guard: the flag may only change
     when the lock is not running. Pure helpers — no fs, no electron. */
  function resolveIron(stored, until, now) {
    if (isLocked(until, now)) return true;
    return !!stored;
  }
  function applyIron(d, wanted, now) {
    const t = objTimer(d);
    if (isLocked(t.ironLockedUntil, now)) return false;   // refuse the flip
    const v = !!wanted;
    if (v && !t.iron) t.ironLockedUntil = makeLock(now, t.ironLockDays);
    t.iron = v;
    return true;
  }
  /** Normalize the three iron fields to safe values (used by store sanitize). */
  function normalizeFields(t, now) {
    t.iron = !!t.iron;
    t.ironLockDays = lockDays(t.ironLockDays);
    const u = Number(t.ironLockedUntil);
    t.ironLockedUntil = Number.isFinite(u) && u > 0 ? Math.min(u, 8.64e15) : 0;
    if (t.ironLockedUntil && t.ironLockedUntil <= now) { t.ironLockedUntil = 0; t.iron = false; }
    return t;
  }
  function objTimer(d) {
    const s = (d && d.settings) || {};
    if (!s.timer || typeof s.timer !== 'object' || Array.isArray(s.timer)) s.timer = {};
    return s.timer;
  }
  return { SENTENCE, COOLDOWN_SEC, LOCK_DAYS_DEFAULT, normalize, matches, lockDays, makeLock, isLocked, remainingHms, resolveIron, applyIron, normalizeFields };
});
