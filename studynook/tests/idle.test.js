'use strict';
/* "Are you still here?": asks after a stretch with no input during a running focus, closes on any input,
   pauses (never stops blocking) when nobody answers. */
const fs = require('fs');
const path = require('path');
const { IdleWatch, decide, normCfg, GRACE_SEC } = require('../app/main/idle.js');
const { SessionEngine } = require('../app/main/session.js');

const CFG = { enabled: true, afterMin: 15 };
const T0 = 1e12;

suite('idle check · rules', () => {
  test('asks only after afterMin minutes without input, only while a focus round runs', () => {
    expect(decide(null, { idleSec: 14 * 60, now: T0, focusing: true, cfg: CFG }).action).toBe('none');
    const r = decide(null, { idleSec: 15 * 60, now: T0, focusing: true, cfg: CFG });
    expect(r.action).toBe('show');
    expect(r.prompt.deadline).toBe(T0 + GRACE_SEC * 1000);
    expect(decide(null, { idleSec: 99 * 60, now: T0, focusing: false, cfg: CFG }).action).toBe('none');
    expect(decide(null, { idleSec: 99 * 60, now: T0, focusing: true, cfg: { enabled: false, afterMin: 15 } }).action).toBe('none');
  });
  test('any input closes the card; no input until the deadline pauses', () => {
    const p = decide(null, { idleSec: 900, now: T0, focusing: true, cfg: CFG }).prompt;
    expect(decide(p, { idleSec: 930, now: T0 + 30000, focusing: true, cfg: CFG }).action).toBe('none');
    expect(decide(p, { idleSec: 2, now: T0 + 30000, focusing: true, cfg: CFG }).action).toBe('hide');
    expect(decide(p, { idleSec: 960, now: T0 + GRACE_SEC * 1000, focusing: true, cfg: CFG }).action).toBe('pause');
  });
  test('the card goes away if the round ends or is paused meanwhile', () => {
    const p = decide(null, { idleSec: 900, now: T0, focusing: true, cfg: CFG }).prompt;
    expect(decide(p, { idleSec: 910, now: T0 + 5000, focusing: false, cfg: CFG }).action).toBe('hide');
  });
  test('settings are clamped to 2-60 minutes, default 15, on unless switched off', () => {
    expect(normCfg({ afterMin: 1 }).afterMin).toBe(2);
    expect(normCfg({ afterMin: 999 }).afterMin).toBe(60);
    expect(normCfg(null)).toEqual({ enabled: true, afterMin: 15 });
    expect(normCfg({ enabled: false }).enabled).toBe(false);
  });
});

suite('idle check · with the real engine', () => {
  function setup() {
    const eng = new SessionEngine({ getSettings: () => ({ workMin: 25, shortMin: 5, longMin: 15, rounds: 4 }), onTick: () => {}, onState: () => {}, onPhaseEnd: () => {} });
    eng.start({ mode: 'pomodoro' });
    let idleSec = 0; const seen = [];
    const w = new IdleWatch({ session: eng, getIdleSec: () => idleSec, getCfg: () => CFG, show: () => seen.push('show'), hide: () => seen.push('hide'), log: (e) => seen.push(e) });
    return { eng, w, seen, setIdle: (s) => { idleSec = s; } };
  }
  test('away: asks, then pauses the clock while blocking stays on', () => {
    const { eng, w, seen, setIdle } = setup();
    setIdle(15 * 60); w.check(T0);
    expect(seen.includes('show')).toBe(true);
    setIdle(16 * 60); w.check(T0 + GRACE_SEC * 1000);
    expect(eng.isTicking()).toBe(false);
    expect(eng.isFocusPhase()).toBe(true);              // paused focus still blocks
    expect(eng.publicState().blockActive).toBe(true);
    expect(seen.includes('idle-paused')).toBe(true);
    eng.stop({});
  });
  test('back in time: the card closes and the timer keeps running', () => {
    const { eng, w, seen, setIdle } = setup();
    setIdle(15 * 60); w.check(T0);
    setIdle(1); w.check(T0 + 20000);
    expect(seen).toEqual(['show', 'idle-asked', 'hide']);
    expect(eng.isTicking()).toBe(true);
    eng.stop({});
  });
});

suite('idle check · wiring', () => {
  const main = fs.readFileSync(path.join(__dirname, '../app/main/main.js'), 'utf8');
  test('the card is shown without taking focus and uses the OS idle time', () => {
    expect(/showInactive\(\)/.test(main)).toBe(true);
    expect(/powerMonitor\.getSystemIdleTime\(\)/.test(main)).toBe(true);
  });
});
