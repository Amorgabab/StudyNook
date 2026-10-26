/* StudyNook · mini.js — always-on-top session pill (display only;
   click opens the main window). Follows the app's theme + language. */
'use strict';
(function () {
  const STAGE_ICONS = ['egg', 'baby', 'cat', 'book-open', 'graduation-cap', 'crown'];
  const pill = document.getElementById('pill');
  const time = document.getElementById('time');
  const lbl = document.getElementById('lbl');
  const stage = document.getElementById('stage');
  let shownStage = -1;

  function paint(st) {
    if (!st || !st.active) return;
    time.textContent = N.fmt(st.remainingSec);
    const phase = st.phase === 'focus' ? t('phase.focus') : st.phase === 'short' ? t('phase.short') : t('phase.long');
    lbl.textContent = st.running ? phase : t('phase.paused', { phase });
    pill.classList.toggle('brk', st.phase !== 'focus');
  }
  function apply(s) {
    if (!s || !s.data) return;
    NookI18n.setLang(NookPrefs.normLang(s.data.settings.language));
    NookPrefs.applyToDocument(document, s.data.settings, !!s.systemDark);
    pill.title = t('mini.open');
    if (s.data.pet.stage !== shownStage) {
      shownStage = s.data.pet.stage;
      stage.innerHTML = '';
      stage.appendChild(N.icon(STAGE_ICONS[shownStage] || 'egg', 16));
    }
    paint(s.session);
  }

  nook.on('tick', paint);
  nook.on('snapshot', apply);
  nook.invoke('get-snapshot').then(apply);
  // pull the state every second in case a push event is missed
  setInterval(() => { nook.invoke('get-snapshot').then(apply).catch(() => {}); }, 1000);
  pill.addEventListener('click', () => nook.invoke('win:show-main'));
})();
