/* ============================================================
   StudyNook · guardian.js — the app blocker engine
   ------------------------------------------------------------
   While the guard is armed it scans running processes every
   `scanSec` seconds and deals with distractions:
     • gentle  → show a cozy warning, give a grace period, then close
     • instant → close immediately (still logged & toastable)
     • remind  → warn only, never close
   Safety rails (in this order):
     1. NEVER_KILL system list (catalog.js)
     2. our own PID
     3. temporary "leave it alone for 5 min" grants
     4. in allow mode: your allowlist apps are untouched
   The *decision* logic lives in planner.js (pure, unit-tested).
   ============================================================ */
'use strict';

const processes = require('./processes.js');
const planner = require('./planner.js');

class Guardian {
  /**
   * @param hooks
   *   store: Store
   *   session: SessionEngine
   *   onEvent({type:'warn'|'kill'|'warn-expired', label, count, norm})
   *   showReminder({label, norm, deadline}) / hideReminder()
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.timer = null;
    this.pausedUntil = 0;
    this.warned = new Map();     // pid → {norm, at}
    this.remindThrottle = new Map(); // norm → last reminder ts
    this.pendingReminder = null; // {label, norm, deadline}
    this.busy = false;
  }

  cfg() { return this.hooks.store.data.settings.guardian; }

  /** Iron strictness (shared/iron.js → effectiveGuard): while Iron is in
      effect the guard is ALWAYS on and closes apps instantly — no gentle
      warning you can sit on, no remind-only mode. The UI renders from the
      same helper, so what you see is exactly what runs. */
  effCfg() {
    const g = this.cfg();
    if (!this._ironActive()) return g;
    const Iron = require('../shared/iron.js');
    return Iron.effectiveGuard(g, true);
  }

  /** Iron in effect = self-lock running OR the switch on. Falls back to the
      raw stored flag when no session hook is wired (plain unit tests). */
  _ironActive() {
    const s = this.hooks.session;
    if (s && typeof s.ironActive === 'function') return s.ironActive();
    const t = (this.hooks.store.data.settings || {}).timer || {};
    return !!t.iron;
  }

  /* list/kill go through hooks when provided (tests), real OS otherwise */
  _list() { return this.hooks.listProcesses ? this.hooks.listProcesses() : processes.listProcesses(); }
  _kill(pid) { return this.hooks.killProcess ? this.hooks.killProcess(pid) : processes.killProcess(pid); }

  isArmed() {
    const g = this.effCfg();
    if (!g.enabled) return false;
    /* "Blocked pause" is gone by design: pausing the timer never stops
       blocking in Iron mode — a breathing-room request is simply ignored. */
    if (!this._ironActive() && Date.now() < this.pausedUntil) return false;
    if (g.onlyDuringSessions && !this._ironActive()) return this.hooks.session.isFocusing();
    return true;
  }

