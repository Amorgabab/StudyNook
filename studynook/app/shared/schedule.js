/* ============================================================
   StudyNook · schedule.js  (PURE LOGIC — no dependencies)
   ------------------------------------------------------------
   The Week Schedule: a planner grid of RECURRING study blocks
   ("Mon 18:00 · Math · 45m"). Blocks repeat every week; each
   cell compares what you PLANNED against what you actually
   focused (from d.daily) on that weekday. Works in Node
   (module.exports) and in the browser (NookSchedule).
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NookSchedule = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // index 0 = Monday
  const MAX_BLOCKS = 12;   // grid rows per week
  const MAX_PER_DAY = 8;   // sanity cap per day-column

  /** JS getDay() (0=Sun..6=Sat) → our column index (0=Mon..6=Sun) */
  function dayIndex(jsDay) { return (jsDay + 6) % 7; }
  function todayIndex(now) { return dayIndex((now || new Date()).getDay()); }
  function hhmm(v) { return /^\d{2}:\d{2}$/.test(String(v)) ? String(v) : null; }

  /** Coerce one raw block object into a safe shape; null if unusable. */
  function sanitizeBlock(b) {
    if (!b || typeof b !== 'object') return null;
    const subject = typeof b.subject === 'string' ? b.subject.slice(0, 40) : '';
    const label = typeof b.label === 'string' ? b.label.slice(0, 60) : '';
    const min = Math.max(0, Math.min(600, Math.round(Number(b.min) || 0)));
    const at = hhmm(b.at);
    const days = Array.isArray(b.days) ? b.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).slice(0, MAX_PER_DAY) : [];
    if (!subject && !label) return null;          // an empty block is noise
    if (!days.length) return null;                 // must live on ≥1 weekday
    return { id: String(b.id || 'b' + Math.random().toString(36).slice(2)).slice(0, 40), subject, label, min, at, days, enabled: b.enabled !== false };
  }

  /** Coerce the whole schedule map ({blockId: block}) — used by store sanitize/import. */
  function sanitizeSchedule(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    const ids = Object.keys(raw).slice(0, MAX_BLOCKS * 2);
    for (const id of ids) {
      const b = sanitizeBlock(raw[id]);
      if (b) { b.id = String(id).slice(0, 40); out[b.id] = b; }
      if (Object.keys(out).length >= MAX_BLOCKS) break;
    }
    return out;
  }

  /** Add a block; returns {ok, id?, error?}. Never exceeds MAX_BLOCKS. */
  function addBlock(sched, block) {
    const b = sanitizeBlock(Object.assign({}, block, { id: block && block.id }));
    if (!b) return { ok: false, error: 'Give the block a subject or a name, and pick at least one day.' };
    const count = Object.keys(sched || {}).length;
    if (count >= MAX_BLOCKS) return { ok: false, error: 'The week grid holds ' + MAX_BLOCKS + ' blocks — delete one first.' };
    let id = b.id;
    while (!id || sched[id]) id = 'b' + Date.now().toString(36) + Math.floor(Math.random() * 999);
    b.id = id;
    sched[id] = b;
    return { ok: true, id };
  }
  function updateBlock(sched, id, patch) {
    const cur = sched && sched[id];
    if (!cur) return { ok: false, error: 'no such block' };
    const next = sanitizeBlock(Object.assign({}, cur, patch, { id: cur.id }));
    if (!next) return { ok: false, error: 'A block needs a subject or name, and at least one day.' };
    next.id = cur.id;
    sched[id] = next;
    return { ok: true };
  }
  function removeBlock(sched, id) {
    if (!sched || !sched[id]) return false;
    delete sched[id];
    return true;
  }
  function toggleBlock(sched, id) {
    const b = sched && sched[id];
    if (!b) return false;
    b.enabled = b.enabled === false;
    return true;
  }

  /** Planned minutes per weekday (0..6), counting enabled blocks only. */
  function plannedByDay(sched) {
    const p = [0, 0, 0, 0, 0, 0, 0];
    for (const id of Object.keys(sched || {})) {
      const b = sched[id];
      if (!b || b.enabled === false) continue;
      for (const d of (b.days || [])) if (d >= 0 && d <= 6) p[d] += (b.min || 0);
    }
    return p;
  }

  /** Sorted unique times ("HH:MM") across all enabled blocks — the grid rows. */
  function rowTimes(sched) {
    const set = new Set();
    for (const id of Object.keys(sched || {})) {
      const b = sched[id];
      if (!b || b.enabled === false) continue;
      if (b.at) set.add(b.at);
    }
    return [...set].sort();
  }

  /** All blocks scheduled on one weekday, sorted by time (untimed last). */
  function blocksForDay(sched, dayIdx) {
    const list = [];
    for (const id of Object.keys(sched || {})) {
      const b = sched[id];
      if (!b || b.enabled === false) continue;
      if ((b.days || []).includes(dayIdx)) list.push(b);
    }
    list.sort((a, b2) => (a.at || '99:99').localeCompare(b2.at || '99:99'));
    return list;
  }

  /** Local YYYY-MM-DD key for "today minus back days". */
  function dateKey(back, now) {
    const d = new Date((now || new Date()).getTime());
    d.setDate(d.getDate() - back);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /**
   * Actual focused minutes on each weekday of the current week cycle:
   * day i counts dates today-back where that date's weekday == i
   * (i.e. yesterday belongs to Mon, the day before to Tue, …).
   */
  function actualByDay(daily, now) {
    const a = [0, 0, 0, 0, 0, 0, 0];
    const t = now || new Date();
    for (let back = 0; back < 7; back++) {
      const d = new Date(t.getTime());
      d.setDate(d.getDate() - back);
      const rec = (daily || {})[dateKey(back, t)];
      a[dayIndex(d.getDay())] += rec && rec.min ? rec.min : 0;
    }
    return a;
  }

  /** Per-day summary for the view: planned, actual, pct (null when unplanned). */
  function summarize(sched, daily, now) {
    const p = plannedByDay(sched), a = actualByDay(daily, now);
    return DAYS.map((name, i) => ({
      name, planned: p[i], actual: a[i],
      pct: p[i] > 0 ? Math.min(1.5, a[i] / p[i]) : null,
      met: p[i] > 0 && a[i] >= p[i]
    }));
  }

  /** Gentle totals line: "Planned 6h 30m · focused 4h 10m". */
  function totals(sched, daily, now) {
    const p = plannedByDay(sched).reduce((x, y) => x + y, 0);
    const a = actualByDay(daily, now).reduce((x, y) => x + y, 0);
    return { plannedMin: p, actualMin: a };
  }

  return {
    DAYS, MAX_BLOCKS, MAX_PER_DAY,
    dayIndex, todayIndex, sanitizeBlock, sanitizeSchedule,
    addBlock, updateBlock, removeBlock, toggleBlock,
    plannedByDay, rowTimes, blocksForDay, actualByDay, dateKey, summarize, totals
  };
});
