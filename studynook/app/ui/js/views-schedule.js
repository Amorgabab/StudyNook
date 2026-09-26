/* ============================================================
   StudyNook · views-schedule.js — Week Schedule view
   A planner grid of recurring study blocks + plan-vs-focus
   bars fed by real session data (d.daily). All number-crunching
   lives in shared/schedule.js so it stays testable.
   ============================================================ */
'use strict';
window.Views = window.Views || {};

Views.schedule = function (c) {
  const d = App.state.data;
  const sched = d.schedule || {};
  const SH = NookSchedule;
  const todayIdx = SH.todayIndex();
  const sum = SH.summarize(sched, d.daily);
  const tot = SH.totals(sched, d.daily);

  /* ---------- header card ---------- */
  const head = N.el('div', { class: 'card' });
  head.appendChild(N.el('h2', { text: '📅 Week schedule' }));
  head.appendChild(N.el('div', { class: 'sub', text: 'Plan your week as repeating study blocks. When you focus, StudyNook quietly compares what you planned with what actually happened.' }));
  if (Object.keys(sched).length) {
    head.appendChild(N.el('div', { class: 'row spread' },
      N.el('span', { class: 'small', text: 'This week: planned ' + N.fmtMin(tot.plannedMin) + ' · focused ' + N.fmtMin(tot.actualMin) }),
      tot.plannedMin > 0 && tot.actualMin >= tot.plannedMin
        ? N.el('span', { class: 'pill on', text: '🌟 plan met' })
        : tot.plannedMin > 0
          ? N.el('span', { class: 'pill', text: Math.round((tot.actualMin / tot.plannedMin) * 100) + '% of plan so far' })
          : null
    ));
  }
  c.appendChild(head);

  /* ---------- add-block form ---------- */
  const formCard = N.el('div', { class: 'card mt' });
  formCard.appendChild(N.el('h3', { style: 'margin:0 0 8px;font-size:14px', text: '+ New weekly block' }));
  const subj = N.el('select', { class: 'input', id: 'sched-subj', style: 'width:150px' });
  subj.appendChild(N.el('option', { value: '', text: 'subject…' }));
  for (const s of (d.subjects || [])) subj.appendChild(N.el('option', { value: s, text: s }));
  const lbl = N.el('input', { class: 'input', id: 'sched-label', placeholder: 'optional note, e.g. “problem set”', style: 'flex:1;min-width:150px' });
  const at = N.el('input', { class: 'input', type: 'time', id: 'sched-at', style: 'width:auto', title: 'what time? (optional)' });
  let minVal = 25;
  const mins = N.stepper(25, 5, 600, (v) => { minVal = v; }, 5);
  mins.title = 'how many minutes each day?';

  const picked = new Set([todayIdx]);
  const dayRow = N.el('div', { class: 'seg', style: 'flex-wrap:wrap' });
  const dayBtns = SH.DAYS.map((name, i) => {
    const b = N.el('button', { class: picked.has(i) ? 'on sage' : '', text: name, onclick: () => {
      picked.has(i) ? picked.delete(i) : picked.add(i);
      b.className = picked.has(i) ? 'on sage' : '';
    } });
    return b;
  });
  dayRow.append(...dayBtns);

  const err = N.el('div', { class: 'small', style: 'color:var(--rose);display:none;margin-top:6px' });
  const submit = () => {
    if (!subj.value && !lbl.value.trim()) { err.textContent = 'Pick a subject or write a short note first.'; err.style.display = 'block'; return; }
    if (!picked.size) { err.textContent = 'Choose at least one day of the week.'; err.style.display = 'block'; return; }
    err.style.display = 'none';
    nook.invoke('schedule:add', { block: {
      subject: subj.value, label: lbl.value.trim(), min: minVal,
      at: at.value || null, days: [...picked].sort((a, b) => a - b)
    } }).then((res) => {
      if (res && res.ok) Audio2.pop();
      else if (res && res.error) { err.textContent = res.error; err.style.display = 'block'; }
    });
  };
  const addBtn = N.el('button', { class: 'btn btn-sage', text: '+ Add block', onclick: submit });
  formCard.appendChild(N.el('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px' }, subj, lbl, mins, N.el('span', { class: 'row', style: 'gap:4px' }, N.el('span', { class: 'small', text: 'at' }), at), addBtn));
  formCard.appendChild(N.el('div', { class: 'row mt', style: 'gap:8px;flex-wrap:wrap' }, N.el('span', { class: 'small', text: 'days:' }), dayRow));
  formCard.appendChild(err);
  formCard.appendChild(N.el('div', { class: 'small mt', text: 'Blocks repeat every week. Leave “at” empty for a flexible any-time block. Max ' + SH.MAX_BLOCKS + ' blocks.' }));
  c.appendChild(formCard);

  /* ---------- week grid ---------- */
  const gridCard = N.el('div', { class: 'card mt' });
  if (!Object.keys(sched).length) {
    gridCard.appendChild(N.el('div', { class: 'small', text: 'Nothing planned yet. Add a block above — even two or three a week makes the plan feel real. 🌱' }));
    c.appendChild(gridCard);
    return;
  }
  gridCard.appendChild(N.el('div', { class: 'week-grid' }));
  const wrap = gridCard.lastChild;
  // header row: day names with plan/actual chips
  wrap.appendChild(N.el('div', { class: 'wg-cell wg-head', text: 'wk' }));
  SH.DAYS.forEach((name, i) => {
    const cell = N.el('div', { class: 'wg-cell wg-head' + (i === todayIdx ? ' today' : '') },
      N.el('div', { class: 'wg-day', text: name }),
      N.el('div', { class: 'wg-nums', text: sum[i].planned ? N.fmtMin(sum[i].planned) + ' → ' + N.fmtMin(sum[i].actual) : (i === todayIdx ? 'today' : '—') })
    );
    wrap.appendChild(cell);
  });
  // body rows: max blocks on any day
  const perDay = SH.DAYS.map((_, i) => SH.blocksForDay(sched, i));
  const rows = Math.min(6, Math.max(...perDay.map((l) => l.length)));
  for (let r = 0; r < rows; r++) {
    wrap.appendChild(N.el('div', { class: 'wg-cell wg-side', text: String(r + 1) }));
    for (let i = 0; i < 7; i++) {
      const b = perDay[i][r];
      if (!b) { wrap.appendChild(N.el('div', { class: 'wg-cell' })); continue; }
      const chip = N.el('div', { class: 'wg-block' + (i === todayIdx ? ' today' : ''), title: (b.at ? b.at + ' · ' : '') + (b.subject || b.label) + ' · ' + N.fmtMin(b.min) },
        N.el('span', { class: 'wg-t', text: b.at || '∗' }),
        N.el('span', { class: 'wg-s', text: b.subject || b.label }),
        N.el('span', { class: 'wg-m', text: N.fmtMin(b.min) })
      );
      wrap.appendChild(N.el('div', { class: 'wg-cell' }, chip));
    }
  }
  const more = perDay.some((l) => l.length > rows);
  if (more) gridCard.appendChild(N.el('div', { class: 'small mt', text: 'Some days have more blocks than shown — the list below has everything.' }));
  c.appendChild(gridCard);

  /* ---------- plan vs actual bars ---------- */
  const barsCard = N.el('div', { class: 'card mt' });
  barsCard.appendChild(N.el('h3', { style: 'margin:0 0 10px;font-size:14px', text: '🌤 Plan vs. focus this week' }));
  for (const s of sum) {
    if (!s.planned && !s.actual) continue;
    const pct = s.pct === null ? 0 : Math.min(1, s.pct);
    barsCard.appendChild(N.el('div', { class: 'row', style: 'gap:10px;margin-bottom:7px;align-items:center' },
      N.el('span', { class: 'bar-day' + (SH.DAYS.indexOf(s.name) === todayIdx ? ' today' : ''), text: s.name }),
      N.el('div', { class: 'bar-track' }, N.el('div', { class: 'bar-fill' + (s.met ? ' met' : ''), style: 'width:' + Math.round(pct * 100) + '%' })),
      N.el('span', { class: 'small bar-num', text: s.planned ? N.fmtMin(s.actual) + ' / ' + N.fmtMin(s.planned) + (s.met ? ' ✓' : '') : N.fmtMin(s.actual) + ' (no plan)' })
    ));
  }
  barsCard.appendChild(N.el('div', { class: 'small mt', text: 'Focus minutes come from finished sessions — just press Start when your block begins. No checkboxes to tick. 💪' }));
  c.appendChild(barsCard);

  /* ---------- manage blocks list ---------- */
  const listCard = N.el('div', { class: 'card mt' });
  listCard.appendChild(N.el('h3', { style: 'margin:0 0 10px;font-size:14px', text: 'Your blocks (' + Object.keys(sched).length + '/' + SH.MAX_BLOCKS + ')' }));
  const ids = Object.keys(sched).sort((a, b) => (sched[a].at || '99:99').localeCompare(sched[b].at || '99:99'));
  for (const id of ids) {
    const b = sched[id];
    const row = N.el('div', { class: 'list-row' });
    row.appendChild(N.el('div', { class: 'grow' },
      N.el('div', { class: 'title', text: (b.at ? b.at + ' · ' : '') + (b.subject || b.label || 'block') + (b.label && b.subject ? ' — ' + b.label : '') }),
      N.el('div', { class: 'row', style: 'gap:4px;margin-top:4px;flex-wrap:wrap' },
        ...SH.DAYS.map((n, i) => N.el('span', { class: 'day-dot' + ((b.days || []).includes(i) ? ' on' : (i === todayIdx ? ' today' : '')), text: n[0] }))
      )
    ));
    row.appendChild(N.el('span', { class: 'small', text: N.fmtMin(b.min) }));
    row.appendChild(N.el('button', { class: 'toggle' + (b.enabled !== false ? ' on' : ''), title: 'pause/resume this block', onclick: () => nook.invoke('schedule:toggle', { id }) }));
    row.appendChild(N.el('button', { class: 'iconbtn', text: '✎', title: 'edit', onclick: () => editModal(b) }));
    row.appendChild(N.el('button', { class: 'iconbtn', text: '🗑', title: 'delete', onclick: () => App.confirm('Delete this block?', (b.subject || b.label) + ' · ' + N.fmtMin(b.min), () => nook.invoke('schedule:remove', { id })) }));
    listCard.appendChild(row);
  }
  c.appendChild(listCard);

  /* ---------- edit modal (reuse App.modal) ---------- */
  function editModal(b) {
    const esub = N.el('select', { class: 'input', style: 'width:100%' });
    esub.appendChild(N.el('option', { value: '', text: 'subject…' }));
    for (const s of (d.subjects || [])) esub.appendChild(N.el('option', { value: s, text: s, selected: s === b.subject ? true : null }));
    const elbl = N.el('input', { class: 'input', style: 'width:100%', placeholder: 'note (optional)', value: b.label || '' });
    const eat = N.el('input', { class: 'input', type: 'time', value: b.at || '' });
    let emin = b.min;
    const emins = N.stepper(b.min, 5, 600, (v) => { emin = v; }, 5);
    const epick = new Set(b.days || []);
    const eday = N.el('div', { class: 'seg', style: 'flex-wrap:wrap' },
      ...SH.DAYS.map((n, i) => {
        const btn = N.el('button', { class: epick.has(i) ? 'on sage' : '', text: n, onclick: () => { epick.has(i) ? epick.delete(i) : epick.add(i); btn.className = epick.has(i) ? 'on sage' : ''; } });
        return btn;
      })
    );
    const body = N.el('div', {},
      N.el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, esub, elbl),
      N.el('div', { class: 'row mt', style: 'gap:8px;align-items:center' }, N.el('span', { class: 'small', text: 'at' }), eat, emins),
      N.el('div', { class: 'mt' }, eday)
    );
    App.modal('Edit block', body, [
      { label: 'Save', cls: 'btn-sage', fn: () => {
        nook.invoke('schedule:update', { id: b.id, patch: { subject: esub.value, label: elbl.value.trim(), min: emin, at: eat.value || null, days: [...epick].sort((x, y) => x - y) } })
          .then((res) => { if (res && !res.ok && res.error) App.toast('Cannot save', res.error); App.closeModal(); });
      } },
      { label: 'Cancel', cls: 'btn-ghost', fn: () => App.closeModal() }
    ]);
    // preselect current subject option
    esub.value = b.subject || '';
  }
};
