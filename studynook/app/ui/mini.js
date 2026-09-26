/* StudyNook · mini.js — tiny always-on-top session pill (display only;
   click opens the main window). No controls on purpose. */
'use strict';
(function () {
  const pill = document.getElementById('pill');
  const time = document.getElementById('time');
  const lbl = document.getElementById('lbl');
  const pet = document.getElementById('pet');

  function paint(st) {
    if (!st || !st.active) return;
    time.textContent = N.fmt(st.remainingSec);
    lbl.textContent = st.phase === 'focus' ? 'focus' : st.phase === 'short' ? 'break' : 'long break';
    pill.classList.toggle('brk', st.phase !== 'focus');
  }

  nook.on('tick', paint);
  nook.on('snapshot', (s) => {
    paint(s.session);
    const st = NookProgress.PET_STAGES[s.data.pet.stage] || NookProgress.PET_STAGES[0];
    pet.textContent = st.emoji;
  });
  nook.invoke('get-snapshot').then((s) => {
    paint(s.session);
    const st = NookProgress.PET_STAGES[s.data.pet.stage] || NookProgress.PET_STAGES[0];
    pet.textContent = st.emoji;
  });
  // update-proof: pull the state every second in case push events are missed
  setInterval(() => {
    nook.invoke('get-snapshot').then((s) => {
      paint(s.session);
      const st = NookProgress.PET_STAGES[s.data.pet.stage] || NookProgress.PET_STAGES[0];
      pet.textContent = st.emoji;
    }).catch(() => {});
  }, 1000);

  pill.addEventListener('click', () => nook.invoke('win:show-main'));
})();
