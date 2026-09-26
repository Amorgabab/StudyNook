'use strict';
const { Guardian } = require('../app/main/guardian.js');
const { SessionEngine } = require('../app/main/session.js');

function fakeStore() {
  const data = { settings: { guardian: { enabled: true, mode: 'block', action: 'instant', graceSec: 1, scanSec: 1, onlyDuringSessions: false } }, apps: { block: [{ id: 'b1', label: 'Discord', procs: ['discord'], enabled: true }], allow: [], allowOnce: {} }, counters: { kills: 0 } };
  return { data, mutate: (fn) => fn(data) };
}

suite('guardian · pid-reuse safety', () => {
  test('skips pids whose process is gone/reused before the kill lands', async () => {
    const killed = [];
    const g = new Guardian({
      store: fakeStore(),
      session: { recordKill: () => {} },
      onEvent: () => {},
      listProcesses: async () => [],            // nothing alive anymore
      killProcess: async (pid) => { killed.push(pid); return true; }
    });
    await g._killGroup({ label: 'Discord', pids: [777], norms: ['discord'] });
    expect(killed.length).toBe(0);
  });

  test('kills pids that still run the matching process', async () => {
    const killed = [];
    const g = new Guardian({
      store: fakeStore(),
      session: { recordKill: () => {} },
      onEvent: () => {},
      listProcesses: async () => [{ pid: 777, name: 'Discord.exe', norm: 'discord' }],
      killProcess: async (pid) => { killed.push(pid); return true; }
    });
    await g._killGroup({ label: 'Discord', pids: [777], norms: ['discord'] });
    expect(killed).toEqual([777]);
  });

  test('does not kill a reused pid running a DIFFERENT process', async () => {
    const killed = [];
    const g = new Guardian({
      store: fakeStore(),
      session: { recordKill: () => {} },
      onEvent: () => {},
      listProcesses: async () => [{ pid: 777, name: 'notepad.exe', norm: 'notepad' }], // pid reused!
      killProcess: async (pid) => { killed.push(pid); return true; }
    });
    await g._killGroup({ label: 'Discord', pids: [777], norms: ['discord'] });
    expect(killed.length).toBe(0);
  });
});

suite('session · wall-clock jump protection', () => {
  test('clock jumping backwards cannot stretch the countdown', () => {
    const eng = new SessionEngine({ getSettings: () => ({ workMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: false }), onPhaseEnd: () => {} });
    eng.start({ mode: 'free', freeMin: 25 });
    eng._tick();                                   // seeds _lastRem ≈ 1500
    eng.s.endsAt = Date.now() + 25 * 60 * 1000 * 3; // simulate clock jump backwards
    eng._tick();
    expect(eng.remainingSec() <= 25 * 60).toBeTruthy();
    eng.stop({});
  });
  test('normal countdown unaffected', () => {
    const eng = new SessionEngine({ getSettings: () => ({ workMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: false }), onPhaseEnd: () => {} });
    eng.start({ mode: 'free', freeMin: 25 });
    eng._tick();
    const a = eng.remainingSec();
    expect(a >= 1490 && a <= 1500).toBeTruthy();
    eng.stop({});
  });
});
