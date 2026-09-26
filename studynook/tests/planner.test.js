'use strict';
const planner = require('../app/main/planner.js');
const catalog = require('../app/shared/catalog.js');

const OPTS = (over) => Object.assign({
  mode: 'block', block: [], allow: [], allowOnce: {}, platform: 'win32', selfPid: 4242
}, over || {});

const PROC = (pid, name) => ({ pid, name, norm: catalog.normalizeProcName(name) });

suite('planner · block mode', () => {
  const procs = [PROC(1, 'Discord.exe'), PROC(2, 'chrome.exe'), PROC(3, 'svchost.exe'), PROC(4242, 'electron.exe')];
  test('closes only listed apps', () => {
    const t = planner.chooseTargets(procs, OPTS({ block: [{ label: 'Discord', procs: ['discord'], enabled: true }] }));
    expect(t.length).toBe(1);
    expect(t[0].norm).toBe('discord');
  });
  test('disabled entries do nothing', () => {
    const t = planner.chooseTargets(procs, OPTS({ block: [{ label: 'Discord', procs: ['discord'], enabled: false }] }));
    expect(t.length).toBe(0);
  });
  test('system processes are untouchable even if listed', () => {
    const t = planner.chooseTargets(procs, OPTS({ block: [{ label: 'sys', procs: ['svchost', 'explorer', 'dwm'], enabled: true }] }));
    expect(t.length).toBe(0);
  });
  test('our own pid is skipped', () => {
    const t = planner.chooseTargets([PROC(4242, 'myapp.exe')], OPTS({ block: [{ label: 'me', procs: ['myapp'], enabled: true }] }));
    expect(t.length).toBe(0);
  });
  test('allow-once grants pause targeting', () => {
    const until = Date.now() + 60000;
    const t = planner.chooseTargets(procs, OPTS({ block: [{ label: 'Discord', procs: ['discord'], enabled: true }], allowOnce: { discord: until } }));
    expect(t.length).toBe(0);
  });
  test('expired allow-once resumes targeting', () => {
    const t = planner.chooseTargets(procs, OPTS({ block: [{ label: 'Discord', procs: ['discord'], enabled: true }], allowOnce: { discord: Date.now() - 1 } }));
    expect(t.length).toBe(1);
  });
});

suite('planner · allow mode', () => {
  const procs = [PROC(1, 'chrome.exe'), PROC(2, 'Discord.exe'), PROC(3, 'svchost.exe'), PROC(4, 'explorer.exe'), PROC(5, 'notepad.exe')];
  test('closes everything not allowed (system safe)', () => {
    const t = planner.chooseTargets(procs, OPTS({ mode: 'allow', allow: [{ label: 'Chrome', procs: ['chrome'], enabled: true }] }));
    const norms = t.map((x) => x.norm).sort();
    expect(norms).toEqual(['discord', 'notepad']);
  });
  test('reason is not-on-allowlist', () => {
    const t = planner.chooseTargets(procs, OPTS({ mode: 'allow', allow: [] }));
    expect(t.every((x) => x.reason === 'not-on-allowlist')).toBeTruthy();
  });
});

suite('planner · grouping', () => {
  test('groups pids by label with norms', () => {
    const targets = [
      { pid: 1, name: 'Discord.exe', norm: 'discord', label: 'Discord', reason: 'x' },
      { pid: 2, name: 'Discord.exe', norm: 'discord', label: 'Discord', reason: 'x' }
    ];
    const g = planner.groupTargets(targets);
    expect(g.length).toBe(1);
    expect(g[0].count).toBe(2);
    expect(g[0].norms).toEqual(['discord']);
  });
});

suite('catalog · normalization', () => {
  test('strips path + extension + case', () => {
    expect(catalog.normalizeProcName('C:\\Apps\\Discord.EXE')).toBe('discord');
    expect(catalog.normalizeProcName('/usr/bin/telegram')).toBe('telegram');
    expect(catalog.normalizeProcName('Steam.exe')).toBe('steam');
  });
  test('never-kill covers core windows processes', () => {
    for (const n of ['svchost', 'csrss', 'winlogon', 'dwm', 'explorer', 'lsass']) {
      expect(catalog.NEVER_KILL.win.includes(n)).toBeTruthy();
    }
  });
});
