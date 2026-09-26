/* StudyNook extension · blocked.js — the cozy "napping" page */
'use strict';
(function () {
  const QUOTES = [
    'Small steps every day make big dreams come true.',
    'Focus is a kind of kindness you give your future self.',
    'The internet will still be here after your session.',
    'One page. One problem. One minute at a time.',
    'Deep work first, dopamine later.',
    'Close the tabs. Open the mind.',
    'Future you is already saying thank you.',
    'Warm drink, quiet mind, one task.',
    'Progress hides inside boring minutes.',
    'Mochi believes in you. That\'s scientifically significant.'
  ];
  const LINES = [
    'is taking a nap so you can focus.',
    'has been tucked into bed until your session ends.',
    'is having its screen time paused. Gently.',
    'was caught sneaking in. Mochi escorted it out.',
    'is on a little vacation. You\'re on a mission.'
  ];

  chrome.storage.local.get('nook', (o) => {
    const st = (o && o.nook) || {};
    const lb = st.lastBlocked || {};
    const dom = lb.domain || 'this site';
    document.getElementById('dom').textContent = dom;
    document.getElementById('line').textContent = dom + ' ' + LINES[Math.floor(Math.random() * LINES.length)];
    document.getElementById('quote').textContent = '“' + QUOTES[Math.floor(Math.random() * QUOTES.length)] + '”';
    const bounces = (st.bounces || {})[dom] || 0;
    document.getElementById('meta').textContent =
      (bounces > 1 ? `Mochi has bounced this site ${bounces} times. She's patient. ` : '') +
      'StudyNook Tab Guardian 🪺';

    // countdown
    const timerEl = document.getElementById('timer');
    let endsAt = 0;
    if (st.connected && st.session && st.session.active && st.session.phase === 'focus') {
      endsAt = Date.now() + st.session.remainingSec * 1000;
    } else if (!st.connected && st.timer && st.timer.running && st.timer.phase === 'focus') {
      endsAt = st.timer.endsAt;
    }
    if (endsAt) {
      const tick = () => {
        const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
        timerEl.textContent = '🌱 focus ends in ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      };
      tick(); setInterval(tick, 1000);
    } else {
      timerEl.textContent = '🌙 blocking is on (always-mode or no active session)';
    }
  });

  document.getElementById('back').onclick = () => {
    if (history.length > 1) history.back();
    else window.close();
  };
  document.getElementById('close-tab').onclick = () => window.close();
})();
