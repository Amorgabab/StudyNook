/* ============================================================
   StudyNook · app.js — UI bootstrap: state, router, events,
   toasts, modals, onboarding tour, theme
   ============================================================ */
'use strict';
window.App = (function () {
  const state0 = { data: null, session: null, guardian: null, ext: null };
  const App = {
    state: state0,
    view: 'home',
    freeMode: false,
    freeMin: 25,
    lastTaskId: null,
    taskFilter: 'open',
    appsTab: 'block',
    ambience: null,
    moodOverride: null,      // {mood, until}
    render() { renderView(); }
  };

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    bindChrome();
    nook.on('snapshot', (s) => { App.state = s; applyTheme(); renderView(true); });
    nook.on('tick', (st) => { App.state.session = st; Views.homeTick && Views.homeTick(st); });
    nook.on('session-event', onSessionEvent);
    nook.on('reward', onReward);
    nook.on('guard', onGuard);
    nook.on('iron-gate', () => App.ironGate(() => nook.invoke('win:close')));
    nook.on('close-blocked', () => App.toast('Session running — the nook stays open', 'Finish or end the session to close StudyNook. Pause first if you need to step away.'));
    nook.on('data-blocked', () => App.toast('Data is locked while a session runs', 'Reset/import are refused until the session ends. Your progress is safe.'));
    const snap = await nook.invoke('get-snapshot');
    App.state = snap;
    Audio2.setEnabled({ ui: snap.data.settings.sound.ui, chimes: snap.data.settings.sound.chimes });
    Audio2.setVolume(snap.data.settings.sound.volume);
    applyTheme();
    renderView();
    setInterval(updateGreeting, 30000); updateGreeting();
    setInterval(reportAmbient, 60000);
    setInterval(() => { if (App.view === 'home') renderView(true); }, 60000); // keep feed times fresh
    if (!snap.data.onboarded) setTimeout(() => App.startTour(), 600);
  });

  function bindChrome() {
    document.querySelectorAll('.navbtn').forEach((b) => {
      b.addEventListener('click', () => {
        Audio2.click();
        App.view = b.dataset.view;
        document.querySelectorAll('.navbtn').forEach((x) => x.classList.toggle('active', x === b));
        renderView();
      });
    });
    document.getElementById('btn-min').addEventListener('click', () => nook.invoke('win:min'));
    document.getElementById('btn-close').addEventListener('click', () => {
      nook.invoke('win:close');
      App.toast('Hidden to tray', 'Timer and guard keep running. Click the tray icon to reopen.');
    });
    document.addEventListener('click', (e) => { if (e.target.closest('button')) Audio2.click(); }, true);
  }

  /* ---------------- theme & greeting ---------------- */
  function applyTheme() {
    const s = App.state.data && App.state.data.settings;
    if (!s) return;
    const h = N.hour();
    const tod = h < 6 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'day' : h < 21 ? 'evening' : 'night';
    document.body.dataset.tod = tod;
    document.body.dataset.theme = s.theme === 'auto' ? (tod === 'night' ? 'dark' : 'light') : s.theme;
  }
  function updateGreeting() {
    const h = N.hour();
    const name = App.state.data && App.state.data.profile.name;
    const g = h < 5 ? 'late night session' : h < 12 ? 'good morning' + (name ? ', ' + name : '') : h < 18 ? 'good afternoon' + (name ? ', ' + name : '') : h < 22 ? 'good evening' + (name ? ', ' + name : '') : 'night session';
    document.getElementById('tb-greet').textContent = '· ' + g;
  }

  /* ---------------- render router ---------------- */
  function renderView(soft) {
    if (!App.state.data) return;
    const active = document.activeElement;
    const focusKey = active && active.id ? active.id : null;
    const caret = active && active.selectionStart !== undefined ? active.selectionStart : null;

    const c = document.getElementById('view');
    c.innerHTML = '';
    if (App.view === 'home') Views.home(c);
    else if (App.view === 'tasks') Views.tasks(c);
    else if (App.view === 'schedule') Views.schedule(c);
    else if (App.view === 'notes') Views.notes(c);
    else if (App.view === 'apps') Views.apps(c);
    else if (App.view === 'sites') Views.sites(c);
    else if (App.view === 'garden') Views.garden(c);
    else if (App.view === 'settings') Views.settings(c);
    else if (App.view === 'help') Views.help(c);

    // titlebar chips + sidebar pills
    const d = App.state.data;
    const lp = NookProgress.levelProgress(d.xp);
    document.getElementById('chip-level').textContent = `Lv ${lp.level} · ${lp.title}`;
    document.getElementById('chip-streak').textContent = '🔥 ' + d.streak.current;
    document.getElementById('xp-fill').style.width = Math.round(lp.pct * 100) + '%';
    const gp = document.getElementById('pill-guard');
    const g = d.settings.guardian;
    gp.textContent = App.state.guardian.armed ? 'guard: active' : (App.state.guardian.pausedMinLeft > 0 ? `guard: paused ${App.state.guardian.pausedMinLeft}m` : g.enabled ? 'guard: idle' : 'guard: off');
    gp.className = 'pill' + (App.state.guardian.armed ? ' on' : App.state.guardian.pausedMinLeft > 0 ? ' warn' : '');
    const ep = document.getElementById('pill-ext');
    ep.textContent = App.state.ext.bridgeError ? 'bridge: error' : App.state.ext.connected ? 'extension: on' : 'extension: off';
    ep.className = 'pill' + (App.state.ext.bridgeError ? ' warn' : App.state.ext.connected ? ' on' : '');

    if (focusKey) {
      const el2 = document.getElementById(focusKey);
      if (el2) { el2.focus(); try { if (caret !== null) el2.setSelectionRange(caret, caret); } catch (e) {} }
    }
    void soft;
  }

  /* ---------------- pet mood ---------------- */
  App.mood = function () {
    if (App.moodOverride && App.moodOverride.until > Date.now()) return App.moodOverride.mood;
    const s = App.state.session;
    if (!s || !s.active) return 'idle';
    if (!s.running) return 'idle';
    return s.phase === 'focus' ? 'focus' : 'break';
  };
  App.moodLine = function () {
    const m = App.mood();
    const name = App.state.data.pet.name;
    return {
      idle: name + ' is waiting.',
      focus: name + ' is focusing with you.',
      break: name + ' is resting. You should too.',
      celebrate: name + ' is proud of you.',
      sad: name + ' misses you. It\'s okay.'
    }[m] || '';
  };

  /* ---------------- ambience ---------------- */
  App.setAmbience = function (id) {
    App.ambience = id === 'off' ? null : id;
    if (App.ambience) Audio2.startAmbience(App.ambience);
    else Audio2.stopAmbience();
    renderView(true);
  };
  function reportAmbient() { if (App.ambience) nook.invoke('ambient:minute'); }

  /* ---------------- events ---------------- */
  function onSessionEvent(ev) {
    if (ev.kind === 'focus-complete') {
      Audio2.chime();
      App.moodOverride = { mood: 'celebrate', until: Date.now() + 12000 };
      App.toast('Focus complete · +' + ev.xp + ' XP', ev.minutes + ' minutes focused.');
      renderView(true);
    } else if (ev.kind === 'break-end') {
      Audio2.chimeSoft();
      App.toast('Break finished', 'Start the next round when ready.');
      renderView(true);
    } else if (ev.kind === 'abandon') {
      App.moodOverride = { mood: 'sad', until: Date.now() + 45000 };
      App.toast('Session ended early', ev.minutes > 0 ? ev.minutes + ' focused minutes still counted.' : 'No minutes counted.');
      renderView(true);
    }
  }
  function onReward(ev) {
    if (ev.kind === 'achievement') { Audio2.pop(); App.toast('Achievement · ' + ev.name, ev.desc); }
    else if (ev.kind === 'levelup') { Audio2.chimeSoft(); App.toast('Level ' + ev.level, ev.title); }
    else if (ev.kind === 'stageup') { Audio2.chime(); App.moodOverride = { mood: 'celebrate', until: Date.now() + 12000 }; App.toast(ev.stage.name, ev.stage.blurb); }
    renderView(true);
  }
  function onGuard(ev) {
    if (ev.type === 'kill') App.toast('Closed ' + ev.label, ev.count + ' process' + (ev.count > 1 ? 'es' : '') + ' closed so you can focus.');
    else if (ev.type === 'warn') App.toast(ev.label + ' is open', 'The guard is watching it.');
    renderView(true);
  }

  /* ---------------- toasts (plain) ---------------- */
  App.toast = function (title, desc, ms = 4600) {
    const t = N.el('div', { class: 'toast' }, N.el('div', { class: 'e' }), N.el('div', {}, N.el('div', { class: 't', text: title }), desc ? N.el('div', { class: 'd', text: desc }) : null));
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, ms);
  };

  /* ---------------- iron gate (cool-down + typed sentence) ---------------- */
  App.ironGate = function (onPass) {
    const S = (window.NookIron && NookIron.SENTENCE) || 'i choose to end my focus early';
    let left = (window.NookIron && NookIron.COOLDOWN_SEC) || 60;
    const cd = N.el('div', { class: 'big-num', style: 'color:var(--rose);text-align:center', text: String(left) });
    const inp = N.el('input', { class: 'input', style: 'width:100%;font-family:Consolas,monospace', placeholder: 'type the sentence here when the gate opens' });
    const body = N.el('div', {},
      N.el('p', { class: 'small', text: 'Iron session. No pause, no quick exits. Cool down first — the gate opens in:' }),
      cd,
      N.el('p', { class: 'small mt', text: 'Then type this exactly, like confirming a deletion:' }),
      N.el('div', { class: 'mono', style: 'display:inline-block;padding:8px 12px;font-size:13px;margin-top:4px', text: S }),
      N.el('div', { class: 'mt' }, inp)
    );
    let iv = null;
    const done = () => { if (iv) clearInterval(iv); App.closeModal(); };
    App.modal('Iron gate', body, [
      { label: 'End session', cls: 'btn-danger', fn: () => { done(); nook.invoke('iron:passed'); onPass(); } },
      { label: 'Stay focused', cls: 'btn-sage', fn: () => { done(); } }
    ]);
    const conf = document.querySelector('#modal-root .row .btn');
    if (conf) conf.disabled = true;
    const check = () => { if (conf) conf.disabled = !(left <= 0 && NookIron.matches(inp.value, S)); };
    iv = setInterval(() => { left = Math.max(0, left - 1); cd.textContent = String(left); check(); }, 1000);
    inp.addEventListener('input', check);
  };

  /* ---------------- modal & confirm ---------------- */
  App.modal = function (title, bodyNode, buttons) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const m = N.el('div', { class: 'modal' }, N.el('h3', { text: title }), bodyNode);
    const row = N.el('div', { class: 'row mt', style: 'justify-content:flex-end' });
    for (const b of buttons || []) row.appendChild(N.el('button', { class: 'btn ' + (b.cls || ''), text: b.label, onclick: b.fn }));
    m.appendChild(row);
    root.appendChild(m);
    root.classList.add('open');
  };
  App.closeModal = function () { const r = document.getElementById('modal-root'); r.classList.remove('open'); r.innerHTML = ''; };
  App.confirm = function (title, text, onYes) {
    App.modal(title, N.el('p', { class: 'small', style: 'line-height:1.6', text }), [
      { label: 'Yes, do it', cls: 'btn-danger', fn: () => { App.closeModal(); onYes(); } },
      { label: 'Cancel', cls: 'btn-ghost', fn: () => App.closeModal() }
    ]);
  };

  /* ---------------- onboarding tour ---------------- */
  const TOUR = [
    ['🪺', 'Welcome to StudyNook', 'A focus timer with app and website blocking, notes, tasks and progress tracking. This tour takes about a minute. The Help tab explains everything again later.'],
    ['⏱', 'Focus sessions', 'Press Start on the Nook tab. Pomodoro runs rounds with breaks; Free focus is one stretch of any length you type in. The timer keeps running if you hide the window — see the tray icon and the mini pill.'],
    ['🐱', 'Your study pet', 'The pet grows with total focused minutes, from egg to scholar cat. Click it anytime; it likes that.'],
    ['🧸', 'App Guardian', 'On the Apps tab, list the programs that distract you. While you focus, StudyNook warns them, then closes them. System processes are always protected.'],
    ['🌐', 'Tab Guardian', 'On the Sites tab, set blocked or allowed websites, then pair the bundled Chrome extension with the 6-letter code. Blocked tabs show a waiting page instead.'],
    ['📊', 'Progress', 'Stats, streaks, achievements and a day-by-day garden live in the Garden tab. Notes and tasks are under their own tabs.'],
    ['📅', 'Week schedule', 'On the Schedule tab, plan repeating study blocks for your week. StudyNook compares what you planned with the minutes you actually focused — no checkboxes needed.']
  ];
  let tourIdx = 0;
  App.startTour = function () {
    tourIdx = 0;
    const root = document.getElementById('tour-root');
    root.classList.add('open');
    drawTour();
    function drawTour() {
      root.innerHTML = '';
      const [e, h, p] = TOUR[tourIdx];
      const card = N.el('div', { class: 'tour-card' },
        N.el('div', { class: 'e', text: e }),
        N.el('h3', { text: h }),
        N.el('p', { text: p }),
        N.el('div', { class: 'tour-dots' }, ...TOUR.map((_, i) => N.el('i', { class: i === tourIdx ? 'on' : '' }))),
        N.el('div', { class: 'row', style: 'justify-content:center;gap:10px' },
          N.el('button', { class: 'btn btn-ghost', text: 'Skip', onclick: end }),
          tourIdx > 0 ? N.el('button', { class: 'btn', text: 'Back', onclick: () => { tourIdx--; drawTour(); } }) : null,
          N.el('button', { class: 'btn btn-primary', text: tourIdx === TOUR.length - 1 ? 'Start using it' : 'Next', onclick: () => { if (tourIdx === TOUR.length - 1) end(); else { tourIdx++; drawTour(); } } })
        )
      );
      root.appendChild(card);
    }
    function end() {
      root.classList.remove('open');
      root.innerHTML = '';
      nook.invoke('onboarding:done');
    }
  };

  return App;
})();
