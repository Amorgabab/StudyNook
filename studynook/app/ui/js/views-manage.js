/* ============================================================
   StudyNook · views-manage.js — Tasks, Notes, Apps, Websites
   ============================================================ */
'use strict';
window.Views = window.Views || {};

/* ============================= TASKS ============================= */
Views.tasks = function (c) {
  const d = App.state.data;
  c.appendChild(N.pageHead(t('tasks.title'), t('tasks.sub')));

  /* --- add form --- */
  const form = N.card(t('tasks.new'), 'plus');
  const txt = N.el('input', { class: 'input', id: 'task-text', placeholder: t('tasks.placeholder'), 'aria-label': t('tasks.field.task') });
  const subj = N.el('select', { class: 'input', 'aria-label': t('tasks.field.subject') });
  subj.appendChild(N.el('option', { value: '', text: t('tasks.subject.none') }));
  for (const s of (d.subjects || [])) subj.appendChild(N.el('option', { value: s, text: s }));
  let minVal = 0;
  const est = N.el('select', { class: 'input', 'aria-label': t('tasks.field.estimate') });
  for (let i = 1; i <= 8; i++) est.appendChild(N.el('option', { value: String(i), text: t(i === 1 ? 'tasks.pomodoro.one' : 'tasks.pomodoro.many', { n: i }) }));
  const add = () => {
    const v = txt.value.trim();
    if (!v) { txt.focus(); return; }
    nook.invoke('tasks:add', { text: v, subject: subj.value, min: minVal, est: est.value })
      .then((r) => { if (!r) App.toast(t('tasks.addFailed.t'), t('tasks.addFailed.d'), { kind: 'warning' }); });
    Audio2.pop();
  };
  txt.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  form.appendChild(N.el('div', { class: 'task-form' },
    field(t('tasks.field.task'), txt), field(t('tasks.field.subject'), subj),
    field(t('tasks.field.planned'), N.el('span', { class: 'row' }, N.stepper(0, 0, 600, (v) => { minVal = v; }, 5, t('tasks.field.planned')), N.el('span', { class: 'stepper-unit', text: t('unit.min') }))),
    field(t('tasks.field.estimate'), est),
    N.btn(t('tasks.add'), { cls: 'btn-primary', icon: 'plus', onclick: add })));
  c.appendChild(form);

  /* --- list --- */
  const open = d.tasks.filter((x) => !x.done), done = d.tasks.filter((x) => x.done);
  const list = N.card(null, null, null);
  list.style.marginTop = 'var(--s-6)';
  list.appendChild(N.el('div', { class: 'card-head' },
    N.seg([['open', t('tasks.filter.open', { n: open.length })], ['done', t('tasks.filter.done', { n: done.length })]], App.taskFilter === 'done' ? 'done' : 'open', (v) => { App.taskFilter = v; App.render(); }, { label: t('tasks.filter') })));
  const rows = App.taskFilter === 'done' ? done : open;
  if (!rows.length) {
    list.appendChild(App.taskFilter === 'done' ? N.empty('circle-check', t('tasks.empty.done.t'), t('tasks.empty.done.d')) : N.empty('list-checks', t('tasks.empty.open.t'), t('tasks.empty.open.d')));
  }
  for (const tk of rows) {
    const row = N.el('div', { class: 'task-row' + (tk.done ? ' done' : '') });
    row.appendChild(N.el('button', {
      class: 'check', role: 'checkbox', type: 'button', 'aria-checked': tk.done ? 'true' : 'false',
      'aria-label': tk.done ? t('tasks.reopen') : t('tasks.complete'), title: tk.done ? t('tasks.reopen') : t('tasks.complete'),
      onclick: () => { nook.invoke('tasks:toggle', { id: tk.id }); if (!tk.done) Audio2.pop(); }
    }, N.icon('check', 14)));
    const body = N.el('div', { class: 'grow' }, N.el('div', { class: 'task-title', text: tk.text }));
    const meta = N.el('div', { class: 'task-meta' });
    if (tk.subject) meta.appendChild(N.el('span', { class: 'badge accent', text: tk.subject }));
    if (tk.min) meta.appendChild(N.el('span', { class: 'badge', title: t('tasks.meta.planned.tip') }, N.icon('clock', 12), N.el('span', { text: NookI18n.minutes(tk.min) })));
    meta.appendChild(N.el('span', { class: 'badge', title: t('tasks.meta.pomos.tip') }, N.icon('timer', 12), N.el('span', { text: t('tasks.meta.pomos', { done: tk.pomosDone || 0, est: tk.est }) })));
    body.appendChild(meta);

    const srcs = N.el('div', { class: 'sources' });
    (tk.sources || []).forEach((s, i) => {
      srcs.appendChild(N.el('span', { class: 'chip', title: s.url },
        N.el('button', { type: 'button', 'aria-label': t('tasks.source.open'), title: t('tasks.source.open'), onclick: () => nook.invoke('open:url', { url: s.url }) }, N.icon('external-link', 14, 'icon-flip')),
        N.el('span', { text: N.shortUrl(s.url) }),
        N.el('button', { type: 'button', 'aria-label': t('tasks.source.remove'), title: t('tasks.source.remove'), onclick: () => nook.invoke('tasks:removeSource', { id: tk.id, idx: i }) }, N.icon('x', 14))));
    });
    const sInp = N.el('input', { class: 'input', style: 'flex:1', placeholder: t('tasks.source.placeholder'), 'aria-label': t('tasks.source.placeholder') });
    const addSrc = () => { if (sInp.value.trim()) { nook.invoke('tasks:addSource', { id: tk.id, url: sInp.value }); sInp.value = ''; } };
    sInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSrc(); });
    const srcForm = N.el('div', { class: 'src-form hidden' }, sInp, N.btn(t('common.add'), { cls: 'btn-sm', onclick: addSrc }));
    srcs.appendChild(N.btn(t('tasks.source.add'), { cls: 'btn-ghost btn-sm', icon: 'link', title: t('tasks.source.tip'), onclick: () => { srcForm.classList.toggle('hidden'); if (!srcForm.classList.contains('hidden')) sInp.focus(); } }));
    body.append(srcs, srcForm);
    row.appendChild(body);
    row.appendChild(N.iconBtn('trash', t('tasks.delete'), () => App.confirm(t('tasks.delete.confirm'), tk.text, () => nook.invoke('tasks:remove', { id: tk.id }), t('common.delete')), 'danger'));
    list.appendChild(row);
  }
  c.appendChild(list);

  function field(label, control) { return N.el('label', { class: 'field' }, N.el('span', { class: 'field-label', text: label }), control); }
};

