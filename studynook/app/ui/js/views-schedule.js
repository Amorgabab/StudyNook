/* ============================================================
   StudyNook · views-schedule.js — Week Schedule view
   ------------------------------------------------------------
   The Week Schedule is NOT a second data system: it shows the
   SAME tasks from d.tasks[] that carry a planned date (and an
   optional start time). Edit here → Tasks updates instantly,
   and vice versa. All week math lives in shared/weeksched.js +
   shared/taskdays.js so it stays pure and testable.
   ============================================================ */
'use strict';
window.Views = window.Views || {};

Views.scheduleStart = null; // remembered while you browse Previous/Next Week

Views.schedule = function (c) {
  const d = App.state.data;
  const TD = window.TaskDays, WS = window.WeekSched;
  const today = N.todayKey();
  if (!Views.scheduleStart) Views.scheduleStart = TD.weekStart(today);
  const model = WS.weekModel(d.tasks, Views.scheduleStart, today);
  Views.scheduleStart = model.start;
  const thisWeekStart = TD.weekStart(today);

  /* ---------- header card with readable week navigation ---------- */
  const head = N.el('div', { class: 'card' });
  head.appendChild(N.el('h2', { text: '📅 Week Schedule' }));
  head.appendChild(N.el('div', { class: 'sub', text: 'Your scheduled study tasks, day by day. These are the same tasks from the Tasks tab — a task appears here once it has a date.' }));
  const nav = N.el('div', { class: 'row spread ws-nav' },
    N.el('button', { class: 'btn btn-ghost btn-sm', text: '‹ Previous Week', 'aria-label': 'Previous Week', onclick: () => { Views.scheduleStart = WS.shiftWeek(model.start, -1); App.render(); } }),
    N.el('div', { class: 'ws-range' },
      N.el('b', { text: WS.rangeLabel(model) }),
      N.el('span', { class: 'small', text: model.start === thisWeekStart ? 'This Week' : (model.start > thisWeekStart ? 'Upcoming' : 'Past') })
    ),
    N.el('button', { class: 'btn btn-ghost btn-sm', text: 'Next Week ›', 'aria-label': 'Next Week', onclick: () => { Views.scheduleStart = WS.shiftWeek(model.start, 1); App.render(); } })
  );
  head.appendChild(nav);
  const navRow = N.el('div', { class: 'row', style: 'justify-content:center;margin-top:6px' });
  if (model.start !== thisWeekStart) {
    navRow.appendChild(N.el('button', { class: 'btn btn-ghost btn-sm', text: 'Today', 'aria-label': 'Jump back to the current week', onclick: () => { Views.scheduleStart = thisWeekStart; App.render(); } }));
  } else {
    navRow.appendChild(N.el('span', { class: 'pill on', text: 'You are viewing This Week' }));
  }
  if (model.total) {
    navRow.appendChild(N.el('span', { class: 'small', style: 'margin-left:10px', text: model.doneTotal + ' of ' + model.total + ' done · planned ' + N.fmtMin(model.plannedMin) }));
  }
  head.appendChild(navRow);
  c.appendChild(head);

  /* ---------- empty state ---------- */
  if (!model.total) {
    const clear = N.el('div', { class: 'card mt' });
    clear.appendChild(N.el('h3', { style: 'margin:0 0 6px;font-size:15px', text: 'Your week is clear' }));
    clear.appendChild(N.el('div', { class: 'small', text: "You don't have any scheduled tasks for this week. Give yourself one nudge: pick a day and a rough time — even two or three sessions makes the week feel real. 🌱" }));
    const addBtn = N.el('button', { class: 'btn btn-sage mt', text: '+ Add a Task', onclick: () => Views._taskModal(null, { focusDate: true }) });
    clear.appendChild(N.el('div', { class: 'row mt', style: 'gap:8px;flex-wrap:wrap' },
      addBtn,
      N.el('button', { class: 'btn btn-ghost', text: 'Or plan an existing task', onclick: () => Views._scheduleExisting(model) })
    ));
    c.appendChild(clear);
    return;
  }

  /* ---------- quick-add for THIS week (same task record as the Tasks tab) ---------- */
  const addCard = N.el('div', { class: 'card mt' });
  const qText = N.el('input', { class: 'input', placeholder: 'Add a study task for this week…', style: 'flex:1;min-width:200px', 'aria-label': 'Task name' });
  const qDay = N.el('select', { class: 'input', style: 'width:auto', 'aria-label': 'Day of the week' });
  qDay.appendChild(N.el('option', { value: '', text: 'Any day' }));
  for (const day of model.days) qDay.appendChild(N.el('option', { value: day.key, text: day.name + (day.isToday ? ' · Today' : '') }));
  const qAt = N.el('input', { class: 'input', type: 'time', style: 'width:auto', title: 'Start time (optional)', 'aria-label': 'Start time, optional' });
  let qMin = 25;
  const qMins = N.stepper(25, 0, 600, (v) => { qMin = v; }, 5);
  qMins.setAttribute('aria-label', 'Planned minutes');
  const qErr = N.el('div', { class: 'small', style: 'color:var(--rose);display:none;margin-top:6px' });
  const qAdd = N.el('button', { class: 'btn btn-sage', text: '+ Add' });
  const qSubmit = () => {
    const v = qText.value.trim();
    if (!v) { qText.focus(); return; }
    qErr.style.display = 'none';
    qAdd.disabled = true; // one flight at a time — no double-adds on fast clicks
    nook.invoke('tasks:add', { text: v, subject: '', min: qMin, est: Math.max(1, Math.ceil(qMin / 25) || 1), date: qDay.value || null, at: qAt.value || null })
      .then((t) => {
        qAdd.disabled = false;
        if (t && t.id) { qText.value = ''; Audio2.pop(); }
        else { qErr.textContent = 'Could not save right now — please try again.'; qErr.style.display = 'block'; }
      })
      .catch(() => { qAdd.disabled = false; qErr.textContent = 'Could not save right now — please try again.'; qErr.style.display = 'block'; });
  };
  qAdd.addEventListener('click', qSubmit);
  qText.addEventListener('keydown', (e) => { if (e.key === 'Enter') qSubmit(); });
  addCard.appendChild(N.el('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px;align-items:center' },
    qText, qDay, qAt, qMins, N.el('span', { class: 'small', text: 'minutes' }), qAdd));
  addCard.appendChild(qErr);
  addCard.appendChild(N.el('div', { class: 'small mt', text: 'New tasks appear here AND on the Tasks tab — it is always one single task. Leave “Any day” to keep it unscheduled for now.' }));
  c.insertBefore(addCard, c.children[1] || null);

  /* ---------- the seven days (always all shown) ---------- */
  for (const day of model.days) {
    const card = N.el('div', { class: 'card mt ws-day' + (day.isToday ? ' today' : '') });
    card.appendChild(N.el('div', { class: 'row spread ws-day-head' },
      N.el('h3', { style: 'margin:0;font-size:14px', text: day.name + (day.isToday ? ' · Today' : '') }),
      N.el('span', { class: 'small', text: day.count ? day.count + (day.count > 1 ? ' scheduled tasks' : ' scheduled task') + (day.doneCount ? ' · ' + day.doneCount + ' completed' : '') : '' })
    ));
    if (!day.count) {
      card.appendChild(N.el('div', { class: 'ws-empty', text: 'No scheduled tasks' }));
      c.appendChild(card);
      continue;
    }
    for (const t of day.tasks) {
      const row = N.el('div', { class: 'list-row' + (t.done ? ' done' : '') });
      row.appendChild(N.el('button', {
        class: 'checkbox' + (t.done ? ' on' : ''), text: '✓',
        title: t.done ? 'Mark as Incomplete' : 'Mark as Complete (+5 XP)',
        'aria-label': t.done ? 'Mark task as incomplete' : 'Mark task as complete, +5 XP',
        onclick: () => { nook.invoke('tasks:toggle', { id: t.id }); if (!t.done) Audio2.pop(); }
      }));
      const grow = N.el('div', { class: 'grow' },
        N.el('div', { class: 'title', text: t.text }),
        N.el('div', { class: 'task-meta' },
          N.el('span', { class: 'meta-chip', text: t.at ? t.at : 'Any time' }),
          t.subject ? N.el('span', { class: 'tag', text: t.subject }) : null,
          t.min ? N.el('span', { class: 'meta-chip', title: 'Planned minutes — how long you expect this to take', text: N.fmtMin(t.min) }) : null
        )
      );
      row.appendChild(grow);
      if (!t.done) {
        row.appendChild(N.el('button', {
          class: 'btn btn-sm btn-sage', text: '▶ Focus', title: 'Go to the timer with this task selected',
          'aria-label': 'Start focusing on this task',
          onclick: () => nook.invoke('tasks:focusNow', { id: t.id }).then((ok) => {
            if (!ok) App.toast('Cannot start now', 'A session may already be running.');
          })
        }));
      }
      row.appendChild(N.el('button', { class: 'iconbtn', text: '✎', title: 'Edit Task', 'aria-label': 'Edit task', onclick: () => Views._taskModal(t) }));
      row.appendChild(N.el('button', {
        class: 'iconbtn', text: '📅✕', title: 'Remove from Week Schedule — keeps the task in your list',
        'aria-label': 'Remove from Week Schedule, keeps the task',
        onclick: () => nook.invoke('tasks:unschedule', { id: t.id }).then((hit) => {
          if (hit) App.toast('Removed from Week Schedule', '"' + t.text + '" stays in your Tasks list.', 'good');
          else App.toast('Could not update', 'Please try again.');
        })
      }));
      row.appendChild(N.el('button', {
        class: 'iconbtn', text: '🗑', title: 'Delete Task — permanently removes the task',
        'aria-label': 'Delete task permanently',
        onclick: () => App.confirm('Delete this task?', t.text + ' — this permanently deletes it. (To keep the task but unschedule it, use Remove from Week Schedule.)', () => nook.invoke('tasks:remove', { id: t.id }))
      }));
      card.appendChild(row);
    }
    c.appendChild(card);
  }
  c.appendChild(N.el('div', { class: 'small mt', style: 'opacity:.8', text: '💡 Completing a task here also completes it in Tasks — it is always the same single task. Planned minutes are what you expect to spend; focused minutes are what StudyNook actually recorded.' }));
};

