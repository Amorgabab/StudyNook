/* ============================================================
   StudyNook · session.js — the focus timer engine
   ------------------------------------------------------------
   Lives in the MAIN process so your timer keeps running even
   if the window is hidden. Emits ticks every second and
   completes phases (focus → break → focus …).
   Modes:
     • pomodoro: work / short-break / long-break rounds
     • free:     one long focus stretch of your chosen length
   ============================================================ */
'use strict';

class SessionEngine {
  /**
   * @param {object} hooks
   *   getSettings() → data.settings.timer
   *   onTick(state)                    every second
   *   onPhaseEnd(info)                 a phase finished / session stopped
   *   onState()                        push fresh snapshot to all windows
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.s = null;                 // active session or null
    this.timer = null;
    this.lastTickSec = -1;
    this.killsThisSession = [];    // [{label, count}]
    /* Iron mode is chosen by the USER at session start (or via the iron
       switch): `isIron()` / `ironActive()` are the single authorities and
       they are scoped to the RUNNING FOCUS PHASE:
         • strictness (guard never disarms — not even while the timer is
           paused, instant close, strict mode on) applies ONLY while an iron
           focus is running — you choose iron or no-iron when you press Start;
         • PAUSE IS NOT BLOCKED: pausing an iron focus only stops the clock —
           the app guard keeps closing distractions the whole time. What iron
           still refuses is ending early without going through the gate;
         • your Sites choices ("during focus" vs "always", blocking on/off)
           are FREE WILL — nothing here rewrites them behind your back;
         • during breaks and after the session ends, your own saved guard
           choices apply again exactly as stored — nothing stays secretly
           hardened in the background;
         • mid-session file edits can neither enable nor disable the promise:
           the flag is frozen at start, and while the multi-day self-lock
           runs a restored/active iron focus keeps it anyway (tamper-proof).
       The stored switch itself is only ever *written* through settings:set's
       guarded path (Iron.applyIron); direct file edits are re-normalized on
       load (store.sanitizeData) and re-asserted on every save
       (store.enforceIron). */
    this.ironAtStart = false;
  }

  /** The engine's live view of "is this focus iron?". True only while a
      focus phase is actually running with iron chosen at start (or
      re-derived from the self-lock after a crash-restart). Idle / breaks →
      false: strictness is a per-session thing, decided when you press
      Start — never a permanent background mode. */
  isIron() {
    return !!(this.s && this.s.phase === 'focus' && this.s.iron);
  }

  /** Iron strictness is IN EFFECT only while a focus phase is actually
      running with iron chosen at start ("when starting the session, iron or
      no iron — you choose"). It is NOT tied to the multi-day switch lock:
      once the session ends, your own guard/site choices (gentle warn,
      only-during-focus, blocking off…) apply again exactly as saved.
      A hand-edited data.json can't fake it either — while the self-lock
      runs, an already-active iron focus keeps its promise.
      In effect means: the app guard never disarms (even if you pause the
      timer), closes instantly, and strict mode is on. Pause itself is
      allowed — it only stops the clock, never the blocking. */
  ironActive() {
    if (!this.s || this.s.phase !== 'focus') return false;
    if (this.hooks.isIronLocked && this.hooks.isIronLocked()) return true;
    return !!this.s.iron;
  }

  isActive() { return !!this.s; }
  isFocusing() { return !!this.s && this.s.phase === 'focus' && this.s.running; }
  isRunning() { return !!this.s && this.s.running; }
  /** True whenever a focus phase of the session exists and it was started
      as an iron one — RUNNING OR PAUSED. The app guard uses this so that
      pausing the timer in iron mode stops the CLOCK but never the blocking. */
  isIronFocus() { return !!(this.s && this.s.phase === 'focus' && this.s.iron); }

  start({ mode = 'pomodoro', freeMin = 0, taskId = null, label = '' } = {}) {
    const t = this.hooks.getSettings();
    /* You choose iron or no-iron HERE, when you press Start: the stored
       switch (kept true by the self-lock while your promise runs) is frozen
       into the session. Editing data.json mid-session can't change it. */
    const Iron = require('../shared/iron.js');
    const ironOn = Iron.resolveIron(t.iron, t.ironLockedUntil, Date.now());
    /* The chosen length is FROZEN at start: a free session keeps its own
       freeMin inside the snapshot, so changing workMin in Settings later —
       or restoring after a reinstall of a new build — can never rewrite the
       countdown of a session that is already running. */
    const reqFreeMin = Number(freeMin);
    const savedFreeMin = Number(this.s && this.s.mode === 'free' ? this.s.freeMin : NaN);
    const effFreeMin = Number.isFinite(reqFreeMin) && reqFreeMin > 0 ? reqFreeMin
      : (Number.isFinite(savedFreeMin) && savedFreeMin > 0 ? savedFreeMin : t.workMin);
    const workSec = (mode === 'free' ? effFreeMin : t.workMin) * 60;
    /* A focus can be STARTED while another is still live (e.g. a restored
       session that survived a crash/reinstall). Two protections here:
       1) NEVER shorten the countdown — the "2 hours reset to 1h40" bug. If
          the live focus has MORE time left than what's about to start, the
          request cannot override the promise; keep the existing session.
       2) REMEMBER the chosen length across restarts: after closing the app
          and installing a new version mid-session, the UI chips fall back
          to Settings' workMin (default 25m), so pressing Start feeds that
          fallback into the engine. Persisted free sessions carry their own
          freeMin; pomodoro rounds are governed by workMin — raise the
          stored value to at least the frozen round length instead of
          letting the stale/default setting clobber the running focus. */
    const prev = this.s;
    if (prev && prev.active !== false && prev.phase === 'focus') {
      const prevRem = prev.running
        ? Math.max(0, Math.round((prev.endsAt - Date.now()) / 1000))
        : Math.max(0, Number(prev.pausedRemaining) || 0);
      if (prevRem > workSec) return this.publicState();   // never shorten
      const reqMin = Math.ceil(workSec / 60);
      if (mode === 'free' && prev.mode === 'free') {
        const curFree = Number(prev.freeMin) || 0;
        if (reqMin > curFree) prev.freeMin = reqMin;      // lengthen the live free focus
      } else if (mode !== 'free') {
        const curWork = Number(t.workMin) || 0;
        if (reqMin > curWork) t.workMin = Math.min(600, reqMin);  // keep rounds ≥ the live focus
      }
      this._persist();
      return this.publicState();                          // live focus stays untouched
    }
    this.s = {
      mode,
      freeMin: mode === 'free' ? Math.round(effFreeMin) : undefined,
      running: true,
      phase: 'focus',
      phaseSec: workSec,
      endsAt: Date.now() + workSec * 1000,
      pausedRemaining: null,
      roundIdx: 0,
      rounds: mode === 'free' ? 1 : t.rounds,
      startedAt: Date.now(),
      sessionFocusSec: 0,        // focused seconds across the whole session
      phaseAccumStart: 0,        // sessionFocusSec snapshot at phase start
      phaseStartAt: Date.now(),
      taskId, label,
      iron: ironOn               // frozen at start — tamper-proof for this session
    };
    this.ironAtStart = this.s.iron;
    this.killsThisSession = [];
    this._loop();
    this._persist();
    this.hooks.onState && this.hooks.onState();
    return this.publicState();
  }

  pause() {
    /* Iron focus CAN be paused — pausing only stops the clock. The app
       guard keeps blocking the whole time (guardian.isArmed ignores the
       timer's running state while an iron focus exists), and ending early
       still has to go through the gate. */
    if (!this.s || !this.s.running) return this.publicState();
    this.s.sessionFocusSec += this._focusedSecInPhase();
    this.s.pausedRemaining = this.remainingSec();
    this.s.running = false;
    this._persist();
    this.hooks.onState && this.hooks.onState();
    return this.publicState();
  }

  resume() {
    if (!this.s || this.s.running) return this.publicState();
    this.s.running = true;
    this.s.endsAt = Date.now() + (this.s.pausedRemaining || this.remainingSec()) * 1000;
    this.s.pausedRemaining = null;
    this.s.phaseStartAt = Date.now();
    this._persist();
    this.hooks.onState && this.hooks.onState();
    return this.publicState();
  }

  /** Skip current BREAK to the next focus round. (Skipping focus = give up → use stop.) */
  skip() {
    if (!this.s || this.s.phase === 'focus') return this.stop({ abandon: true });
    /* Iron strictness: during an iron self-lock, breaks can't be skipped —
       that would let you fast-forward past a blocked period with the guard
       asleep. The break simply runs its course. */
    if (this.ironActive()) return this.publicState();
    return this._endPhase(false);
  }

  stop({ abandon = false } = {}) {
    if (!this.s) return null;
    const s = this.s;
    if (s.running) s.sessionFocusSec += this._focusedSecInPhase();
    const minutes = Math.floor(s.sessionFocusSec / 60);
    const info = {
      phase: 'session-stop', minutes, completed: false, abandon,
      kills: this.killsThisSession, mode: s.mode, taskId: s.taskId,
      label: s.label, startedAt: s.startedAt, roundsDone: s.roundIdx
    };
    this.s = null;
    this._stopLoop();
    this.killsThisSession = [];
    this._persist();
    this.hooks.onPhaseEnd && this.hooks.onPhaseEnd(info);
    this.hooks.onState && this.hooks.onState();
    return { minutes, abandon };
  }

  /** Compute how many seconds of the saved accum belong to the CURRENT open
      phase, using the persisted snapshot fields (never the live clock).
      Shared by restore() and recoverable() so both agree on the math. */
  static _phaseBankedSec(st, accum) {
    const savedTime = Number(st.savedAt) || Date.now();
    const remAtSave = st.running
      ? Math.max(0, Math.round(((Number(st.endsAt) || savedTime) - savedTime) / 1000))
      : Math.max(0, Number(st.pausedRemaining) || 0);
    // A session.json written by an older build may lack phaseStartAt — derive
    // it from the countdown snapshot (savedAt minus the remaining part of the
    // phase) so the banked-time math still works.
    const effPhaseStart = Number(st.phaseStartAt) || (savedTime - remAtSave * 1000);
    let phaseBanked = 0;
    if (st.phase === 'focus') {
      if (st.running) {
        // focus was ticking: everything since its start already sits in accum
        phaseBanked = Math.max(0, Math.min(Math.round((savedTime - effPhaseStart) / 1000), accum));
      } else {
        // paused focus: pausedRemaining was frozen at pause time
        phaseBanked = Math.max(0, (Number(st.phaseSec) || 0) - (Number(st.pausedRemaining) || 0));
        phaseBanked = Math.min(phaseBanked, accum);
      }
    }
    return phaseBanked;
  }

  /** Pure check used at boot BEFORE any mutation: can this persisted
      snapshot be resumed, or must it be salvaged? Returns
      { ok: true } when restore() would produce a live session, otherwise
      { ok: false, why } with a human-readable reason. Keeps main.js from
      half-restoring a broken state (e.g. a focus round whose full length
      elapsed while the app was dead). */
  static recoverable(st) {
    if (!st || !st.active) return { ok: false, why: 'no active session' };
    if (!['focus', 'short', 'long'].includes(st.phase)) return { ok: false, why: 'unknown phase in saved state' };
    const accum = Math.max(0, Number(st.accumSec) || 0);
    /* A snapshot from an older build (or a hand-edited file) may lack
       phaseSec. Without it we can't rebuild the countdown honestly —
       restoring would silently reset e.g. a 2-hour focus to the default
       workMin. Refuse; main.js salvages it as credit + feed note instead. */
    if (!(Number(st.phaseSec) > 0)) return { ok: false, why: 'saved session has no phase length to resume' };
    if (st.phase === 'focus' && st.running) {
      const phaseBanked = SessionEngine._phaseBankedSec(st, accum);
      const rem = Math.max(0, (Number(st.phaseSec) || 0) - phaseBanked);
      if (rem <= 0) return { ok: false, why: 'the focus round finished while the app was closed' };
    }
    return { ok: true };
  }

  /** Restore a persisted session after a crash / "End task" kill / restart.
      The engine was built for this (`persist` writes session.json every few
      seconds and `restore` reads it back) — but nobody ever called it, so a
      killed app made the session look like it never started. Now main.js
      actually restores it here.

      Time while the app was DEAD does not count against you: the timer
      resumes exactly where it was left, as if no time passed. For a RUNNING
      focus we keep only the focused seconds accrued up to the last persist
      (`accumSec` minus what the open phase had banked at save time) and
      rebuild `endsAt` from that remainder. The iron flag is NOT trusted from
      the file — it's re-derived live (switch on OR self-lock still running →
      iron stays on), so a hand-edited data.json can't smuggle a paused,
      iron-less session back in. */
  restore(st) {
    if (!st || !st.active) return null;
    // Refuse structurally invalid snapshots outright — never half-restore a
    // corrupt file into a zombie session (main.js salvages these instead).
    if (!['focus', 'short', 'long'].includes(st.phase)) return null;
    const Iron = require('../shared/iron.js');
    const t = this.hooks.getSettings() || {};
    const iron = Iron.resolveIron(t.iron, t.ironLockedUntil, Date.now());
    const accum = Math.max(0, Number(st.accumSec) || 0);
    const phaseBanked = SessionEngine._phaseBankedSec(st, accum);
    this.s = {
      mode: st.mode === 'free' ? 'free' : 'pomodoro',
      freeMin: Number(st.freeMin) > 0 ? Number(st.freeMin) : undefined,
      running: !!st.running,
      phase: ['focus', 'short', 'long'].includes(st.phase) ? st.phase : 'focus',
      phaseSec: Math.max(0, Number(st.phaseSec) || 0),
      endsAt: 0,
      pausedRemaining: Number(st.pausedRemaining) || 0,
      roundIdx: Math.max(0, Number(st.roundIdx) || 0),
      rounds: Math.max(1, Number(st.rounds) || 4),
      startedAt: Number(st.startedAt) || Date.now(),
      sessionFocusSec: Math.max(0, accum - phaseBanked),
      phaseAccumStart: Math.max(0, accum - phaseBanked),
      phaseStartAt: Date.now(),
      taskId: st.taskId || null, label: String(st.label || ''),
      iron
    };
    // Rebuild the countdown from where it was left off — dead time is free.
    if (this.s.phase === 'focus' && this.s.running) {
      const rem = Math.max(0, this.s.phaseSec - phaseBanked);
      this.s.pausedRemaining = null;
      this.s.endsAt = Date.now() + rem * 1000;
    } else if (this.s.running) {
      // a running break: honour its original end if it hasn't fully elapsed
      this.s.endsAt = Math.max(Date.now(), Number(st.endsAt) || Date.now());
    } else {
      this.s.pausedRemaining = this.s.pausedRemaining ||
        (this.s.phase === 'focus' ? Math.max(0, this.s.phaseSec - phaseBanked) : this.s.phaseSec);
    }
    this.ironAtStart = iron;
    this._lastRem = null;
    this.lastTickSec = -1;
    this.killsThisSession = [];
    this._loop();
    this.hooks.onState && this.hooks.onState();
    return this.publicState();
  }

  recordKill(label) {
    const hit = this.killsThisSession.find((k) => k.label === label);
    if (hit) hit.count += 1;
    else this.killsThisSession.push({ label, count: 1 });
  }

  remainingSec() {
    if (!this.s) return 0;
    if (!this.s.running) return this.s.pausedRemaining || 0;
    return Math.max(0, Math.round((this.s.endsAt - Date.now()) / 1000));
  }

  _focusedSecInPhase() {
    if (!this.s || !this.s.running || this.s.phase !== 'focus') return 0;
    return Math.max(0, Math.round((Date.now() - this.s.phaseStartAt) / 1000));
  }

  _loop() {
    this._stopLoop();
    this.timer = setInterval(() => this._tick(), 500);
  }
  _stopLoop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  _tick() {
    if (!this.s) return;
    let rem = this.remainingSec();
    // wall-clock jump protection: if remaining exceeds the phase length
    // (clock moved backwards), resync from the last sane remainder
    if (this.s.running && rem > this.s.phaseSec) {
      const sane = this._lastRem != null ? Math.min(this._lastRem, this.s.phaseSec) : this.s.phaseSec;
      this.s.endsAt = Date.now() + sane * 1000;
      rem = sane;
    }
    if (this.s.running) this._lastRem = rem;
    if (rem !== this.lastTickSec) {
      this.lastTickSec = rem;
      this.hooks.onTick && this.hooks.onTick(this.publicState());
      if (rem % 5 === 0) this._persist();   // crash-proof session persistence
    }
    if (rem <= 0 && this.s.running) this._endPhase(true);
  }

  /* ---------- crash/kill-proof persistence ---------- */
  persistState() {
    if (!this.s) return null;
    const s = this.s;
    return {
      active: true, mode: s.mode, freeMin: s.freeMin, running: s.running, phase: s.phase,
      phaseSec: s.phaseSec, endsAt: s.endsAt, pausedRemaining: s.pausedRemaining,
      roundIdx: s.roundIdx, rounds: s.rounds, taskId: s.taskId, label: s.label,
      startedAt: s.startedAt,
      phaseStartAt: s.phaseStartAt,
      accumSec: s.sessionFocusSec + this._focusedSecInPhase(),
      savedAt: Date.now()
    };
  }
  _persist() {
    if (!this.hooks.persist) return;
    try { this.hooks.persist(this.persistState()); } catch (e) {}
  }

  /** A phase finished naturally (completed=true) or was skipped (false). */
  _endPhase(completed) {
    const s = this.s;
    if (!s) return null;
    const t = this.hooks.getSettings();
    const wasFocus = s.phase === 'focus';
    let minutes = 0;

    if (wasFocus) {
      if (s.running) s.sessionFocusSec += this._focusedSecInPhase();
      const phaseFocusedSec = completed ? s.phaseSec : (s.sessionFocusSec - s.phaseAccumStart);
      minutes = completed ? Math.round(s.phaseSec / 60) : Math.floor(phaseFocusedSec / 60);
    }

    this.hooks.onPhaseEnd && this.hooks.onPhaseEnd({
      phase: s.phase, minutes, completed, abandon: false,
      kills: this.killsThisSession, mode: s.mode, taskId: s.taskId,
      label: s.label, startedAt: s.startedAt, roundsDone: s.roundIdx + (wasFocus ? 1 : 0)
    });

    /* ---- advance to the next phase ---- */
    if (s.mode === 'free') {
      this.s = null;
      this._stopLoop();
      this.hooks.onState && this.hooks.onState();
      return this.publicState();
    }

    const beginPhase = (phase, sec) => {
      s.phase = phase;
      s.phaseSec = sec;
      s.phaseAccumStart = s.sessionFocusSec;
      s.phaseStartAt = Date.now();
      const auto = phase === 'focus' ? t.autoStartFocus : t.autoStartBreaks;
      if (auto) { s.running = true; s.endsAt = Date.now() + sec * 1000; }
      else { s.running = false; s.pausedRemaining = sec; }
    };

    if (wasFocus) {
      s.roundIdx += 1;
      const isLong = s.roundIdx % Math.max(2, t.rounds) === 0;
      beginPhase(isLong ? 'long' : 'short', (isLong ? t.longMin : t.shortMin) * 60);
    } else {
      if (s.roundIdx >= s.rounds) {          // whole plan finished 🎉
        this.s = null;
        this._stopLoop();
        this.hooks.onState && this.hooks.onState();
        return this.publicState();
      }
      beginPhase('focus', t.workMin * 60);
    }
    this.lastTickSec = -1;
    this._persist();
    this.hooks.onState && this.hooks.onState();
    return this.publicState();
  }

  publicState() {
    if (!this.s) return { active: false, running: false, phase: 'idle', remainingSec: 0, totalSec: 0, roundIdx: 0, rounds: 0, mode: null, taskId: null, label: '' };
    const s = this.s;
    return {
      active: true,
      running: s.running,
      phase: s.phase,                       // focus | short | long
      remainingSec: this.remainingSec(),
      totalSec: s.phaseSec,
      roundIdx: s.roundIdx,
      rounds: s.rounds,
      mode: s.mode,
      taskId: s.taskId,
      label: s.label
    };
  }
}

module.exports = { SessionEngine };
