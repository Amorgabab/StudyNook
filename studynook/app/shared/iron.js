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
  function remainingHms(until, now) {
    let ms = Math.max(0, (until || 0) - (now || Date.now()));
    const d = Math.floor(ms / 86400000); ms -= d * 86400000;
    const h = Math.floor(ms / 3600000); ms -= h * 3600000;
    const m = Math.floor(ms / 60000);
    return d + 'd ' + h + 'h ' + m + 'm';
  }
  return { SENTENCE, COOLDOWN_SEC, LOCK_DAYS_DEFAULT, normalize, matches, lockDays, makeLock, isLocked, remainingHms };
});
