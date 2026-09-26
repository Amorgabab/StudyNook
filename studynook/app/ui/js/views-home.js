/* ============================================================
   StudyNook · views-home.js — the Nook: timer + Mochi + today
   ============================================================ */
'use strict';
window.Views = window.Views || {};

Views.home = function (c) {
  const S = App.state, d = S.data, ses = S.session;
  const t = d.settings.timer;

  /* ---------- timer card ---------- */
  const timerCard = N.el('div', { class: 'card timer-card', id: 'timer-card' });
  // status pill only carries real information (phase / paused) — no filler text when idle
  if (ses.active) {
    const phaseLabel = ses.phase === 'focus' ? 'Focus' : ses.phase === 'short' ? 'Short break' : 'Long break';
    const pill = N.el('div', { class: 'phase-pill' + (ses.phase !== 'focus' ? ' break' : ''), id: 'phase-pill', text: phaseLabel + (ses.running ? '' : ' · paused') });
    timerCard.appendChild(pill);
  }
  // iron status — quiet session-state line at the top of the card, never between the action and the task picker
  if (d.settings.timer.iron) {
    timerCard.appendChild(N.el('div', { class: 'iron-status', text: '🔒 iron mode · no pause · switch locked for ' + NookIron.remainingHms(d.settings.timer.ironLockedUntil, Date.now()) }));
  }

  // ring — thin subtle progress ring, large readable time
  const R = 110, CIRC = 2 * Math.PI * R;
  const frac = ses.active && ses.totalSec ? ses.remainingSec / ses.totalSec : 1;
  const svg = N.svgEl('svg', { width: 250, height: 250, viewBox: '0 0 250 250' });
  svg.appendChild(N.svgEl('circle', { class: 'ring-bg', cx: 125, cy: 125, r: R, fill: 'none', 'stroke-width': 8 }));
  const fg = N.svgEl('circle', { class: 'ring-fg' + (ses.active && ses.phase !== 'focus' ? ' break' : ''), id: 'ring-fg', cx: 125, cy: 125, r: R, fill: 'none', 'stroke-width': 8, 'stroke-dasharray': CIRC, 'stroke-dashoffset': CIRC * (1 - frac) });
  svg.appendChild(fg);
  const wrap = N.el('div', { class: 'ring-wrap' });
  wrap.appendChild(svg);
  const center = N.el('div', { class: 'ring-center' });
  const idleMin = App.freeMode ? App.freeMin : t.workMin;
  const timeEl = N.el('div', { class: 'ring-time', id: 'ring-time', text: ses.active ? N.fmt(ses.remainingSec) : N.fmt(idleMin * 60) });
  const task = ses.taskId ? d.tasks.find((x) => x.id === ses.taskId) : null;
  const subEl = N.el('div', { class: 'ring-sub', id: 'ring-sub', text: ses.active ? (task ? '📚 ' + task.text : (ses.mode === 'free' ? 'free focus' : `round ${Math.min(ses.roundIdx + 1, ses.rounds)}/${ses.rounds}`)) : (App.freeMode ? `free focus · ${App.freeMin} min` : `pomodoro · ${t.workMin} min rounds`) });
  center.append(timeEl, subEl);
  wrap.appendChild(center);
  timerCard.appendChild(wrap);

  // controls — mode selector directly under the ring (round dots removed: no useful info)
  const controls = N.el('div', { class: 'timer-controls' });
  if (!ses.active) {
    const modeSeg = N.el('div', { class: 'seg' });
    const bPomo = N.el('button', { class: App.freeMode ? '' : 'on accent', text: '🍅 Pomodoro', onclick: () => { App.freeMode = false; App.render(); } });
    const bFree = N.el('button', { class: App.freeMode ? 'on accent' : '', text: '🌙 Free focus', onclick: () => { App.freeMode = true; App.render(); } });
    modeSeg.append(bPomo, bFree);
    controls.appendChild(modeSeg);
    const start = N.el('button', { class: 'btn glass-btn startbig', text: '▶ Start focusing', onclick: () => startSession() });
    controls.appendChild(start);
  } else {
    const iron = d.settings.timer.iron && ses.phase === 'focus';
    const pp = iron && ses.running
      ? N.el('button', { class: 'btn startbig', disabled: true, title: 'Iron session: no pause', text: '🔒 no pause (iron)' })
      : N.el('button', {
          class: 'btn btn-primary startbig',
          text: ses.running ? '⏸ Pause' : '▶ Resume',
          onclick: () => nook.invoke(ses.running ? 'session:pause' : 'session:resume')
        });
    const giveUp = iron
      ? N.el('button', {
          class: 'btn btn-ghost', text: '🔒 End early (iron gate)',
          onclick: () => App.ironGate(() => nook.invoke('session:stop', { abandon: true }))
        })
      : N.el('button', {
          class: 'btn btn-ghost', text: '🌧️ End session', onclick: () => App.confirm('End this session?', ses.phase === 'focus' ? 'Focused minutes still count for XP (unless strict mode is on), but you lose the completion bonus.' : 'Your break ends and the session stops.', () => nook.invoke('session:stop', { abandon: ses.phase === 'focus' }))
        });
    controls.append(pp, giveUp);
    if (ses.phase !== 'focus') controls.appendChild(N.el('button', { class: 'btn btn-sage', text: '⏭ Skip break', onclick: () => nook.invoke('session:skip') }));
  }
  timerCard.appendChild(controls);

  // free-mode length chips + task picker (only when idle)
  if (!ses.active) {
    // duration controls are a quiet secondary setting — small, muted, placed
    // after the primary action flow so they never compete with the timer
    if (App.freeMode) {
      const freeRow = N.el('div', { class: 'free-row' });
      for (const m of [15, 25, 45, 60, 90]) {
        freeRow.appendChild(N.el('button', { class: 'dur-chip' + (App.freeMin === m ? ' on' : ''), text: m + 'm', onclick: () => { App.freeMin = m; App.render(); } }));
      }
      const custom = N.stepper(App.freeMin, 1, 600, (v) => { App.freeMin = v; App.render(); });
      freeRow.appendChild(N.el('span', { class: 'dur-stepper' }, custom, N.el('span', { class: 'dur-unit', text: 'min' })));
      timerCard.appendChild(freeRow);
    }
    // task picker — compact & secondary, immediately follows Start focusing
    const taskRow = N.el('div', { class: 'task-pick' });
    const sel = N.el('select', { class: 'input', id: 'home-task' });
    sel.appendChild(N.el('option', { value: '', text: '🎯 no specific task' }));
    for (const tk of d.tasks.filter((x) => !x.done)) sel.appendChild(N.el('option', { value: tk.id, text: (tk.subject ? tk.subject + ' · ' : '') + tk.text, selected: App.lastTaskId === tk.id }));
    sel.addEventListener('change', () => {
      App.lastTaskId = sel.value || null;
      const tk = d.tasks.find((x) => x.id === App.lastTaskId);
      if (tk && tk.min > 0 && App.freeMode) App.freeMin = tk.min;   // plan pre-fills free length
      App.render();
    });
    taskRow.append(
      N.el('span', { class: 'tp-label', text: 'Studying' }),
      sel,
      N.el('span', { class: 'tp-hint', text: 'optional' })
    );
    timerCard.appendChild(taskRow);
    // task plan → one-click session length
    const selTask = d.tasks.find((x) => x.id === App.lastTaskId);
    if (selTask && selTask.min > 0) {
      const planRow = N.el('div', { class: 'row', style: 'justify-content:center;margin-top:8px' });
      planRow.appendChild(N.el('span', { class: 'tag', text: `📋 plan: ${selTask.min} min` }));
      planRow.appendChild(N.el('button', {
        class: 'btn btn-sm btn-honey',
        text: App.freeMode && App.freeMin === selTask.min ? '✓ session will run ' + selTask.min + ' min' : 'Use as session length',
        onclick: () => { App.freeMode = true; App.freeMin = selTask.min; App.render(); }
      }));
      timerCard.appendChild(planRow);
    }
  }

  /* ---------- right column: pet + today ---------- */
  const right = N.el('div', { style: 'display:flex;flex-direction:column;gap:16px' });

  const petCard = N.el('div', { class: 'card pet-card' });
  const stage = NookProgress.PET_STAGES[d.pet.stage] || NookProgress.PET_STAGES[0];
  const next = NookProgress.PET_STAGES[d.pet.stage + 1];
  const box = N.el('div', { class: 'mochi-box', id: 'mochi-box', title: 'Pet ' + d.pet.name });
  box.innerHTML = Mochi.build(d.pet.stage, App.mood());
  box.addEventListener('click', (e) => {
    nook.invoke('pet:pet');
    Audio2.purr();
    const h = N.el('span', { class: 'heart', text: ['💗', '💕', '🩷', '✨'][Math.floor(Math.random() * 4)] });
    h.style.left = (e.offsetX || 60) + 'px';
    h.style.top = (e.offsetY || 40) + 'px';
    h.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
    box.appendChild(h);
    setTimeout(() => h.remove(), 1000);
  });
  petCard.appendChild(box);
  petCard.appendChild(N.el('div', { class: 'pet-name', text: d.pet.name }));
  petCard.appendChild(N.el('div', { class: 'pet-stage', text: stage.emoji + ' ' + stage.name + (next ? ` · ${N.fmtMin(next.min - d.pet.totalFocusMin)} to evolve` : ' · fully evolved!') }));
  const sbar = N.el('div', { class: 'stage-bar' });
  const pct = next ? Math.min(1, (d.pet.totalFocusMin - stage.min) / (next.min - stage.min)) : 1;
  sbar.appendChild(N.el('div', { class: 'stage-fill', style: `width:${Math.round(pct * 100)}%` }));
  petCard.appendChild(sbar);
  petCard.appendChild(N.el('div', { class: 'pet-mood', id: 'pet-mood', text: App.moodLine() }));
  right.appendChild(petCard);

  const todayKey = N.todayKey();
  const today = d.daily[todayKey] || { min: 0, sessions: 0, kills: 0, tasks: 0 };
  const todayCard = N.el('div', { class: 'card' });
  todayCard.appendChild(N.el('h2', { text: '🌤️ Today' }));
  const tg = N.el('div', { class: 'today-grid' });
  const stats = [
    [N.fmtMin(today.min), 'Focused', ''],
    [today.sessions, 'Sessions', ''],
    [today.kills, 'Closes', ''],
    [d.streak.current, 'Streak', ' streak']
  ];
  for (const [v, k, extra] of stats) {
    tg.appendChild(N.el('div', { class: 'stat-tile' + (extra ? ' streak' : '') },
      N.el('div', { class: 'v', text: String(v) + (extra ? ' 🔥' : '') }),
      N.el('div', { class: 'k', text: k.toLowerCase() })));
  }
  todayCard.appendChild(tg);
  right.appendChild(todayCard);

  /* ---------- ambience + journal ---------- */
  const bottom = N.el('div', { class: 'grid2b mt' });
  const ambCard = N.el('div', { class: 'card amb-card' });
  ambCard.appendChild(N.el('h2', { text: '🎧 Ambience' }));
  // no explanatory text — title up top, controls grouped toward the bottom
  ambCard.appendChild(N.el('div', { class: 'amb-spacer' }));
  const ambRow = N.el('div', { class: 'amb-row' });
  const AMB = [['rain', '🌧️ Rain'], ['fire', '🔥 Fireplace'], ['waves', '🌊 Waves'], ['cafe', '☕ Café']];
  for (const [id, lbl] of AMB) {
    ambRow.appendChild(N.el('button', {
      class: 'amb-btn' + (App.ambience === id ? ' on' : ''), text: lbl, 'aria-pressed': App.ambience === id ? 'true' : 'false',
      onclick: () => App.setAmbience(id)
    }));
  }
  // Off reads as "disable", not as another sound source
  ambRow.appendChild(N.el('button', {
    class: 'amb-off' + (App.ambience === 'off' || !App.ambience ? ' on' : ''), text: '🔕 Off', title: 'Turn ambience off', 'aria-pressed': (App.ambience === 'off' || !App.ambience) ? 'true' : 'false',
    onclick: () => App.setAmbience('off')
  }));
  ambCard.appendChild(ambRow);
  // volume belongs to the current selection — one quiet row with it
  const volRow = N.el('div', { class: 'amb-volrow' });
  const volName = (AMB.find((a) => a[0] === App.ambience) || [, 'Ambience'])[1];
  const vol = N.el('input', { class: 'amb-vol', type: 'range', min: 0, max: 100, value: Math.round(d.settings.sound.volume * 100), 'aria-label': 'Ambience volume' });
  vol.addEventListener('input', () => {
    Audio2.setVolume(vol.value / 100);
    nook.invoke('settings:set', { section: 'sound', values: { volume: vol.value / 100 } });
  });
  volRow.append(N.el('span', { class: 'amb-vol-name', text: volName }), vol);
  ambCard.appendChild(volRow);
  bottom.appendChild(ambCard);

  const feedCard = N.el('div', { class: 'card' });
  feedCard.appendChild(N.el('h2', { text: 'Journal' }));
  const feed = N.el('div', { class: 'feed mt' });
  const rows = (d.feed || []).slice(0, 9);
  if (!rows.length) feed.appendChild(N.el('div', { class: 'small', text: 'Your cozy story starts with the first session…' }));
  for (const r of rows) {
    const kind = r.kind === 'good' ? 'good' : r.kind === 'warn' ? 'warn' : 'info';
    const icon = kind === 'good' ? '✓' : kind === 'warn' ? '!' : '·';
    const entry = N.el('div', { class: 'feed-entry ' + kind },
      N.el('div', { class: 'fe-main' },
        N.el('span', { class: 'fe-emoji', text: r.emoji || '🌱' }),
        N.el('span', { class: 'fe-text', text: r.text }),
        N.el('span', { class: 'fe-icon', 'aria-hidden': 'true', text: icon }),
        N.el('span', { class: 'ft', text: N.timeAgo(r.t) })
      )
    );
    if (r.xp > 0) entry.appendChild(N.el('div', { class: 'fe-xp', text: '+' + r.xp + ' XP' }));
    feed.appendChild(entry);
  }
  feedCard.appendChild(feed);
  bottom.appendChild(feedCard);

  c.append(N.el('div', { class: 'home-top' }, timerCard, right), bottom);

  function startSession() {
    const selEl = document.getElementById('home-task');
    App.lastTaskId = selEl && selEl.value ? selEl.value : App.lastTaskId;
    Audio2.begin();
    nook.invoke('session:start', { mode: App.freeMode ? 'free' : 'pomodoro', freeMin: App.freeMin || 25, taskId: App.lastTaskId });
  }
};

/* Called every second — updates timer DOM in place (no full re-render) */
Views.homeTick = function (st) {
  const time = document.getElementById('ring-time');
  const fg = document.getElementById('ring-fg');
  const pill = document.getElementById('phase-pill');
  if (!time) return;
  time.textContent = N.fmt(st.remainingSec);
  if (fg && st.totalSec) fg.setAttribute('stroke-dashoffset', (2 * Math.PI * 110) * (1 - st.remainingSec / st.totalSec));
  if (pill && st.active) {
    const lbl = st.phase === 'focus' ? 'Focus' : st.phase === 'short' ? 'Short break' : 'Long break';
    pill.textContent = lbl + (st.running ? '' : ' · paused');
    pill.className = 'phase-pill' + (st.phase !== 'focus' ? ' break' : '');
    if (fg) fg.setAttribute('class', 'ring-fg' + (st.phase !== 'focus' ? ' break' : ''));
  }
};
