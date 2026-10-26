/* ============================================================
   StudyNook · views-misc.js — Settings & Help
   ============================================================ */
'use strict';
window.Views = window.Views || {};

/* ============================= SETTINGS ============================= */
const SETTINGS_SECTIONS = [
  ['general', 'sliders-horizontal'], ['appearance', 'palette'], ['timer', 'timer'], ['blocking', 'shield'],
  ['notifications', 'bell'], ['sound', 'volume-2'], ['data', 'database'], ['about', 'info']
];

Views.settings = function (c) {
  const S = App.state, d = S.data, s = d.settings;
  if (App.viewOpts && App.viewOpts.section) { App.settingsSection = App.viewOpts.section; App.viewOpts = {}; }
  const cur = App.settingsSection || 'general';
  c.appendChild(N.pageHead(t('set.title'), t('set.sub')));

  const nav = N.el('nav', { class: 'subnav', 'aria-label': t('set.title') });
  for (const [id, ico] of SETTINGS_SECTIONS) {
    nav.appendChild(N.el('button', { type: 'button', 'aria-current': cur === id ? 'true' : 'false', onclick: () => { App.settingsSection = id; App.render(); } }, N.icon(ico, 16), N.el('span', { text: t('set.sec.' + id) })));
  }
  const panel = N.el('div', { class: 'stack gap-6' });
  const ico = (SETTINGS_SECTIONS.find((x) => x[0] === cur) || [])[1];
  const card = N.card(t('set.sec.' + cur), ico);
  panel.appendChild(card);
  c.appendChild(N.el('div', { class: 'with-subnav' }, nav, panel));

  const set = (section, values) => nook.invoke('settings:set', { section, values });
  const setT = (v) => set('timer', v), setG = (v) => set('guardian', v);
  const row = (label, desc, control) => N.el('div', { class: 'set-row' },
    N.el('div', { class: 'grow' }, N.el('div', { class: 'set-label', text: label }), desc ? N.el('div', { class: 'set-desc', text: desc }) : null),
    N.el('div', { class: 'set-control' }, control));
  const num = (val, min, max, onSet, unit, step, label) => N.el('span', { class: 'row' }, N.stepper(val, min, max, onSet, step, label), unit ? N.el('span', { class: 'stepper-unit', text: unit }) : null);
  const text = (val, max, onSet, label) => { const i = N.el('input', { class: 'input', value: val || '', maxlength: String(max), style: 'width:220px', 'aria-label': label, 'data-draft': 'set:text:' + label }); i.addEventListener('change', () => onSet(i.value.trim())); return i; };

  if (cur === 'general') {
    const lang = N.el('select', { class: 'input', 'aria-label': t('set.lang') });
    for (const [v, lbl] of [['en', 'English'], ['ar', 'العربية'], ['fr', 'Français'], ['es', 'Español']]) lang.appendChild(N.el('option', { value: v, text: lbl, selected: NookPrefs.normLang(s.language) === v }));
    lang.addEventListener('change', () => set('language', lang.value));
    card.appendChild(row(t('set.lang'), t('set.lang.desc'), lang));
    card.appendChild(row(t('set.startup'), S.packaged ? t('set.startup.desc') : t('set.startup.dev'),
      N.toggle(!!s.startWithWindows, (v) => set('startWithWindows', v), { label: t('set.startup'), disabled: !S.packaged })));
    card.appendChild(row(t('set.name'), t('set.name.desc'), text(d.profile.name, 40, (v) => nook.invoke('profile:set', { name: v }), t('set.name'))));
    card.appendChild(row(t('set.pet'), t('set.pet.desc'), text(d.pet.name, 20, (v) => nook.invoke('pet:rename', { name: v }), t('set.pet'))));
    card.appendChild(row(t('set.goal'), t('set.goal.desc'), num(s.dailyGoalMin || 0, 0, 720, (v) => set('dailyGoalMin', v), t('unit.min'), 15, t('set.goal'))));
    // subjects
    const block = N.el('div', { class: 'set-block' }, N.el('div', { class: 'set-label', text: t('set.subjects') }), N.el('div', { class: 'set-desc', style: 'margin-bottom:var(--s-3)', text: t('set.subjects.desc') }));
    const chips = N.el('div', { class: 'chips' });
    for (const sj of (d.subjects || [])) chips.appendChild(N.el('span', { class: 'chip' }, N.el('span', { text: sj }), N.el('button', { type: 'button', 'aria-label': t('set.subjects.remove', { s: sj }), onclick: () => nook.invoke('subjects:set', { list: d.subjects.filter((x) => x !== sj) }) }, N.icon('x', 14))));
    block.appendChild(chips);
    const sinp = N.el('input', { class: 'input grow', placeholder: t('set.subjects.add'), maxlength: '40', 'aria-label': t('set.subjects.add'), 'data-draft': 'set:subject' });
    const addS = () => { const v = sinp.value.trim(); if (v) { nook.invoke('subjects:set', { list: [...(d.subjects || []), v] }); sinp.value = ''; } };
    sinp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addS(); });
    block.appendChild(N.el('div', { class: 'row', style: 'margin-top:var(--s-3);max-width:420px' }, sinp, N.btn(t('common.add'), { icon: 'plus', onclick: addS })));
    card.appendChild(block);
  }

  if (cur === 'appearance') {
    const theme = NookPrefs.THEMES.includes(s.theme) ? s.theme : 'system';
    card.appendChild(row(t('set.theme'), t('set.theme.desc.' + theme),
      N.seg([['system', t('set.theme.system'), 'monitor'], ['light', t('set.theme.light'), 'sun'], ['dark', t('set.theme.dark'), 'moon'], ['auto', t('set.theme.auto'), 'sun-moon']], theme, (v) => set('theme', v), { label: t('set.theme') })));
    card.appendChild(row(t('set.mini'), t('set.mini.desc'), N.toggle(!!s.miniWindow, (v) => set('miniWindow', v), { label: t('set.mini') })));
  }

  if (cur === 'timer') {
    const tm = s.timer;
    card.appendChild(row(t('set.t.work'), t('set.t.work.desc'), num(tm.workMin, 5, 180, (v) => setT({ workMin: v }), t('unit.min'), 5, t('set.t.work'))));
    card.appendChild(row(t('set.t.short'), null, num(tm.shortMin, 1, 60, (v) => setT({ shortMin: v }), t('unit.min'), 1, t('set.t.short'))));
    card.appendChild(row(t('set.t.long'), null, num(tm.longMin, 5, 90, (v) => setT({ longMin: v }), t('unit.min'), 5, t('set.t.long'))));
    card.appendChild(row(t('set.t.rounds'), t('set.t.rounds.desc'), num(tm.rounds, 2, 12, (v) => setT({ rounds: v }), null, 1, t('set.t.rounds'))));
    card.appendChild(row(t('set.t.autoBreak'), null, N.toggle(!!tm.autoStartBreaks, (v) => setT({ autoStartBreaks: v }), { label: t('set.t.autoBreak') })));
    card.appendChild(row(t('set.t.autoFocus'), null, N.toggle(!!tm.autoStartFocus, (v) => setT({ autoStartFocus: v }), { label: t('set.t.autoFocus') })));
    card.appendChild(row(t('set.t.strict'), t('set.t.strict.desc'), N.toggle(!!tm.strict, (v) => setT({ strict: v }), { label: t('set.t.strict') })));
    const locked = NookIron.isLocked(tm.ironLockedUntil, Date.now());
    card.appendChild(row(t('set.t.iron'), locked ? t('set.t.iron.locked', { time: NookIron.remainingHms(tm.ironLockedUntil, Date.now()) }) : t('set.t.iron.desc'),
      locked ? N.el('span', { class: 'badge warning' }, N.icon('lock', 12), N.el('span', { text: t('set.t.iron.lockedBadge') }))
        : N.toggle(!!tm.iron, (v) => {
          if (!v) return setT({ iron: false });
          App.confirm(t('set.t.iron.confirm.t'), t('set.t.iron.confirm.d', { n: tm.ironLockDays || 4 }), () => setT({ iron: true }), t('set.t.iron.confirm.yes'));
        }, { label: t('set.t.iron') })));
    card.appendChild(row(t('set.t.ironDays'), t('set.t.ironDays.desc'), num(tm.ironLockDays || 4, 1, 30, (v) => setT({ ironLockDays: v }), t('unit.days'), 1, t('set.t.ironDays'))));
  }

  if (cur === 'blocking') {
    const g = s.guardian;
    if (App.ironFocusOn()) card.appendChild(N.callout('warning', 'lock', t('set.b.ironNote')));
    card.appendChild(row(t('set.b.when'), t('set.b.when.desc'), N.seg([['session', t('set.b.during'), 'timer'], ['always', t('set.b.always'), 'infinity']], g.onlyDuringSessions ? 'session' : 'always', (v) => setG({ onlyDuringSessions: v === 'session' }), { label: t('set.b.when') })));
    card.appendChild(row(t('set.b.mode'), t('set.b.mode.desc'), N.seg([['block', t('set.b.blocklist'), 'ban'], ['allow', t('set.b.allowlist'), 'circle-check']], g.mode, (v) => { setG({ mode: v }); if (v === 'allow') setTimeout(Views.showAllowPreview, 300); }, { label: t('set.b.mode') })));
    card.appendChild(row(t('set.b.action'), t('set.b.action.desc'), N.seg([['gentle', t('set.b.gentle'), 'bell-ring'], ['instant', t('set.b.instant'), 'zap'], ['remind', t('set.b.remind'), 'bell']], g.action, (v) => setG({ action: v }), { label: t('set.b.action') })));
    card.appendChild(row(t('set.b.grace'), t('set.b.grace.desc'), num(g.graceSec, 5, 300, (v) => setG({ graceSec: v }), t('unit.sec'), 5, t('set.b.grace'))));
    card.appendChild(row(t('set.b.scan'), t('set.b.scan.desc'), num(g.scanSec, 1, 30, (v) => setG({ scanSec: v }), t('unit.sec'), 1, t('set.b.scan'))));
    card.appendChild(row(t('set.b.sites'), t('set.b.sites.desc'), N.seg([['session', t('set.b.during'), 'timer'], ['always', t('set.b.always'), 'infinity']], d.sites.when, (v) => nook.invoke('sites:set', { patch: { when: v } }), { label: t('set.b.sites') })));
    card.appendChild(row(t('set.b.pause'), S.guardian.pausedMinLeft > 0 ? t('set.b.pause.active', { n: S.guardian.pausedMinLeft }) : t('set.b.pause.desc'),
      N.el('span', { class: 'row' }, ...[5, 15, 60].map((m) => N.btn(t('set.b.pause.min', { n: m }), { cls: 'btn-sm', onclick: () => nook.invoke('guardian:pause', { min: m }) })))));
  }

  if (cur === 'notifications') {
    const nt = s.notify || {};
    for (const k of ['focusEnd', 'breakEnd', 'blocker']) {
      card.appendChild(row(t('set.n.' + k), t('set.n.' + k + '.desc'), N.toggle(nt[k] !== false, (v) => set('notify', { [k]: v }), { label: t('set.n.' + k) })));
    }
  }

  if (cur === 'sound') {
    const snd = s.sound;
    card.appendChild(row(t('set.s.ui'), t('set.s.ui.desc'), N.toggle(!!snd.ui, (v) => { set('sound', { ui: v }); Audio2.setEnabled({ ui: v, chimes: snd.chimes }); }, { label: t('set.s.ui') })));
    card.appendChild(row(t('set.s.chimes'), t('set.s.chimes.desc'), N.toggle(!!snd.chimes, (v) => { set('sound', { chimes: v }); Audio2.setEnabled({ ui: snd.ui, chimes: v }); }, { label: t('set.s.chimes') })));
    const vol = N.el('input', { type: 'range', min: 0, max: 100, value: Math.round(snd.volume * 100), style: 'width:200px', 'aria-label': t('set.s.volume') });
    vol.addEventListener('input', () => Audio2.setVolume(vol.value / 100));
    vol.addEventListener('change', () => set('sound', { volume: vol.value / 100 }));
    card.appendChild(row(t('set.s.volume'), null, vol));
    card.appendChild(row(t('set.s.files'), t('set.s.files.desc'), N.btn(t('set.s.files.open'), { icon: 'folder-open', title: S.soundsPath, onclick: () => nook.invoke('data:openSounds') })));
  }

  if (cur === 'data') {
    card.appendChild(row(t('set.d.backup'), t('set.d.backup.desc'), N.el('span', { class: 'row' },
      N.btn(t('set.d.backup.now'), { icon: 'download', onclick: () => nook.invoke('data:backupNow').then((r) => App.toast(t('set.d.backup.done'), r.name, { kind: 'success' })) }),
      N.btn(t('set.d.backup.folder'), { cls: 'btn-ghost', icon: 'folder-open', onclick: () => nook.invoke('data:openBackups') }))));
    card.appendChild(row(t('set.d.export'), t('set.d.export.desc'), N.btn(t('set.d.export.btn'), { icon: 'download', onclick: exportData })));
    card.appendChild(row(t('set.d.import'), t('set.d.import.desc'), N.btn(t('set.d.import.btn'), { icon: 'upload', onclick: importData })));
    card.appendChild(row(t('set.d.folder'), t('set.d.folder.desc'), N.btn(t('set.d.folder.btn'), { cls: 'btn-ghost', icon: 'folder-open', onclick: () => nook.invoke('data:openFolder') })));
    card.appendChild(row(t('set.d.reset'), t('set.d.reset.desc'), N.btn(t('set.d.reset.btn'), { cls: 'btn-danger', icon: 'rotate-ccw', onclick: () => App.confirm(t('set.d.reset.confirm.t'), t('set.d.reset.confirm.d'), () => nook.invoke('data:reset'), t('set.d.reset.btn')) })));
  }

  if (cur === 'about') {
    card.appendChild(row(t('set.a.version'), t('set.a.local'), N.el('span', { class: 'badge', text: 'v' + (S.appVersion || '') })));
    card.appendChild(row(t('set.a.tour'), t('set.a.tour.desc'), N.btn(t('set.a.tour.btn'), { icon: 'play', onclick: () => App.startTour() })));
    card.appendChild(row(t('set.a.help'), t('set.a.help.desc'), N.btn(t('set.a.help.btn'), { icon: 'circle-question-mark', onclick: () => App.go('help') })));
  }

  function exportData() {
    nook.invoke('data:export').then((json) => {
      const a = N.el('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: 'studynook-backup.json' });
      document.body.appendChild(a); a.click(); a.remove();
      App.toast(t('set.d.export.done'), 'studynook-backup.json', { kind: 'success' });
    });
  }
  function importData() {
    const ta = N.el('textarea', { class: 'input', style: 'width:100%;height:200px;font-family:var(--font-mono);font-size:12px', placeholder: t('set.d.import.placeholder'), 'aria-label': t('set.d.import.placeholder') });
    App.modal(t('set.d.import'), ta, [
      { label: t('common.cancel'), cls: 'btn-ghost', fn: () => App.closeModal() },
      { label: t('set.d.import.btn'), cls: 'btn-primary', fn: () => nook.invoke('data:import', { json: ta.value }).then((ok) => { App.closeModal(); App.toast(ok ? t('set.d.import.ok') : t('set.d.import.fail'), ok ? '' : t('set.d.import.fail.d'), { kind: ok ? 'success' : 'warning' }); }) }
    ]);
  }
};

