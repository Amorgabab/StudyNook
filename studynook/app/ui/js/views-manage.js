/* ============================================================
   StudyNook · views-manage.js — Tasks, Apps & Sites views
   ============================================================ */
'use strict';
window.Views = window.Views || {};

/* ============================= TASKS ============================= */
Views.tasks = function (c) {
  const d = App.state.data;
  const card = N.el('div', { class: 'card' });
  card.appendChild(N.el('h2', { text: '📝 Study tasks' }));
  card.appendChild(N.el('div', { class: 'sub', text: 'Small, kind to-do items. Link one to a session so Mochi knows what you\'re growing.' }));

  /* --- creation form: every control is labeled — no cryptic steppers --- */
  const form = N.el('div', { class: 'task-form' });
  const txt = N.el('input', { class: 'input', id: 'task-text', placeholder: 'What needs doing? e.g. "Chemistry ch.4 notes"', style: 'flex:1;min-width:200px', 'aria-label': 'Task name' });
  const f1 = N.el('div', { class: 'row' });
  f1.append(txt, Views._field('Subject', Views._taskSubjects(d)), Views._field('Planned time', Views._taskMinStepper()), Views._field('Effort', Views._taskEstSelect()));
  const planSel = Views._taskPlanSelect();
  f1.appendChild(Views._field('Schedule on day', planSel));
  const atInp = N.el('input', { class: 'input', type: 'time', style: 'width:auto', 'aria-label': 'Start time (optional)' });
  const atWrap = Views._field('Start time (optional)', atInp);
  atWrap.style.display = 'none'; // appears only once a day is chosen — scheduling stays optional
  f1.appendChild(atWrap);
  planSel.addEventListener('change', () => { atWrap.style.display = planSel.value ? '' : 'none'; if (!planSel.value) atInp.value = ''; });
  const addBtn = N.el('button', { class: 'btn btn-sage task-add', text: '+ Add task', onclick: () => submit() });
  const f2 = N.el('div', { class: 'row spread' });
  f2.appendChild(N.el('div', { class: 'small', text: '⏱ planned minutes ≈ how long you\'ll spend · 🍅 Pomodoros ≈ how many focus rounds that might take (estimate only).' }));
  f2.appendChild(addBtn);
  form.append(f1, f2);
  txt.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  card.appendChild(form);
  card.appendChild(N.el('div', { class: 'small mt', text: 'Subjects are managed in Settings. "Planned time" is optional — leave it at 0 and the task stays open-ended. Pick a day and the task also shows up on your Week Schedule.' }));

  function submit() {
    const v = txt.value.trim();
    if (!v) { txt.focus(); return; }
    // one call — a scheduled task is created complete (date + optional start time travel together)
    nook.invoke('tasks:add', { text: v, subject: Views._subjSel.value, min: Views._minVal, est: Views._estSel.value, date: Views._planSel.value || null, at: atInp.value || null })
      .then((t) => { if (!t) App.toast('Could not add task', 'Please check the name and try again.'); });
    Audio2.pop();
  }

  const open = d.tasks.filter((t) => !t.done), done = d.tasks.filter((t) => t.done);
  card.appendChild(N.el('div', { class: 'row mt spread' },
    N.el('div', { class: 'seg' },
      N.el('button', { class: App.taskFilter === 'done' ? '' : 'on sage', text: `Open (${open.length})`, onclick: () => { App.taskFilter = 'open'; App.render(); } }),
      N.el('button', { class: App.taskFilter === 'done' ? 'on sage' : '', text: `Done (${done.length})`, onclick: () => { App.taskFilter = 'done'; App.render(); } })
    ),
    N.el('div', { class: 'small', text: `${open.length} open · ${done.length} done · +5 XP each` })
  ));

  /* --- THIS WEEK: a separate block under the Study Tasks card ---------------
     Not a second data system — these are the SAME d.tasks[] records that
     carry a date. Timed tasks sort first by start time, then untimed ones.
     Every scheduled task gets Day / Time dropdowns right on its row, so you
     can change when it happens without leaving this view. ------------------- */
  const TD = window.TaskDays;
  const WS = window.WeekSched;
  const todayK = N.todayKey();
  const weekDates = TD.weekDates(TD.weekStart(todayK));
  const inWeek = (t) => !!t.date && weekDates.indexOf(t.date) >= 0;
  const timedFirst = (a, b) => WS.dayTasks([a, b], a.date)[0] === a ? -1 : 1; // shared pure ordering
  const thisWeekOpen = open.filter(inWeek).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : timedFirst(a, b)));
  const pastOpen = open.filter((t) => t.date && !inWeek(t) && t.date < todayK);
  const weekDone = done.filter(inWeek);

  const wkCard = N.el('div', { class: 'card mt' });
  wkCard.appendChild(N.el('h2', { text: '📅 This Week' }));
  wkCard.appendChild(N.el('div', { class: 'sub', text: 'Tasks that have a day. Change the day or time right here — it updates the same task everywhere. No dates? Use the “Schedule on day” picker above.' }));
  if (!thisWeekOpen.length && !weekDone.length) {
    wkCard.appendChild(N.el('div', { class: 'ws-empty', text: 'No scheduled tasks this week — your calendar is clear. 🌿' }));
  } else {
    let lastDay = null;
    for (const t of thisWeekOpen.concat(weekDone.sort(timedFirst)) ) {
      if (t.date !== lastDay) {
        lastDay = t.date;
        wkCard.appendChild(N.el('div', { class: 'row spread wk-dayhead' },
          N.el('b', { text: TD.fullDayName(t.date) + (t.date === todayK ? ' · Today' : '') }),
          N.el('span', { class: 'small', text: TD.fullMonthName(t.date) + ' ' + (+t.date.slice(8, 10)) })
        ));
      }
      const row = N.el('div', { class: 'list-row' + (t.done ? ' done' : '') });
      row.appendChild(N.el('button', {
        class: 'checkbox' + (t.done ? ' on' : ''), text: '✓',
        title: t.done ? 'Mark as Incomplete' : 'Mark as Complete (+5 XP)',
        'aria-label': t.done ? 'Mark task as incomplete' : 'Mark task as complete, +5 XP',
        onclick: () => { nook.invoke('tasks:toggle', { id: t.id }); if (!t.done) Audio2.pop(); }
      }));
      row.appendChild(N.el('div', { class: 'grow' },
        N.el('div', { class: 'title', text: t.text }),
        N.el('div', { class: 'task-meta' },
          t.subject ? N.el('span', { class: 'tag', text: t.subject }) : null,
          t.min ? N.el('span', { class: 'meta-chip', title: 'Planned minutes — how long you expect this to take', text: N.fmtMin(t.min) }) : null
        )
      ));
      // DAY control — moves the task to another day (same task record, one IPC call)
      const daySel = N.el('select', { class: 'input wk-sel', 'aria-label': 'Scheduled day for this task' });
      daySel.appendChild(N.el('option', { value: '', text: 'Unschedule' }));
      for (const k of weekDates) daySel.appendChild(N.el('option', { value: k, text: TD.fullDayName(k) + (k === todayK ? ' · Today' : '') }));
      if (t.date && weekDates.indexOf(t.date) < 0) daySel.appendChild(N.el('option', { value: t.date, text: TD.fullDayName(t.date) + ' · ' + TD.fullMonthName(t.date) + ' ' + (+t.date.slice(8, 10)), selected: true }));
      daySel.value = t.date || '';
      daySel.addEventListener('change', () => {
        const v = daySel.value;
        if (!v) {
          App.confirm('Remove from Week Schedule?', '"' + t.text + '" will become an ordinary unscheduled task — it stays in your list.',
            () => nook.invoke('tasks:setDate', { id: t.id, date: null }).then((hit) => {
              if (!hit) App.toast('Could not update', 'Please try again.');
            }));
          return;
        }
        nook.invoke('tasks:setDate', { id: t.id, date: v, at: t.at || null }).then((hit) => {
          if (!hit) App.toast('Could not move the task', 'Please try again.');
        });
      });
      row.appendChild(Views._field('Day', daySel));
      // TIME control — optional start time; empty means "Any time"
      const atSel = N.el('select', { class: 'input wk-sel', 'aria-label': 'Start time for this task' });
      atSel.appendChild(N.el('option', { value: '', text: 'Any time' }));
      for (let h = 6; h <= 23; h++) for (const m of [0, 30]) {
        const v = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        atSel.appendChild(N.el('option', { value: v, text: v }));
      }
      if (t.at && !/^\d{2}:(00|30)$/.test(t.at)) atSel.appendChild(N.el('option', { value: t.at, text: t.at, selected: true }));
      atSel.value = t.at || '';
      atSel.addEventListener('change', () => nook.invoke('tasks:setDate', { id: t.id, date: t.date, at: atSel.value || null }));
      row.appendChild(Views._field('Time', atSel));
      if (!t.done) {
        row.appendChild(N.el('button', {
          class: 'btn btn-sm btn-sage', text: '▶ Focus', title: 'Go to the timer with this task selected',
          'aria-label': 'Start focusing on this task',
          onclick: () => nook.invoke('tasks:focusNow', { id: t.id }).then((ok2) => {
            if (!ok2) App.toast('Cannot start now', 'A session may already be running.');
          })
        }));
      }
      wkCard.appendChild(row);
    }
  }
  card.appendChild(wkCard);
  if (pastOpen.length) {
    const od = N.el('div', { class: 'card mt' });
    od.appendChild(N.el('div', { class: 'row spread' },
      N.el('b', { text: '⏳ Planned earlier, still open' }),
      N.el('span', { class: 'small', text: pastOpen.length + (pastOpen.length > 1 ? ' tasks' : ' task') })
    ));
    for (const t of pastOpen.slice(0, 6)) {
      od.appendChild(N.el('div', { class: 'row', style: 'gap:8px;margin-top:6px;align-items:center' },
        N.el('button', { class: 'domain-chip', style: 'cursor:pointer;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: t.text, title: 'Click to focus on this task', onclick: () => { App.lastTaskId = t.id; App.go('home'); } }),
        N.el('span', { class: 'small', text: TD.fullDayName(t.date) + ' ' + (+t.date.slice(8, 10)) }),
        N.el('button', { class: 'btn btn-ghost btn-sm', text: 'Move to Today', 'aria-label': 'Reschedule to today', onclick: () => nook.invoke('tasks:setDate', { id: t.id, date: todayK, at: null }) })
      ));
    }
    if (pastOpen.length > 6) od.appendChild(N.el('div', { class: 'small mt', text: '+' + (pastOpen.length - 6) + ' more in your Open list.' }));
    card.appendChild(od);
  }

  /* --- task list rows --- */
  const list = N.el('div', { class: 'list mt' });
  const rows = App.taskFilter === 'done' ? done : open;
  if (!rows.length) list.appendChild(N.el('div', { class: 'small', text: App.taskFilter === 'done' ? 'Nothing finished yet — your future self is patient.' : 'All clear! Add a task above, or just free-focus. 🌿' }));
  for (const t of rows) {
    const row = N.el('div', { class: 'list-row' + (t.done ? ' done' : '') });
    const cb = N.el('button', { class: 'checkbox' + (t.done ? ' on' : ''), text: '✓', title: t.done ? 'reopen' : 'complete (+5 XP)', 'aria-label': t.done ? 'Reopen task' : 'Complete task, +5 XP', onclick: () => { nook.invoke('tasks:toggle', { id: t.id }); if (!t.done) Audio2.pop(); } });
    const grow = N.el('div', { class: 'grow' }, N.el('div', { class: 'title', text: t.text }));
    // meta line: subject / planned time / pomodoro progress / planned day — all explicit words now
    const meta = [];
    if (t.subject) meta.push(N.el('span', { class: 'tag', text: t.subject }));
    if (t.min) meta.push(N.el('span', { class: 'meta-chip', title: 'Planned minutes — the time you expect this task to take', text: '⏱ planned ' + N.fmtMin(t.min) }));
    meta.push(N.el('span', { class: 'meta-chip', title: 'Pomodoros done out of your estimate', text: `🍅 ${t.pomosDone || 0}/${t.est} pomodoros` }));
    if (t.date) meta.push(N.el('button', { class: 'meta-chip link', title: 'Remove from Week Schedule — keeps the task in your list', text: '📅 ' + TD.dayLabel(t.date) + (t.at ? ' · ' + t.at : ''), onclick: () => nook.invoke('tasks:unschedule', { id: t.id }) }));
    // study sources: collapsed behind a "+ Source" affordance until opened
    const srcWrap = N.el('div', { class: 'src-wrap' });
    const srcBar = N.el('div', { class: 'row', style: 'gap:5px;margin-top:6px;flex-wrap:wrap' });
    (t.sources || []).forEach((s, i) => {
      srcBar.appendChild(N.el('span', { class: 'domain-chip', title: s.url },
        N.el('button', { style: 'width:auto;padding:0 7px;background:var(--sky-soft);border:none;color:#47688A;font-weight:800;cursor:pointer', text: '↗', title: 'open in browser', 'aria-label': 'Open source in browser', onclick: () => nook.invoke('open:url', { url: s.url }) }),
        N.el('span', { class: 'mono', style: 'border:none;background:transparent', text: N.shortUrl(s.url) }),
        N.el('button', { text: '✕', title: 'remove source', 'aria-label': 'Remove source', onclick: () => nook.invoke('tasks:removeSource', { id: t.id, idx: i }) })
      ));
    });
    const sInp = N.el('input', { class: 'input', style: 'flex:1;min-width:150px;padding:5px 10px;font-size:11px', placeholder: 'paste study material here…', 'aria-label': 'Study material URL' });
    const addSrc = () => { if (sInp.value.trim()) { nook.invoke('tasks:addSource', { id: t.id, url: sInp.value }); sInp.value = ''; } };
    sInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSrc(); });
    const srcForm = N.el('div', { class: 'row', style: 'gap:5px;margin-top:6px;display:none' });
    srcForm.append(sInp, N.el('button', { class: 'btn btn-sm btn-sage', style: 'padding:4px 10px', text: '+ Add', 'aria-label': 'Add study source', onclick: addSrc }));
    const srcToggle = N.el('button', { class: 'src-toggle', text: (t.sources && t.sources.length ? '＋ Add source' : '🔗 + Source'), title: 'Attach lecture videos, papers or textbook pages to this task', onclick: () => { srcForm.style.display = srcForm.style.display === 'none' ? 'flex' : 'none'; if (srcForm.style.display === 'flex') sInp.focus(); } });
    srcWrap.append(srcBar, srcForm, srcToggle);
    grow.appendChild(meta.length ? N.el('div', { class: 'task-meta' }, ...meta) : meta[0]);
    grow.appendChild(srcWrap);
    row.append(cb, grow);
    row.appendChild(N.el('button', { class: 'iconbtn', text: '🗑', title: 'delete', 'aria-label': 'Delete task', onclick: () => App.confirm('Delete this task?', t.text, () => nook.invoke('tasks:remove', { id: t.id })) }));
    list.appendChild(row);
  }
  card.appendChild(list);
  c.appendChild(card);
};

