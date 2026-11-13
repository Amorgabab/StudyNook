'use strict';
/* Removing blocked apps/sites only right after a 2h+ finished session, and tasks that reward XP once. */
const fs = require('fs');
const path = require('path');
const Iron = require('../app/shared/iron.js');
const { SessionEngine } = require('../app/main/session.js');
const { sanitizeData, defaultData } = require('../app/main/store.js');

const T = { workMin: 30, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: true, iron: false, ironLockedUntil: 0 };
function engine(timer) {
  const done = [];
  const eng = new SessionEngine({ getSettings: () => Object.assign({}, T, timer || {}), onTick: () => {}, onState: () => {}, onPhaseEnd: () => {}, onSessionComplete: (x) => done.push(x) });
  return { eng, done };
}
/** Let the current phase run out (as if its time had passed). */
function finishPhase(eng) {
  if (eng.s.phase === 'focus') eng.s.phaseStartAt = Date.now() - eng.s.phaseSec * 1000;
  eng.s.endsAt = Date.now() - 1;
  eng._lastTickAt = Date.now();
  eng._tick();
}

suite('removal window · rule', () => {
  test('removal only inside the window and never while the lists are frozen', () => {
    const now = Date.now();
    expect(Iron.canRemove(0, now, false)).toBe(false);
    expect(Iron.canRemove(now + 60000, now, false)).toBe(true);
    expect(Iron.canRemove(now + 60000, now, true)).toBe(false);
    expect(Iron.canRemove(now - 1, now, false)).toBe(false);
  });
  test('keepBlocked keeps every blocked site and lets new ones in', () => {
    const out = Iron.keepBlocked({ block: ['a.com', 'b.com'] }, { block: ['b.com', 'c.com'], allow: ['x.com'], mode: 'allow' });
    expect(out.block.slice().sort()).toEqual(['a.com', 'b.com', 'c.com']);
    expect(out.allow).toEqual(['x.com']);
    expect(out.mode).toBe('allow');
  });
  test('a hand-edited far-future unlock is cut to one window; old values clear', () => {
    const d = defaultData();
    d.listsUnlockUntil = Date.now() + 365 * 86400000;
    sanitizeData(d);
    expect(d.listsUnlockUntil <= Date.now() + Iron.UNLOCK_MIN * 60000).toBe(true);
    d.listsUnlockUntil = Date.now() - 5;
    sanitizeData(d);
    expect(d.listsUnlockUntil).toBe(0);
  });
});

suite('removal window · which sessions open it', () => {
  test('a 2-hour free session that runs to its end reports 120 focused minutes', () => {
    const { eng, done } = engine();
    eng.start({ mode: 'free', freeMin: 120 });
    finishPhase(eng);
    expect(eng.isActive()).toBe(false);
    expect(done.length).toBe(1);
    expect(done[0].focusMin >= Iron.UNLOCK_SESSION_MIN).toBe(true);
  });
  test('a 4 x 30 min Pomodoro plan reports only when every round is done', () => {
    const { eng, done } = engine();
    eng.start({ mode: 'pomodoro' });
    for (let i = 0; i < 8 && eng.isActive(); i++) { expect(done.length).toBe(0); finishPhase(eng); }
    expect(eng.isActive()).toBe(false);
    expect(done.length).toBe(1);
    expect(done[0].focusMin).toBe(120);
  });
  test('ending early never opens the window; a 1-hour session reports too little', () => {
    const a = engine();
    a.eng.start({ mode: 'free', freeMin: 120 });
    a.eng.stop({ abandon: true });
    expect(a.done.length).toBe(0);
    const b = engine();
    b.eng.start({ mode: 'free', freeMin: 60 });
    finishPhase(b.eng);
    expect(b.done[0].focusMin < Iron.UNLOCK_SESSION_MIN).toBe(true);
  });
});

suite('removal window · every writer checks it', () => {
  const ipc = fs.readFileSync(path.join(__dirname, '../app/main/ipc.js'), 'utf8');
  const bridge = fs.readFileSync(path.join(__dirname, '../app/main/sync-server.js'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '../app/main/main.js'), 'utf8');
  test('apps:remove and apps:toggle (turning off) are refused outside the window', () => {
    expect(/H\('apps:remove'[\s\S]{0,300}blockRemovalLocked\(\)/.test(ipc)).toBe(true);
    expect(/H\('apps:toggle'[\s\S]{0,400}enabled !== false && blockRemovalLocked\(\)/.test(ipc)).toBe(true);
  });
  test('sites:set and POST /sites keep blocked sites outside the window', () => {
    expect(/Iron\.canRemove\(d\.listsUnlockUntil[\s\S]{0,80}Iron\.keepBlocked\(before, d\.sites\)/.test(ipc)).toBe(true);
    expect(/Iron\.canRemove\(d\.listsUnlockUntil[\s\S]{0,80}Iron\.keepBlocked\(before, d\.sites\)/.test(bridge)).toBe(true);
  });
  test('main opens the window only for UNLOCK_SESSION_MIN+ sessions', () => {
    expect(/onSessionComplete[\s\S]{0,120}focusMin < Iron\.UNLOCK_SESSION_MIN\) return/.test(main)).toBe(true);
  });
});

suite('tasks · XP once', () => {
  test('old done tasks count as already rewarded; kind is inferred', () => {
    const d = defaultData();
    d.tasks = [
      { id: 't1', text: 'old done', done: true, min: 0, est: 2 },
      { id: 't2', text: 'free one', done: false, min: 45 },
      { id: 't3', text: 'pomo one', done: false, min: 0, est: 3 }
    ];
    sanitizeData(d);
    expect(d.tasks.map((t) => t.xpGiven)).toEqual([true, false, false]);
    expect(d.tasks.map((t) => t.kind)).toEqual(['pomodoro', 'free', 'pomodoro']);
  });
  test('tasks:toggle and tasks:complete reward only when xpGiven is not set', () => {
    const ipc = fs.readFileSync(path.join(__dirname, '../app/main/ipc.js'), 'utf8');
    expect(/if \(t\.done && !t\.xpGiven\)/.test(ipc)).toBe(true);
    expect(/H\('tasks:complete'[\s\S]{0,300}const reward = !t\.xpGiven;[\s\S]{0,200}d\.tasks = d\.tasks\.filter/.test(ipc)).toBe(true);
  });
  test('the "ask before completing" setting defaults on and is a boolean', () => {
    const d = defaultData();
    expect(d.settings.confirmTaskDone).toBe(true);
    d.settings.confirmTaskDone = 'no';
    sanitizeData(d);
    expect(d.settings.confirmTaskDone).toBe(true);
    d.settings.confirmTaskDone = false;
    sanitizeData(d);
    expect(d.settings.confirmTaskDone).toBe(false);
  });
});
