/* ============================================================
   StudyNook · views-garden.js — Progress: level, streak, totals,
   last 7 days, 13-week activity, companion journey, achievements
   ============================================================ */
'use strict';
window.Views = window.Views || {};

const ACH_ICON = {
  first_nook: 'sprout', pomo_10: 'timer', deep_50: 'flame', marathon_90: 'mountain', hour_day: 'clock',
  streak_3: 'flame', streak_7: 'star', streak_30: 'moon', early_bird: 'sunrise', night_owl: 'moon-star',
  zen: 'leaf', bounce_25: 'shield', bounce_100: 'shield-check', task_10: 'circle-check', task_50: 'list-checks',
  best_friend: 'heart', hatch: 'egg', scholar: 'graduation-cap', legend: 'crown', level_5: 'book-open',
  level_15: 'trophy', rain_120: 'cloud-rain', garden_14: 'flower', comeback: 'sun'
};

Views.garden = function (c) {
  const d = App.state.data;
  const lp = NookProgress.levelProgress(d.xp);
  c.appendChild(N.pageHead(t('progress.title'), t('progress.sub')));

  /* ---------- summary ---------- */
  const level = N.card(t('progress.level'), 'award');
  level.appendChild(N.el('div', { class: 'big-num', text: t('chip.level', { n: NookI18n.num(lp.level) }) + ' · ' + App.levelTitle(lp.level) }));
  level.appendChild(N.el('div', { class: 'progress', style: 'margin:var(--s-3) 0 var(--s-2)' }, N.el('span', { style: 'width:' + Math.round(lp.pct * 100) + '%' })));
  level.appendChild(N.el('div', { class: 'caption', text: t('progress.level.sub', { into: NookI18n.num(lp.into), need: NookI18n.num(lp.need), total: NookI18n.num(d.xp) }) }));

  const streak = N.card(t('progress.streak'), 'flame');
  streak.appendChild(N.el('div', { class: 'big-num', text: t('progress.days', { n: NookI18n.num(d.streak.current) }) }));
  streak.appendChild(N.el('div', { class: 'caption', style: 'margin-top:var(--s-2)', text: t('progress.streak.sub', { best: NookI18n.num(d.streak.best) }) }));

  const allMin = Object.values(d.daily).reduce((a, v) => a + (v.min || 0), 0);
  const totals = N.card(t('progress.total'), 'clock');
  totals.appendChild(N.el('div', { class: 'big-num', text: NookI18n.minutes(allMin) }));
  totals.appendChild(N.el('div', { class: 'caption', style: 'margin-top:var(--s-2)', text: t('progress.total.sub', { s: NookI18n.num(d.counters.sessionsTotal || 0), tk: NookI18n.num(d.counters.tasksDone || 0), k: NookI18n.num(d.counters.kills || 0) }) }));
  c.appendChild(N.el('div', { class: 'grid-3' }, level, streak, totals));

  /* ---------- last 7 days + activity map ---------- */
  const week = N.card(t('progress.week'), 'chart-column');
  const bars = N.el('div', { class: 'bars', role: 'img', 'aria-label': t('progress.week') });
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(N.dayKey(i));
  const max = Math.max(30, ...days.map((k) => (d.daily[k] && d.daily[k].min) || 0));
  days.forEach((k, idx) => {
    const min = (d.daily[k] && d.daily[k].min) || 0;
    const ts = new Date(k + 'T12:00:00').getTime();
    bars.appendChild(N.el('div', { class: 'bar-col' + (idx === 6 ? ' today' : ''), title: NookI18n.date(ts) + ' · ' + NookI18n.minutes(min) },
      N.el('span', { class: 'caption tnum', text: min ? NookI18n.minutesShort(min) : '' }),
      N.el('div', { class: 'bar', style: 'height:' + Math.max(2, Math.round((min / max) * 100)) + '%' }),
      N.el('span', { class: 'caption', text: NookI18n.weekday(ts) })));
  });
  week.appendChild(bars);

  const map = N.card(t('progress.map'), 'calendar');
  map.appendChild(N.el('p', { class: 'card-sub', text: t('progress.map.sub') }));
  const heat = N.el('div', { class: 'heat', role: 'img', 'aria-label': t('progress.map') });
  // 13 full weeks, columns = weeks (Mon→Sun), ending with the current week
  const todayDow = (new Date().getDay() + 6) % 7;            // 0 = Monday
  const totalDays = 12 * 7 + todayDow + 1;
  for (let i = totalDays - 1; i >= 0; i--) {
    const k = N.dayKey(i), min = (d.daily[k] && d.daily[k].min) || 0;
    const l = min <= 0 ? 0 : min < 15 ? 1 : min < 30 ? 2 : min < 60 ? 3 : 4;
    heat.appendChild(N.el('i', { 'data-l': String(l), title: NookI18n.date(new Date(k + 'T12:00:00').getTime()) + ' · ' + NookI18n.minutes(min) }));
  }
  map.appendChild(heat);
  map.appendChild(N.el('div', { class: 'heat-legend' }, N.el('span', { class: 'caption', style: 'margin-inline-end:6px', text: t('progress.map.less') }),
    ...[0, 1, 2, 3, 4].map((l) => N.el('i', { class: 'heat-swatch', 'data-l': String(l) })),
    N.el('span', { class: 'caption', style: 'margin-inline-start:6px', text: t('progress.map.more') })));
  c.appendChild(N.el('div', { class: 'grid-2', style: 'margin-top:var(--s-6)' }, week, map));

  /* ---------- companion journey ---------- */
  const journey = N.card(t('progress.journey', { name: d.pet.name }), 'cat');
  journey.style.marginTop = 'var(--s-6)';
  journey.appendChild(N.el('p', { class: 'card-sub', text: t('stage.' + d.pet.stage + '.blurb') }));
  const track = N.el('div', { class: 'journey' });
  for (const s2 of NookProgress.PET_STAGES) {
    const reached = d.pet.stage >= s2.id;
    track.appendChild(N.el('div', { class: 'stage' + (reached ? ' reached' : '') + (d.pet.stage === s2.id ? ' current' : '') },
      N.el('span', { class: 'item-icon' }, N.icon(App.STAGE_ICONS[s2.id], 18)),
      N.el('span', { class: 'set-label', text: App.stageName(s2.id) }),
      N.el('span', { class: 'caption', text: s2.min ? NookI18n.minutes(s2.min) : t('progress.journey.start') })));
  }
  journey.appendChild(track);
  c.appendChild(journey);

  /* ---------- achievements ---------- */
  const earned = Object.keys(d.achievements).length;
  const ach = N.card(t('progress.ach', { n: earned, of: NookProgress.ACHIEVEMENTS.length }), 'trophy');
  ach.style.marginTop = 'var(--s-6)';
  const grid = N.el('div', { class: 'ach-grid' });
  for (const a of NookProgress.ACHIEVEMENTS) {
    const got = d.achievements[a.id];
    grid.appendChild(N.el('div', { class: 'ach' + (got ? '' : ' locked') },
      N.el('span', { class: 'item-icon' }, N.icon(got ? (ACH_ICON[a.id] || 'trophy') : 'lock', 18)),
      N.el('div', { class: 'grow' },
        N.el('div', { class: 'item-title', text: t('ach.' + a.id + '.name') }),
        N.el('div', { class: 'item-sub', text: t('ach.' + a.id + '.desc') }),
        got ? N.el('div', { class: 'caption', style: 'margin-top:2px', text: t('progress.ach.on', { date: NookI18n.date(got) }) }) : null)));
  }
  ach.appendChild(grid);
  c.appendChild(ach);
};