/* ============================= HELP ============================= */
Views.help = function (c) {
  const lang = NookI18n.getLang();
  const all = (window.NookHelp && (NookHelp[lang] || NookHelp.en)) || [];
  c.appendChild(N.pageHead(t('help.title'), t('help.sub')));
  const q = (App.helpQuery || '').trim().toLowerCase();
  const textOf = (a) => [a.title, a.lead].concat(a.blocks.map((b) => [b.h, b.p, b.note].concat(b.ol || [], b.ul || [], b.table ? [].concat(...b.table.rows) : []).filter(Boolean).join(' '))).join(' ').toLowerCase();
  const shown = q ? all.filter((a) => textOf(a).includes(q)) : all;
  if (!App.helpTopic || !all.some((a) => a.id === App.helpTopic)) App.helpTopic = all.length ? all[0].id : null;
  if (q && shown.length && !shown.some((a) => a.id === App.helpTopic)) App.helpTopic = shown[0].id;

  const side = N.el('div');
  const search = N.el('input', { class: 'input', id: 'help-search', type: 'search', placeholder: t('help.search'), value: App.helpQuery || '', 'aria-label': t('help.search') });
  search.addEventListener('input', () => { App.helpQuery = search.value; App.render(); });
  side.appendChild(N.el('div', { class: 'help-search' }, N.icon('search', 16), search));
  const nav = N.el('nav', { class: 'subnav', 'aria-label': t('help.title') });
  for (const a of shown) nav.appendChild(N.el('button', { type: 'button', 'aria-current': a.id === App.helpTopic ? 'true' : 'false', onclick: () => { App.helpTopic = a.id; App.render(); } }, N.icon(a.icon, 16), N.el('span', { text: a.title })));
  if (!shown.length) nav.appendChild(N.el('p', { class: 'small', style: 'padding:var(--s-2) var(--s-3)', text: t('help.noResults') }));
  side.appendChild(nav);

  const art = all.find((a) => a.id === App.helpTopic);
  const panel = N.card();
  if (art) panel.appendChild(renderArticle(art));
  c.appendChild(N.el('div', { class: 'with-subnav' }, side, panel));
};

