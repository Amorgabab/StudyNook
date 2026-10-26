/* StudyNook extension · blocked.js — shown in place of a blocked site */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const t = NookExtI18n.t;
  const ico = (name, size) => NookIcons.svg(name, { size: size || 16 });

  chrome.storage.local.get('nook', (o) => {
    const st = (o && o.nook) || {};
    NookExtI18n.pick(st.lang);
    $('halo').innerHTML = ico('moon', 26);
    $('headline').textContent = t('blk.title');
    const dom = (st.lastBlocked && st.lastBlocked.domain) || t('blk.site');
    $('dom').textContent = dom;
    $('line').textContent = t('blk.body');
    const quotes = t('quotes');
    $('quote').textContent = Array.isArray(quotes) ? '“' + quotes[Math.floor(Math.random() * quotes.length)] + '”' : '';
    $('back').innerHTML = ico('chevron-left') + '<span>' + t('blk.back') + '</span>';
    if (document.documentElement.dir === 'rtl') $('back').firstChild.style.transform = 'scaleX(-1)';
    $('close-tab').textContent = t('blk.close');
    const bounces = (st.bounces || {})[dom] || 0;
    $('meta').textContent = bounces > 1 ? t('blk.count', { n: bounces }) : '';

    let endsAt = 0;
    if (st.connected && st.session && st.session.active && st.session.phase === 'focus') endsAt = Date.now() + st.session.remainingSec * 1000;
    else if (!st.connected && st.timer && st.timer.running && st.timer.phase === 'focus') endsAt = st.timer.endsAt;
    const timerEl = $('timer');
    if (endsAt) {
      const tick = () => {
        const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
        timerEl.innerHTML = ico('timer') + '<span></span>';
        timerEl.lastChild.textContent = t('blk.left', { time: String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') });
      };
      tick(); setInterval(tick, 1000);
    } else {
      timerEl.innerHTML = ico('infinity') + '<span></span>';
      timerEl.lastChild.textContent = t('blk.always');
    }
  });

  $('back').onclick = () => { if (history.length > 1) history.back(); else window.close(); };
  $('close-tab').onclick = () => window.close();
})();