/* ============================= NOTES ============================= */
Views.notes = function (c) {
  const d = App.state.data;
  c.appendChild(N.pageHead(t('notes.title'), t('notes.sub'), N.btn(t('notes.new'), { cls: 'btn-primary', icon: 'plus', onclick: () => nook.invoke('notes:add') })));
  const notes = d.notes || [];
  if (!notes.length) { const e = N.card(); e.appendChild(N.empty('notebook-pen', t('notes.empty.t'), t('notes.empty.d'))); c.appendChild(e); return; }
  const grid = N.el('div', { class: 'notes-grid' });
  for (const n of notes) {
    const card = N.el('section', { class: 'card note-card' });
    const title = N.el('input', { class: 'note-title', placeholder: t('notes.untitled'), value: n.title || '', 'aria-label': t('notes.field.title') });
    const body = N.el('textarea', { class: 'note-body', placeholder: t('notes.placeholder'), 'aria-label': t('notes.field.body') });
    body.value = n.body || '';
    const saved = N.el('span', { class: 'caption', text: t('notes.saved', { when: N.timeAgo(n.updatedAt) }) });
    let timer = null;
    const save = () => {
      clearTimeout(timer);
      saved.textContent = t('notes.saving');
      timer = setTimeout(() => { nook.invoke('notes:save', { id: n.id, title: title.value, body: body.value }); saved.textContent = t('notes.saved', { when: t('fmt.justNow') }); }, 500);
    };
    title.addEventListener('input', save);
    body.addEventListener('input', save);
    card.append(title, body, N.el('div', { class: 'row spread' }, saved,
      N.iconBtn('trash', t('notes.delete'), () => App.confirm(t('notes.delete.confirm'), n.title || t('notes.untitled'), () => nook.invoke('notes:remove', { id: n.id }), t('common.delete')), 'danger')));
    grid.appendChild(card);
  }
  c.appendChild(grid);
};

