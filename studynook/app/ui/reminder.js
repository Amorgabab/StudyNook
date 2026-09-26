/* StudyNook · reminder.js — the gentle warning card */
'use strict';
(function () {
  const title = document.getElementById('title');
  const sub = document.getElementById('sub');
  const count = document.getElementById('count');
  let deadline = 0, tick = null, norm = '';

  function show(p) {
    if (!p) return;
    norm = p.norm || '';
    title.textContent = `${p.label} is open`;
    sub.textContent = p.gentle
      ? 'Focus time! Mochi will gently close it in…'
      : `Psst — ${p.label} tends to eat study time.`;
    count.style.display = p.gentle ? '' : 'none';
    deadline = p.deadline || Date.now() + 15000;
    if (tick) clearInterval(tick);
    tick = setInterval(() => {
      const s = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      count.textContent = String(s);
    }, 250);
  }

  nook.on('reminder', (p) => { if (p) show(p); });
  nook.on('snapshot', (s) => { if (s.pendingReminder) show(s.pendingReminder); });
  nook.invoke('get-snapshot').then((s) => { if (s.pendingReminder) show(s.pendingReminder); });

  document.getElementById('b-leave').addEventListener('click', () => nook.invoke('reminder:allowOnce', { norm }));
  document.getElementById('b-close').addEventListener('click', () => nook.invoke('reminder:killNow', { norm }));
  document.getElementById('b-self').addEventListener('click', () => nook.invoke('reminder:dismiss'));
})();
