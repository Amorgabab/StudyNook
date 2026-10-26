/* ============================================================
   StudyNook · views-home.js — Focus page: timer, today, companion,
   ambience, activity
   ============================================================ */
'use strict';
window.Views = window.Views || {};

const RING_R = 108, RING_C = 2 * Math.PI * RING_R;

Views.home = function (c) {
  const S = App.state, d = S.data, ses = S.session, tm = d.settings.timer;

  const h = N.hour(), name = d.profile.name;
  const greetKey = h < 5 ? 'home.greet.night' : h < 12 ? 'home.greet.morning' : h < 18 ? 'home.greet.afternoon' : h < 22 ? 'home.greet.evening' : 'home.greet.night';
  c.appendChild(N.pageHead(t('home.title'), name ? t(greetKey + 'Name', { name }) : t(greetKey)));

  /* ---------- timer card ---------- */
  const timer = N.el('section', { class: 'card timer-card', 'aria-label': t('home.timer') });
  if (!ses.active) {
    timer.appendChild(N.seg([['pomodoro', t('home.mode.pomodoro'), 'timer'], ['free', t('home.mode.free'), 'hourglass']], App.freeMode ? 'free' : 'pomodoro',
      (v) => { App.freeMode = v === 'free'; App.render(); }, { full: true, label: t('home.mode.label') }));
  }
  const status = N.el('div', { class: 'timer-status', id: 'timer-status' });
  if (ses.active) status.appendChild(phaseBadge(ses));
  if (tm.iron || (ses.active && ses.iron)) {
    const locked = NookIron.isLocked(tm.ironLockedUntil, Date.now());
    const b = N.el('span', { class: 'badge', title: t('home.iron.tip') }, N.icon('lock', 12), N.el('span', { text: locked ? t('home.iron.locked', { time: NookIron.remainingHms(tm.ironLockedUntil, Date.now()).replace(/^0d\s+/, '') }) : t('home.iron.on') }));
    status.appendChild(b);
  }
  timer.appendChild(status);

  const frac = ses.active && ses.totalSec ? ses.remainingSec / ses.totalSec : 1;
  const svg = N.svgEl('svg', { width: 240, height: 240, viewBox: '0 0 240 240', 'aria-hidden': 'true' });
  svg.appendChild(N.svgEl('circle', { class: 'ring-bg', cx: 120, cy: 120, r: RING_R, fill: 'none', 'stroke-width': 10 }));
  svg.appendChild(N.svgEl('circle', { class: 'ring-fg' + (ses.active && ses.phase !== 'focus' ? ' break' : ''), id: 'ring-fg', cx: 120, cy: 120, r: RING_R, fill: 'none', 'stroke-width': 10, 'stroke-dasharray': RING_C, 'stroke-dashoffset': RING_C * (1 - frac) }));
  const idleMin = App.freeMode ? App.freeMin : tm.workMin;
  const task = ses.taskId ? d.tasks.find((x) => x.id === ses.taskId) : null;
  const sub = ses.active
    ? (task ? task.text : ses.mode === 'free' ? t('home.mode.free') : t('home.round', { n: Math.min(ses.roundIdx + 1, ses.rounds), of: ses.rounds }))
    : (App.freeMode ? t('home.idle.free', { min: NookI18n.minutes(App.freeMin) }) : t('home.idle.pomodoro', { min: NookI18n.minutes(tm.workMin) }));
  timer.appendChild(N.el('div', { class: 'ring-wrap' }, svg,
    N.el('div', { class: 'ring-center' },
      N.el('div', { class: 'ring-time', id: 'ring-time', role: 'timer', text: N.fmt(ses.active ? ses.remainingSec : idleMin * 60) }),
      N.el('div', { class: 'ring-sub', title: sub, text: sub }))));

  const actions = N.el('div', { class: 'timer-actions' });
  if (!ses.active) {
    if (App.freeMode) {
      const row = N.el('div', { class: 'dur-row', role: 'group', 'aria-label': t('home.duration') });
      for (const m of [15, 25, 45, 60, 90]) row.appendChild(N.el('button', { class: 'dur-chip', type: 'button', 'aria-pressed': App.freeMin === m ? 'true' : 'false', text: NookI18n.minutes(m), onclick: () => { App.freeMin = m; App.render(); } }));
      row.appendChild(N.stepper(App.freeMin, 1, 600, (v) => { App.freeMin = v; App.render(); }, 5, t('home.duration')));
      actions.appendChild(row);
    }
    actions.appendChild(N.btn(t('home.start'), { cls: 'btn-primary btn-lg btn-block', icon: 'play', iconSize: 18, onclick: startSession }));
    const sel = N.el('select', { class: 'input', id: 'home-task', 'aria-label': t('home.task') });
    sel.appendChild(N.el('option', { value: '', text: t('home.task.none') }));
    for (const tk of d.tasks.filter((x) => !x.done)) sel.appendChild(N.el('option', { value: tk.id, text: (tk.subject ? tk.subject + ' · ' : '') + tk.text, selected: App.lastTaskId === tk.id }));
    sel.addEventListener('change', () => {
      App.lastTaskId = sel.value || null;
      const tk = d.tasks.find((x) => x.id === App.lastTaskId);
      if (tk && tk.min > 0 && App.freeMode) App.freeMin = tk.min;
      App.render();
    });
    actions.appendChild(N.el('label', { class: 'task-pick' }, N.el('span', { class: 'field-label', text: t('home.task') }), sel));
    const selTask = d.tasks.find((x) => x.id === App.lastTaskId);
    if (selTask && selTask.min > 0) {
      const using = App.freeMode && App.freeMin === selTask.min;
      actions.appendChild(N.el('div', { class: 'row spread' },
        N.el('span', { class: 'small', text: t('home.planned', { min: NookI18n.minutes(selTask.min) }) }),
        using ? N.el('span', { class: 'badge success' }, N.icon('check', 12), N.el('span', { text: t('home.planned.using') }))
          : N.btn(t('home.planned.use'), { cls: 'btn-sm', onclick: () => { App.freeMode = true; App.freeMin = selTask.min; App.render(); } })));
    }
  } else {
    const iron = App.ironFocusOn();
    const row = N.el('div', { class: 'row' });
    row.appendChild(N.btn(ses.running ? t('home.pause') : t('home.resume'), {
      cls: 'btn-primary btn-lg', icon: ses.running ? 'pause' : 'play', iconSize: 18,
      title: iron ? t('home.iron.pauseTip') : null,
      onclick: () => nook.invoke(ses.running ? 'session:pause' : 'session:resume')
    }));
    row.appendChild(iron
      ? N.btn(t('home.endEarly'), { cls: 'btn-lg', icon: 'lock', iconSize: 18, onclick: () => App.ironGate(() => nook.invoke('session:stop', { abandon: true })) })
      : N.btn(t('home.end'), { cls: 'btn-lg', icon: 'square', iconSize: 16, onclick: () => App.confirm(t('home.end.confirm.t'), ses.phase === 'focus' ? t('home.end.confirm.focus') : t('home.end.confirm.break'), () => nook.invoke('session:stop', { abandon: ses.phase === 'focus' }), t('home.end')) }));
    actions.appendChild(row);
    if (ses.phase !== 'focus' && !ses.iron) actions.appendChild(N.btn(t('home.skipBreak'), { cls: 'btn-ghost', icon: 'skip-forward', onclick: () => nook.invoke('session:skip') }));
  }
  timer.appendChild(actions);

  /* ---------- today ---------- */
  const today = d.daily[N.todayKey()] || { min: 0, sessions: 0, kills: 0, tasks: 0 };
  const todayCard = N.card(t('home.today'), 'sun');
  const goal = d.settings.dailyGoalMin || 0;
  if (goal > 0) {
    const pct = Math.min(1, today.min / goal);
    todayCard.appendChild(N.el('div', { class: 'goal' },
      N.el('div', { class: 'row' }, N.el('span', { class: 'set-label', text: t('home.goal') }), N.el('span', { class: 'small tnum', text: t('home.goal.of', { done: NookI18n.minutes(today.min), goal: NookI18n.minutes(goal) }) })),
      N.el('div', { class: 'progress' + (pct >= 1 ? ' success' : ''), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': goal, 'aria-valuenow': today.min }, N.el('span', { style: 'width:' + Math.round(pct * 100) + '%' })),
      pct >= 1 ? N.el('span', { class: 'caption', text: t('home.goal.reached') }) : null));
  }
  const stats = N.el('div', { class: 'stats-4' });
  for (const [v, k] of [[NookI18n.minutesShort(today.min), 'home.stat.focused'], [NookI18n.num(today.sessions), 'home.stat.sessions'], [NookI18n.num(today.kills), 'home.stat.closed'], [NookI18n.num(d.streak.current), 'home.stat.streak']]) {
    stats.appendChild(N.el('div', { class: 'stat' }, N.el('div', { class: 'v', text: v }), N.el('div', { class: 'k overline', text: t(k) })));
  }
  todayCard.appendChild(stats);

  /* ---------- companion ---------- */
  const comp = N.card(t('home.companion'), 'cat');
  const stage = NookProgress.PET_STAGES[d.pet.stage] || NookProgress.PET_STAGES[0];
  const next = NookProgress.PET_STAGES[d.pet.stage + 1];
  const box = N.el('button', { class: 'mochi-box', type: 'button', title: t('home.companion.pet', { name: d.pet.name }), 'aria-label': t('home.companion.pet', { name: d.pet.name }), html: Mochi.build(d.pet.stage, App.mood()) });
  box.addEventListener('click', () => { nook.invoke('pet:pet'); Audio2.purr(); });
  const pct = next ? Math.min(1, (d.pet.totalFocusMin - stage.min) / (next.min - stage.min)) : 1;
  comp.appendChild(N.el('div', { class: 'companion' }, box,
    N.el('div', { class: 'grow' },
      N.el('div', { class: 'companion-name', text: d.pet.name }),
      N.el('div', { class: 'row small' }, N.icon(App.STAGE_ICONS[stage.id], 14), N.el('span', { text: App.stageName(stage.id) })),
      N.el('div', { class: 'progress success' }, N.el('span', { style: 'width:' + Math.round(pct * 100) + '%' })),
      N.el('div', { class: 'caption', style: 'margin-top:6px', text: next ? t('home.companion.next', { time: NookI18n.minutes(next.min - d.pet.totalFocusMin), stage: App.stageName(next.id) }) : t('home.companion.max') }),
      N.el('div', { class: 'small', style: 'margin-top:8px', text: App.moodLine() }))));

  c.appendChild(N.el('div', { class: 'focus-grid' }, timer, N.el('div', { class: 'focus-side' }, todayCard, comp)));

  /* ---------- ambience ---------- */
  const amb = N.card(t('home.ambience'), 'volume-2');
  const AMB = [['rain', 'cloud-rain'], ['fire', 'flame'], ['waves', 'waves-horizontal'], ['cafe', 'coffee']];
  const ambRow = N.el('div', { class: 'amb-row', role: 'group', 'aria-label': t('home.ambience') });
  for (const [id, ico] of AMB) {
    ambRow.appendChild(N.el('button', { class: 'amb-btn', type: 'button', 'aria-pressed': App.ambience === id ? 'true' : 'false', onclick: () => App.setAmbience(id) }, N.icon(ico, 16), N.el('span', { text: t('amb.' + id) })));
  }
  ambRow.appendChild(N.el('button', { class: 'amb-btn', type: 'button', 'aria-pressed': !App.ambience ? 'true' : 'false', onclick: () => App.setAmbience('off') }, N.icon('volume-x', 16), N.el('span', { text: t('amb.off') })));
  amb.appendChild(ambRow);
  const vol = N.el('input', { type: 'range', min: 0, max: 100, value: Math.round(d.settings.sound.volume * 100), 'aria-label': t('home.volume') });
  vol.addEventListener('input', () => Audio2.setVolume(vol.value / 100));
  vol.addEventListener('change', () => nook.invoke('settings:set', { section: 'sound', values: { volume: vol.value / 100 } }));
  amb.appendChild(N.el('div', { class: 'vol-row' }, N.icon('volume-2', 16), N.el('span', { class: 'small', text: t('home.volume') }), vol));

  /* ---------- activity ---------- */
  const act = N.card(t('home.activity'), 'clock');
  const rows = (d.feed || []).slice(0, 8);
  if (!rows.length) act.appendChild(N.empty('clock', t('home.activity.empty.t'), t('home.activity.empty.d')));
  else {
    const feed = N.el('div', { class: 'feed' });
    for (const r of rows) {
      const kind = r.kind === 'good' ? 'good' : r.kind === 'warn' ? 'warn' : 'info';
      feed.appendChild(N.el('div', { class: 'feed-item ' + kind },
        N.icon(kind === 'good' ? 'circle-check' : kind === 'warn' ? 'circle-alert' : 'circle-dot', 16),
        N.el('div', { class: 'grow' }, N.el('div', { class: 'feed-text', text: r.text }), r.xp > 0 ? N.el('div', { class: 'feed-xp', text: t('home.activity.xp', { n: r.xp }) }) : null),
        N.el('span', { class: 'feed-time', text: N.timeAgo(r.t) })));
    }
    act.appendChild(feed);
  }
  c.appendChild(N.el('div', { class: 'stack gap-6', style: 'margin-top:var(--s-6)' }, amb, act));

  function startSession() {
    const selEl = document.getElementById('home-task');
    App.lastTaskId = selEl && selEl.value ? selEl.value : App.lastTaskId;
    Audio2.begin();
    nook.invoke('session:start', { mode: App.freeMode ? 'free' : 'pomodoro', freeMin: App.freeMin || 25, taskId: App.lastTaskId });
  }
};

function phaseBadge(st) {
  const lbl = st.phase === 'focus' ? t('phase.focus') : st.phase === 'short' ? t('phase.short') : t('phase.long');
  return N.el('span', { class: 'badge ' + (!st.running ? 'warning' : st.phase === 'focus' ? 'accent' : 'success'), id: 'phase-badge', text: st.running ? lbl : t('phase.paused', { phase: lbl }) });
}

/* Called every second — updates the timer in place (no full re-render) */
Views.homeTick = function (st) {
  const time = document.getElementById('ring-time');
  if (!time) return;
  time.textContent = N.fmt(st.remainingSec);
  const fg = document.getElementById('ring-fg');
  if (fg && st.totalSec) {
    fg.setAttribute('stroke-dashoffset', RING_C * (1 - st.remainingSec / st.totalSec));
    fg.setAttribute('class', 'ring-fg' + (st.phase !== 'focus' ? ' break' : ''));
  }
  const old = document.getElementById('phase-badge');
  if (old && st.active) old.replaceWith(phaseBadge(st));
};
