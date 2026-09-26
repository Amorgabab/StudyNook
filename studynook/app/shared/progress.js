/* ============================================================
   StudyNook · progress.js  (PURE LOGIC — no dependencies)
   ------------------------------------------------------------
   Everything about growing: XP, levels, titles, pet stages,
   streaks and achievements. Shared by the app AND the tests.
   Works in Node (module.exports) and in the browser (NookProgress).
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NookProgress = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Dates (local, YYYY-MM-DD) ---------- */
  function dayStr(d) {
    d = d || new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* ---------- Levels & titles ---------- */
  // XP needed to go FROM `level` TO `level+1`
  function xpForLevel(level) { return 100 + (level - 1) * 50; }
  // Total XP needed to REACH `level`
  function cumulativeForLevel(level) {
    let t = 0;
    for (let l = 1; l < level; l++) t += xpForLevel(l);
    return t;
  }
  function levelFromXp(xp) {
    let l = 1;
    while (xp >= cumulativeForLevel(l + 1) && l < 999) l++;
    return l;
  }
  const TITLES = [
    'Seedling', 'Sprout', 'Leaflet', 'Tea Sipper', 'Bookworm',
    'Candle Keeper', 'Rain Listener', 'Blanket Scholar', 'Hearth Guardian',
    'Star Reader', 'Moon Librarian', 'Cloud Sage', 'Nook Keeper',
    'Dream Weaver', 'Grand Cozy Master'
  ];
  function titleForLevel(level) {
    return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))];
  }
  function levelProgress(xp) {
    const level = levelFromXp(xp);
    const base = cumulativeForLevel(level);
    const need = xpForLevel(level);
    const into = Math.max(0, xp - base);
    return { level, title: titleForLevel(level), into, need, pct: Math.min(1, into / need) };
  }

  /* ---------- Pet (Mochi) evolution ---------- */
  const PET_STAGES = [
    { id: 0, name: 'Sleepy Egg',   min: 0,    emoji: '🥚', blurb: 'A warm little egg. It hums when you study.' },
    { id: 1, name: 'Baby Blob',    min: 45,   emoji: '🐣', blurb: 'It hatched! A squishy baby blob full of curiosity.' },
    { id: 2, name: 'Mochi Kitten', min: 180,  emoji: '🐱', blurb: 'Tiny ears, tiny paws, big focus energy.' },
    { id: 3, name: 'Study Cat',    min: 540,  emoji: '😺', blurb: 'Now wears a little reading scarf. Very serious scholar vibes.' },
    { id: 4, name: 'Scholar Cat',  min: 1200, emoji: '🎓', blurb: 'Round glasses, rounder cheeks. Quotes Latin. Probably.' },
    { id: 5, name: 'Cozy Legend',  min: 2400, emoji: '👑', blurb: 'A crowned cloud of pure cozy. Legends say it never procrastinates.' }
  ];
  function stageForMinutes(min) {
    let s = 0;
    for (const st of PET_STAGES) if (min >= st.min) s = st.id;
    return s;
  }

  /* ---------- Streaks ---------- */
  // Call once per day when the user focuses. Mutates data.streak.
  function registerFocusDay(data, day) {
    day = day || dayStr();
    const s = data.streak || (data.streak = { current: 0, best: 0, lastFocusDay: null });
    if (s.lastFocusDay === day) return false;
    s.current = (s.lastFocusDay === yesterdayStrOf(day)) ? (s.current || 0) + 1 : 1;
    s.best = Math.max(s.best || 0, s.current);
    s.lastFocusDay = day;
    return true;
  }
  function yesterdayStrOf(day) {
    const d = new Date(day + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return dayStr(d);
  }
  // If a day was missed, the streak shown should decay to 0 (called on load).
  function refreshStreak(data) {
    const s = data.streak;
    if (!s || !s.lastFocusDay) return;
    const today = dayStr();
    if (s.lastFocusDay !== today && s.lastFocusDay !== yesterdayStrOf(today)) s.current = 0;
  }

  /* ---------- Achievements ---------- */
  // Each check(data, ctx) is pure. ctx may include:
  // { completed, sessionMin, hour, kills, abandoned }
  const ACHIEVEMENTS = [
    { id: 'first_nook',  emoji: '🌱', name: 'First Sprout',       desc: 'Complete your first focus session',            check: (d, c) => !!c.completed },
    { id: 'pomo_10',     emoji: '🍅', name: 'Tomato Friend',      desc: 'Complete 10 focus sessions',                   check: (d) => (d.counters.sessionsTotal || 0) >= 10 },
    { id: 'deep_50',     emoji: '🕯️', name: 'Candlelight Focus',  desc: 'Complete one session of 50+ minutes',          check: (d, c) => (c.sessionMin || 0) >= 50 },
    { id: 'marathon_90', emoji: '🏔️', name: 'Mountain Mover',     desc: 'Complete one session of 90+ minutes',          check: (d, c) => (c.sessionMin || 0) >= 90 },
    { id: 'hour_day',    emoji: '⏰', name: 'Hour of Power',      desc: 'Focus 60+ minutes in a single day',            check: (d) => Object.values(d.daily || {}).some((v) => (v.min || 0) >= 60) },
    { id: 'streak_3',    emoji: '🔥', name: 'Cozy Streak',        desc: 'Study 3 days in a row',                        check: (d) => (d.streak.current || 0) >= 3 },
    { id: 'streak_7',    emoji: '🌟', name: 'Week in the Nook',   desc: 'Study 7 days in a row',                        check: (d) => (d.streak.current || 0) >= 7 },
    { id: 'streak_30',   emoji: '🌙', name: 'Moonlit Devotion',   desc: 'Study 30 days in a row',                       check: (d) => (d.streak.current || 0) >= 30 },
    { id: 'early_bird',  emoji: '🌅', name: 'Early Bird',         desc: 'Finish a session before 7 AM',                 check: (d, c) => c.completed && (c.hour ?? 12) < 7 },
    { id: 'night_owl',   emoji: '🦉', name: 'Night Owl',          desc: 'Finish a session after 11 PM',                 check: (d, c) => c.completed && (c.hour ?? 12) >= 23 },
    { id: 'zen',         emoji: '🍵', name: 'Untouched by Chaos', desc: 'Finish a 25+ min session with zero closes',    check: (d, c) => c.completed && (c.sessionMin || 0) >= 25 && (c.kills || 0) === 0 },
    { id: 'bounce_25',   emoji: '🧸', name: 'Gentle Bouncer',     desc: 'Gently close 25 distractions',                 check: (d) => (d.counters.kills || 0) >= 25 },
    { id: 'bounce_100',  emoji: '🛡️', name: 'Nook Guardian',      desc: 'Gently close 100 distractions',                check: (d) => (d.counters.kills || 0) >= 100 },
    { id: 'task_10',     emoji: '✅', name: 'Task Tidy',          desc: 'Complete 10 tasks',                            check: (d) => (d.counters.tasksDone || 0) >= 10 },
    { id: 'task_50',     emoji: '📌', name: 'List Legend',        desc: 'Complete 50 tasks',                            check: (d) => (d.counters.tasksDone || 0) >= 50 },
    { id: 'best_friend', emoji: '💞', name: "Mochi's Best Friend", desc: 'Pet Mochi 100 times',                         check: (d) => (d.counters.pets || 0) >= 100 },
    { id: 'hatch',       emoji: '🐣', name: "It's Hatching!",     desc: 'Mochi grows into a Baby Blob',                 check: (d) => (d.pet.stage || 0) >= 1 },
    { id: 'scholar',     emoji: '🎓', name: 'Scholar Cat',        desc: 'Mochi reaches the Scholar Cat stage',          check: (d) => (d.pet.stage || 0) >= 4 },
    { id: 'legend',      emoji: '👑', name: 'Cozy Legend',        desc: 'Mochi reaches the final stage',                check: (d) => (d.pet.stage || 0) >= 5 },
    { id: 'level_5',     emoji: '📖', name: 'Getting Serious',    desc: 'Reach level 5',                                check: (d) => (d.level || 1) >= 5 },
    { id: 'level_15',    emoji: '🌈', name: 'Nook Master',        desc: 'Reach level 15',                               check: (d) => (d.level || 1) >= 15 },
    { id: 'rain_120',    emoji: '🌧️', name: 'Rainy Afternoon',    desc: 'Listen to 2 hours of ambience',                check: (d) => (d.counters.ambientMin || 0) >= 120 },
    { id: 'garden_14',   emoji: '🌷', name: 'Green Thumb',        desc: 'Study on 14 different days',                   check: (d) => Object.values(d.daily || {}).filter((v) => (v.min || 0) > 0).length >= 14 },
    { id: 'comeback',    emoji: '🌤️', name: 'Comeback Cozy',      desc: 'Finish a session after giving one up',         check: (d, c) => !!c.completed && (d.counters.abandons || 0) >= 1 }
  ];
  function evaluateAchievements(data, ctx) {
    ctx = ctx || {};
    const earned = [];
    for (const a of ACHIEVEMENTS) {
      if (data.achievements[a.id]) continue;
      let ok = false;
      try { ok = a.check(data, ctx); } catch (e) { ok = false; }
      if (ok) earned.push(a.id);
    }
    return earned;
  }
  function achievementsById() {
    const m = {};
    for (const a of ACHIEVEMENTS) m[a.id] = a;
    return m;
  }

  /* ---------- Reward helpers (used when a focus phase completes) ---------- */
  // minutes: focused minutes (rounded), completed: finished the phase properly
  function focusRewards(data, minutes, completed, ctxExtra) {
    minutes = Math.max(0, Math.round(minutes));
    const events = [];
    const ctx = Object.assign({ completed, sessionMin: minutes, hour: new Date().getHours() }, ctxExtra || {});

    if (minutes > 0 || completed) {
      const day = dayStr();
      const d = data.daily[day] || (data.daily[day] = { min: 0, sessions: 0, kills: 0, tasks: 0 });
      d.min += minutes;
      if (completed) d.sessions += 1;
      if (completed) data.counters.sessionsTotal = (data.counters.sessionsTotal || 0) + 1;
      if (minutes > 0) registerFocusDay(data, day);
    }

    data.pet.totalFocusMin = (data.pet.totalFocusMin || 0) + minutes;
    const newStage = stageForMinutes(data.pet.totalFocusMin);
    if (newStage > (data.pet.stage || 0)) {
      data.pet.stage = newStage;
      events.push({ type: 'stageup', stage: PET_STAGES[newStage] });
    }

    const xpGained = minutes + (completed ? 10 : 0);
    if (xpGained > 0) {
      data.xp = (data.xp || 0) + xpGained;
      const newLevel = levelFromXp(data.xp);
      if (newLevel > (data.level || 1)) {
        data.level = newLevel;
        events.push({ type: 'levelup', level: newLevel, title: titleForLevel(newLevel) });
      }
      events.push({ type: 'xp', amount: xpGained });
    }

    const earned = evaluateAchievements(data, ctx);
    for (const id of earned) {
      data.achievements[id] = new Date().toISOString();
      const a = achievementsById()[id];
      events.push({ type: 'achievement', id, emoji: a.emoji, name: a.name, desc: a.desc });
    }
    return { xpGained, events };
  }

  return {
    dayStr,
    xpForLevel, cumulativeForLevel, levelFromXp, titleForLevel, levelProgress,
    TITLES, PET_STAGES, stageForMinutes,
    registerFocusDay, refreshStreak,
    ACHIEVEMENTS, evaluateAchievements, achievementsById,
    focusRewards
  };
});