  start() { this._loop(); this._armWatch = setInterval(() => this._checkArmTransition(), 1000); }
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this._armWatch) { clearInterval(this._armWatch); this._armWatch = null; }
    this.hooks.hideReminder && this.hooks.hideReminder();
    this.pendingReminder = null;
  }
  _loop() {
    if (this.timer) clearInterval(this.timer);
    const sec = Math.max(1, this.cfg().scanSec || 3);
    this.timer = setInterval(() => this.scan(), sec * 1000);
  }
  /* Apps already open before a session don't "refresh" — but we re-read the
     whole process list each scan, so they're caught on the first one. This
     makes the first scan instant when the guard arms (session start). */
  _checkArmTransition() {
    const armed = this.isArmed();
    if (armed && !this._wasArmed) {
      this._wasArmed = true;
      this.scan();
      setTimeout(() => this.scan(), 2500);
    } else if (!armed) {
      this._wasArmed = false;
    }
  }

  /** Breathe-room pause. In Iron mode this is a no-op: the pause never stops
      blocking while iron is in effect (the UI hides the button, and even a
      direct IPC call lands here and gets refused). */
  pauseFor(min) {
    if (this._ironActive()) return false;
    this.pausedUntil = Date.now() + min * 60000;
    this.warned.clear();
    this.hooks.hideReminder && this.hooks.hideReminder();
    this.pendingReminder = null;
    return true;
  }
  pausedMinLeft() { return Math.max(0, Math.ceil((this.pausedUntil - Date.now()) / 60000)); }

  allowOnce(norm, min = 5) {
    /* Iron: "leave it open 5 min" grants are not granted — instant close wins. */
    if (this._ironActive()) return false;
    this.hooks.store.mutate((d) => { d.apps.allowOnce[norm] = Date.now() + min * 60000; });
    this.warned.clear();
    this.hooks.hideReminder && this.hooks.hideReminder();
    this.pendingReminder = null;
    return true;
  }

  async killNow(norm) { // used by the reminder window's "close it now" button
    const procs = await this._list();
    const store = this.hooks.store;
    let killed = 0;
    for (const p of procs) {
      if (p.norm !== norm) continue;
      const safe = planner.chooseTargets([p], {
        mode: 'block', block: [{ label: norm, procs: [norm], enabled: true }], allow: [], allowOnce: {}, platform: process.platform, selfPid: process.pid
      });
      if (!safe.length) continue;
      // re-verify immediately before killing (pid-reuse safety)
      const fresh = await this._list();
      if (!fresh.some((f) => f.pid === p.pid && f.norm === norm)) continue;
      await this._kill(p.pid);
      killed++;
    }
    if (killed) {
      store.mutate((d) => { d.counters.kills += killed; });
      this.hooks.session.recordKill(norm);
      this.hooks.onEvent && this.hooks.onEvent({ type: 'kill', label: norm, count: killed, norm });
    }
    this.hooks.hideReminder && this.hooks.hideReminder();
    this.pendingReminder = null;
    return killed;
  }

  /** Preview what allow-mode would close right now (for the safety modal). */
  async previewAllowlist() {
    const procs = await this._list();
    const d = this.hooks.store.data;
    const targets = planner.chooseTargets(procs, {
      mode: 'allow', block: [], allow: d.apps.allow, allowOnce: d.apps.allowOnce,
      platform: process.platform, selfPid: process.pid
    });
    return planner.groupTargets(targets);
  }

  async scan() {
    if (this.busy) return;
    if (!this.isArmed()) {
      if (this.pendingReminder) { this.hooks.hideReminder && this.hooks.hideReminder(); this.pendingReminder = null; }
      return;
    }
    this.busy = true;
    try {
      const g = this.effCfg();   // iron-hardened view — UI shows the same thing
      const d = this.hooks.store.data;
      const procs = await this._list();
      const targets = planner.chooseTargets(procs, {
        mode: g.mode,
        block: d.apps.block,
        allow: d.apps.allow,
        allowOnce: d.apps.allowOnce,
        platform: process.platform,
        selfPid: process.pid
      });
      const groups = planner.groupTargets(targets);
      // Drop warnings for apps that are no longer running
      const activeLabels = new Set(groups.map((g) => g.label));
      for (const label of [...this.warned.keys()]) if (!activeLabels.has(label)) this.warned.delete(label);

      for (const grp of groups) {
        if (g.action === 'instant') {
          await this._killGroup(grp);
        } else {
          // gentle / remind
          const w = this.warned.get(grp.label);
          if (!w) {
            this.warned.set(grp.label, { at: Date.now() });
            this._maybeRemind(grp);
          } else if (g.action === 'gentle' && Date.now() - w.at >= (g.graceSec || 15) * 1000) {
            await this._killGroup(grp);
            this.warned.delete(grp.label);
          } else if (g.action === 'remind') {
            this._maybeRemind(grp);
          }
        }
      }
    } catch (e) {
      console.error('[guardian] scan error:', e.message);
    } finally {
      this.busy = false;
    }
  }

  _maybeRemind(grp) {
    const now = Date.now();
    const last = this.remindThrottle.get(grp.label) || 0;
    if (now - last < 90000) return;          // don't nag more than every 90s per app
    this.remindThrottle.set(grp.label, now);
    const g = this.effCfg();
    const deadline = now + (g.action === 'gentle' ? (g.graceSec || 15) : 30) * 1000;
    this.pendingReminder = { label: grp.label, norm: (grp.norms && grp.norms[0]) || grp.label, count: grp.count, deadline, gentle: g.action === 'gentle' };
    this.hooks.onEvent && this.hooks.onEvent({ type: 'warn', label: grp.label, count: grp.count });
    this.hooks.showReminder && this.hooks.showReminder(this.pendingReminder);
  }

  async _killGroup(grp) {
    // PID-reuse safety: re-verify each pid still runs a matching process
    let fresh = [];
    try { fresh = await this._list(); } catch (e) { fresh = []; }
    const alive = new Set(fresh.filter((p) => grp.norms.includes(p.norm)).map((p) => p.pid));
    let killed = 0;
    for (const pid of grp.pids) {
      if (!alive.has(pid)) continue;   // gone or reused by another program — skip
      await this._kill(pid);
      killed++;
    }
    if (killed) {
      this.hooks.store.mutate((d) => { d.counters.kills = (d.counters.kills || 0) + killed; });
      this.hooks.session.recordKill(grp.label);
      this.hooks.onEvent && this.hooks.onEvent({ type: 'kill', label: grp.label, count: killed });
    }
  }
}

module.exports = { Guardian };
