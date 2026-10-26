'use strict';
const { Guardian } = require('../app/main/guardian.js');
const { makeShared } = require('../app/main/processes.js');

function guard(apps, over) {
  const store = {
    data: {
      settings: { guardian: Object.assign({ enabled: true, mode: 'block', action: 'instant', graceSec: 1, scanSec: 1, onlyDuringSessions: false }, over || {}) },
      apps: Object.assign({ block: [], allow: [], allowOnce: {} }, apps),
      counters: { kills: 0 }
    },
    mutate(fn) { return fn(this.data); }
  };
  const calls = { list: 0, kill: [] };
  const g = new Guardian({
    store,
    session: { isFocusing: () => true, isIronFocus: () => false, ironActive: () => false, recordKill: () => {} },
    onEvent: () => {},
    listProcesses: async () => { calls.list++; return [{ pid: 7, name: 'Discord.exe', norm: 'discord' }, { pid: 8, name: 'Code.exe', norm: 'code' }]; },
    killProcess: async (pid) => { calls.kill.push(pid); return true; }
  });
  return { g, calls };
}
const entry = (procs, extra) => Object.assign({ id: 'e', label: 'x', procs, enabled: true }, extra || {});

suite('guard · scans only when something can match', () => {
  test('blocklist mode with an empty list never lists processes', async () => {
    const { g, calls } = guard({ block: [] });
    await g.scan();
    expect(calls.list).toBe(0);
  });
  test('blocklist mode with only disabled or process-less entries never lists processes', async () => {
    const { g, calls } = guard({ block: [entry(['discord'], { enabled: false }), entry([])] });
    await g.scan();
    expect(calls.list).toBe(0);
  });
  test('allowlist mode with nothing allowed never lists processes (and closes nothing)', async () => {
    const { g, calls } = guard({ allow: [] }, { mode: 'allow' });
    await g.scan();
    expect(calls.list).toBe(0);
    expect(calls.kill.length).toBe(0);
  });
  test('an enabled blocked app is still found and closed', async () => {
    const { g, calls } = guard({ block: [entry(['discord'])] });
    await g.scan();
    expect(calls.list > 0).toBe(true);
    expect(calls.kill).toEqual([7]);
  });
  test('an enabled allowlist still closes everything else', async () => {
    const { g, calls } = guard({ allow: [entry(['code'])] }, { mode: 'allow' });
    await g.scan();
    expect(calls.kill).toEqual([7]);
  });
  test('adding the first entry starts scanning again', async () => {
    const { g, calls } = guard({ block: [] });
    await g.scan();
    expect(calls.list).toBe(0);
    g.hooks.store.data.apps.block.push(entry(['discord']));
    await g.scan();
    expect(calls.kill).toEqual([7]);
  });
});

suite('processes · one shared list', () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  test('callers at the same moment share one lookup', async () => {
    let n = 0;
    const shared = makeShared(async () => { n++; await sleep(20); return [{ pid: 1 }]; });
    const [a, b, c] = await Promise.all([shared(), shared(), shared()]);
    expect(n).toBe(1);
    expect(a === b && b === c).toBe(true);
  });
  test('a recent list is reused, an old one is refreshed', async () => {
    let n = 0, t = 1000;
    const shared = makeShared(async () => { n++; return [{ pid: n }]; }, () => t);
    await shared(1500);
    t += 1000; await shared(1500);
    expect(n).toBe(1);
    t += 600; await shared(1500);
    expect(n).toBe(2);
    await shared(0);                       // maxAge 0 = always fresh
    expect(n).toBe(3);
  });
  test('a failed lookup is not cached and does not wedge later calls', async () => {
    let n = 0;
    const shared = makeShared(async () => { n++; if (n === 1) throw new Error('tasklist failed'); return [{ pid: 2 }]; });
    let failed = false;
    try { await shared(); } catch (e) { failed = true; }
    expect(failed).toBe(true);
    expect((await shared())[0].pid).toBe(2);
  });
  test('killing always re-verifies against a fresh list, never the shared one', async () => {
    const fresh = [];
    const store = { data: { settings: { guardian: { enabled: true, mode: 'block', action: 'instant', scanSec: 1, onlyDuringSessions: false } }, apps: { block: [], allow: [], allowOnce: {} }, counters: { kills: 0 } }, mutate(fn) { return fn(this.data); } };
    const g = new Guardian({ store, session: { isFocusing: () => true, recordKill: () => {} }, onEvent: () => {}, listProcesses: async () => { fresh.push(1); return []; }, killProcess: async () => true });
    await g._killGroup({ label: 'x', pids: [9], norms: ['x'] });
    expect(fresh.length).toBe(1);
  });
});
