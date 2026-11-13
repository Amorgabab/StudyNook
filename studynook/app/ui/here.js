/* StudyNook · here.js — the "Are you still here?" card (shown after a long stretch with no input) */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  let deadline = 0, tick = null;
  $('ico').appendChild(N.icon('hand', 18));

  function paint() {
    const n = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    $('sub').textContent = t('here.sub', { n: NookI18n.num(n) });
  }
  function show(p) {
    if (!p) return;
    deadline = p.deadline || Date.now() + 60000;
    if (tick) clearInterval(tick);
    paint();
    tick = setInterval(paint, 250);
  }
  function apply(s) {
    if (!s || !s.data) return;
    NookI18n.setLang(NookPrefs.normLang(s.data.settings.language));
    NookPrefs.applyToDocument(document, s.data.settings, !!s.systemDark);
    $('title').textContent = t('here.title');
    $('b-here').textContent = t('here.btn');
    if (s.here) show(s.here); else if (deadline) paint();
  }

  nook.on('here', show);
  nook.on('snapshot', apply);
  nook.invoke('get-snapshot').then(apply);
  $('b-here').addEventListener('click', () => nook.invoke('here:dismiss'));
})();
