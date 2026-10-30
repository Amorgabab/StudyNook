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

    const two = (n) => String(n).padStart(2, '0');
    // m:ss under an hour, h:mm:ss above (a 2-hour Iron session used to read "119:02")
    const fmtLeft = (sec) => (sec >= 3600 ? Math.floor(sec / 3600) + ':' + two(Math.floor((sec % 3600) / 60)) + ':' + two(sec % 60) : two(Math.floor(sec / 60)) + ':' + two(sec % 60));
    const label = NookBlockLabel.blockLabel(st);
    const timerEl = $('timer');
    const setLine = (icon, text) => { timerEl.innerHTML = ico(icon) + '<span></span>'; timerEl.lastChild.textContent = text; };
    if (label.kind === 'countdown') {
      const endsAt = label.endsAt || Date.now() + label.remainingSec * 1000;
      const tick = () => setLine('timer', t('blk.left', { time: fmtLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000))) }));
      tick(); setInterval(tick, 1000);
    } else if (label.kind === 'paused') {
      setLine('pause', t('blk.paused', { time: fmtLeft(Math.max(0, Math.round(label.remainingSec || 0))) }));
    } else if (label.kind === 'offline') {
      setLine('info', t('blk.offline'));
    } else {
      setLine('infinity', t('blk.always'));
    }
  });

  $('back').onclick = () => { if (history.length > 1) history.back(); else window.close(); };
  $('close-tab').onclick = () => window.close();
})();
