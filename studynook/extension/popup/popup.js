/* StudyNook extension · popup.js — status, standalone timer, pairing */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const t = NookExtI18n.t;
  const ico = (name, size) => NookIcons.svg(name, { size: size || 16 });
  const ask = (type, extra) => chrome.runtime.sendMessage(Object.assign({ type }, extra || {}));
  let ST = null;

  const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  function blockingActive(st) {
    const sites = st.sites || {};
    if (!sites.enabled) return false;
    if (sites.when === 'always') return true;
    if (st.connected) { const s = st.session || {}; return !!(s.active && s.phase === 'focus' && (s.running || s.blockActive)); }
    return !!(st.timer && st.timer.running && st.timer.phase === 'focus');
  }

  function labels() {
    $('mark').innerHTML = ico('book-open', 14);
    $('sync').innerHTML = ico('refresh-cw'); $('sync').title = t('pop.sync'); $('sync').setAttribute('aria-label', t('pop.sync'));
    $('stale-txt').textContent = t('pop.stale');
    $('fixstale').innerHTML = ico('rotate-ccw') + '<span>' + t('pop.reload') + '</span>';
    $('tstart').innerHTML = ico('play') + '<span>' + t('pop.start') + '</span>';
    $('tstop').innerHTML = ico('square') + '<span>' + t('pop.stop') + '</span>';
    $('pair-lbl').textContent = t('pop.pair.label');
    $('pair').textContent = t('pop.pair');
    $('foot').textContent = t('pop.foot');
  }

  function paint() {
    const st = ST, sites = st.sites || {}, active = blockingActive(st);
    $('dot').className = 'dot' + (st.connected ? ' on' : '');
    $('conn').textContent = st.connected ? t('pop.connected') : t('pop.standalone');
    const state = $('state');
    state.className = 'state' + (active ? ' active' : '');
    state.innerHTML = ico(!sites.enabled ? 'shield-off' : active ? 'shield-check' : 'moon', 18) + '<span></span>';
    state.lastChild.textContent = !sites.enabled ? t('pop.off') : active ? t('pop.active') : t('pop.sleeping');
    if (st.connected) {
      const s = st.session || {};
      $('sess').textContent = s.active ? t(s.phase === 'focus' ? 'pop.focusLeft' : 'pop.breakLeft', { time: fmt(s.remainingSec) }) + (s.running ? '' : t('pop.paused')) : t('pop.noSession');
    } else {
      const tm = st.timer;
      $('sess').textContent = tm && tm.running ? t('pop.saFocus', { time: fmt((tm.endsAt - Date.now()) / 1000) }) : t('pop.offline');
    }
    $('sweep').textContent = st.lastAudit ? t('pop.sweep', { n: Math.max(0, Math.round((Date.now() - st.lastAudit) / 1000)) }) : '';
    $('standalone').hidden = !!st.connected;
    $('tstart').hidden = !!(st.connected || (st.timer && st.timer.running));
    $('tstop').hidden = !(!st.connected && st.timer && st.timer.running);
    $('paircard').hidden = !!st.token;
  }

  async function refresh() {
    const r = await ask('get-state');
    ST = r.state || {};
    NookExtI18n.pick(ST.lang);
    labels();
    try {
      const vj = await fetch(chrome.runtime.getURL('version.json'), { cache: 'no-store' });
      const diskV = String(((await vj.json()) || {}).version || '');
      $('stale').hidden = !(diskV && r.manifest && diskV !== r.manifest);
    } catch (e) { $('stale').hidden = true; }
    paint();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await refresh();
    setInterval(() => { if (ST) paint(); }, 1000);
    $('fixstale').onclick = () => chrome.runtime.reload();
    $('sync').onclick = async () => { $('conn').textContent = t('pop.syncing'); await ask('sync'); await refresh(); };
    $('pair').onclick = async () => {
      const r = await ask('pair', { code: $('code').value });
      $('pair').textContent = r.ok ? t('pop.pair.ok') : t('pop.pair.fail');
      if (r.ok) setTimeout(refresh, 400);
    };
    $('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('pair').click(); });
    $('tstart').onclick = async () => { await ask('timer', { op: 'start', workMin: 25, breakMin: 5 }); refresh(); };
    $('tstop').onclick = async () => { await ask('timer', { op: 'stop' }); refresh(); };
  });
})();
