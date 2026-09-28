/* ============================================================
   StudyNook · taskdays.js  (PURE LOGIC — no dependencies)
   ------------------------------------------------------------
   Weekly planning layer for tasks: a task can carry an optional
   planned date ("YYYY-MM-DD"). This module validates/normalizes
   those dates and groups tasks into a Mon–Sun week so the Tasks
   view can show "this week" without becoming a calendar app.
   All functions are pure → unit-testable like schedule.js.
   Works in Node (module.exports) and in the browser (TaskDays).
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.TaskDays = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MAX_PLANNED = 200; // hard cap on how many tasks may carry a date (sanity bound)

  /** Validate + normalize a user-supplied date string. Returns 'YYYY-MM-DD' or null. */
  function normDate(s) {
    if (typeof s !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], da = +m[3];
    if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    const d = new Date(y, mo - 1, da);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null; // rejects 2026-02-30 etc.
    return s.trim();
  }

  /** Local-timezone 'YYYY-MM-DD' for a Date. */
  function toKey(d) {
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /** Monday-based start of the week containing refStr ('YYYY-MM-DD'). */
  function weekStart(refStr) {
    const y = +refStr.slice(0, 4), mo = +refStr.slice(5, 7) - 1, da = +refStr.slice(8, 10);
    const d = new Date(y, mo, da);
    const dow = d.getDay(); // 0=Sun..6=Sat
    d.setDate(d.getDate() - ((dow + 6) % 7)); // back to Monday (Sunday counts as end of previous week)
    return toKey(d);
  }

  /** The seven date keys of the week starting at weekStart key. */
  function weekDates(startKey) {
    const out = [];
    const y = +startKey.slice(0, 4), mo = +startKey.slice(5, 7) - 1, da = +startKey.slice(8, 10);
    const d = new Date(y, mo, da);
    for (let i = 0; i < 7; i++) { out.push(toKey(d)); d.setDate(d.getDate() + 1); }
    return out;
  }

  /** Human label like "Mon 27" for a date key. */
  function dayLabel(dateKey) {
    const y = +dateKey.slice(0, 4), mo = +dateKey.slice(5, 7) - 1, da = +dateKey.slice(8, 10);
    return DAY_NAMES[(new Date(y, mo, da).getDay() + 6) % 7] + ' ' + da;
  }

  const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; // index 0 = Monday
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /** Full weekday name ("Monday") — the Week Schedule never abbreviates. */
  function fullDayName(dateKey) {
    const y = +dateKey.slice(0, 4), mo = +dateKey.slice(5, 7) - 1, da = +dateKey.slice(8, 10);
    return FULL_DAYS[(new Date(y, mo, da).getDay() + 6) % 7];
  }

  /** Full month name ("September") for readable week-range headers. */
  function fullMonthName(dateKey) { return MONTHS[+dateKey.slice(5, 7) - 1] || ''; }

  /**
   * Group tasks by planned date within one Monday-based week.
   * @returns {{ days: Array<{key:string,name:string,isToday:boolean,tasks:Array}>,
   *            unplanned: Array, overdue: Array, plannedCount:number }}
   */
  function groupTasks(tasks, todayStr) {
    const t = normDate(todayStr) || toKey(new Date());
    const list = Array.isArray(tasks) ? tasks : [];
    const start = weekStart(t);
    const dates = weekDates(start);
    const buckets = new Map(dates.map((k) => [k, []]));
    const unplanned = [], overdue = [];
    let plannedCount = 0;
    for (const task of list) {
      if (!task || typeof task !== 'object') continue;
      const k = normDate(task.date);
      if (!k) { unplanned.push(task); continue; }
      plannedCount++;
      if (buckets.has(k)) buckets.get(k).push(task);
      else if (k < t && !task.done) overdue.push(task); // planned in the past, still open
    }
    const days = dates.map((k) => ({ key: k, name: dayLabel(k), isToday: k === t, tasks: buckets.get(k) }));
    return { days, unplanned, overdue, plannedCount };
  }

  return { normDate, toKey, weekStart, weekDates, dayLabel, fullDayName, fullMonthName, groupTasks, DAY_NAMES, FULL_DAYS, MONTHS, MAX_PLANNED };
});
