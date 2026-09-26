/* ============================================================
   StudyNook · tests/weekschedule.test.js — "This Week" block
   ------------------------------------------------------------
   The old separate Schedule tab is gone: scheduled items ARE
   tasks (d.tasks[] with an optional date + start time). These
   tests cover the pure week math (shared/weeksched.js), the
   store sanitizer round-trip, and the one-time migration from
   legacy recurring blocks → real dated tasks.
   ============================================================ */
'use strict';
const WS = require('../app/shared/weeksched.js');
const TD = require('../app/shared/taskdays.js');
const { sanitizeData, defaultData, migrateLegacySchedule } = require('../app/main/store.js');

// 2026-09-30 is a Wednesday; that Mon–Sun week is 2026-09-28 .. 2026-10-04
const TODAY = '2026-09-30';
const WK_START = '2026-09-28';
const MON = '2026-09-28', TUE = '2026-09-29', WED = '2026-09-30', SUN = '2026-10-04';

suite('weeksched · normAt (optional start time)', () => {
  test('valid HH:MM survives', () => expect(WS.normAt('18:00')).toBe('18:00'));
  test('empty / null normalize to null (a dated task needs no time)', () => {
    expect(WS.normAt(null)).toBe(null);
    expect(WS.normAt('')).toBe(null);
    expect(WS.normAt(undefined)).toBe(null);
  });
  test('garbage times are rejected', () => {
    for (const bad of ['25:00', '18:60', '8am', '18', 'hh:mm', {}, [], '18:00:00']) {
      expect(WS.normAt(bad)).toBe(null);
    }
  });
});

suite('weeksched · dayTasks ordering', () => {
  const mk = (id, at) => ({ id, text: id, date: MON, at });
  test('timed tasks sort chronologically before untimed ones', () => {
    const list = [mk('late', '20:00'), mk('free', null), mk('early', '08:30')];
    expect(WS.dayTasks(list, MON).map((t) => t.id)).toEqual(['early', 'late', 'free']);
  });
  test('same start time keeps insertion order (stable)', () => {
    const list = [mk('a', '18:00'), mk('b', '18:00')];
    expect(WS.dayTasks(list, MON).map((t) => t.id)).toEqual(['a', 'b']);
  });
  test('only the requested day appears', () => {
    const list = [mk('mon', '09:00'), { id: 'tue', text: 't', date: TUE, at: '08:00' }];
    expect(WS.dayTasks(list, MON).map((t) => t.id)).toEqual(['mon']);
  });
  test('garbage input never throws', () => {
    expect(WS.dayTasks(null, MON)).toEqual([]);
    expect(WS.dayTasks([null, 'x', {}], MON)).toEqual([]);
  });
});

suite('weeksched · weekModel', () => {
  const tasks = [
    { id: '1', text: 'Math', date: MON, at: '18:00', min: 45, done: false },
    { id: '2', text: 'Physics', date: MON, at: '20:00', min: 60, done: true },
    { id: '3', text: 'English', date: WED, at: null, min: 30, done: false },
    { id: '4', text: 'unscheduled', date: null, at: null, min: 0, done: false },
    { id: '5', text: 'next week', date: '2026-10-05', at: '09:00', min: 25, done: false }
  ];
  test('shows all seven days of the selected week', () => {
    const m = WS.weekModel(tasks, WK_START, TODAY);
    expect(m.days.length).toBe(7);
    expect(m.days[0].key).toBe(MON);
    expect(m.days[6].key).toBe(SUN);
    expect(m.days.map((d) => d.name)).toEqual(TD.FULL_DAYS.slice()); // never abbreviated
  });
  test('per-day counts, completion and planned minutes', () => {
    const m = WS.weekModel(tasks, WK_START, TODAY);
    const mon = m.days[0];
    expect(mon.count).toBe(2);
    expect(mon.doneCount).toBe(1);
    expect(mon.plannedMin).toBe(105);
    expect(mon.tasks.map((t) => t.id)).toEqual(['1', '2']); // chronological
    expect(m.total).toBe(3);          // unscheduled + next-week tasks excluded
    expect(m.doneTotal).toBe(1);
    expect(m.plannedMin).toBe(135);
  });
  test('today flag lands on the right day', () => {
    const m = WS.weekModel([], WK_START, TODAY);
    expect(m.days[2].isToday).toBeTruthy();
    expect(m.days[0].isToday).toBeFalsy();
  });
  test('empty week model is safe', () => {
    const m = WS.weekModel([], WK_START, TODAY);
    for (const d of m.days) expect(d.count).toBe(0);
    expect(m.total).toBe(0);
  });
  test('missing/invalid start key falls back to the current week', () => {
    const m = WS.weekModel([], null, TODAY);
    expect(m.start).toBe(WK_START);
  });
});