/* --- small shared builders for the labeled task form (keeps Views.tasks readable) --- */
Views._minVal = 0;
Views._field = function (label, control) {
  return N.el('label', { class: 'tfield' }, N.el('span', { class: 'tfield-lbl', text: label }), control);
};
Views._taskSubjects = function (d) {
  const subj = N.el('select', { class: 'input', id: 'task-subj', 'aria-label': 'Subject' });
  subj.appendChild(N.el('option', { value: '', text: '— none —' }));
  for (const s of (d.subjects || [])) subj.appendChild(N.el('option', { value: s, text: s }));
  Views._subjSel = subj;
  return subj;
};
Views._taskMinStepper = function () {
  Views._minVal = 0;
  const min = N.stepper(0, 0, 600, (v) => { Views._minVal = v; });
  min.setAttribute('aria-label', 'Planned minutes');
  return min;
};
Views._taskEstSelect = function () {
  const est = N.el('select', { class: 'input', 'aria-label': 'Estimated Pomodoros' });
  est.appendChild(N.el('option', { value: '1', text: '1 🍅 Pomodoro' }));
  for (let i = 2; i <= 8; i++) est.appendChild(N.el('option', { value: String(i), text: i + ' 🍅 Pomodoros' }));
  Views._estSel = est;
  return est;
};
Views._taskPlanSelect = function () {
  const TD = window.TaskDays;
  const sel = N.el('select', { class: 'input', 'aria-label': 'Plan for a day this week' });
  sel.appendChild(N.el('option', { value: '', text: 'unplanned' }));
  const dates = TD.weekDates(TD.weekStart(N.todayKey()));
  for (const k of dates) sel.appendChild(N.el('option', { value: k, text: TD.dayLabel(k) + (k === N.todayKey() ? ' · today' : '') }));
  Views._planSel = sel;
  return sel;
};

