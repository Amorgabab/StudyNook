/* ============================================================
   StudyNook · views-misc.js — Settings & Help
   ============================================================ */
'use strict';
window.Views = window.Views || {};

/* ---------- settings ---------- */
Views.settings = function (c) {
  const d = App.state.data, s = d.settings;
  const grid = N.el('div', { class: 'set-grid' });

  /* profile */
  const prof = N.el('div', { class: 'card' });
  prof.appendChild(N.el('h2', { text: 'You & your pet' }));
  prof.appendChild(setRow('Your name', 'Shown in greetings', textInput(d.profile.name, (v) => nook.invoke('profile:set', { name: v }))));
  prof.appendChild(setRow('Pet name', 'Yes, you can rename Mochi', textInput(d.pet.name, (v) => nook.invoke('pet:rename', { name: v }))));
  grid.appendChild(prof);

  /* subjects */
  const subjCard = N.el('div', { class: 'card' });
  subjCard.appendChild(N.el('h2', { text: 'Subjects' }));
  subjCard.appendChild(N.el('div', { class: 'sub', text: 'Used by the dropdown when adding tasks.' }));
  const chips = N.el('div', { class: 'chips' });
  for (const s of (d.subjects || [])) {
    chips.appendChild(N.el('span', { class: 'domain-chip' }, s, N.el('button', { text: '✕', title: 'remove', onclick: () => nook.invoke('subjects:set', { list: (d.subjects || []).filter((x) => x !== s) }) })));
  }
  subjCard.appendChild(chips);
  const srow = N.el('div', { class: 'row mt' });
  const sinp = N.el('input', { class: 'input', placeholder: 'add subject…', style: 'flex:1' });
  sinp.addEventListener('keydown', (e) => { if (e.key === 'Enter') addSubj(); });
  srow.append(sinp, N.el('button', { class: 'btn btn-sm btn-sage', text: '+ Add', onclick: addSubj }));
  subjCard.appendChild(srow);
  grid.appendChild(subjCard);
  function addSubj() {
    const v = sinp.value.trim();
    if (!v) return;
    nook.invoke('subjects:set', { list: [...(d.subjects || []), v] });
    sinp.value = '';
  }

  /* timer */
  const tim = N.el('div', { class: 'card' });
  tim.appendChild(N.el('h2', { text: '⏱ Timer' }));
  tim.appendChild(setRow('Focus length', 'minutes per round', numInput(s.timer.workMin, 5, 180, (v) => setT({ workMin: v }))));
  tim.appendChild(setRow('Short break', 'minutes', numInput(s.timer.shortMin, 1, 60, (v) => setT({ shortMin: v }))));
  tim.appendChild(setRow('Long break', 'minutes', numInput(s.timer.longMin, 5, 90, (v) => setT({ longMin: v }))));
  tim.appendChild(setRow('Rounds per plan', 'then a long break', numInput(s.timer.rounds, 2, 12, (v) => setT({ rounds: v }))));
  tim.appendChild(setRow('Auto-start breaks', 'slide into rest without clicking', toggleInput(s.timer.autoStartBreaks, (v) => setT({ autoStartBreaks: v }))));
  tim.appendChild(setRow('Auto-start next round', 'for the truly unstoppable', toggleInput(s.timer.autoStartFocus, (v) => setT({ autoStartFocus: v }))));
  tim.appendChild(setRow('Strict mode', 'ending early = zero XP for that round', toggleInput(s.timer.strict, (v) => setT({ strict: v }))));
  const ironLocked = window.NookIron && NookIron.isLocked(s.timer.ironLockedUntil, Date.now());
  tim.appendChild(setRow('Iron session',
    ironLocked
      ? 'your own rule: this switch stays locked for ' + NookIron.remainingHms(s.timer.ironLockedUntil, Date.now())
      : 'no pause anywhere while focusing; ending early = 60s cool-down + typed sentence',
    ironLocked
      ? N.el('span', { class: 'pill warn', text: '🔒 locked ' + NookIron.remainingHms(s.timer.ironLockedUntil, Date.now()) })
      : toggleInput(s.timer.iron, (v) => setT({ iron: v }))));
  tim.appendChild(setRow('Iron lock duration', 'how long the switch stays locked after you enable Iron (1-30 days)',
    N.el('span', { class: 'row', style: 'gap:4px' },
      N.stepper(s.timer.ironLockDays || 4, 1, 30, (v) => setT({ ironLockDays: v })),
      N.el('span', { class: 'small', text: 'days' }))));
  grid.appendChild(tim);

  /* sound & looks */
  const snd = N.el('div', { class: 'card' });
  snd.appendChild(N.el('h2', { text: '🎧 Sound & looks' }));
  snd.appendChild(N.el('div', { class: 'sub', text: 'Real ambience: drop rain.mp3 / fire.mp3 / waves.mp3 / cafe.mp3 into the sounds folder (button below creates/opens it). Synthesized versions play until then.' }));
  snd.appendChild(N.el('div', { class: 'small', style: 'margin-bottom:8px', text: App.state.soundsPath || '' }));
  snd.appendChild(setRow('UI sounds', 'clicks & pops', toggleInput(s.sound.ui, (v) => { setSnd({ ui: v }); Audio2.setEnabled({ ui: v, chimes: s.sound.chimes }); })));
  snd.appendChild(setRow('Chimes', 'session start/finish bells', toggleInput(s.sound.chimes, (v) => { setSnd({ chimes: v }); Audio2.setEnabled({ ui: s.sound.ui, chimes: v }); })));
  snd.appendChild(setRow('Theme', 'auto follows the time of day', segInput(['auto', 'light', 'dark'], s.theme, (v) => nook.invoke('settings:set', { section: 'theme', values: v }))));
  snd.appendChild(setRow('Mini floating timer', 'tiny always-on-top pill during sessions', toggleInput(s.miniWindow, (v) => nook.invoke('settings:set', { section: 'miniWindow', values: v }))));
  grid.appendChild(snd);

  /* guardian extras */
  const gcard = N.el('div', { class: 'card' });
  gcard.appendChild(N.el('h2', { text: '🛟 Safety & emergency' }));
  gcard.appendChild(N.el('div', { class: 'sub', text: 'StudyNook never touches system processes (see app/shared/catalog.js → NEVER_KILL). If you ever need a blocked app:' }));
  const btns = N.el('div', { class: 'row' });
  for (const m of [5, 15, 60]) btns.appendChild(N.el('button', { class: 'btn btn-sm', text: `pause guard ${m} min`, onclick: () => nook.invoke('guardian:pause', { min: m }) }));
  gcard.appendChild(btns);
  gcard.appendChild(N.el('div', { class: 'small mt', text: '…or click "Leave it open 5 min" on any warning card, or quit StudyNook from the tray (guard stops instantly).' }));
  grid.appendChild(gcard);

  /* data */
  const data = N.el('div', { class: 'card' });
  data.appendChild(N.el('h2', { text: 'Export & backups' }));
  data.appendChild(N.el('div', { class: 'sub', text: 'Everything lives in one readable file: data/data.json. A backup is saved automatically once a day (last 7 kept).' }));
  const drow = N.el('div', { class: 'row' });
  drow.appendChild(N.el('button', { class: 'btn btn-sm', text: 'Export backup (download)', onclick: exportData }));
  drow.appendChild(N.el('button', { class: 'btn btn-sm', text: 'Import backup', onclick: importData }));
  drow.appendChild(N.el('button', { class: 'btn btn-sm', text: 'Back up now', onclick: () => nook.invoke('data:backupNow').then((r) => App.toast('Backup saved', r.name)) }));
  data.appendChild(drow);
  const drow2 = N.el('div', { class: 'row mt' });
  drow2.appendChild(N.el('button', { class: 'btn btn-sm btn-ghost', text: 'Open backups folder', onclick: () => nook.invoke('data:openBackups') }));
  drow2.appendChild(N.el('button', { class: 'btn btn-sm btn-ghost', text: 'Open data folder', onclick: () => nook.invoke('data:openFolder') }));
  drow2.appendChild(N.el('button', { class: 'btn btn-sm btn-ghost', text: 'Open sounds folder', onclick: () => nook.invoke('data:openSounds') }));
  drow2.appendChild(N.el('button', { class: 'btn btn-sm btn-danger', text: 'Reset everything', onclick: () => App.confirm('Reset ALL data?', 'XP, pet, streaks, tasks, notes, lists — everything returns to defaults. Backups are kept in data/backups.', () => nook.invoke('data:reset')) }));
  data.appendChild(drow2);
  grid.appendChild(data);

  /* about */
  const about = N.el('div', { class: 'card' });
  about.appendChild(N.el('h2', { text: 'About' }));
  about.appendChild(N.el('div', { class: 'sub', text: 'StudyNook v' + (App.state.appVersion || '1.5') + ' · local-first: no accounts, no cloud, no telemetry.' }));
  const arow = N.el('div', { class: 'row' });
  arow.appendChild(N.el('button', { class: 'btn btn-sm', text: '📖 Open README', onclick: () => nook.invoke('help:readme') }));
  arow.appendChild(N.el('button', { class: 'btn btn-sm', text: '🎓 Replay welcome tour', onclick: () => App.startTour() }));
  about.appendChild(arow);
  grid.appendChild(about);

  c.appendChild(grid);

  /* helpers */
  function setRow(lbl, hint, control) {
    return N.el('div', { class: 'set-row' }, N.el('div', {}, N.el('div', { class: 'lbl', text: lbl }), N.el('div', { class: 'hint', text: hint })), control);
  }
  function textInput(val, onSet) {
    const i = N.el('input', { class: 'input', value: val || '', style: 'width:160px' });
    i.addEventListener('change', () => onSet(i.value.trim()));
    return i;
  }
  function numInput(val, min, max, onSet) {
    return N.stepper(val, min, max, onSet);
  }
  function toggleInput(val, onSet) { return N.el('button', { class: 'toggle' + (val ? ' on' : ''), onclick: () => onSet(!val) }); }
  function segInput(opts, cur, onSet) {
    const s2 = N.el('div', { class: 'seg' });
    for (const o of opts) s2.appendChild(N.el('button', { class: cur === o ? 'on sage' : '', text: o, onclick: () => onSet(o) }));
    return s2;
  }
  function setT(patch) { nook.invoke('settings:set', { section: 'timer', values: patch }); }
  function setSnd(patch) { nook.invoke('settings:set', { section: 'sound', values: patch }); }
  function exportData() {
    nook.invoke('data:export').then((json) => {
      const blob = new Blob([json], { type: 'application/json' });
      const a = N.el('a', { href: URL.createObjectURL(blob), download: 'studynook-backup.json' });
      document.body.appendChild(a); a.click(); a.remove();
      App.toast('Backup downloaded', 'studynook-backup.json');
    });
  }
  function importData() {
    const ta = N.el('textarea', { class: 'input', style: 'width:100%;height:180px;font-family:monospace;font-size:11px', placeholder: 'paste backup JSON here' });
    App.modal('Import backup', ta, [
      { label: 'Import', cls: 'btn-primary', fn: () => { nook.invoke('data:import', { json: ta.value }).then((ok) => { App.closeModal(); App.toast(ok ? 'Backup imported' : 'Import failed', ok ? 'Your data was restored.' : 'That JSON could not be read.'); }); } },
      { label: 'Cancel', cls: 'btn-ghost', fn: () => App.closeModal() }
    ]);
  }
};