/* ---------- helper: quickly schedule an existing unscheduled task ---------- */
Views._scheduleExisting = function (model) {
  const TD = window.TaskDays;
  const d = App.state.data;
  const open = d.tasks.filter((t) => !t.done && !t.date);
  if (!open.length) { App.toast('Nothing unplanned', 'Every open task already has a date — or your list is empty. Add a new task instead.'); return; }
  const sel = N.el('select', { class: 'input', style: 'width:100%', 'aria-label': 'Choose a task' });
  for (const t of open) sel.appendChild(N.el('option', { value: t.id, text: t.text.slice(0, 60) }));
  const dateSel = N.el('select', { class: 'input', style: 'width:100%', 'aria-label': 'Day' });
  dateSel.appendChild(N.el('option', { value: '', text: 'Which day?' }));
  for (const day of model.days) dateSel.appendChild(N.el('option', { value: day.key, text: day.name + (day.isToday ? ' · Today' : '') }));
  const atInp = N.el('input', { class: 'input', type: 'time', style: 'width:100%', 'aria-label': 'Start time (optional)' });
  const body = N.el('div', { class: 'row', style: 'flex-direction:column;gap:10px' },
    N.el('div', {}, N.el('span', { class: 'tfield-lbl', text: 'Task' }), sel),
    N.el('div', {}, N.el('span', { class: 'tfield-lbl', text: 'Day' }), dateSel),
    N.el('div', {}, N.el('span', { class: 'tfield-lbl', text: 'Start time (optional)' }), atInp)
  );
  App.modal('Schedule a task', body, [
    { label: 'Add to Week Schedule', cls: 'btn-sage', fn: () => {
      if (!dateSel.value) { App.toast('Pick a day', 'Choose which day this task should happen on.'); return; }
      nook.invoke('tasks:setDate', { id: sel.value, date: dateSel.value, at: atInp.value || null }).then((hit) => {
        App.closeModal();
        if (!hit) App.toast('Could not schedule', 'Please try again.');
      });
    } },
    { label: 'Cancel', cls: 'btn-ghost', fn: () => App.closeModal() }
  ]);
};