suite('weeksched · shiftWeek & rangeLabel', () => {
  test('Previous / Next Week move exactly 7 days', () => {
    expect(WS.shiftWeek(WK_START, -1)).toBe('2026-09-21');
    expect(WS.shiftWeek(WK_START, 1)).toBe('2026-10-05');
    expect(WS.shiftWeek(WS.shiftWeek(WK_START, 1), -1)).toBe(WK_START);
  });
  test('crosses month boundaries cleanly', () => {
    const m = WS.weekModel([], '2026-10-05', TODAY);
    expect(m.start).toBe('2026-10-05');
    expect(m.end).toBe('2026-10-11');
  });
  test('range label uses full month names', () => {
    const m = WS.weekModel([], WK_START, TODAY);
    expect(WS.rangeLabel(m)).toBe('September 28 – October 4');
    const m2 = WS.weekModel([], '2026-10-05', TODAY);
    expect(WS.rangeLabel(m2)).toBe('October 5 – 11');
  });
});

suite('weeksched · store sanitizer round-trip (tasks carry the schedule)', () => {
  test('date/at survive sanitization; garbage is nulled', () => {
    const d = defaultData();
    d.tasks = [
      { id: 'ok', text: 'Study Math', date: MON, at: '18:30', min: 45 },
      { id: 'bad', text: 'Junk', date: '2026-02-30', at: '9am', min: 45 },
      { id: 'none', text: 'Plain', date: null, at: null, min: 0 }
    ];
    const s = sanitizeData(d);
    const ok = s.tasks.find((t) => t.id === 'ok');
    expect(ok.date).toBe(MON); expect(ok.at).toBe('18:30');
    const bad = s.tasks.find((t) => t.id === 'bad');
    expect(bad.date).toBe(null); expect(bad.at).toBe(null); // invalid → ordinary task
    expect(s.tasks.find((t) => t.id === 'none').date).toBe(null);
  });
  test('no second schedule store exists in defaults or sanitized data', () => {
    expect(defaultData().schedule).toBe(undefined);
    const s = sanitizeData(defaultData());
    expect(s.schedule).toBe(undefined);
  });
});

suite('weeksched · legacy migration (blocks → dated tasks)', () => {
  test('valid blocks become real tasks once, then the old structure disappears', () => {
    const d = defaultData();
    d.schedule = {
      b1: { subject: 'Mathematics', label: 'Study chapter 4', min: 45, at: '18:00', days: [0, 3], enabled: true },
      b2: { subject: 'Gym', label: '', min: 60, at: null, days: [2], enabled: true }
    };
    expect(migrateLegacySchedule(d)).toBeTruthy();
    expect(d.schedule).toBe(undefined);                       // removed only after conversion
    const migrated = d.tasks.filter((t) => t.migratedFrom);
    expect(migrated.length).toBe(3);                          // b1 × 2 days + b2 × 1 day
    const mathMon = migrated.find((t) => t.migratedFrom === 'b1' && t.date === MON);
    expect(mathMon.text).toContain('Mathematics');
    expect(mathMon.at).toBe('18:00');
    expect(mathMon.min).toBe(45);
    expect(mathMon.done).toBe(false);
    // idempotent: running again never duplicates
    const before = d.tasks.length;
    expect(migrateLegacySchedule(d)).toBeFalsy();
    expect(d.tasks.length).toBe(before);
  });
  test('malformed legacy data cannot crash migration', () => {
    const d = defaultData();
    d.schedule = { x: 'not-an-object', y: { subject: '', days: 'nope' }, z: null };
    expect(migrateLegacySchedule(d)).toBeFalsy();
    expect(d.schedule).toBe(undefined);
    expect(Array.isArray(d.tasks)).toBeTruthy();
  });
  test('paused legacy blocks still migrate (kept as tasks, not silently dropped)', () => {
    const d = defaultData();
    d.schedule = { p: { subject: 'History', min: 30, days: [1], enabled: false } };
    expect(migrateLegacySchedule(d)).toBeTruthy();
    expect(d.tasks.some((t) => t.migratedFrom === 'p')).toBeTruthy();
  });
  test('sanitizeData runs migration end-to-end (hostile payloads included)', () => {
    const d = defaultData();
    d.schedule = [{ evil: true }]; // array garbage — must be discarded safely
    const s = sanitizeData(d);
    expect(s.schedule).toBe(undefined);
    expect(s.tasks.length).toBe(0);
  });
});
