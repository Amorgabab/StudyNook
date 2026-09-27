/* ============================================================
   StudyNook · views-manage.js — Tasks, Apps & Sites views
   ============================================================ */
'use strict';
window.Views = window.Views || {};

/* ============================= TASKS ============================= */
Views.tasks = function (c) {
  const d = App.state.data;
  const card = N.el('div', { class: 'card' });
  /* page header — clean title only (subtitle removed for less clutter) */
  const head = N.el('div', { class: 'page-head' });
  head.appendChild(N.el('h2', { class: 'page-title', text: '📝 Study tasks' }));
  card.appendChild(head);

  /* --- creation form: elevated surface, input dominant, primary CTA --- */
  const form = N.el('div', { class: 'create-card' });
  const row = N.el('div', { class: 'create-row' });
  const txt = N.el('input', { class: 'input task-input', id: 'task-text', placeholder: 'What needs doing? e.g. "Chemistry ch.4 notes"', 'aria-label': 'Task name' });
  row.append(txt, Views._field('Subject', Views._taskSubjects(d)), Views._field('Planned time', Views._taskMinStepper()), Views._field('Effort', Views._taskEstSelect()));
  const addBtn = N.el('button', { class: 'btn btn-primary task-add', text: '+ Add task', onclick: () => submit() });
  row.appendChild(addBtn);
  form.appendChild(row);
  txt.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  card.appendChild(form);

  function submit() {
    const v = txt.value.trim();
    if (!v) { txt.focus(); return; }
    nook.invoke('tasks:add', { text: v, subject: Views._subjSel.value, min: Views._minVal, est: Views._estSel.value })
      .then((t) => { if (!t) App.toast('Could not add task', 'Please check the name and try again.'); });
    Audio2.pop();
  }

  const open = d.tasks.filter((t) => !t.done), done = d.tasks.filter((t) => t.done);
  card.appendChild(N.el('div', { class: 'row spread task-filters' },
    N.el('div', { class: 'seg seg-sm', role: 'tablist' },
      N.el('button', { class: App.taskFilter === 'done' ? '' : 'on sage', text: `Open (${open.length})`, onclick: () => { App.taskFilter = 'open'; App.render(); } }),
      N.el('button', { class: App.taskFilter === 'done' ? 'on sage' : '', text: `Done (${done.length})`, onclick: () => { App.taskFilter = 'done'; App.render(); } })
    )
  ));

  /* --- task list rows --- */
  const list = N.el('div', { class: 'list task-list' });
  const rows = App.taskFilter === 'done' ? done : open;
  if (!rows.length) list.appendChild(N.el('div', { class: 'small', text: App.taskFilter === 'done' ? 'Nothing finished yet — your future self is patient.' : 'All clear! Add a task above, or just free-focus. 🌿' }));
  for (const t of rows) {
    const row = N.el('div', { class: 'list-row' + (t.done ? ' done' : '') });
    const cb = N.el('button', { class: 'checkbox' + (t.done ? ' on' : ''), text: '✓', title: t.done ? 'reopen' : 'complete (+5 XP)', 'aria-label': t.done ? 'Reopen task' : 'Complete task, +5 XP', onclick: () => { nook.invoke('tasks:toggle', { id: t.id }); if (!t.done) Audio2.pop(); } });
    const grow = N.el('div', { class: 'grow' }, N.el('div', { class: 'title', text: t.text }));
    // meta line: subject / planned time / pomodoro progress — all explicit words now
    const meta = [];
    if (t.subject) meta.push(N.el('span', { class: 'tag', text: t.subject }));
    if (t.min) meta.push(N.el('span', { class: 'meta-chip', title: 'Planned minutes — the time you expect this task to take', text: '⏱ planned ' + N.fmtMin(t.min) }));
    meta.push(N.el('span', { class: 'meta-chip', title: 'Pomodoros done out of your estimate', text: `🍅 ${t.pomosDone || 0}/${t.est} pomodoros` }));
    // study sources: collapsed behind a "+ Source" affordance until opened
    const srcWrap = N.el('div', { class: 'src-wrap' });
    const srcBar = N.el('div', { class: 'row src-bar', style: 'gap:5px;flex-wrap:wrap' });
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
    srcWrap.append(srcBar, srcToggle, srcForm);
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
  /* subtitle removed for less clutter — the title and controls speak for themselves */

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
  /* dense scan-behavior explanation removed for less clutter */

  if (g.mode === 'allow') {
    ctrl.appendChild(N.el('div', { class: 'banner warn mt' }, N.el('span', { text: '⚠️' }), N.el('span', { text: 'Allowlist mode closes any app NOT on your allow list (system processes are always protected). Use "Preview" anytime to see exactly what would close.' }), N.el('button', { class: 'btn btn-sm', text: 'Preview now', onclick: showPreview })));
  }
  c.appendChild(ctrl);

  /* --- lists card --- */
  const lists = N.el('div', { class: 'card mt' });
  const tab = App.appsTab || 'block';
  lists.appendChild(N.el('div', { class: 'tabs' },
    ...[['block', `🚫 Blocked (${d.apps.block.length})`], ['allow', `✅ Allowed (${d.apps.allow.length})`], ['lib', '📚 App library'], ['run', '🔎 Running now']]
      .map(([id, lbl]) => N.el('button', { class: 'btn btn-sm' + (tab === id ? ' btn-honey' : ' btn-ghost'), text: lbl, title: id === 'run' ? 'See all currently running processes and their real names' : '', onclick: () => { App.appsTab = id; App.render(); } }))
  ));

  if (tab === 'block' || tab === 'allow') {
    const listKey = tab;
    /* section explanation removed for less clutter — the tab label says it all */
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
    const lbl = N.el('input', { class: 'input', placeholder: 'App name (e.g. Discord)', title: 'A friendly display name for the app', style: 'width:170px' });
    const procs = N.el('input', { class: 'input', placeholder: 'process names, comma separated (e.g. discord, discordptb)', title: 'The OS process names to close — check the "Running now" tab for real names', style: 'flex:1;min-width:220px' });
    addRow.append(lbl, procs, N.el('button', { class: 'btn btn-sm btn-sage', text: '+ Add custom', onclick: () => { if (lbl.value.trim() && procs.value.trim()) nook.invoke('apps:add', { list: listKey, label: lbl.value, procs: procs.value.split(',').map((s) => s.trim()).filter(Boolean) }); } }));
    lists.appendChild(addRow);
    /* permanent hint line removed — moved into input tooltips + the "Running now" tab tooltip */
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
      N.el('button', { class: s.mode === 'allow' ? 'on accent' : '', text: '✅ Allowlist — block EVERYTHING else', title: 'During focus, only the allowed sites below will open — everything else lands on the napping page.', onclick: () => setS({ mode: 'allow' }) }))
  ));
  const focusing = App.state.session && App.state.session.active && App.state.session.phase === 'focus' && App.state.session.running;
  ctrl.appendChild(N.el('div', { class: 'row mt' },
    N.el('span', { class: 'pill ' + (s.enabled && (s.when === 'always' || focusing) ? 'on' : 'warn'), text: s.enabled ? (s.when === 'always' ? '🟢 rules armed always' : focusing ? '🟢 rules armed (focusing)' : '💤 rules sleep until focus starts') : '⚪ site blocking off' })
  ));
  c.appendChild(ctrl);

  const listsCard = N.el('div', { class: 'grid2b site-cards mt' });
  listsCard.appendChild(domainList('block', '🚫 Blocked sites', s.block, 'youtube.com'));
  listsCard.appendChild(domainList('allow', '✅ Allowed sites (allow-mode)', s.allow, 'wikipedia.org or youtube.com/watch?v=…'));
  c.appendChild(listsCard);

  /* --- extension pairing card: status + full setup steps always visible --- */
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
  extCard.appendChild(N.el('div', { class: 'small mt', text: '✨ Setup instructions' }));
  const steps = N.el('div', { class: 'list mt ext-setup-steps open' });
  [
    ['1', 'Open Chrome (or Edge/Brave) and go to chrome://extensions'],
    ['2', 'Turn ON "Developer mode" (top-right corner)'],
    ['3', 'Click "Load unpacked" and pick this folder:  ' + (App.state.extPath || 'extension/')],
    ['4', 'Click the StudyNook extension icon → paste the pairing code above → Pair']
  ].forEach(([n, t]) => steps.appendChild(N.el('div', { class: 'list-row' }, N.el('span', { class: 'tag', text: n }), N.el('div', { class: 'grow' }, N.el('div', { class: 'title', style: 'font-weight:600', text: t })))));
  extCard.appendChild(steps);
  if (!ext.connected) {
    extCard.appendChild(N.el('div', { class: 'banner good mt' }, N.el('span', { text: '🌈' }), N.el('span', { text: 'No desktop app running? The extension still works on its own — open its popup for a built-in mini timer & lists. When StudyNook is open, the desktop settings win.' })));
  }
  c.appendChild(extCard);

  function setS(patch) { nook.invoke('sites:set', { patch }); }

  function domainList(key, title, arr, ph) {
    const card = N.el('div', { class: 'card site-card' });
    card.appendChild(N.el('h2', { text: title }));
    // tag area grows to fill the card, pushing the add-row to the bottom
    const chips = N.el('div', { class: 'chips mt site-tags' });
    for (const dom of arr) {
      chips.appendChild(N.el('span', { class: 'domain-chip' }, dom, N.el('button', { text: '✕', title: 'remove', onclick: () => setS({ [key]: arr.filter((x) => x !== dom) }) })));
    }
    if (!arr.length) chips.appendChild(N.el('span', { class: 'small', text: 'empty' }));
    card.appendChild(chips);
    const foot = N.el('div', { class: 'site-input-section' });
    const row = N.el('div', { class: 'row' });
    const inp = N.el('input', { class: 'input', placeholder: ph, style: 'flex:1' });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    row.append(inp, N.el('button', { class: 'btn btn-sm btn-sage', text: '+ Add', onclick: add }));
    foot.appendChild(row);
    // seed suggestions
    const seeds = (key === 'block' ? NookCatalog.SEED_BLOCK_SITES : NookCatalog.SEED_ALLOW_SITES).filter((x) => !arr.includes(x)).slice(0, 6);
    if (seeds.length) {
      foot.appendChild(N.el('div', { class: 'small mt', text: 'quick add:' }));
      foot.appendChild(N.el('div', { class: 'chips', style: 'margin-top:6px' }, ...seeds.map((sd) => N.el('button', { class: 'btn btn-sm btn-ghost', text: '+ ' + sd, onclick: () => setS({ [key]: [...arr, sd] }) }))));
    }
    card.appendChild(foot);
    if (key === 'block') inp.title = 'Tip: paths work too — e.g. youtube.com/shorts blocks only the Shorts feed.';
    function add() {
      const v = NookRules.normalizeEntry(inp.value);   // keeps paths: youtube.com/shorts
      if (!v) return;
      setS({ [key]: [...arr, v] });
      inp.value = '';
    }
    return card;
  }
};
