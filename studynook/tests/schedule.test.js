/* ============================================================
   StudyNook · tests/schedule.test.js — Week Schedule pure logic
   + store persistence of d.schedule
   ============================================================ */
'use strict';
const SH = require('../app/shared/schedule.js');
const { sanitizeData, defaultData } = require('../app/main/store.js');

// fixed "now": Sunday 2026-09-27 → todayIndex() = 6 (Sun)
const NOW = new Date(2026, 8, 27, 12, 0, 0);
const key = (back) => SH.dateKey(back, NOW);

suite('schedule · sanitize', () => {
  test('valid block survives with clamped fields', () => {
    const b = SH.sanitizeBlock({ subject: 'Math', label: 'x'.repeat(90), min: 9999, at: '18:30', days: [0, 1, 9] });
    expect(b.subject).toBe('Math');
    expect(b.label.length).toBe(60);
    expect(b.min).toBe(600);
    expect(b.at).toBe('18:30');
    expect(b.days).toEqual([0, 1]);           // 9 dropped
    expect(b.enabled).toBeTruthy();
  });
  test('empty / no-day / junk blocks are rejected', () => {
    expect(SH.sanitizeBlock(null)).toBe(null);
    expect(SH.sanitizeBlock({ subject: '', label: '', days: [0] })).toBe(null);
    expect(SH.sanitizeBlock({ subject: 'Math', days: [] })).toBe(null);
    expect(SH.sanitizeBlock({ subject: 'Math', days: 'nope' })).toBe(null);
    const partial = SH.sanitizeBlock({ subject: 'Math', days: [-1, 7, 2] });   // only day 2 survives
    expect(partial.days).toEqual([2]);
  });
});

suite('schedule · crud caps & edits', () => {
  test('add refuses empty block and beyond MAX_BLOCKS', () => {
    const s = {};
    expect(SH.addBlock(s, { subject: '', days: [0] }).ok).toBeFalsy();
    for (let i = 0; i < SH.MAX_BLOCKS; i++) expect(SH.addBlock(s, { subject: 'S' + i, min: 10, days: [i % 7] }).ok).toBeTruthy();
    expect(Object.keys(s).length).toBe(SH.MAX_BLOCKS);
    const r = SH.addBlock(s, { subject: 'one too many', days: [0] });
    expect(r.ok).toBeFalsy(); expect(r.error).toBeTruthy();
  });
  test('update patches fields, keeps id; invalid patch refused', () => {
    const s = {};
    const { id } = SH.addBlock(s, { subject: 'Math', min: 25, days: [0, 1] });
    expect(SH.updateBlock(s, id, { min: 45, at: '07:00' }).ok).toBeTruthy();
    expect(s[id].min).toBe(45); expect(s[id].at).toBe('07:00'); expect(s[id].id).toBe(id);
    expect(SH.updateBlock(s, id, { days: [] }).ok).toBeFalsy();
    expect(SH.updateBlock(s, 'missing', { min: 5 }).ok).toBeFalsy();
  });
  test('toggle pauses/resumes; remove deletes', () => {
    const s = {};
    const { id } = SH.addBlock(s, { subject: 'Bio', min: 30, days: [2] });
    SH.toggleBlock(s, id); expect(s[id].enabled).toBeFalsy();
    SH.toggleBlock(s, id); expect(s[id].enabled).toBeTruthy();
    expect(SH.removeBlock(s, id)).toBeTruthy();
    expect(SH.removeBlock(s, id)).toBeFalsy();
  });
});

