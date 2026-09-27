/* ============================================================
   StudyNook · views-garden.js — stats, garden heatmap, trophies
   ============================================================ */
'use strict';
window.Views = window.Views || {};

Views.garden = function (c) {
  const d = App.state.data;
  const lp = NookProgress.levelProgress(d.xp);

  /* ---------- hero row ---------- */
  const hero = N.el('div', { class: 'garden-hero' });

  const level = N.el('div', { class: 'card level-card' });
  level.appendChild(N.el('div', { class: 'small', text: 'LEVEL ' + lp.level }));
  level.appendChild(N.el('div', { class: 'big-num', text: lp.title }));
  const bar = N.el('div', { class: 'stage-bar', style: 'width:100%;margin:10px 0 6px' });
  bar.appendChild(N.el('div', { class: 'stage-fill', style: `width:${Math.round(lp.pct * 100)}%` }));
  level.appendChild(bar);
  level.appendChild(N.el('div', { class: 'small', text: `${lp.into} / ${lp.need} XP to next level · ${d.xp} XP total` }));
  hero.appendChild(level);

  const streak = N.el('div', { class: 'card' });
  streak.appendChild(N.el('div', { class: 'small', text: 'STREAK' }));
  streak.appendChild(N.el('div', { class: 'big-num', text: d.streak.current + ' 🔥' }));
  streak.appendChild(N.el('div', { class: 'small mt', text: `best: ${d.streak.best} days · focus any day to keep it alive` }));
  hero.appendChild(streak);

  const totals = N.el('div', { class: 'card' });
  const allMin = Object.values(d.daily).reduce((a, v) => a + (v.min || 0), 0);
  totals.appendChild(N.el('div', { class: 'small', text: 'ALL-TIME GARDEN' }));
  totals.appendChild(N.el('div', { class: 'big-num', text: N.fmtMin(allMin) }));
  totals.appendChild(N.el('div', { class: 'small mt', text: `${d.counters.sessionsTotal} sessions · ${d.counters.tasksDone} tasks · ${d.counters.kills} gentle closes` }));
  hero.appendChild(totals);
  c.appendChild(hero);

  /* ---------- charts row ---------- */
  const charts = N.el('div', { class: 'grid2b garden-charts mt' });

  const week = N.el('div', { class: 'card' });
  week.appendChild(N.el('h2', { text: '📊 Last 7 days' }));
  const bars = N.el('div', { class: 'bars mt' });
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(N.dayKey(i));
  const max = Math.max(30, ...days.map((k) => (d.daily[k] && d.daily[k].min) || 0));
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const k of days) {
    const min = (d.daily[k] && d.daily[k].min) || 0;
    const col = N.el('div', { class: 'bar-col', title: k + ' · ' + N.fmtMin(min) });
    col.appendChild(N.el('div', { class: 'bar', style: `height:${Math.round((min / max) * 100)}%` }));
    col.appendChild(N.el('div', { class: 'bar-lbl', text: DOW[new Date(k + 'T12:00:00').getDay()] }));
    bars.appendChild(col);
  }
  week.appendChild(bars);
  charts.appendChild(week);

  const garden = N.el('div', { class: 'card' });
  garden.appendChild(N.el('h2', { text: '🌷 Focus garden' }));
  garden.appendChild(N.el('div', { class: 'sub', text: 'Every day you study grows a plant. 15m+ 🌿 · 30m+ 🌷 · 60m+ 🌳' }));
  const heat = N.el('div', { class: 'heat' });
  for (let i = 90; i >= 0; i--) {
    const k = N.dayKey(i);
    const min = (d.daily[k] && d.daily[k].min) || 0;
    const plant = min <= 0 ? '' : min < 15 ? '🌱' : min < 30 ? '🌿' : min < 60 ? '🌷' : '🌳';
    heat.appendChild(N.el('div', { class: 'heat-cell', title: k + ' · ' + N.fmtMin(min), text: plant }));
  }
  garden.appendChild(heat);
  charts.appendChild(garden);
  c.appendChild(charts);

  /* ---------- evolution + achievements ---------- */
  const evoCard = N.el('div', { class: 'card mt' });
  evoCard.appendChild(N.el('h2', { text: '🐾 ' + d.pet.name + "'s journey" }));
  evoCard.appendChild(N.el('div', { class: 'sub', text: NookProgress.PET_STAGES[d.pet.stage].blurb }));
  const track = N.el('div', { class: 'evo-track mt' });
  for (const st of NookProgress.PET_STAGES) {
    const reached = d.pet.stage >= st.id;
    track.appendChild(N.el('div', { class: 'evo-step' + (reached ? ' reached' : '') + (d.pet.stage === st.id ? ' current' : ''), title: st.name + ' · ' + N.fmtMin(st.min) },
      N.el('div', { class: 'evo-line' }),
      N.el('div', { class: 'e', text: st.emoji }),
      N.el('div', { class: 'n', text: st.name + '\n' + N.fmtMin(st.min) })
    ));
  }
  evoCard.appendChild(track);
  c.appendChild(evoCard);

  const achCard = N.el('div', { class: 'card mt' });
  const earnedCount = Object.keys(d.achievements).length;
  achCard.appendChild(N.el('h2', { text: `Achievements (${earnedCount}/${NookProgress.ACHIEVEMENTS.length})` }));
  const grid = N.el('div', { class: 'list mt' });
  for (const a of NookProgress.ACHIEVEMENTS) {
    const got = d.achievements[a.id];
    grid.appendChild(N.el('div', { class: 'list-row', style: got ? '' : 'opacity:.55' },
      N.el('div', { class: 'grow' }, N.el('div', { class: 'title', style: 'font-size:12.5px', text: a.name }), N.el('div', { class: 'small', text: a.desc })),
      N.el('span', { class: 'small', text: got ? new Date(got).toLocaleDateString() : 'locked' })
    ));
  }
  achCard.appendChild(grid);
  c.appendChild(achCard);
};
