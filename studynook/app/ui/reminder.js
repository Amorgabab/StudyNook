/* StudyNook · reminder.js — the "blocked app is open" warning card */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  let deadline = 0, tick = null, norm = '', last = null;
  $('ico').appendChild(N.icon('bell-ring', 20));

  function labels() {
    $('b-leave').textContent = t('rem.keep');
    $('b-close').textContent = t('rem.close');
    $('b-self').textContent = t('rem.self');
    $('countlbl').textContent = t('rem.seconds');
  }
  function show(p) {
    if (!p) return;
    last = p;
    norm = p.norm || '';
    $('title').textContent = t('rem.title', { app: p.label });
    $('sub').textContent = p.gentle ? t('rem.gentle') : t('rem.remind', { app: p.label });
    $('countrow').style.display = p.gentle ? '' : 'none';
    deadline = p.deadline || Date.now() + 15000;
    if (tick) clearInterval(tick);
    const paint = () => { $('count').textContent = NookI18n.num(Math.max(0, Math.round((deadline - Date.now()) / 1000))); };
    paint();
    tick = setInterval(paint, 250);
  }
  function apply(s) {
    if (!s || !s.data) return;
    NookI18n.setLang(NookPrefs.normLang(s.data.settings.language));
    NookPrefs.applyToDocument(document, s.data.settings, !!s.systemDark);
    labels();
    if (s.pendingReminder) show(s.pendingReminder); else if (last) show(last);
  }

  nook.on('reminder', (p) => { if (p) show(p); });
  nook.on('snapshot', apply);
  nook.invoke('get-snapshot').then(apply);

  $('b-leave').addEventListener('click', () => nook.invoke('reminder:allowOnce', { norm }));
  $('b-close').addEventListener('click', () => nook.invoke('reminder:killNow', { norm }));
  $('b-self').addEventListener('click', () => nook.invoke('reminder:dismiss'));
})();