/* ============================= NOTES ============================= */
Views.notes = function (c) {
  const d = App.state.data;
  const head = N.el('div', { class: 'row spread', style: 'margin-bottom:14px' });
  head.appendChild(N.el('h2', { style: 'margin:0', text: '🗒 Notes' }));
  head.appendChild(N.el('button', { class: 'btn btn-sage', text: '+ New note', onclick: () => nook.invoke('notes:add') }));
  c.appendChild(head);

  const grid = N.el('div', { class: 'notes-grid' });
  const notes = d.notes || [];
  if (!notes.length) grid.appendChild(N.el('div', { class: 'card small', text: 'No notes yet. Notes are plain text saved in your data file — lecture scraps, formulas, reminders.' }));
  for (const n of notes) {
    const card = N.el('div', { class: 'card note-card' });
    const title = N.el('input', { class: 'input', placeholder: 'Title', value: n.title || '' });
    const body = N.el('textarea', { placeholder: 'Write here…' });
    body.value = n.body || '';
    const foot = N.el('div', { class: 'row spread mt' },
      N.el('span', { class: 'small', id: 'note-saved-' + n.id, text: 'saved ' + N.timeAgo(n.updatedAt) }),
      N.el('button', { class: 'iconbtn', text: '🗑', title: 'delete note', onclick: () => App.confirm('Delete this note?', (n.title || 'Untitled'), () => nook.invoke('notes:remove', { id: n.id })) })
    );
    let t1 = null;
    const save = () => {
      clearTimeout(t1);
      t1 = setTimeout(() => {
        nook.invoke('notes:save', { id: n.id, title: title.value, body: body.value });
        const lbl = document.getElementById('note-saved-' + n.id);
        if (lbl) lbl.textContent = 'saved just now';
      }, 500);
    };
    title.addEventListener('input', save);
    body.addEventListener('input', save);
    card.append(title, body, foot);
    grid.appendChild(card);
  }
  c.appendChild(grid);
};

