/* ============================================================
   StudyNook · idle.js — "Are you still here?"
   ------------------------------------------------------------
   During a RUNNING focus round, if the PC has had no mouse or
   keyboard input for `afterMin` minutes, a small card asks
   "Are you still here?". Any input anywhere closes it. If nothing
   happens for GRACE_SEC, the timer is paused: pausing only stops
   the clock, blocking stays on (SessionEngine rule).
   The input source is the OS idle time (Electron powerMonitor),
   so typing in another program counts as being here.
   decide() is pure so the rules are unit-tested without Electron.
   ============================================================ */
'use strict';

const GRACE_SEC = 60;
const CHECK_MS = 2000;
const DEFAULTS = { enabled: true, afterMin: 15 };

function normCfg(c) {
  const o = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  const n = Math.round(Number(o.afterMin));
  return { enabled: o.enabled !== false, afterMin: Number.isFinite(n) ? Math.max(2, Math.min(60, n)) : DEFAULTS.afterMin };
}

/**
 * One step of the watcher.
 * @param prompt  current prompt {since, deadline, idleAtShow} or null
 * @param input   {idleSec, now, focusing, cfg}
 * @returns {prompt, action: 'none'|'show'|'hide'|'pause'}
 */
function decide(prompt, input) {
  const cfg = normCfg(input.cfg);
  const { idleSec, now } = input;
  if (!cfg.enabled || !input.focusing) return { prompt: null, action: prompt ? 'hide' : 'none' };
  if (prompt) {
    // the idle counter restarts at 0 on any input, so a smaller value than when we asked means "they're back"
    if (idleSec < prompt.idleAtShow) return { prompt: null, action: 'hide' };
    if (now >= prompt.deadline) return { prompt: null, action: 'pause' };
    return { prompt, action: 'none' };
  }
  if (idleSec >= cfg.afterMin * 60) {
    return { prompt: { since: now, deadline: now + GRACE_SEC * 1000, idleAtShow: idleSec }, action: 'show' };
  }
  return { prompt: null, action: 'none' };
}

class IdleWatch {
  /**
   * hooks: getIdleSec() → seconds, getCfg() → settings.idle, session (SessionEngine),
   *        show(prompt), hide(), onPaused(), log(event, data)
   */
  constructor(hooks) { this.hooks = hooks; this.prompt = null; this.timer = null; }
  start() { this.stop(); this.timer = setInterval(() => this.check(), CHECK_MS); }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  /** "I'm here" button: same as moving the mouse. */
  dismiss() { if (this.prompt) { this.prompt = null; this.hooks.hide(); } }
  check(now) {
    const h = this.hooks;
    let idleSec = 0;
    try { idleSec = Number(h.getIdleSec()) || 0; } catch (e) { idleSec = 0; }
    const r = decide(this.prompt, { idleSec, now: now || Date.now(), focusing: !!(h.session && h.session.isFocusing()), cfg: h.getCfg() });
    this.prompt = r.prompt;
    if (r.action === 'show') { h.show(this.prompt); if (h.log) h.log('idle-asked', { idleSec }); }
    else if (r.action === 'hide') h.hide();
    else if (r.action === 'pause') {
      h.hide();
      h.session.pause();               // stops the clock only; a paused focus keeps blocking
      if (h.log) h.log('idle-paused', { idleSec });
      if (h.onPaused) h.onPaused();
    }
    return r.action;
  }
}

module.exports = { IdleWatch, decide, normCfg, GRACE_SEC, DEFAULTS };
