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