/* ============================= APPS ============================= */
const APP_ICON = {
  discord: 'message-circle', whatsapp: 'message-circle', telegram: 'message-circle', skype: 'message-circle',
  spotify: 'music', netflix: 'tv', obsidian_n: 'notebook-pen', wallpaper: 'app-window',
  steam: 'gamepad-2', epic: 'gamepad-2', minecraft: 'gamepad-2', roblox: 'gamepad-2', lol: 'gamepad-2', valorant: 'gamepad-2',
  cs2: 'gamepad-2', battlenet: 'gamepad-2', ea: 'gamepad-2', genshin: 'gamepad-2', amongus: 'gamepad-2', terraria: 'gamepad-2', xbox: 'gamepad-2'
};
Views.apps = function (c) {
  const S = App.state, d = S.data, g = d.settings.guardian;
  c.appendChild(N.pageHead(t('apps.title'), t('apps.sub')));

  /* --- status --- */
  const st = N.card();
  const armed = S.guardian.armed, paused = S.guardian.pausedMinLeft > 0;
  const sub = !g.enabled ? t('apps.state.offSub') : armed ? t('apps.state.armed') : paused ? t('apps.state.paused', { n: S.guardian.pausedMinLeft }) : g.onlyDuringSessions ? t('apps.state.waiting') : t('apps.state.armed');
  st.appendChild(N.el('div', { class: 'status-card' },
    N.el('span', { class: 'item-icon' }, N.icon(g.enabled ? 'shield-check' : 'shield-off', 20)),
    N.el('div', { class: 'grow' }, N.el('b', { text: g.enabled ? t('apps.state.on') : t('apps.state.off') }), N.el('span', { class: 'small', text: sub + ' · ' + t('apps.mode.' + g.mode) + ' · ' + t('apps.action.' + g.action) })),
    paused ? N.btn(t('apps.resume'), { cls: 'btn-sm', icon: 'play', onclick: () => nook.invoke('guardian:pause', { min: 0 }) })
      : g.enabled ? N.btn(t('apps.pause5'), { cls: 'btn-sm btn-ghost', icon: 'pause', onclick: () => nook.invoke('guardian:pause', { min: 5 }) }) : null,
    N.btn(t('apps.fineTune'), { cls: 'btn-sm btn-ghost', icon: 'sliders-horizontal', onclick: () => App.go('settings', { section: 'blocking' }) }),
    N.toggle(g.enabled, (v) => nook.invoke('settings:set', { section: 'guardian', values: { enabled: v } }), { label: t('apps.toggle') })));
  if (g.mode === 'allow') {
    const cw = N.callout('warning', 'triangle-alert', t('apps.allowWarn'), t('apps.allowWarn.t'));
    cw.appendChild(N.btn(t('apps.preview'), { cls: 'btn-sm', onclick: () => Views.showAllowPreview() }));
    cw.style.marginTop = 'var(--s-5)';
    st.appendChild(cw);
  }
  c.appendChild(st);

  /* --- lists --- */
  const lists = N.card();
  lists.style.marginTop = 'var(--s-6)';
  const tab = App.appsTab || 'block';
  const tabs = N.el('div', { class: 'tabs', role: 'tablist' });
  for (const [id, ico, lbl, count] of [['block', 'ban', t('apps.tab.blocked'), d.apps.block.length], ['allow', 'circle-check', t('apps.tab.allowed'), d.apps.allow.length], ['lib', 'library', t('apps.tab.library')], ['run', 'scan-search', t('apps.tab.running')]]) {
    tabs.appendChild(N.el('button', { class: 'tab', role: 'tab', type: 'button', 'aria-selected': tab === id ? 'true' : 'false', onclick: () => { App.appsTab = id; App.render(); } },
      N.icon(ico, 16), N.el('span', { text: lbl }), count !== undefined ? N.el('span', { class: 'count', text: String(count) }) : null));
  }
  lists.appendChild(tabs);
  const frozen = App.listsFrozen();

  if (tab === 'block' || tab === 'allow') {
    if (frozen) lists.appendChild(N.callout('warning', 'lock', t('apps.frozen')));
    const entries = d.apps[tab];
    if (!entries.length) lists.appendChild(N.empty(tab === 'block' ? 'ban' : 'circle-check', t('apps.empty.' + tab + '.t'), t('apps.empty.d')));
    const list = N.el('div', { class: 'list' });
    for (const e of entries) {
      list.appendChild(N.el('div', { class: 'item' },
        N.el('span', { class: 'item-icon' }, N.icon(APP_ICON[e.catalogId] || 'app-window', 18)),
        N.el('div', { class: 'grow' }, N.el('div', { class: 'item-title', text: e.label }), N.el('div', { class: 'row wrap', style: 'margin-top:4px;gap:4px' }, ...e.procs.map((p) => N.el('span', { class: 'mono', text: p })))),
        N.toggle(e.enabled !== false, () => nook.invoke('apps:toggle', { list: tab, id: e.id }), { label: t('apps.entry.toggle', { app: e.label }), disabled: frozen, title: frozen ? t('apps.frozen.short') : null }),
        frozen ? null : N.iconBtn('trash', t('apps.entry.remove', { app: e.label }), () => nook.invoke('apps:remove', { list: tab, id: e.id }), 'danger')));
    }
    lists.appendChild(list);
    const lbl = N.el('input', { class: 'input', placeholder: t('apps.add.name'), 'aria-label': t('apps.add.name') });
    const procs = N.el('input', { class: 'input', placeholder: t('apps.add.procs'), title: t('apps.add.procs.tip'), 'aria-label': t('apps.add.procs') });
    const canAdd = !(frozen && tab === 'allow');
    lists.appendChild(N.el('div', { class: 'add-row' }, lbl, procs,
      N.btn(t('common.add'), { cls: 'btn-primary', icon: 'plus', disabled: !canAdd, title: canAdd ? null : t('apps.frozen.short'),
        onclick: () => { if (lbl.value.trim() && procs.value.trim()) nook.invoke('apps:add', { list: tab, label: lbl.value, procs: procs.value.split(',').map((s) => s.trim()).filter(Boolean) }); } })));
  }

  if (tab === 'lib') {
    lists.appendChild(N.el('p', { class: 'small', style: 'margin-bottom:var(--s-4)', text: t('apps.lib.sub') }));
    const grid = N.el('div', { class: 'catalog' });
    for (const item of NookCatalog.DISTRACTION_CATALOG) {
      const inBlock = d.apps.block.some((e) => e.catalogId === item.id);
      const inAllow = d.apps.allow.some((e) => e.catalogId === item.id);
      grid.appendChild(N.el('div', { class: 'cat-item' },
        N.el('span', { class: 'item-icon' }, N.icon(APP_ICON[item.id] || 'app-window', 18)),
        N.el('div', { class: 'grow ellipsis', title: item.label, text: item.label }),
        inBlock ? N.el('span', { class: 'badge danger', text: t('apps.lib.blocked') })
          : inAllow ? N.el('span', { class: 'badge success', text: t('apps.lib.allowed') })
            : N.el('span', { class: 'row', style: 'gap:4px' },
              N.btn(t('apps.lib.block'), { cls: 'btn-sm', onclick: () => nook.invoke('apps:addCatalog', { id: item.id, list: 'block' }) }),
              N.btn(t('apps.lib.allow'), { cls: 'btn-sm btn-ghost', disabled: frozen, title: frozen ? t('apps.frozen.short') : null, onclick: () => nook.invoke('apps:addCatalog', { id: item.id, list: 'allow' }) }))));
    }
    lists.appendChild(grid);
  }

  if (tab === 'run') {
    const search = N.el('input', { class: 'input grow', placeholder: t('apps.run.filter'), 'aria-label': t('apps.run.filter') });
    const table = N.el('div', { class: 'list scan-list' });
    lists.appendChild(N.el('div', { class: 'row', style: 'margin-bottom:var(--s-4)' }, search, N.btn(t('apps.run.rescan'), { icon: 'refresh-cw', onclick: () => scan() })));
    lists.appendChild(table);
    let rowsCache = null;
    search.addEventListener('input', () => paintScan());
    const scan = () => { table.innerHTML = ''; table.appendChild(N.el('div', { class: 'small', text: t('apps.run.scanning') })); nook.invoke('apps:scan').then((r) => { rowsCache = r; paintScan(); }); };
    const paintScan = () => {
      if (!rowsCache) return;
      table.innerHTML = '';
      const q = search.value.toLowerCase();
      const shown = rowsCache.filter((r) => !q || r.norm.includes(q)).slice(0, 300);
      if (!shown.length) table.appendChild(N.empty('search', t('apps.run.none')));
      for (const r of shown) {
        table.appendChild(N.el('div', { class: 'item' },
          N.el('div', { class: 'grow' }, N.el('div', { class: 'item-title', text: r.name }), N.el('div', { class: 'item-sub', text: t('apps.run.pid', { pid: r.pid }) })),
          r.listed ? N.el('span', { class: 'badge', text: t('apps.run.listed') }) : N.el('span', { class: 'row', style: 'gap:4px' },
            N.btn(t('apps.lib.block'), { cls: 'btn-sm', onclick: () => nook.invoke('apps:add', { list: 'block', label: r.name, procs: [r.norm] }) }),
            N.btn(t('apps.lib.allow'), { cls: 'btn-sm btn-ghost', disabled: frozen, onclick: () => nook.invoke('apps:add', { list: 'allow', label: r.name, procs: [r.norm] }) }))));
      }
    };
    scan();
  }
  c.appendChild(lists);
};

