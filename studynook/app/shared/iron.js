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
     when the lock is not running. Pure helpers — no fs, no electron.

     WHAT IRON FREEZES (promise scope): turning iron on means "no flipping
     the big switches mid-promise", so during an iron FOCUS the Site-blocking
     ON/OFF switch and the Blocklist↔Allowlist mode are frozen — exactly the
     state you committed to when you pressed Start. Choosing iron for a
     session was free will; backing out of the two big switches halfway is
     not. Everything else (the lists, during-focus/always) stays editable.

     THE LOCK IS NOT AN ACTIVE PROMISE: the multi-day switch lock exists to
     stop the iron toggle from being flipped off-and-on as a loophole — it
     keeps `resolveIron()` true until it expires. It must NEVER freeze the
     site switches: with sites.enabled=false and mode=Blocklist chosen
     BEFORE turning iron on, freezing those switches for days would leave
     blocking stuck OFF (and the mode stuck) long after every focus ended —
     a dead lockout, not a kept promise. So the freeze follows the live
     iron focus (running OR paused), which is what "while iron runs" means
     everywhere else in the app (see session.ironActive / App.ironFocusOn). */
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
      While a LIVE iron focus runs — running OR paused, never just because
      the multi-day switch lock ticks — the Site-blocking ON/OFF switch and
      the Blocklist↔Allowlist mode are FROZEN: patches carrying those fields
      are dropped entirely (lists stay editable — adding blocked sites only
      ever strengthens the promise). With no iron focus in progress the gate
      is transparent: every choice is free will, even while the iron switch
      stays locked ON (that lock only guards the iron toggle itself — see
      the promise-scope note above, and bug: freezing for the whole lock
      stranded users who turned iron on with blocking OFF / Blocklist).
      Returns true when the patch may be applied.
      `ironFocus` = an iron focus phase exists right now (live session view;
      pass false/undefined when there is none). The stored `timer` is read
      as a belt-and-braces fallback: if the caller couldn't consult the
      session engine but the file still says an iron focus was underway,
      the freeze holds. The LOCK alone never freezes anything here. */
  function sitePatchAllowed(timer, ironFocus, now, patch) {
    const p = (patch && typeof patch === 'object' && !Array.isArray(patch)) ? patch : {};
    const t = (timer && typeof timer === 'object' && !Array.isArray(timer)) ? timer : {};
    const focusOn = !!ironFocus || !!t.ironFocusActive;
    if (!focusOn) return true;
    if ('enabled' in p || 'mode' in p) return false;   // 🔒 frozen during an iron focus
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
  return { SENTENCE, COOLDOWN_SEC, LOCK_DAYS_DEFAULT, normalize, matches, lockDays, makeLock, isLocked, remainingHms, resolveIron, applyIron, sitePatchAllowed, normalizeFields, effectiveGuard, effectiveTimer };
});
