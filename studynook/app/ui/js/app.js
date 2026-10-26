/* ============================================================
   StudyNook · app.js — UI bootstrap: navigation, theme + language,
   router, toasts, modals, Iron gate, welcome tour
   ============================================================ */
'use strict';
window.App = (function () {
  const App = {
    state: { data: null, session: null, guardian: null, ext: null },
    view: 'home',
    viewOpts: {},
    freeMode: false,
    freeMin: 25,
    lastTaskId: null,
    taskFilter: 'open',
    appsTab: 'block',
    ambience: null,
    moodOverride: null      // {mood, until}
  };

  const NAV = [
    ['home', 'house', 'nav.focus'],
    ['tasks', 'list-checks', 'nav.tasks'],
    ['notes', 'notebook-pen', 'nav.notes'],
    ['apps', 'app-window', 'nav.apps'],
    ['sites', 'globe', 'nav.sites'],
    ['garden', 'chart-column', 'nav.progress'],
    ['settings', 'settings', 'nav.settings'],
    ['help', 'circle-question-mark', 'nav.help']
  ];
  let langApplied = null;

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    nook.on('snapshot', (s) => { App.state = s; applyPrefs(); renderView(); });
    nook.on('tick', (st) => { App.state.session = st; Views.homeTick && Views.homeTick(st); });
    nook.on('session-event', onSessionEvent);
    nook.on('reward', onReward);
    nook.on('guard', onGuard);
    nook.on('iron-gate', () => App.ironGate(() => nook.invoke('win:close')));
    nook.on('close-blocked', () => App.toast(t('toast.closeBlocked.t'), t('toast.closeBlocked.d'), { kind: 'warning' }));
    nook.on('data-blocked', () => App.toast(t('toast.dataBlocked.t'), t('toast.dataBlocked.d'), { kind: 'warning' }));
    nook.on('list-frozen', () => App.toast(t('toast.listFrozen.t'), t('toast.listFrozen.d'), { kind: 'warning' }));
    nook.on('toast', (p) => { if (p && p.title) App.toast(String(p.title), p.msg ? String(p.msg) : '', { ms: 12000, kind: 'warning' }); });
    const snap = await nook.invoke('get-snapshot');
    App.state = snap;
    Audio2.setEnabled({ ui: snap.data.settings.sound.ui, chimes: snap.data.settings.sound.chimes });
    Audio2.setVolume(snap.data.settings.sound.volume);
    applyPrefs();
    bindChrome();
    renderView();
    setInterval(applyPrefs, 60000);                                                // "auto" theme follows the clock
    setInterval(() => { if (App.view === 'home') renderView(); }, 60000);          // keep relative times fresh
    setInterval(() => { if (App.ambience) nook.invoke('ambient:minute'); }, 60000);
    if (!snap.data.onboarded) setTimeout(() => App.startTour(), 600);
  });

  /* ---------------- theme + language (one place, every render) ---------------- */
  function applyPrefs() {
    const s = App.state.data && App.state.data.settings;
    if (!s) return;
    NookI18n.setLang(NookPrefs.normLang(s.language));
    NookPrefs.applyToDocument(document, s, !!App.state.systemDark);
    if (langApplied !== NookI18n.getLang()) { langApplied = NookI18n.getLang(); buildChrome(); }
  }

  /* ---------------- chrome: titlebar + sidebar ---------------- */
  function buildChrome() {
    document.title = 'StudyNook';
    const mark = document.getElementById('brand-mark');
    mark.innerHTML = ''; mark.appendChild(N.icon('book-open', 14));
    const bmin = document.getElementById('btn-min'), bclose = document.getElementById('btn-close');
    bmin.innerHTML = ''; bmin.appendChild(N.icon('minus', 16)); bmin.title = t('win.minimize'); bmin.setAttribute('aria-label', t('win.minimize'));
    bclose.innerHTML = ''; bclose.appendChild(N.icon('x', 16)); bclose.title = t('win.hide'); bclose.setAttribute('aria-label', t('win.hide'));
    const side = document.getElementById('sidebar');
    side.innerHTML = '';
    side.setAttribute('aria-label', t('nav.label'));
    for (const [view, ico, key] of NAV) {
      side.appendChild(N.el('button', {
        class: 'navbtn' + (App.view === view ? ' active' : ''), type: 'button', 'data-view': view, title: t(key),
        'aria-current': App.view === view ? 'page' : null, onclick: () => App.go(view)
      }, N.icon(ico, 20), N.el('span', { class: 'nav-lbl', text: t(key) })));
    }
    side.appendChild(N.el('div', { class: 'side-status' },
      N.el('div', { class: 'status-line', id: 'st-guard' }),
      N.el('div', { class: 'status-line', id: 'st-ext' })));
  }
  function bindChrome() {
    document.getElementById('btn-min').addEventListener('click', () => nook.invoke('win:min'));
    document.getElementById('btn-close').addEventListener('click', () => {
      nook.invoke('win:close').then((ok) => { if (ok) App.toast(t('toast.hidden.t'), t('toast.hidden.d')); });
    });
    document.addEventListener('click', (e) => { if (e.target.closest('button')) Audio2.click(); }, true);
  }
  App.go = function (view, opts) {
    App.view = view;
    App.viewOpts = opts || {};
    document.querySelectorAll('.navbtn').forEach((b) => {
      const on = b.dataset.view === view;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    renderView();
    document.getElementById('view').scrollTop = 0;
  };
  App.render = function () { renderView(); };

  function paintStatus() {
    const S = App.state, d = S.data;
    const lp = NookProgress.levelProgress(d.xp);
    const lvl = document.getElementById('chip-level');
    lvl.innerHTML = '';
    lvl.title = t('chip.levelTitle', { title: App.levelTitle(lp.level), into: NookI18n.num(lp.into), need: NookI18n.num(lp.need) });
    lvl.append(N.icon('award', 14), N.el('span', { text: t('chip.level', { n: NookI18n.num(lp.level) }) }), N.el('span', { class: 'bar' }, N.el('span', { style: 'width:' + Math.round(lp.pct * 100) + '%' })));
    const st = document.getElementById('chip-streak');
    st.innerHTML = '';
    st.title = t('chip.streakTitle');
    st.append(N.icon('flame', 14), N.el('span', { class: 'tnum', text: NookI18n.num(d.streak.current) }));

    const g = d.settings.guardian;
    const gEl = document.getElementById('st-guard');
    if (gEl) {
      const armed = S.guardian.armed, paused = S.guardian.pausedMinLeft > 0;
      const txt = armed ? t('status.guard.armed') : paused ? t('status.guard.paused', { n: S.guardian.pausedMinLeft }) : g.enabled ? t('status.guard.idle') : t('status.guard.off');
      gEl.innerHTML = '';
      gEl.title = t('status.guard') + ': ' + txt;
      gEl.append(N.el('i', { class: 'dot' + (armed ? ' on' : paused ? ' warn' : '') }), N.el('span', {}, t('status.guard') + ' · ', N.el('b', { text: txt })));
    }
    const eEl = document.getElementById('st-ext');
    if (eEl) {
      const err = !!S.ext.bridgeError, on = S.ext.connected;
      const txt = err ? t('status.ext.error') : on ? t('status.ext.on') : t('status.ext.off');
      eEl.innerHTML = '';
      eEl.title = t('status.ext') + ': ' + txt;
      eEl.append(N.el('i', { class: 'dot' + (err ? ' bad' : on ? ' on' : '') }), N.el('span', {}, t('status.ext') + ' · ', N.el('b', { text: txt })));
    }
  }

  /* ---------------- router ---------------- */
  function renderView() {
    if (!App.state.data) return;
    const active = document.activeElement;
    const focusSel = active && active.dataset && active.dataset.draft ? '[data-draft="' + CSS.escape(active.dataset.draft) + '"]' : active && active.id ? '#' + CSS.escape(active.id) : null;
    const caret = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    const v = document.getElementById('view');
    const scroll = v.scrollTop;
    // Anything typed but not sent yet (new task, note text, a source link…) survives the rebuild.
    const drafts = {};
    v.querySelectorAll('[data-draft]').forEach((f) => { drafts[f.dataset.draft] = f.value; });
    v.innerHTML = '';
    const page = N.el('div', { class: 'page' });
    const fn = { home: Views.home, tasks: Views.tasks, notes: Views.notes, apps: Views.apps, sites: Views.sites, garden: Views.garden, settings: Views.settings, help: Views.help }[App.view] || Views.home;
    fn(page);
    v.appendChild(page);
    v.scrollTop = scroll;
    restoreDrafts(v, drafts);
    paintStatus();
    if (focusSel) {
      const el2 = document.querySelector(focusSel);
      if (el2) { el2.focus(); try { if (caret !== null) el2.setSelectionRange(caret, caret); } catch (e) {} }
    }
  }

  /** Put typed-but-unsent values back into the rebuilt page. A source-link box that was open
      (it is hidden until you click "Add source") is reopened if it holds text. */
  function restoreDrafts(root, drafts) {
    root.querySelectorAll('[data-draft]').forEach((f) => {
      const k = f.dataset.draft;
      if (!(k in drafts) || drafts[k] === f.value) return;
      f.value = drafts[k];
      if (f.hasAttribute('data-draft-sync')) f.dispatchEvent(new Event('change'));   // steppers keep their value in a closure
      const hidden = f.closest('.hidden');
      if (hidden && f.value) hidden.classList.remove('hidden');
    });
  }

  /* ---------------- shared session helpers (one source of truth) ---------------- */
  const Iron = window.NookIron;
  App.ironFocusOn = function () {
    const ses = App.state.session || {}, tm = App.state.data.settings.timer;
    if (!(ses.active && ses.phase === 'focus')) return false;
    return Iron.isLocked(tm.ironLockedUntil, Date.now()) || !!ses.iron;
  };
  App.listsFrozen = function () {
    const ses = App.state.session || {}, tm = App.state.data.settings.timer;
    return Iron.listsFrozenState(!!(ses.active && ses.phase === 'focus' && ses.iron), Iron.isLocked(tm.ironLockedUntil, Date.now()));
  };
  App.levelTitle = function (level) {
    const idx = Math.min(NookProgress.TITLES.length - 1, Math.floor((level - 1) / 3));
    return t('level.title.' + idx);
  };
  App.stageName = function (i) { return t('stage.' + i + '.name'); };
  App.STAGE_ICONS = ['egg', 'baby', 'cat', 'book-open', 'graduation-cap', 'crown'];

  /* ---------------- companion mood ---------------- */
  App.mood = function () {
    if (App.moodOverride && App.moodOverride.until > Date.now()) return App.moodOverride.mood;
    const s = App.state.session;
    if (!s || !s.active || !s.running) return 'idle';
    return s.phase === 'focus' ? 'focus' : 'break';
  };
  App.moodLine = function () { return t('mood.' + App.mood(), { name: App.state.data.pet.name }); };

  /* ---------------- ambience ---------------- */
  App.setAmbience = function (id) {
    App.ambience = id === 'off' ? null : id;
    if (App.ambience) Audio2.startAmbience(App.ambience); else Audio2.stopAmbience();
    renderView();
  };

  /* ---------------- events from the engine ---------------- */
  function onSessionEvent(ev) {
    if (ev.kind === 'focus-complete') {
      Audio2.chime();
      App.moodOverride = { mood: 'celebrate', until: Date.now() + 12000 };
      App.toast(t('toast.focusDone.t', { xp: ev.xp }), t('toast.focusDone.d', { min: NookI18n.minutes(ev.minutes) }), { kind: 'success' });
    } else if (ev.kind === 'break-end') {
      Audio2.chimeSoft();
      App.toast(t('toast.breakDone.t'), t('toast.breakDone.d'));
    } else if (ev.kind === 'abandon') {
      App.moodOverride = { mood: 'sad', until: Date.now() + 45000 };
      App.toast(t('toast.ended.t'), ev.minutes > 0 ? t('toast.ended.d', { min: NookI18n.minutes(ev.minutes) }) : t('toast.ended.none'));
    }
    renderView();
  }
  function onReward(ev) {
    if (ev.kind === 'achievement') { Audio2.pop(); App.toast(t('toast.achievement', { name: t('ach.' + ev.id + '.name') }), t('ach.' + ev.id + '.desc'), { kind: 'success', icon: 'trophy' }); }
    else if (ev.kind === 'levelup') { Audio2.chimeSoft(); App.toast(t('toast.levelup', { n: ev.level }), App.levelTitle(ev.level), { kind: 'success', icon: 'award' }); }
    else if (ev.kind === 'stageup') { Audio2.chime(); App.moodOverride = { mood: 'celebrate', until: Date.now() + 12000 }; App.toast(App.stageName(ev.stage.id), t('stage.' + ev.stage.id + '.blurb'), { kind: 'success', icon: App.STAGE_ICONS[ev.stage.id] }); }
    renderView();
  }
  function onGuard(ev) {
    if (ev.type === 'kill') App.toast(t('toast.closedApp.t', { app: ev.label }), t('toast.closedApp.d', { n: ev.count }));
    else if (ev.type === 'warn') App.toast(t('toast.warnApp.t', { app: ev.label }), t('toast.warnApp.d'), { kind: 'warning' });
    renderView();
  }

  /* ---------------- toasts ---------------- */
  App.toast = function (title, desc, opts) {
    opts = opts || {};
    const kind = opts.kind || 'info';
    const ico = opts.icon || (kind === 'success' ? 'circle-check' : kind === 'warning' ? 'triangle-alert' : 'info');
    const el = N.el('div', { class: 'toast ' + kind }, N.icon(ico, 18),
      N.el('div', { class: 'grow' }, N.el('div', { class: 'toast-title', text: title }), desc ? N.el('div', { class: 'toast-body', text: desc }) : null));
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 200); }, opts.ms || 5000);
  };

  /* ---------------- modal & confirm ---------------- */
  App.modal = function (title, bodyNode, buttons) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const m = N.el('div', { class: 'modal' }, N.el('h3', { text: title }), bodyNode);
    const row = N.el('div', { class: 'modal-actions' });
    for (const b of buttons || []) row.appendChild(N.btn(b.label, { cls: b.cls || '', onclick: b.fn }));
    m.appendChild(row);
    root.appendChild(m);
    root.classList.add('open');
    root.onclick = (e) => { if (e.target === root) App.closeModal(); };
    const first = m.querySelector('input, textarea, .modal-actions .btn:last-child');
    if (first) first.focus();
    return m;
  };
  App.closeModal = function () { const r = document.getElementById('modal-root'); r.classList.remove('open'); r.innerHTML = ''; };
  App.confirm = function (title, text, onYes, yesLabel) {
    App.modal(title, N.el('p', { class: 'small', text }), [
      { label: t('common.cancel'), cls: 'btn-ghost', fn: () => App.closeModal() },
      { label: yesLabel || t('common.confirm'), cls: 'btn-danger-solid', fn: () => { App.closeModal(); onYes(); } }
    ]);
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.getElementById('modal-root').classList.contains('open')) App.closeModal(); });

  /* ---------------- Iron gate (cool-down + typed sentence) ---------------- */
  App.ironGate = function (onPass) {
    const S = t('iron.sentence');
    let left = Iron.COOLDOWN_SEC || 60;
    const cd = N.el('div', { class: 'gate-count', text: String(left) });
    const inp = N.el('input', { class: 'input', style: 'width:100%', placeholder: t('iron.gate.placeholder'), 'aria-label': t('iron.gate.placeholder') });
    const body = N.el('div', {},
      N.el('p', { class: 'small', text: t('iron.gate.intro') }), cd,
      N.el('p', { class: 'small', text: t('iron.gate.type') }),
      N.el('code', { class: 'gate-sentence', text: S }), inp);
    let iv = null;
    const done = () => { if (iv) clearInterval(iv); App.closeModal(); };
    const m = App.modal(t('iron.gate.title'), body, [
      { label: t('iron.gate.stay'), cls: 'btn-primary', fn: done },
      { label: t('iron.gate.end'), cls: 'btn-danger', fn: () => { done(); nook.invoke('iron:passed'); onPass(); } }
    ]);
    const endBtn = m.querySelector('.modal-actions .btn:last-child');
    endBtn.disabled = true;
    const check = () => { endBtn.disabled = !(left <= 0 && Iron.matches(inp.value, S)); };
    iv = setInterval(() => { left = Math.max(0, left - 1); cd.textContent = String(left); check(); }, 1000);
    inp.addEventListener('input', check);
    inp.focus();
  };

  /* ---------------- welcome tour ---------------- */
  const TOUR = [['book-open', 'tour.1'], ['timer', 'tour.2'], ['cat', 'tour.3'], ['app-window', 'tour.4'], ['globe', 'tour.5'], ['chart-column', 'tour.6']];
  App.startTour = function () {
    let i = 0;
    const root = document.getElementById('tour-root');
    root.classList.add('open');
    const end = () => { root.classList.remove('open'); root.innerHTML = ''; nook.invoke('onboarding:done'); };
    const draw = () => {
      root.innerHTML = '';
      const [ico, key] = TOUR[i];
      const last = i === TOUR.length - 1;
      root.appendChild(N.el('div', { class: 'tour' },
        N.el('div', { class: 'item-icon' }, N.icon(ico, 24)),
        N.el('h3', { text: t(key + '.t') }),
        N.el('p', { text: t(key + '.d') }),
        N.el('div', { class: 'tour-dots' }, ...TOUR.map((_, k) => N.el('i', { class: k === i ? 'on' : '' }))),
        N.el('div', { class: 'row', style: 'justify-content:center' },
          N.btn(t('tour.skip'), { cls: 'btn-ghost', onclick: end }),
          i > 0 ? N.btn(t('common.back'), { onclick: () => { i--; draw(); } }) : null,
          N.btn(last ? t('tour.finish') : t('common.next'), { cls: 'btn-primary', onclick: () => { if (last) end(); else { i++; draw(); } } }))));
    };
    draw();
  };

  return App;
})();
