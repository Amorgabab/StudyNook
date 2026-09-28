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
    /* Iron mode is decided by the ENGINE at session start, not by whatever a
       hand-edited data.json currently claims. `isIron()` / `ironActive()` are
       the single authorities and they are scoped to the RUNNING FOCUS PHASE:
         • strictness (no pause, guard never disarms, instant close, sites
           always-blocked) applies ONLY while an iron focus is running — you
           choose iron or no-iron when you press Start;
         • during breaks and after the session ends, your own saved guard /
           site choices apply again exactly as stored — nothing stays
           secretly hardened in the background;
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
      runs, an already-active iron focus keeps its promise. */
  ironActive() {
    if (!this.s || this.s.phase !== 'focus') return false;
    if (this.hooks.isIronLocked && this.hooks.isIronLocked()) return true;
    return !!this.s.iron;
  }

  isActive() { return !!this.s; }
  isFocusing() { return !!this.s && this.s.phase === 'focus' && this.s.running; }
  isRunning() { return !!this.s && this.s.running; }

  start({ mode = 'pomodoro', freeMin = 0, taskId = null, label = '' } = {}) {
    const t = this.hooks.getSettings();
    /* You choose iron or no-iron HERE, when you press Start: the stored
       switch (kept true by the self-lock while your promise runs) is frozen
       into the session. Editing data.json mid-session can't change it. */
    const Iron = require('../shared/iron.js');
    const ironOn = Iron.resolveIron(t.iron, t.ironLockedUntil, Date.now());
    const workSec = (mode === 'free' ? (freeMin || t.workMin) : t.workMin) * 60;
    this.s = {
      mode,
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
    // Iron focus: no pausing — the engine refuses, whatever the settings file says.
    if (this.ironActive()) return this.publicState();
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

  /** Restore a persisted session after a crash/restart. The iron flag is NOT
      trusted from the file — it's re-derived live at start (switch on OR
      self-lock still running → iron stays on), so a hand-edited data.json
      can't smuggle a paused, iron-less session back in. */
  restore(st) {
    if (!st || !st.active) return null;
    const Iron = require('../shared/iron.js');
    const t = this.hooks.getSettings() || {};
    const iron = Iron.resolveIron(t.iron, t.ironLockedUntil, Date.now());
    this.s = {
      mode: st.mode === 'free' ? 'free' : 'pomodoro',
      running: !!st.running,
      phase: ['focus', 'short', 'long'].includes(st.phase) ? st.phase : 'focus',
      phaseSec: Math.max(0, Number(st.phaseSec) || 0),
      endsAt: Number(st.endsAt) || Date.now(),
      pausedRemaining: Number(st.pausedRemaining) || 0,
      roundIdx: Math.max(0, Number(st.roundIdx) || 0),
      rounds: Math.max(1, Number(st.rounds) || 4),
      startedAt: Number(st.startedAt) || Date.now(),
      sessionFocusSec: Math.max(0, Number(st.accumSec) || 0),
      phaseAccumStart: Math.max(0, Number(st.accumSec) || 0),
      phaseStartAt: Date.now(),
      taskId: st.taskId || null, label: String(st.label || ''),
      iron
    };
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
      active: true, mode: s.mode, running: s.running, phase: s.phase,
      phaseSec: s.phaseSec, endsAt: s.endsAt, pausedRemaining: s.pausedRemaining,
      roundIdx: s.roundIdx, rounds: s.rounds, taskId: s.taskId, label: s.label,
      startedAt: s.startedAt,
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