suite('schedule · planning math', () => {
  const s = {};
  SH.addBlock(s, { subject: 'Math', min: 45, at: '18:00', days: [0, 1, 2] });      // Mon-Wed
  SH.addBlock(s, { subject: 'Chem', min: 30, at: '18:00', days: [0, 4] });          // Mon, Fri
  SH.addBlock(s, { subject: 'Paused', min: 60, at: '09:00', days: [0], enabled: false });

  test('plannedByDay ignores disabled blocks', () => {
    expect(SH.plannedByDay(s)).toEqual([75, 45, 45, 0, 30, 0, 0]);
  });
  test('rowTimes merges same-time blocks into one row', () => {
    expect(SH.rowTimes(s)).toEqual(['18:00']);
  });
  test('blocksForDay sorts by time', () => {
    const s2 = {};
    SH.addBlock(s2, { subject: 'Late', min: 10, at: '20:00', days: [3] });
    SH.addBlock(s2, { subject: 'Early', min: 10, at: '08:00', days: [3] });
    SH.addBlock(s2, { subject: 'Anytime', min: 10, days: [3] });
    expect(SH.blocksForDay(s2, 3).map((b) => b.subject)).toEqual(['Early', 'Late', 'Anytime']);
    expect(SH.blocksForDay(s2, 0).length).toBe(0);
  });
  test('todayIndex maps Sunday→6, Monday→0', () => {
    expect(SH.todayIndex(new Date(2026, 8, 27))).toBe(6);   // Sun
    expect(SH.todayIndex(new Date(2026, 8, 28))).toBe(0);   // Mon
  });
  test('actualByDay reads the last 7 daily entries onto their weekdays', () => {
    const daily = { [key(0)]: { min: 10 }, [key(1)]: { min: 20 }, [key(6)]: { min: 5 } };
    const a = SH.actualByDay(daily, NOW);
    expect(a[6]).toBe(10);                       // today (Sun)
    expect(a[5]).toBe(20);                       // yesterday (Sat)
    expect(a[0]).toBe(5);                        // 6 days back (Mon)
    expect(a.reduce((x, y) => x + y, 0)).toBe(35);
  });
  test('summarize flags met days and unplanned pct=null', () => {
    const daily = { [key(6)]: { min: 5 } };    // last Monday got 5 focused min
    const sum = SH.summarize(s, daily, NOW);
    expect(sum[0].planned).toBe(75); expect(sum[0].actual).toBe(5);
    expect(sum[0].met).toBeFalsy(); expect(sum[0].pct).toBe(5 / 75);
    expect(sum[3].planned).toBe(0); expect(sum[3].pct).toBe(null);
    expect(sum[0].name).toBe('Mon');
  });
  test('totals sums plan (incl. every recurring day) and focus', () => {
    const t = SH.totals(s, { [key(0)]: { min: 40 } }, NOW);
    expect(t.plannedMin).toBe(195); expect(t.actualMin).toBe(40);   // 3×45 + 2×30
  });
});

suite('schedule · store integration', () => {
  test('default data has an empty schedule map', () => {
    expect(defaultData().schedule).toEqual({});
  });
  test('sanitizeData coerces hostile schedule payloads safely', () => {
    const d = sanitizeData({ schedule: {
      b1: { subject: 'Math', min: '45', at: '18:00', days: [0, 1, 'x', 99] },
      b2: null, b3: { subject: '', days: [] },
      b4: { label: 'library', min: 1e9, days: [2] }
    } });
    expect(Object.keys(d.schedule).sort()).toEqual(['b1', 'b4']);
    expect(d.schedule.b1.min).toBe(45);
    expect(d.schedule.b1.days).toEqual([0, 1]);
    expect(d.schedule.b4.min).toBe(600);
  });
  test('array/garbage schedule becomes {}', () => {
    expect(sanitizeData({ schedule: [1, 2, 3] }).schedule).toEqual({});
    expect(sanitizeData({ schedule: 'nope' }).schedule).toEqual({});
  });
  test('old data files without schedule get {} via deepMerge', () => {
    const legacy = JSON.parse(JSON.stringify(defaultData()));
    delete legacy.schedule;
    const { deepMerge } = require('../app/main/store.js');
    expect(sanitizeData(deepMerge(defaultData(), legacy)).schedule).toEqual({});
  });
});

