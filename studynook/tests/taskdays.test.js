/* ============================================================
   StudyNook · tests/taskdays.test.js — weekly task planner (pure)
   Covers: date validation, Monday-based week math, grouping,
   overdue detection, sanitizer round-trip through the store.
   ============================================================ */
'use strict';
const TD = require('../app/shared/taskdays.js');

suite('TaskDays · date validation', () => {
  test('accepts real calendar dates', () => {
    expect(TD.normDate('2026-09-27')).toBe('2026-09-27');
    expect(TD.normDate('  2026-01-01  ')).toBe('2026-01-01');
  });
  test('rejects malformed / impossible / wrong-type dates', () => {
    expect(TD.normDate('2026-2-30')).toBe(null);      // not zero-padded
    expect(TD.normDate('2026-02-30')).toBe(null);     // Feb 30 doesn't exist
    expect(TD.normDate('2024-02-29')).toBe('2024-02-29'); // leap year OK
    expect(TD.normDate('hello')).toBe(null);
    expect(TD.normDate('')).toBe(null);
    expect(TD.normDate(null)).toBe(null);
    expect(TD.normDate(20260927)).toBe(null);
    expect(TD.normDate('1999-12-31')).toBe(null);     // out of sane range
    expect(TD.normDate('2101-01-01')).toBe(null);
    expect(TD.normDate({ toString() { return 'x'; } })).toBe(null);
  });
});

suite('TaskDays · week math', () => {
  test('Monday maps to itself; Sunday belongs to the Monday that started its week', () => {
    expect(TD.weekStart('2026-09-28')).toBe('2026-09-28');           // Mon
    expect(TD.weekStart('2026-10-04')).toBe('2026-09-28');           // Sun → same Mon
    expect(TD.weekStart('2026-10-05')).toBe('2026-10-05');           // next Mon
    expect(TD.weekStart('2026-09-27')).toBe('2026-09-21');           // Sun of previous week
  });
  test('weekDates spans a month boundary correctly', () => {
    const ds = TD.weekDates('2026-09-28');
    expect(ds.length).toBe(7);
    expect(ds[0]).toBe('2026-09-28');
    expect(ds[6]).toBe('2026-10-04');
  });
  test('dayLabel names weekdays', () => {
    expect(TD.dayLabel('2026-09-28')).toBe('Mon 28');
    expect(TD.dayLabel('2026-10-04')).toBe('Sun 4');
  });
});

suite('TaskDays · groupTasks', () => {
  const mon = '2026-09-28', wed = '2026-09-30', prevSun = '2026-09-27';
  const mk = (id, date, done) => ({ id, text: 't' + id, date, done: !!done });

  test('empty input yields seven empty days and zero planned', () => {
    const w = TD.groupTasks([], mon);
    expect(w.days.length).toBe(7);
    expect(w.plannedCount).toBe(0);
    expect(w.unplanned.length).toBe(0);
    expect(w.overdue.length).toBe(0);
  });
  test('garbage input is tolerated (nulls, strings, non-objects)', () => {
    const w = TD.groupTasks([null, 'x', 42, mk('1', mon)], mon);
    expect(w.plannedCount).toBe(1);
  });
  test('multiple tasks share one day; today flag set once', () => {
    const w = TD.groupTasks([mk('1', mon), mk('2', mon), mk('3', wed)], mon);
    expect(w.days[0].tasks.length).toBe(2);
    expect(w.days[2].tasks.length).toBe(1);
    expect(w.days.filter((d) => d.isToday).length).toBe(1);
    expect(w.days[0].isToday).toBe(true);
  });
  test('undated and invalid-dated tasks land in unplanned', () => {
    const w = TD.groupTasks([mk('1', null), mk('2', 'nonsense'), mk('3', undefined)], mon);
    expect(w.unplanned.length).toBe(3);
    expect(w.plannedCount).toBe(0);
  });
  test('past-week open tasks are overdue; past-week DONE tasks are ignored', () => {
    const w = TD.groupTasks([mk('1', prevSun), mk('2', prevSun, true)], mon);
    expect(w.overdue.length).toBe(1);
    expect(w.overdue[0].id).toBe('1');
    expect(w.plannedCount).toBe(2); // still counted as planned effort
  });
  test('future weeks are neither in-grid nor overdue', () => {
    const w = TD.groupTasks([mk('1', '2026-12-25')], mon);
    expect(w.overdue.length).toBe(0);
    expect(w.days.some((d) => d.tasks.length)).toBe(false);
    expect(w.plannedCount).toBe(1);
  });
  test('invalid todayStr falls back to the real clock without throwing', () => {
    const w = TD.groupTasks([mk('1', TD.toKey(new Date()))], 'garbage');
    expect(w.days.some((d) => d.tasks.length === 1)).toBe(true);
  });
});

suite('TaskDays · store sanitizer round-trip', () => {
  test('valid dates survive, junk becomes null (sanitizeData)', () => {
    const { sanitizeData } = require('../app/main/store.js');
    const d = sanitizeData({
      tasks: [
        { id: 'a', text: 'keep', est: 1, min: 0, date: '2026-09-30' },
        { id: 'b', text: 'drop', est: 1, min: 0, date: '2026-02-30' },
        { id: 'c', text: 'proto', est: 1, min: 0, date: '__proto__' },
        { id: 'd', text: 'none', est: 1, min: 0 }
      ]
    });
    expect(d.tasks.find((x) => x.id === 'a').date).toBe('2026-09-30');
    expect(d.tasks.find((x) => x.id === 'b').date).toBe(null);
    expect(d.tasks.find((x) => x.id === 'c').date).toBe(null);
    expect(d.tasks.find((x) => x.id === 'd').date).toBe(null);
  });
});
