/* ============================================================
   StudyNook · tests/smoke.js — integration smoke WITHOUT electron
   Boots store + session + guardian + sync-server in plain Node,
   then talks to the sync server exactly like the extension does.
   Run: node tests/smoke.js
   ============================================================ */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');

const { Store } = require('../app/main/store.js');
const { SessionEngine } = require('../app/main/session.js');
const { Guardian } = require('../app/main/guardian.js');
const { SyncServer } = require('../app/main/sync-server.js');
const progress = require('../app/shared/progress.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-smoke-'));
const store = new Store(path.join(tmp, 'data.json'));

let ok = 0, bad = 0;
function check(name, cond) {
  if (cond) { ok++; console.log('  ✓ ' + name); }
  else { bad++; console.log('  ✗ ' + name); }
}

(async () => {
  console.log('smoke: booting engine in ' + tmp);

  const session = new SessionEngine({
    getSettings: () => store.data.settings.timer,
    onTick: () => {},
    onState: () => {},
    onPhaseEnd: (info) => {
      if (info.phase === 'focus' && info.completed) {
        store.mutate((d) => progress.focusRewards(d, info.minutes, true, {}));
      }
    }
  });
  const guardian = new Guardian({
    store, session,
    onEvent: () => {}, showReminder: () => {}, hideReminder: () => {}
  });
  guardian.start();
  const server = new SyncServer({ store, session, guardianArmed: () => guardian.isArmed(), onExtStatus: () => {} });
  server.start();

  const BASE = 'http://127.0.0.1:47470';
  await new Promise((r) => setTimeout(r, 300));

  // 1 · ping
  const ping = await (await fetch(BASE + '/ping')).json();
  check('GET /ping answers', ping.ok === true && ping.app === 'studynook');

  // 2 · unauthenticated state rejected
  const noAuth = await fetch(BASE + '/state');
  check('unpaired /state → 401', noAuth.status === 401);

  // 3 · pair with the code from the store
  const code = store.data.ext.code;
  const paired = await (await fetch(BASE + '/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })).json();
  check('pair with code returns token', paired.ok === true && paired.token === store.data.ext.token);
  const wrong = await fetch(BASE + '/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'ZZZZZZ' }) });
  check('wrong code rejected', wrong.status === 401);
  let lastStatus = 401;
  for (let i = 0; i < 12; i++) {
    lastStatus = (await fetch(BASE + '/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'AAAAAA' }) })).status;
  }
  check('pair brute-force throttled with 429', lastStatus === 429);

  const H = { 'x-nook-token': store.data.ext.token, 'content-type': 'application/json' };

  // 4 · state reflects idle session + default sites
  let st = await (await fetch(BASE + '/state', { headers: H })).json();
  check('state: idle session', st.session.active === false);
  check('state: default blocklist present', st.sites.block.includes('youtube.com'));

  // 5 · extension-style patch: block a site
  await fetch(BASE + '/sites', { method: 'POST', headers: H, body: JSON.stringify({ addBlock: 'https://www.twitch.tv/live' }) });
  st = await (await fetch(BASE + '/state', { headers: H })).json();
  check('sites patch normalizes domain', st.sites.block.includes('twitch.tv'));

  // 6 · start a session via the engine (like IPC would) and see it in /state
  session.start({ mode: 'free', freeMin: 25 });
  await new Promise((r) => setTimeout(r, 200));
  st = await (await fetch(BASE + '/state', { headers: H })).json();
  check('state: focus session visible', st.session.active === true && st.session.phase === 'focus');
  check('guard arms during focus (onlyDuringSessions)', guardian.isArmed() === true);

  // 7 · complete a phase artificially and confirm rewards land in the store
  session.s.endsAt = Date.now() - 1;
  session._tick();
  await new Promise((r) => setTimeout(r, 100));
  check('xp awarded for completed phase', store.data.xp > 0);
  check('first-focus achievement granted', !!store.data.achievements.first_nook);
  check('daily minutes recorded', (store.data.daily[progress.dayStr()] || {}).min >= 25);

  // 8 · guardian safety: system processes never targeted (allow mode!)
  store.data.settings.guardian.mode = 'allow';
  store.data.apps.allow = [{ id: 'x', label: 'node', procs: ['node'], enabled: true }];
  const preview = await guardian.previewAllowlist();
  const norms = preview.map((g) => g.label);
  check('allow-mode preview keeps our own process', !norms.some((n) => String(n).includes('electron')));
  // (on linux CI, 'ps' list includes kernel threads etc — just ensure nothing from NEVER_KILL appears)
  const catalog = require('../app/shared/catalog.js');
  const neverHit = norms.filter((n) => catalog.NEVER_KILL[process.platform === 'darwin' ? 'mac' : process.platform === 'linux' ? 'linux' : 'win'].includes(String(n).toLowerCase()));
  check('allow-mode preview never lists protected system processes', neverHit.length === 0);
  store.data.settings.guardian.mode = 'block';

  // 9 · data file actually written & reloadable
  store.saveNow();
  const reloaded = new Store(path.join(tmp, 'data.json'));
  check('data.json reload keeps xp', reloaded.data.xp === store.data.xp);

  // 10 · heartbeat updates lastSeen
  await fetch(BASE + '/heartbeat', { method: 'POST', headers: H, body: JSON.stringify({ version: '1.0.0' }) });
  check('heartbeat marks extension seen', Date.now() - store.data.ext.lastSeen < 3000);

  session.stop({ abandon: false });
  guardian.stop();
  server.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nsmoke: ${ok} ok, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('smoke crashed:', e); process.exit(1); });