/* ============================= APPS ============================= */
Views.apps = function (c) {
  const d = App.state.data, g = d.settings.guardian, S = App.state;

  /* --- guard controls card --- */
  const ctrl = N.el('div', { class: 'card' });
  ctrl.appendChild(N.el('h2', { text: '🧸 App Guardian' }));
  ctrl.appendChild(N.el('div', { class: 'sub', text: 'Closes distracting programs while you study. Windows are closed gently — you always get a warning first (unless you pick instant).' }));

  ctrl.appendChild(N.el('div', { class: 'row spread' },
    N.el('div', { class: 'row' },
      N.el('button', { class: 'toggle' + (g.enabled ? ' on' : ''), onclick: () => setG({ enabled: !g.enabled }) }),
      N.el('span', { class: 'lbl', style: 'font-weight:800', text: g.enabled ? 'Guard is ON' : 'Guard is OFF' })
    ),
    S.guardian.pausedMinLeft > 0
      ? N.el('div', { class: 'row' }, N.el('span', { class: 'pill warn', text: `😮‍💨 breathing room: ${S.guardian.pausedMinLeft} min left` }), N.el('button', { class: 'btn btn-sm', text: 'resume now', onclick: () => nook.invoke('guardian:pause', { min: 0 }) }))
      : N.el('button', { class: 'btn btn-sm btn-ghost', text: '😮‍💨 let me breathe (5 min)', onclick: () => nook.invoke('guardian:pause', { min: 5 }) })
  ));

  ctrl.appendChild(N.el('div', { class: 'row mt' },
    N.el('span', { class: 'small', text: 'Mode:' }),
    seg([['block', '🚫 Blocklist — close only these apps'], ['allow', '✅ Allowlist — close EVERYTHING else']], g.mode, (v) => {
      if (v === 'allow') previewAllowThenEnable();
      else setG({ mode: v });
    }),
  ));
  ctrl.appendChild(N.el('div', { class: 'row mt' },
    N.el('span', { class: 'small', text: 'When:' }),
    seg([['session', '⏱ only during focus'], ['always', '♾ always']], g.onlyDuringSessions ? 'session' : 'always', (v) => setG({ onlyDuringSessions: v === 'session' })),
    N.el('span', { class: 'small', style: 'margin-left:14px', text: 'Style:' }),
    seg([['gentle', '🕊 gentle warn → close'], ['instant', '⚡ instant close'], ['remind', '🔔 warn only']], g.action, (v) => setG({ action: v }))
  ));
  ctrl.appendChild(N.el('div', { class: 'row mt' },
    N.el('span', { class: 'small', text: 'Warning time:' }), numInput(g.graceSec, 5, 300, (v) => setG({ graceSec: v }), 's'),
    N.el('span', { class: 'small', style: 'margin-left:10px', text: 'Scan every:' }), numInput(g.scanSec, 1, 30, (v) => setG({ scanSec: v }), 's'),
    N.el('span', { class: 'small', style: 'margin-left:auto', text: S.guardian.armed ? '🟢 armed right now' : '⚪ not armed right now' })
  ));
  ctrl.appendChild(N.el('div', { class: 'small mt', text: 'Already-open apps are caught too: the guard re-reads the running process list on every scan, and scans instantly when a session arms. Note: website lists (Sites) and program lists (Apps) are separate — a desktop app must be listed here, its website over there.' }));

  if (g.mode === 'allow') {
    ctrl.appendChild(N.el('div', { class: 'banner warn mt' }, N.el('span', { text: '⚠️' }), N.el('span', { text: 'Allowlist mode closes any app NOT on your allow list (system processes are always protected). Use "Preview" anytime to see exactly what would close.' }), N.el('button', { class: 'btn btn-sm', text: 'Preview now', onclick: showPreview })));
  }
  c.appendChild(ctrl);

  /* --- lists card --- */
  const lists = N.el('div', { class: 'card mt' });
  const tab = App.appsTab || 'block';
  lists.appendChild(N.el('div', { class: 'tabs' },
    ...[['block', `🚫 Blocked (${d.apps.block.length})`], ['allow', `✅ Allowed (${d.apps.allow.length})`], ['lib', '📚 App library'], ['run', '🔎 Running now']]
      .map(([id, lbl]) => N.el('button', { class: 'btn btn-sm' + (tab === id ? ' btn-honey' : ' btn-ghost'), text: lbl, onclick: () => { App.appsTab = id; App.render(); } }))
  ));

  if (tab === 'block' || tab === 'allow') {
    const listKey = tab;
    lists.appendChild(N.el('div', { class: 'small', style: 'margin-bottom:10px', text: listKey === 'block' ? 'These apps get closed (per your style above) whenever the guard is armed.' : 'These apps are safe to keep open. In blocklist mode this list is unused.' }));
    const list = N.el('div', { class: 'list' });
    const entries = d.apps[listKey];
    if (!entries.length) list.appendChild(N.el('div', { class: 'small', text: 'Nothing here yet — add from the App library tab or the scanner below.' }));
    for (const e of entries) {
      const row = N.el('div', { class: 'list-row' });
      row.appendChild(N.el('span', { style: 'font-size:20px', text: e.emoji || '📦' }));
      const grow = N.el('div', { class: 'grow' }, N.el('div', { class: 'title', text: e.label }), N.el('div', { class: 'row', style: 'gap:5px;margin-top:4px' }, ...e.procs.map((p) => N.el('span', { class: 'mono', text: p }))));
      row.appendChild(grow);
      row.appendChild(N.el('button', { class: 'toggle' + (e.enabled !== false ? ' on' : ''), title: 'enable/disable', onclick: () => nook.invoke('apps:toggle', { list: listKey, id: e.id }) }));
      row.appendChild(N.el('button', { class: 'iconbtn', text: '🗑', onclick: () => nook.invoke('apps:remove', { list: listKey, id: e.id }) }));
      list.appendChild(row);
    }
    lists.appendChild(list);

    const addRow = N.el('div', { class: 'row mt' });
    const lbl = N.el('input', { class: 'input', placeholder: 'App name (e.g. Discord)', style: 'width:170px' });
    const procs = N.el('input', { class: 'input', placeholder: 'process names, comma separated (e.g. discord, discordptb)', style: 'flex:1;min-width:220px' });
    addRow.append(lbl, procs, N.el('button', { class: 'btn btn-sm btn-sage', text: '+ Add custom', onclick: () => { if (lbl.value.trim() && procs.value.trim()) nook.invoke('apps:add', { list: listKey, label: lbl.value, procs: procs.value.split(',').map((s) => s.trim()).filter(Boolean) }); } }));
    lists.appendChild(addRow);
    lists.appendChild(N.el('div', { class: 'small mt', text: '💡 Not sure of the process name? Use the "Running now" tab — it shows real names of everything open.' }));
  }

  if (tab === 'lib') {
    lists.appendChild(N.el('div', { class: 'small', style: 'margin-bottom:10px', text: 'One-click adds with the correct process names for your OS (' + S.platform + ').' }));
    const grid = N.el('div', { class: 'catalog-grid' });
    for (const item of NookCatalog.DISTRACTION_CATALOG) {
      const inBlock = d.apps.block.some((e) => e.catalogId === item.id);
      const inAllow = d.apps.allow.some((e) => e.catalogId === item.id);
      const card2 = N.el('div', { class: 'cat-card' });
      card2.appendChild(N.el('div', { class: 'e', text: item.emoji || '📦' }));
      card2.appendChild(N.el('div', { class: 'n', text: item.label }));
      const btns = N.el('div', { class: 'row', style: 'gap:6px' });
      btns.appendChild(inBlock ? N.el('span', { class: 'small', text: '✓ blocked' }) : N.el('button', { class: 'btn btn-sm', text: '+ Block', onclick: () => nook.invoke('apps:addCatalog', { id: item.id, list: 'block' }) }));
      btns.appendChild(inAllow ? N.el('span', { class: 'small', text: '✓ allowed' }) : N.el('button', { class: 'btn btn-sm btn-ghost', text: '+ Allow', onclick: () => nook.invoke('apps:addCatalog', { id: item.id, list: 'allow' }) }));
      card2.appendChild(btns);
      grid.appendChild(card2);
    }
    lists.appendChild(grid);
  }

  if (tab === 'run') {
    lists.appendChild(N.el('div', { class: 'row', style: 'margin-bottom:10px' },
      N.el('button', { class: 'btn btn-sm', text: '🔄 Rescan', onclick: () => scanInto(table, search) }),
      N.el('input', { class: 'input', id: 'scan-search', placeholder: 'filter…', style: 'flex:1' })
    ));
    const table = N.el('div', { class: 'scan-table' });
    lists.appendChild(table);
    const search = lists.querySelector('#scan-search');
    search.addEventListener('input', () => scanInto(table, search));
    scanInto(table, search);
  }
  c.appendChild(lists);

  function seg(opts, cur, onPick) {
    const s = N.el('div', { class: 'seg' });
    for (const [v, lbl] of opts) s.appendChild(N.el('button', { class: cur === v ? 'on sage' : '', text: lbl, onclick: () => onPick(v) }));
    return s;
  }
  function numInput(val, min, max, onSet, suffix) {
    return N.el('span', { class: 'row', style: 'gap:4px' }, N.stepper(val, min, max, onSet), N.el('span', { class: 'small', text: suffix }));
  }
  function setG(patch) { nook.invoke('settings:set', { section: 'guardian', values: patch }); }

  function showPreview() {
    nook.invoke('apps:previewAllow').then((groups) => {
      const body = N.el('div');
      if (!groups.length) body.appendChild(N.el('div', { class: 'small', text: 'Nothing would be closed right now. 🎉' }));
      for (const gr of groups) body.appendChild(N.el('div', { class: 'list-row' }, N.el('span', { text: '💤' }), N.el('div', { class: 'grow' }, N.el('div', { class: 'title', text: gr.label })), N.el('span', { class: 'mono', text: gr.count + ' proc' }) ));
      App.modal('Preview — what allow-mode would close right now', body, [
        { label: 'Got it', cls: 'btn-primary', fn: () => App.closeModal() }
      ]);
    });
  }
  function previewAllowThenEnable() {
    setG({ mode: 'allow' });
    setTimeout(showPreview, 350);
  }
  function scanInto(table, searchEl) {
    table.innerHTML = '';
    table.appendChild(N.el('div', { class: 'small', text: 'scanning…' }));
    nook.invoke('apps:scan').then((rows) => {
      table.innerHTML = '';
      const q = (searchEl.value || '').toLowerCase();
      const shown = rows.filter((r) => !q || r.norm.includes(q));
      if (!shown.length) table.appendChild(N.el('div', { class: 'small', text: 'nothing matches' }));
      for (const r of shown.slice(0, 300)) {
        const row = N.el('div', { class: 'list-row', style: 'padding:7px 12px' });
        row.appendChild(N.el('div', { class: 'grow' }, N.el('div', { class: 'title', style: 'font-size:12px', text: r.name }), N.el('div', { class: 'small', text: 'pid ' + r.pid })));
        if (r.listed) row.appendChild(N.el('span', { class: 'small', text: 'already listed' }));
        else {
          row.appendChild(N.el('button', { class: 'btn btn-sm', text: '+ Block', onclick: () => nook.invoke('apps:add', { list: 'block', label: r.name, procs: [r.norm], emoji: '📦' }) }));
          row.appendChild(N.el('button', { class: 'btn btn-sm btn-ghost', text: '+ Allow', onclick: () => nook.invoke('apps:add', { list: 'allow', label: r.name, procs: [r.norm], emoji: '🛡️' }) }));
        }
        table.appendChild(row);
      }
    });
  }
};

