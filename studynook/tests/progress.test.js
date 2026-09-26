'use strict';
const P = require('../app/shared/progress.js');

suite('progress · levels & xp', () => {
  test('level 1 at 0 xp', () => expect(P.levelFromXp(0)).toBe(1));
  test('level 2 at 100 xp', () => expect(P.levelFromXp(100)).toBe(2));
  test('level 3 at 250 xp', () => expect(P.levelFromXp(250)).toBe(3));
  test('titles climb', () => expect(P.titleForLevel(1) === P.titleForLevel(40)).toBeFalsy());
  test('levelProgress pct sane', () => {
    const lp = P.levelProgress(150);
    expect(lp.level).toBe(2);
    expect(lp.into).toBe(50);
    expect(lp.need).toBe(150);
  });
});

suite('progress · pet stages', () => {
  test('egg at 0', () => expect(P.stageForMinutes(0)).toBe(0));
  test('baby at 45', () => expect(P.stageForMinutes(45)).toBe(1));
  test('legend at 2400', () => expect(P.stageForMinutes(2400)).toBe(5));
});

suite('progress · streaks', () => {
  test('first day starts streak', () => {
    const d = { streak: { current: 0, best: 0, lastFocusDay: null } };
    P.registerFocusDay(d, '2026-09-18');
    expect(d.streak.current).toBe(1);
  });
  test('consecutive days grow', () => {
    const d = { streak: { current: 0, best: 0, lastFocusDay: null } };
    P.registerFocusDay(d, '2026-09-18');
    P.registerFocusDay(d, '2026-09-19');
    P.registerFocusDay(d, '2026-09-20');
    expect(d.streak.current).toBe(3);
    expect(d.streak.best).toBe(3);
  });
  test('gap resets', () => {
    const d = { streak: { current: 0, best: 0, lastFocusDay: null } };
    P.registerFocusDay(d, '2026-09-18');
    P.registerFocusDay(d, '2026-09-20');
    expect(d.streak.current).toBe(1);
  });
  test('same day does not double', () => {
    const d = { streak: { current: 0, best: 0, lastFocusDay: null } };
    P.registerFocusDay(d, '2026-09-20');
    P.registerFocusDay(d, '2026-09-20');
    expect(d.streak.current).toBe(1);
  });
});

suite('progress · rewards & achievements', () => {
  function fresh() {
    return {
      pet: { name: 'Mochi', totalFocusMin: 0, stage: 0, pets: 0 },
      xp: 0, level: 1, daily: {}, counters: {}, achievements: {},
      streak: { current: 0, best: 0, lastFocusDay: null }
    };
  }
  test('completed session grants xp + first achievement', () => {
    const d = fresh();
    const r = P.focusRewards(d, 25, true, { kills: 0 });
    expect(r.xpGained).toBe(35); // 25 + 10 bonus
    expect(d.xp).toBe(35);
    expect(d.achievements.first_nook).toBeTruthy();
    expect(d.daily[P.dayStr()].min).toBe(25);
  });
  test('strict-style abandon still counts focused minutes but no bonus', () => {
    const d = fresh();
    const r = P.focusRewards(d, 12, false, {});
    expect(r.xpGained).toBe(12);
    expect(d.achievements.first_nook).toBeFalsy();
  });
  test('hatch achievement on stage up', () => {
    const d = fresh();
    P.focusRewards(d, 50, true, {});
    expect(d.pet.stage).toBe(1);
    expect(d.achievements.hatch).toBeTruthy();
  });
  test('zen needs zero kills', () => {
    const d = fresh();
    P.focusRewards(d, 30, true, { kills: 2 });
    expect(d.achievements.zen).toBeFalsy();
    const d2 = fresh();
    P.focusRewards(d2, 30, true, { kills: 0 });
    expect(d2.achievements.zen).toBeTruthy();
  });
});
