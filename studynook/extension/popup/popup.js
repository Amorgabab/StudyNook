/* StudyNook extension · popup.js — minimal status popup */
'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const ask = (type, extra) => chrome.runtime.sendMessage(Object.assign({ type }, extra || {}));
  let ST = null, VER = '';

  const fmt = (s) => {
    s = Math.max(0, Math.round(s || 0));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  function blockingActive(st) {
    const sites = st.sites || {};
    if (!sites.enabled) return false;
    if (sites.when === 'always') return true;
    if (st.connected) return !!(st.session && st.session.active && st.session.phase === 'focus' && st.session.running);
    return !!(st.timer && st.timer.running && st.timer.phase === 'focus');
  }

  function paint() {
    const st = ST;
    $('dot').className = 'dot' + (st.connected ? ' on' : '');
    $('conn').textContent = st.connected ? 'connected' : 'standalone';
    const sites = st.sites || {};
    const active = blockingActive(st);
    $('state').textContent = !sites.enabled ? 'Site blocking is OFF'
      : active ? '🚫 Blocking active'
      : '💤 Sleeping until focus starts';
    if (st.connected) {
      const s = st.session || {};
      $('sess').textContent = s.active
        ? (s.phase === 'focus' ? 'Focus session: ' + fmt(s.remainingSec) + ' left' : 'Break: ' + fmt(s.remainingSec) + ' left') + (s.running ? '' : ' (paused)')
        : 'No session running in the app';
    } else {
      const t = st.timer;
      $('sess').textContent = t && t.running ? 'Standalone focus: ' + fmt(Math.max(0, (t.endsAt - Date.now()) / 1000)) + ' left' : 'Desktop app offline — standalone mode';
    }
    $('sweep').textContent = st.lastAudit ? 'Last open-tab sweep: ' + Math.max(0, Math.round((Date.now() - st.lastAudit) / 1000)) + 's ago' : '';
    $('standalone').style.display = st.connected ? 'none' : '';
    $('tstart').style.display = (!st.connected && !(st.timer && st.timer.running)) ? '' : 'none';
    $('tstop').style.display = (!st.connected && st.timer && st.timer.running) ? '' : 'none';
    $('paircard').style.display = st.token ? 'none' : '';
  }

  async function refresh() {
    const r = await ask('get-state');
    ST = r.state || {};
    VER = r.manifest || '';
    try {
      const vj = await fetch(chrome.runtime.getURL('version.json'), { cache: 'no-store' });
      const diskV = String(((await vj.json()) || {}).version || '');
      $('stale').style.display = (diskV && VER && diskV !== VER) ? '' : 'none';
    } catch (e) { $('stale').style.display = 'none'; }
    paint();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    await refresh();
    setInterval(() => { if (ST) paint(); }, 1000);
    $('fixstale').onclick = () => chrome.runtime.reload();
    $('sync').onclick = async () => {
      $('conn').textContent = 'syncing…';
      await ask('sync');
      await refresh();
    };
    $('pair').onclick = async () => {
      const r = await ask('pair', { code: $('code').value });
      $('pair').textContent = r.ok ? 'Paired ✓' : 'Wrong code / app not running';
      if (r.ok) setTimeout(refresh, 400);
    };
    $('tstart').onclick = async () => { await ask('timer', { op: 'start', workMin: 25, breakMin: 5 }); refresh(); };
    $('tstop').onclick = async () => { await ask('timer', { op: 'stop' }); refresh(); };
  });
})();
