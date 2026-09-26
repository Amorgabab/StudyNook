/* ============================================================
   StudyNook · weeksched.js  (PURE LOGIC — no dependencies)
   ------------------------------------------------------------
   The Week Schedule is NOT a second data system: it is a view
   over d.tasks[]. A task that carries a planned date (and an
   optional start time "HH:MM") appears on the Week Schedule;
   everything else stays an ordinary task. This module holds
   the shared pure helpers both the store (sanitization + the
   one-time migration from the old recurring-block schedule)
   and the Week Schedule view use. Reuses taskdays.js for all
   date math so there is exactly ONE calendar brain in the app.
   Works in Node (module.exports) and in the browser (WeekSched).
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./taskdays.js'));
  else root.WeekSched = factory(root.TaskDays);
})(typeof self !== 'undefined' ? self : this, function (TaskDays) {
  'use strict';

  /** Validate + normalize an optional start time. Returns 'HH:MM' or null. */
  function normAt(v) {
    if (v === null || v === undefined || v === '') return null;
    const s = String(v).trim();
    if (!/^\d{2}:\d{2}$/.test(s)) return null;
    const h = +s.slice(0, 2), m = +s.slice(3, 5);
    if (h > 23 || m > 59) return null;
    return s;
  }

  /**
   * Migration map (old → new): the legacy Week Schedule stored
   * RECURRING blocks in d.schedule ({blockId: {subject,label,min,at,days[]}}).
   * Those are now scheduled TASKS. Kept here (pure!) so both store.js
   * and the unit tests share exactly one definition of the old shape.
   */
  const LEGACY_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; // index 0 = Monday
  const LEGACY_MAX_BLOCKS = 12; // hard cap the old grid enforced

  /** Legacy block → safe object, or null when unusable (mirrors the old sanitizer). */
  function sanitizeLegacyBlock(b) {
    if (!b || typeof b !== 'object') return null;
    const subject = typeof b.subject === 'string' ? b.subject.slice(0, 40) : '';
    const label = typeof b.label === 'string' ? b.label.slice(0, 60) : '';
    const min = Math.max(0, Math.min(600, Math.round(Number(b.min) || 0)));
    const at = normAt(b.at);
    const days = Array.isArray(b.days) ? b.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6).slice(0, 8) : [];
    if (!subject && !label) return null;
    if (!days.length) return null;
    return { id: String(b.id || '').slice(0, 40), subject, label, min, at, days };
  }

  /**
   * Convert every valid legacy block into scheduled tasks (one task per
   * weekday the block repeated on — actual calendar dates, never a
   * recurrence engine). Idempotent: migrated tasks carry `migratedFrom`,
   * so running twice can never duplicate anything. Unmappable garbage is
   * skipped safely. Returns { tasks, sourceIds }.
   */
  function migrateBlocks(rawSchedule, weekOfStr) {
    const out = [], sourceIds = [];
    let sched = rawSchedule;
    if (typeof sched === 'string') { try { sched = JSON.parse(sched); } catch (_) { sched = null; } }
    if (!sched || typeof sched !== 'object' || Array.isArray(sched)) return { tasks: out, sourceIds };
    const ref = TaskDays.normDate(weekOfStr) || TaskDays.toKey(new Date());
    const dates = TaskDays.weekDates(TaskDays.weekStart(ref)); // Mon..Sun of the reference week
    const ids = Object.keys(sched).slice(0, LEGACY_MAX_BLOCKS * 2);
    for (const id of ids) {
      const b = sanitizeLegacyBlock(sched[id]);
      if (!b) continue; // junk / empty / day-less → skip, never crash
      sourceIds.push(b.id || id);
      for (const di of b.days) {
        const key = dates[di];
        if (!key) continue;
        const text = ((b.subject || '') + ' ' + (b.label || '')).trim() || 'Scheduled study block';
        out.push({
          id: 'tms-' + String(id).replace(/[^a-zA-Z0-9_-]/g, '') + '-' + di,
          text: text.slice(0, 200),
          subject: b.subject.slice(0, 40),
          est: Math.max(1, Math.min(8, Math.ceil((b.min || 25) / 25))), // honest Pomodoro estimate
          min: b.min || 0,
          done: false, pomosDone: 0,
          date: key, at: b.at,
          sources: [], createdAt: Date.now(), completedAt: null,
          migratedFrom: String(id).slice(0, 40)
        });
      }
    }
    return { tasks: out, sourceIds };
  }

  /** Tasks for one date key, timed ones first (chronological), untimed after. */
  function dayTasks(tasks, dateKey) {
    const list = (Array.isArray(tasks) ? tasks : []).filter((t) => t && typeof t === 'object' && t.date === dateKey);
    list.sort((a, b) => {
      const ax = normAt(a.at) || '99:99', bx = normAt(b.at) || '99:99';
      if (ax !== bx) return ax < bx ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    return list;
  }

  /** Full Monday-based week structure for the view: seven days + totals. */
  function weekModel(tasks, startKey, todayStr) {
    const t = TaskDays.normDate(todayStr) || TaskDays.toKey(new Date());
    let start = TaskDays.normDate(startKey);
    if (!start) start = TaskDays.weekStart(t);
    const keys = TaskDays.weekDates(start);
    const days = keys.map((k) => {
      const list = dayTasks(tasks, k);
      return {
        key: k, name: TaskDays.fullDayName(k), isToday: k === t, tasks: list,
        count: list.length,
        doneCount: list.filter((x) => x.done).length,
        plannedMin: list.reduce((n, x) => n + (Number(x.min) || 0), 0)
      };
    });
    return {
      start: keys[0], end: keys[6], days,
      total: days.reduce((n, x) => n + x.count, 0),
      doneTotal: days.reduce((n, x) => n + x.doneCount, 0),
      plannedMin: days.reduce((n, x) => n + x.plannedMin, 0)
    };
  }

  /** Shift a week-start key by ±7 days (Previous Week / Next Week buttons). */
  function shiftWeek(startKey, delta) {
    const k = TaskDays.normDate(startKey);
    if (!k) return startKey;
    const y = +k.slice(0, 4), mo = +k.slice(5, 7) - 1, da = +k.slice(8, 10);
    const d = new Date(y, mo, da + delta * 7);
    return TaskDays.toKey(d);
  }

  /** Human header like "September 28 – October 4" (never abbreviated). */
  function rangeLabel(model) {
    const f = (k) => TaskDays.fullMonthName(k) + ' ' + (+k.slice(8, 10));
    const sm = model.start.slice(0, 7), em = model.end.slice(0, 7);
    if (sm === em) return f(model.start) + ' – ' + (+model.end.slice(8, 10));
    return f(model.start) + ' – ' + f(model.end);
  }

  return { normAt, LEGACY_DAYS, LEGACY_MAX_BLOCKS, sanitizeLegacyBlock, migrateBlocks, dayTasks, weekModel, shiftWeek, rangeLabel };
});