/* ============================= SITES ============================= */
Views.sites = function (c) {
  const d = App.state.data, s = d.sites, ext = App.state.ext;

  const ctrl = N.el('div', { class: 'card' });
  ctrl.appendChild(N.el('h2', { text: '🌐 Tab Guardian (Chrome extension)' }));
  ctrl.appendChild(N.el('div', { class: 'sub', text: 'Blocks distracting websites in Chrome/Edge/Brave. The bundled extension redirects them to a cozy "napping" page.' }));
  ctrl.appendChild(N.el('div', { class: 'row spread' },
    N.el('div', { class: 'row' },
      N.el('button', { class: 'toggle' + (s.enabled ? ' on' : ''), onclick: () => setS({ enabled: !s.enabled }) }),
      N.el('span', { style: 'font-weight:800', text: s.enabled ? 'Site blocking ON' : 'Site blocking OFF' })
    ),
    N.el('div', { class: 'row' },
      N.el('span', { class: 'small', text: 'When:' }),
      N.el('div', { class: 'seg' },
        N.el('button', { class: s.when === 'session' ? 'on sage' : '', text: '⏱ during focus', onclick: () => setS({ when: 'session' }) }),
        N.el('button', { class: s.when === 'always' ? 'on sage' : '', text: '♾ always', onclick: () => setS({ when: 'always' }) }))
    )
  ));
  ctrl.appendChild(N.el('div', { class: 'row mt' },
    N.el('span', { class: 'small', text: 'Mode:' }),
    N.el('div', { class: 'seg' },
      N.el('button', { class: s.mode === 'block' ? 'on accent' : '', text: '🚫 Blocklist — block only these sites', onclick: () => setS({ mode: 'block' }) }),
      N.el('button', { class: s.mode === 'allow' ? 'on accent' : '', text: '✅ Allowlist — block EVERYTHING else', onclick: () => setS({ mode: 'allow' }) }))
  ));
  ctrl.appendChild(N.el('div', { class: 'banner ' + (s.mode === 'allow' ? 'warn' : 'info') + ' mt' },
    N.el('span', { text: s.mode === 'allow' ? '⚠️' : '💡' }),
    N.el('span', { text: s.mode === 'allow'
      ? 'Allowlist mode: during focus, ONLY the allowed sites below will open. Everything else lands on the napping page. localhost and your extension are always safe.'
      : 'Blocklist mode: the sites below land on the napping page ' + (s.when === 'session' ? 'while a focus session runs.' : 'at all times.') })
  ));
  const focusing = App.state.session && App.state.session.active && App.state.session.phase === 'focus' && App.state.session.running;
  ctrl.appendChild(N.el('div', { class: 'row mt' },
    N.el('span', { class: 'pill ' + (s.enabled && (s.when === 'always' || focusing) ? 'on' : 'warn'), text: s.enabled ? (s.when === 'always' ? '🟢 rules armed always' : focusing ? '🟢 rules armed (focusing)' : '💤 rules sleep until focus starts') : '⚪ site blocking off' }),
    N.el('span', { class: 'small', text: 'Tip: paths work too — e.g. block "youtube.com/shorts" to keep lectures awake but nap the Shorts hole.' })
  ));
  c.appendChild(ctrl);

  const listsCard = N.el('div', { class: 'grid2b mt' });
  listsCard.appendChild(domainList('block', '🚫 Blocked sites', s.block, 'youtube.com'));
  listsCard.appendChild(domainList('allow', '✅ Allowed sites (allow-mode)', s.allow, 'wikipedia.org or youtube.com/watch?v=…'));
  c.appendChild(listsCard);

  /* --- extension pairing card --- */
  const extCard = N.el('div', { class: 'card mt' });
  extCard.appendChild(N.el('h2', { text: '🧩 Connect the extension' }));
  extCard.appendChild(N.el('div', { class: 'row spread mt' },
    N.el('div', { class: 'row' },
      N.el('span', { style: 'font-size:22px', text: ext.connected ? '🟢' : '🔴' }),
      N.el('div', {},
        N.el('div', { style: 'font-weight:800;font-size:13px', text: ext.connected ? 'Extension connected' : 'Extension not connected' }),
        N.el('div', { class: 'small', text: ext.connected ? 'last seen ' + N.timeAgo(ext.lastSeen) + (ext.version ? ' · v' + ext.version : '') : 'install & pair it once — then it follows your sessions automatically' })
      )
    ),
    N.el('div', { class: 'row' },
      N.el('span', { class: 'small', text: 'Pairing code:' }),
      N.el('span', { class: 'mono', style: 'font-size:17px;letter-spacing:3px;font-weight:800', id: 'pair-code', text: ext.code }),
      N.el('button', { class: 'btn btn-sm', text: '📋 copy', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(ext.code); App.toast('Pairing code copied', ext.code); } })
    )
  ));
  const steps = N.el('div', { class: 'list mt' });
  [
    ['1', 'Open Chrome (or Edge/Brave) and go to chrome://extensions'],
    ['2', 'Turn ON "Developer mode" (top-right corner)'],
    ['3', 'Click "Load unpacked" and pick this folder:  ' + (App.state.extPath || 'extension/')],
    ['4', 'Click the StudyNook extension icon → paste the pairing code above → Pair']
  ].forEach(([n, t]) => steps.appendChild(N.el('div', { class: 'list-row' }, N.el('span', { class: 'tag', text: n }), N.el('div', { class: 'grow' }, N.el('div', { class: 'title', style: 'font-weight:600', text: t })))));
  extCard.appendChild(steps);
  extCard.appendChild(N.el('div', { class: 'banner good mt' }, N.el('span', { text: '🌈' }), N.el('span', { text: 'No desktop app running? The extension still works on its own — open its popup for a built-in mini timer & lists. When StudyNook is open, the desktop settings win.' })));
  c.appendChild(extCard);

  function setS(patch) { nook.invoke('sites:set', { patch }); }

  function domainList(key, title, arr, ph) {
    const card = N.el('div', { class: 'card' });
    card.appendChild(N.el('h2', { text: title }));
    const chips = N.el('div', { class: 'chips mt' });
    for (const dom of arr) {
      chips.appendChild(N.el('span', { class: 'domain-chip' }, dom, N.el('button', { text: '✕', title: 'remove', onclick: () => setS({ [key]: arr.filter((x) => x !== dom) }) })));
    }
    if (!arr.length) chips.appendChild(N.el('span', { class: 'small', text: 'empty' }));
    card.appendChild(chips);
    const row = N.el('div', { class: 'row mt' });
    const inp = N.el('input', { class: 'input', placeholder: ph, style: 'flex:1' });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    row.append(inp, N.el('button', { class: 'btn btn-sm btn-sage', text: '+ Add', onclick: add }));
    card.appendChild(row);
    // seed suggestions
    const seeds = (key === 'block' ? NookCatalog.SEED_BLOCK_SITES : NookCatalog.SEED_ALLOW_SITES).filter((x) => !arr.includes(x)).slice(0, 6);
    if (seeds.length) {
      card.appendChild(N.el('div', { class: 'small mt', text: 'quick add:' }));
      card.appendChild(N.el('div', { class: 'chips', style: 'margin-top:6px' }, ...seeds.map((sd) => N.el('button', { class: 'btn btn-sm btn-ghost', text: '+ ' + sd, onclick: () => setS({ [key]: [...arr, sd] }) }))));
    }
    if (key === 'allow') card.appendChild(N.el('div', { class: 'small mt', text: 'Exact pages: paste a FULL url (youtube.com/watch?v=…) to allow only that page — the rest of the site stays napped (allow mode). Wander-proof your lectures.' }));
    function add() {
      const v = NookRules.normalizeEntry(inp.value);   // keeps paths: youtube.com/shorts
      if (!v) return;
      setS({ [key]: [...arr, v] });
      inp.value = '';
    }
    return card;
  }
};