Views.help = function (c) {
  const cards = [
    ['🌱', '1 · Start a focus session', 'On the <b>Nook</b> tab pick a task (optional) and press <b>Start focusing</b>. Pomodoro mode runs rounds of focus with breaks; Free mode is one long stretch. The timer lives in the background — hide the window and it keeps going.'],
    ['🧸', '2 · Block distracting apps', 'On the <b>Apps</b> tab turn the guard on and add apps (one click from the library, or scan what\'s running). <b>Blocklist</b> closes only listed apps; <b>Allowlist</b> closes everything except your safe list. <b>Gentle</b> style shows a warning card with a countdown before closing anything.'],
    ['🌐', '3 · Block distracting tabs', 'On the <b>Sites</b> tab set your lists, then load the bundled extension once (chrome://extensions → Developer mode → Load unpacked → the app\'s <b>extension/</b> folder) and pair it with the 6-letter code. After that, blocked sites redirect to a cozy napping page during focus.'],
    ['🐱', '4 · Grow Mochi & your garden', 'Every focused minute feeds your pet: egg → baby → kitten → study cat → scholar → legend. You also earn XP, levels, streaks, trophies and garden plants (🌱🌿🌷🌳) for each day you study.'],
    ['📅', '5 · Plan the week', 'On the <b>Schedule</b> tab add repeating study blocks ("Mon + Wed · Math · 45m at 18:00"). No checkboxes to tick — when you finish focus sessions, StudyNook fills the plan-vs-focus bars automatically, so slipping one day never means losing the whole week. You can also assign individual tasks to a day with the <b>"Plan for"</b> picker on the Tasks tab — the "This week" strip shows what to study each day.'],
    ['🛟', '6 · Safety & emergency stops', 'StudyNook refuses to close system processes, and in gentle mode you always get a warning first. Need a blocked app? Click <b>"Leave it open 5 min"</b> on the warning, use <b>"let me breathe"</b> on the Apps tab, or quit from the tray — the guard stops instantly.'],
    ['💾', '7 · Your data stays home', 'Everything is stored in <b>data/data.json</b> inside the app folder — plain, readable JSON. Export/import backups from Settings. The localhost bridge (port 47470) only talks to your paired extension.']
  ];
  const grid = N.el('div', { class: 'set-grid' });
  for (const [e, h, p] of cards) {
    grid.appendChild(N.el('div', { class: 'card help-card' }, N.el('div', { class: 'n', text: e }), N.el('div', {}, N.el('h3', { text: h }), N.el('p', { html: p }))));
  }
  c.appendChild(grid);

  const faq = N.el('div', { class: 'card mt' });
  faq.appendChild(N.el('h2', { text: '❓ Quick FAQ' }));
  const rows = [
    ['Will it close something important?', 'No — a built-in NEVER_KILL list protects Windows/macOS/Linux system processes, plus anything on your allow list and anything you granted "5 min" to.'],
    ['Extension says "not connected"?', 'Make sure StudyNook is running, the pairing code matches Settings → Sites, and you loaded the extension from THIS app\'s extension/ folder. The popup has a "sync now" button.'],
    ['Timer disappeared?', 'It\'s in the tray icon (bottom-right) and in the mini floating pill. Click the tray → Open StudyNook.'],
    ['Can I use it without the extension?', 'Yes! App blocking + timer + rewards all work offline. The extension only adds tab blocking (and it works standalone too).'],
    ['Sounds not playing?', 'Click anywhere once (browsers require a gesture before audio), then toggle ambience again.']
  ];
  for (const [q, a] of rows) faq.appendChild(N.el('div', { class: 'set-row' }, N.el('div', {}, N.el('div', { class: 'lbl', text: q }), N.el('div', { class: 'hint', style: 'margin-top:4px', text: a }))));
  c.appendChild(faq);


};