/** Preview of what allowlist mode would close right now (also used from Settings). */
Views.showAllowPreview = function () {
  nook.invoke('apps:previewAllow').then((groups) => {
    const body = N.el('div', { class: 'list' });
    if (!groups.length) body.appendChild(N.empty('circle-check', t('apps.preview.none')));
    for (const gr of groups) body.appendChild(N.el('div', { class: 'item' }, N.el('span', { class: 'item-icon' }, N.icon('app-window', 18)), N.el('div', { class: 'grow item-title', text: gr.label }), N.el('span', { class: 'badge', text: t('apps.preview.procs', { n: gr.count }) })));
    App.modal(t('apps.preview.title'), body, [{ label: t('common.done'), cls: 'btn-primary', fn: () => App.closeModal() }]);
  });
};

/* ============================= WEBSITES ============================= */
Views.sites = function (c) {
  const S = App.state, d = S.data, s = d.sites, ext = S.ext;
  const setS = (patch) => nook.invoke('sites:set', { patch });
  c.appendChild(N.pageHead(t('sites.title'), t('sites.sub')));

  /* --- status --- */
  const ses = S.session || {};
  const focusing = ses.active && ses.phase === 'focus' && (ses.running || ses.blockActive);
  const armedTxt = !s.enabled ? t('sites.state.offSub') : s.when === 'always' ? t('sites.state.always') : focusing ? t('sites.state.active') : t('sites.state.waiting');
  const st = N.card();
  st.appendChild(N.el('div', { class: 'status-card' },
    N.el('span', { class: 'item-icon' }, N.icon(s.enabled ? 'shield-check' : 'shield-off', 20)),
    N.el('div', { class: 'grow' }, N.el('b', { text: s.enabled ? t('sites.state.on') : t('sites.state.off') }), N.el('span', { class: 'small', text: armedTxt })),
    N.seg([['block', t('sites.mode.block'), 'ban'], ['allow', t('sites.mode.allow'), 'circle-check']], s.mode, (v) => setS({ mode: v }), { label: t('sites.mode'), titles: { block: t('sites.mode.block.tip'), allow: t('sites.mode.allow.tip') } }),
    N.toggle(s.enabled, (v) => setS({ enabled: v }), { label: t('sites.toggle') })));
  c.appendChild(st);

  /* --- lists --- */
  const grid = N.el('div', { class: 'grid-2', style: 'margin-top:var(--s-6)' });
  grid.appendChild(domainList('block', t('sites.blocked'), t('sites.blocked.sub'), 'ban', s.block, 'youtube.com/shorts'));
  grid.appendChild(domainList('allow', t('sites.allowed'), t('sites.allowed.sub'), 'circle-check', s.allow, 'wikipedia.org'));
  c.appendChild(grid);

  /* --- extension --- */
  const ec = N.card(t('sites.ext.title'), 'plug');
  ec.style.marginTop = 'var(--s-6)';
  ec.appendChild(N.el('div', { class: 'status-card' },
    N.el('span', { class: 'item-icon' }, N.icon(ext.connected ? 'plug' : 'unplug', 20)),
    N.el('div', { class: 'grow' },
      N.el('b', { text: ext.bridgeError ? t('sites.ext.error') : ext.connected ? t('sites.ext.connected') : t('sites.ext.notConnected') }),
      N.el('span', { class: 'small', text: ext.bridgeError ? ext.bridgeError : ext.connected ? t('sites.ext.lastSeen', { when: N.timeAgo(ext.lastSeen) }) + (ext.version ? ' · v' + ext.version : '') : t('sites.ext.notConnected.sub') })),
    N.el('span', { class: 'small', text: t('sites.ext.code') }),
    N.el('span', { class: 'pair-code', text: ext.code }),
    N.iconBtn('copy', t('sites.ext.copy'), () => { if (navigator.clipboard) navigator.clipboard.writeText(ext.code); App.toast(t('sites.ext.copied'), ext.code, { kind: 'success' }); })));
  ec.appendChild(N.el('div', { class: 'divider' }));
  ec.appendChild(N.el('div', { class: 'overline', style: 'margin-bottom:var(--s-3)', text: t('sites.ext.setup') }));
  const steps = N.el('div', { class: 'steps' });
  for (const k of ['sites.ext.step1', 'sites.ext.step2', 'sites.ext.step3', 'sites.ext.step4']) {
    steps.appendChild(N.el('div', { class: 'step' }, N.el('span', { text: t(k, { path: S.extPath || 'extension' }) })));
  }
  ec.appendChild(steps);
  ec.appendChild(N.el('div', { class: 'row', style: 'margin-top:var(--s-5)' },
    N.btn(t('sites.ext.check'), { icon: 'search-check', onclick: async () => { const r = await nook.invoke('ext:detect'); App.toast(r.title, r.detail, { ms: 10000 }); } })));
  if (!ext.connected) { const cl = N.callout('info', 'info', t('sites.ext.standalone')); cl.style.marginTop = 'var(--s-5)'; ec.appendChild(cl); }
  c.appendChild(ec);

  function domainList(key, title, sub, ico, arr, ph) {
    const card = N.card(title, ico);
    card.appendChild(N.el('p', { class: 'card-sub', text: sub }));
    const chips = N.el('div', { class: 'chips' });
    for (const dom of arr) {
      chips.appendChild(N.el('span', { class: 'chip', title: dom }, N.el('span', { text: dom }),
        N.el('button', { type: 'button', 'aria-label': t('sites.remove', { site: dom }), onclick: () => setS({ [key]: arr.filter((x) => x !== dom) }) }, N.icon('x', 14))));
    }
    if (!arr.length) chips.appendChild(N.el('span', { class: 'small', text: t('sites.empty') }));
    card.appendChild(chips);
    const inp = N.el('input', { class: 'input grow', placeholder: ph, 'aria-label': t('sites.add.label', { list: title }), title: key === 'block' ? t('sites.add.tip') : null });
    const addIt = () => { const v = NookRules.normalizeEntry(inp.value); if (!v) return; setS({ [key]: [...arr, v] }); inp.value = ''; };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addIt(); });
    card.appendChild(N.el('div', { class: 'row', style: 'margin-top:var(--s-5)' }, inp, N.btn(t('common.add'), { cls: 'btn-primary', icon: 'plus', onclick: addIt })));
    const seeds = (key === 'block' ? NookCatalog.SEED_BLOCK_SITES : NookCatalog.SEED_ALLOW_SITES).filter((x) => !arr.includes(x)).slice(0, 6);
    if (seeds.length) {
      card.appendChild(N.el('div', { class: 'overline', style: 'margin:var(--s-4) 0 var(--s-2)', text: t('sites.suggestions') }));
      card.appendChild(N.el('div', { class: 'chips' }, ...seeds.map((sd) => N.btn(sd, { cls: 'btn-sm btn-ghost', icon: 'plus', iconSize: 14, onclick: () => setS({ [key]: [...arr, sd] }) }))));
    }
    return card;
  }
};
