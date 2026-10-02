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
  /** THE gate every site-blocking write must pass through (main handler,
      localhost bridge and the store's last line of defence all call it).
      While an iron promise runs — the multi-day switch lock OR a live iron
      focus — the Site-blocking ON/OFF switch and the Blocklist↔Allowlist
      mode are FROZEN: patches carrying those fields are dropped entirely
      (lists stay editable — adding blocked sites only ever strengthens the
      promise). With no iron promise in effect the gate is transparent:
      every choice is free will. Returns true when the patch may be applied.
      `ironFocus` = an iron focus phase exists right now (live session view;
      pass false/undefined if unknown — the lock alone still freezes). */
  function sitePatchAllowed(timer, ironFocus, now, patch) {
    const p = (patch && typeof patch === 'object' && !Array.isArray(patch)) ? patch : {};
    const t = (timer && typeof timer === 'object' && !Array.isArray(timer)) ? timer : {};
    const promiseOn = resolveIron(t.iron, t.ironLockedUntil, now) || !!ironFocus;
    if (!promiseOn) return true;
    if ('enabled' in p || 'mode' in p) return false;   // 🔒 frozen during iron
    return true;
  }
  /** THE freeze authority for the FOCUS ITEMS — the FULL focus kit:
       • Site blocking ON
       • Allowlist mode
       • App blocking (guard) ON
       • Strict mode ON
     The switches are locked ALL THE TIME, but ONLY while the whole kit is
     configured this way (AND, never OR). This matters: if you set your
     promise up as "blocking ON + Blocklist mode" (or leave blocking off),
     the mode switch was NEVER part of a focus promise — locking it would
     trap you in a configuration you never promised. So partial setups stay
     freely editable; completing the kit is what engages the freeze.
     A live/paused iron focus or the multi-day iron self-lock ALWAYS freezes
     the switches regardless of the kit (that promise was made explicitly).
     The saved config itself is the promise — closing the app or installing
     a new version mid-session can never unlock them. Sites LISTS and the
     "during focus / always" timing stay editable forever: adding blocked
     sites / trimming the allowlist only ever strengthens the promise. */
  function focusItemsFrozen(sites, guard, strict, opts) {
    const o = opts || {};
    const s = (sites && typeof sites === 'object' && !Array.isArray(sites)) ? sites : {};
    const g = (guard && typeof guard === 'object' && !Array.isArray(guard)) ? guard : {};
    if (o.ironFocus || resolveIron(o.timerIron, o.timerIronLockedUntil, o.now)) return true;
    return !!s.enabled && s.mode === 'allow' && !!g.enabled && !!strict;
  }
  /** Patch gate for the focus items: while the freeze holds, the two big
      switches (Site-blocking ON/OFF and Blocklist↔Allowlist MODE) cannot be
      flipped — no escape hatch, they stay locked as long as the kit is on.
      To change them, first break the kit through its own controls (turn
      Strict mode off in Settings, or the guard off on the Apps tab): then
      the switches unlock automatically. Everything else passes untouched.
      Returns true when the patch may apply. */
  function focusItemsPatchAllowed(frozen, patch) {
    const p = (patch && typeof patch === 'object' && !Array.isArray(patch)) ? patch : {};
    if (!frozen) return true;
    if ('enabled' in p || 'mode' in p) return false;   // 🔒 frozen while the focus kit is on
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

  /* ---------- Iron strictness: one source of truth for every surface ----------
     Choosing Iron when you press Start doesn't just mean "no early stop":
     while that iron focus runs, the guards harden so what the UI shows and
     what actually runs can never disagree. effectiveGuard() / effectiveTimer()
     are PURE — both the main process (before acting/writing) and the renderer
     (before drawing toggles/segments) call them, so the displayed state IS
     the enforced state:
       • guardian: guard stays ON, style becomes instant close (gentle/remind
         would let you sit on a warning card instead of losing the app), and
         "only during focus" is ignored — the guard never disarms mid-promise;
       • timer: strict mode is forced on (ending early earns zero XP);
       • pause: the timer may still be paused — pausing only STOPS THE CLOCK.
     SITES ARE NEVER TOUCHED: your "during focus / always" choice in the
     Sites section is free will — effectiveSites was removed on purpose, and
     nothing silently rewrites `when` to 'always' behind your back.
     When Iron is off these are identity functions — user choices untouched. */
  function effectiveGuard(guard, ironOn) {
    const g = Object.assign({}, guard || {});
    if (!ironOn) return g;
    g.enabled = true;
    g.action = 'instant';
    return g;
  }
  function effectiveTimer(timer, ironOn) {
    const t = Object.assign({}, timer || {});
    if (!ironOn) return t;
    t.strict = true;
    return t;
  }
  function objTimer(d) {
    const s = (d && d.settings) || {};
    if (!s.timer || typeof s.timer !== 'object' || Array.isArray(s.timer)) s.timer = {};
    return s.timer;
  }
  return { SENTENCE, COOLDOWN_SEC, LOCK_DAYS_DEFAULT, normalize, matches, lockDays, makeLock, isLocked, remainingHms, resolveIron, applyIron, sitePatchAllowed, focusItemsFrozen, focusItemsPatchAllowed, normalizeFields, effectiveGuard, effectiveTimer };
});