/** Inline markup for help text: **bold**, `code`, [[kbd]]. Input is escaped first. */
function helpInline(s) {
  return N.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\[\[(.+?)\]\]/g, '<kbd>$1</kbd>');
}
function renderArticle(a) {
  const el = N.el('article', { class: 'article' }, N.el('h2', { text: a.title }), N.el('p', { class: 'lead', html: helpInline(a.lead) }));
  for (const b of a.blocks) {
    if (b.h) el.appendChild(N.el('h3', { text: b.h }));
    if (b.p) el.appendChild(N.el('p', { html: helpInline(b.p) }));
    if (b.ol) el.appendChild(N.el('ol', {}, ...b.ol.map((x) => N.el('li', { html: helpInline(x) }))));
    if (b.ul) el.appendChild(N.el('ul', {}, ...b.ul.map((x) => N.el('li', { html: helpInline(x) }))));
    if (b.note) {
      const k = b.kind === 'warning' ? 'warning' : 'info';
      el.appendChild(N.el('div', { class: 'callout ' + k }, N.icon(k === 'warning' ? 'triangle-alert' : 'info', 18), N.el('div', { class: 'grow', html: helpInline(b.note) })));
    }
    if (b.table) {
      el.appendChild(N.el('table', {},
        N.el('thead', {}, N.el('tr', {}, ...b.table.head.map((x) => N.el('th', { text: x })))),
        N.el('tbody', {}, ...b.table.rows.map((r) => N.el('tr', {}, ...r.map((x) => N.el('td', { html: helpInline(x) })))))));
    }
  }
  return el;
}
