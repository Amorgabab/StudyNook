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
  /* Case, spacing, accents (é = e), curly vs straight apostrophes and Arabic
     diacritics/tatweel are ignored, so the translated sentence is typeable on
     any keyboard — the friction is the cool-down and the typing, not spelling. */
  function normalize(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ًͯ-ٕـ]/g, '')
      .replace(/[‘’]/g, "'").replace(/[آأإ]/g, 'ا').toLowerCase().replace(/\s+/g, ' ').trim();
  }
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
    if (v && !t.iron) {
      /* Snapshot the gentle choices BEFORE hardening — exactly once per
         promise. store.enforceIron() re-asserts strictness on every write;
         it only fills this snapshot when missing, so rapid toggling can
         never overwrite it with already-hardened values. */
      const sites = (d && d.sites) || {};
      d.__ironSaved = {
        guard: Object.assign({}, (d.settings || {}).guardian),
        sites: { enabled: sites.enabled !== false, mode: sites.mode === 'allow' ? 'allow' : 'block' }
      };
      t.ironLockedUntil = makeLock(now, t.ironLockDays);
    }
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

  /* ---------- Iron strictness: one source of truth for every surface ----------
     Choosing Iron when you press Start doesn't just mean "no early stop":
     while that iron focus runs, the guards harden so what the UI shows and
     what actually runs can never disagree. effectiveGuard() / effectiveTimer()
     are PURE — both the main process (before acting/writing) and the renderer
     (before drawing toggles/segments) call them, so the displayed state IS
     the enforced state:
       • guardian: guard stays ON, style becomes instant close (gentle/remind
         would let you sit on a warning card instead of losing the app), and
         "only during focus" is ignored — the guard never disarms mid-promise.
         The list MODE (blocklist vs allowlist) stays YOUR choice in iron too;
       • timer: strict mode is forced on (ending early earns zero XP);
       • pause: the timer may still be paused — pausing only STOPS THE CLOCK.
     SITES: the master switch is not free will during an iron promise —
     effectiveSites() forces site blocking ON whenever the self-lock runs
     (the whole point of the promise is that distractions get blocked, and
     the switch used to be flip-able mid-session). The list MODE and your
     "during focus / always" timing choice stay YOURS — `mode` and `when`
     are never rewritten. Outside iron, sites settings pass through
     untouched.
     When Iron is off these are identity functions — user choices untouched. */
  function effectiveGuard(guard, ironOn) {
    const g = Object.assign({}, guard || {});
    if (!ironOn) return g;
    g.enabled = true;
    g.action = 'instant';
    /* MODE stays YOURS in iron too — pick blocklist or allowlist freely.
       (It used to be forced to 'allow', which made the choice disappear.) */
    return g;
  }
  /** Iron lock → site blocking is always ON. The list MODE (block vs allow)
      is deliberately left alone — free will, like `when`. */
  function effectiveSites(sites, locked) {
    const s = Object.assign({}, sites || {});
    if (locked) s.enabled = true;
    return s;
  }
  function effectiveTimer(timer, ironOn) {
    const t = Object.assign({}, timer || {});
    if (!ironOn) return t;
    t.strict = true;
    return t;
  }
  /** Iron list-freeze: while an iron FOCUS is running (or the multi-day
      self-lock runs), the block LISTS are part of the promise too — you may
      add distractions to the blocked side, but nothing on either list can be
      disabled or removed mid-promise. Adding to the allow list is refused by
      the same rule (it would disarm blocking). Outside iron everything
      passes through untouched. */
  function listsFrozen(ironFocusOn, locked) {
    return !!ironFocusOn || !!locked;
  }
  /** Filter a proposed apps-list against the frozen one: entries that exist
      in the frozen snapshot keep their frozen id/enabled state; new entries
      are only kept when they belong to the BLOCK list (adding more blocking
      is always allowed). Returns { ok, list } — ok=false when the change
      tried to disable/remove an existing entry or touch the allow list. */
  function filterFrozenList(frozen, wanted, listKey) {
    const f = Array.isArray(frozen) ? frozen : [];
    const w = Array.isArray(wanted) ? wanted : [];
    const out = f.slice();
    const byId = new Map(f.map((e) => [e.id, e]));
    for (const e of w) {
      const orig = e && byId.get(e.id);
      if (orig) {
        /* An existing entry must keep its FROZEN enabled state. Comparing
           against the normalized truthy value (not `!== false`) means a
           malformed payload can't sneak an "enabled: undefined/null" edit
           past the gate and effectively disable the entry. */
        if (!!e && e.enabled !== !!orig.enabled) return { ok: false, list: f }; // unblock attempt
        continue; // existing entry — stays exactly as frozen
      }
      if (listKey === 'allow') return { ok: false, list: f }; // new exemption — refused
      out.push(e); // new block entry — welcome aboard
    }
    // Removals of existing entries are invisible here because `out` starts
    // from the FULL frozen list — anything missing from `wanted` survives.
    return { ok: true, list: out };
  }
  /** The single authority on whether the app LISTS are frozen right now:
      either an iron focus exists (running or paused — the promise covers the
      whole session) or the multi-day self-lock runs. Both main.js (IPC guard)
      and the renderer (disabled buttons) derive this the same way so the UI
      never offers a toggle the backend would refuse anyway. */
  function listsFrozenState(sessionIronFocus, locked) {
    return listsFrozen(!!sessionIronFocus, !!locked);
  }
  function objTimer(d) {
    const s = (d && d.settings) || {};
    if (!s.timer || typeof s.timer !== 'object' || Array.isArray(s.timer)) s.timer = {};
    return s.timer;
  }
  return { SENTENCE, COOLDOWN_SEC, LOCK_DAYS_DEFAULT, normalize, matches, lockDays, makeLock, isLocked, remainingHms, resolveIron, applyIron, normalizeFields, effectiveGuard, effectiveSites, effectiveTimer, listsFrozen, listsFrozenState, filterFrozenList };
});