suite('schedule · verification hardening', () => {
  test('same-millisecond adds never collide (fresh unique ids)', () => {
    const s = {};
    const ids = [];
    for (let i = 0; i < 12; i++) {
      const r = SH.addBlock(s, { subject: 'S' + i, min: 5, days: [i % 7] });
      expect(r.ok).toBeTruthy(); ids.push(r.id);
    }
    expect(new Set(ids).size).toBe(12);
    expect(Object.keys(s).length).toBe(12);
  });
  test('renderer-supplied id on add cannot overwrite an existing block', () => {
    const s = {};
    const id = SH.addBlock(s, { subject: 'Original', min: 30, days: [0] }).id;   // run.js tests are sync — no destructure
    const res = SH.addBlock(s, { id, subject: 'Impostor', min: 45, days: [1] });
    expect(res.ok).toBeTruthy();
    expect(res.id === id).toBeFalsy();           // fresh id generated server-side (no .not in run.js matcher)
    expect(s[id].subject).toBe('Original');      // untouched
    expect(Object.keys(s).length).toBe(2);
  });
  test('add into a missing/garbage schedule map fails gracefully', () => {
    expect(SH.addBlock(null, { subject: 'X', days: [0] }).ok).toBeFalsy();
    expect(SH.addBlock(undefined, { subject: 'X', days: [0] }).ok).toBeFalsy();
    expect(SH.addBlock('nope', { subject: 'X', days: [0] }).ok).toBeFalsy();
  });
  test('inherited keys are not removable/togglable/updatable (hasOwnProperty)', () => {
    function Fake() {} Fake.prototype.polluted = { subject: 'P', min: 5, days: [0], enabled: true };
    const s = new Fake();                        // s.polluted exists via prototype only
    expect(SH.removeBlock(s, 'polluted')).toBeFalsy();
    expect(SH.toggleBlock(s, 'polluted')).toBeFalsy();
    expect(SH.updateBlock(s, 'polluted', { min: 9 }).ok).toBeFalsy();
  });
  test('week boundaries: each weekday counts exactly one date in the rolling window', () => {
    // Anchor on a Monday: Sun(-1d) Fri(-3d) Wed(-5d) Mon(today) must land on 6,4,2,0
    const MON = new Date(2026, 8, 28, 9, 0, 0);
    const k = (b) => SH.dateKey(b, MON);
    const daily = { [k(0)]: { min: 5 }, [k(1)]: { min: 15 }, [k(3)]: { min: 40 }, [k(5)]: { min: 70 } };
    expect(SH.actualByDay(daily, MON)).toEqual([5, 0, 70, 0, 40, 0, 15]);
    // Anchor on a Sunday: yesterday is Saturday, six back is Monday
    const SUN = new Date(2026, 8, 27, 12, 0, 0);
    const kk = (b) => SH.dateKey(b, SUN);
    expect(SH.actualByDay({ [kk(0)]: { min: 1 }, [kk(1)]: { min: 2 }, [kk(6)]: { min: 3 } }, SUN))
      .toEqual([3, 0, 0, 0, 0, 2, 1]);
  });
  test('multiple blocks share one day without double-counting focus minutes', () => {
    const s = {};
    SH.addBlock(s, { subject: 'A', min: 30, days: [6] });
    SH.addBlock(s, { subject: 'B', min: 30, days: [6] });
    const SUN = new Date(2026, 8, 27, 12, 0, 0);
    const sum = SH.summarize(s, { [SH.dateKey(0, SUN)]: { min: 60 } }, SUN);
    expect(sum[6].planned).toBe(60); expect(sum[6].actual).toBe(60); expect(sum[6].met).toBeTruthy();
    expect(sum[6].pct).toBe(1);
  });
});

suite('schedule · final-release hardening', () => {
  test('sanitizeSchedule accepts arrays without crashing (defensive obj coercion)', () => {
    expect(SH.sanitizeSchedule([{ subject: 'Math', days: [0], min: 25 }])).toEqual({}); // arrays rejected → {}
    expect(SH.sanitizeSchedule(null)).toEqual({});
    expect(SH.sanitizeSchedule('nope')).toEqual({});
  });
  test('updateBlock rejects prototype keys (__proto__ never touches the map)', () => {
    const s = {};
    expect(SH.updateBlock(s, '__proto__', { min: 9 }).ok).toBeFalsy();
    expect(SH.removeBlock(s, '__proto__')).toBeFalsy();
    expect(SH.toggleBlock(s, 'constructor')).toBeFalsy();
  });
  test('summarize with no daily data at all → actual 0, pct 0, met false', () => {
    const s = {};
    SH.addBlock(s, { subject: 'Math', min: 45, days: [0, 1] });
    const sum = SH.summarize(s, {}, NOW);
    expect(sum[0].planned).toBe(45); expect(sum[0].actual).toBe(0);
    expect(sum[0].pct).toBe(0); expect(sum[0].met).toBeFalsy();
    expect(sum[2].planned).toBe(0); expect(sum[2].pct).toBe(null);
  });
  test('paused blocks are excluded from plan but kept in storage', () => {
    const s = {};
    const r = SH.addBlock(s, { subject: 'Gym', min: 60, days: [2] });
    SH.toggleBlock(s, r.id);
    expect(SH.plannedByDay(s)[2]).toBe(0);
    expect(Object.keys(s).length).toBe(1);
    SH.toggleBlock(s, r.id);
    expect(SH.plannedByDay(s)[2]).toBe(60);
  });
  test('totals never exceed real minutes even when focus overshoots plan', () => {
    const s = {};
    SH.addBlock(s, { subject: 'Math', min: 10, days: [6] });
    const SUN = new Date(2026, 8, 27, 12, 0, 0);
    const t = SH.totals(s, { [SH.dateKey(0, SUN)]: { min: 300 } }, SUN);
    expect(t.plannedMin).toBe(10); expect(t.actualMin).toBe(300);
    const sum = SH.summarize(s, { [SH.dateKey(0, SUN)]: { min: 300 } }, SUN);
    expect(sum[6].pct).toBe(1.5);   // capped — impossible percentages can't render
  });
});
