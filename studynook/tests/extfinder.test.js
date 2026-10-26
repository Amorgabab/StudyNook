'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const Finder = require('../app/main/extfinder.js');

const PLATFORM = process.platform;
const EXT = path.join(__dirname, '..', 'extension');          // the real, complete extension folder

/* A throw-away "home" with fake browser profiles inside it. */
function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-ext-'));
  const env = { LOCALAPPDATA: path.join(home, 'AppData', 'Local'), ProgramFiles: path.join(home, 'PF'), 'ProgramFiles(x86)': path.join(home, 'PF86') };
  const chromeRoot = Finder.browserRoots(PLATFORM, env, home)[0].root;
  const profile = (name, files) => {
    const dir = path.join(chromeRoot, name);
    fs.mkdirSync(dir, { recursive: true });
    for (const [f, content] of Object.entries(files || {})) fs.writeFileSync(path.join(dir, f), typeof content === 'string' ? content : JSON.stringify(content));
  };
  return { home, env, profile };
}
const prefs = (entry) => ({ extensions: { settings: { abcdefghijklmnop: Object.assign({ path: EXT }, entry) } } });
const detect = (h, extDir) => Finder.detect({ platform: PLATFORM, env: h.env, home: h.home, extDir: extDir || EXT });

suite('extfinder · extension folder validation', () => {
  test('the shipped extension folder is complete', () => {
    const v = Finder.validateFolder(EXT);
    expect(v.ok).toBe(true);
    expect(v.version).toBe(JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version);
  });
  test('missing and truncated (0-byte) files are reported', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-extdir-'));
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ manifest_version: 3, version: '1.0.0' }));
    fs.writeFileSync(path.join(dir, 'background.js'), '');
    const v = Finder.validateFolder(dir);
    expect(v.ok).toBe(false);
    expect(v.missing).toContain('background.js');
    expect(v.missing).toContain('rules.js');
  });
  test('a garbled manifest is reported, not thrown', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-extdir-'));
    fs.writeFileSync(path.join(dir, 'manifest.json'), '{ not json');
    expect(Finder.validateFolder(dir).error).toBe('manifest.json is unreadable');
  });
});

suite('extfinder · detecting the extension in browser profiles', () => {
  test('enabled in the browser', () => {
    const h = fakeHome(); h.profile('Default', { Preferences: prefs({ state: 1 }) });
    expect(detect(h).status).toBe('enabled');
  });
  test('installed but turned off (state 0, or a disable reason)', () => {
    const a = fakeHome(); a.profile('Default', { Preferences: prefs({ state: 0 }) });
    expect(detect(a).status).toBe('disabled');
    const b = fakeHome(); b.profile('Default', { Preferences: prefs({ disable_reasons: 1 }) });
    expect(detect(b).status).toBe('disabled');
  });
  test('some other extension only → not installed', () => {
    const h = fakeHome(); h.profile('Default', { Preferences: { extensions: { settings: { zzz: { path: path.join(os.tmpdir(), 'other'), state: 1 } } } } });
    expect(detect(h).status).toBe('not-installed');
  });
  test('registered but in an unknown state (e.g. terminated) → partial', () => {
    const h = fakeHome(); h.profile('Default', { Preferences: prefs({ state: 2 }) });
    expect(detect(h).status).toBe('partial');
  });
  // Formats captured from real Chrome 155 (throwaway-profile lab): enabled has NO state, disabled has a list.
  test('modern Chrome: no state + empty disable_reasons list → enabled', () => {
    const h = fakeHome(); h.profile('Default', { Preferences: prefs({ disable_reasons: [], location: 4 }) });
    expect(detect(h).status).toBe('enabled');
  });
  test('modern Chrome: disable_reasons [1] (and several reasons) → disabled', () => {
    const a = fakeHome(); a.profile('Default', { Preferences: prefs({ disable_reasons: [1], location: 4 }) });
    expect(detect(a).status).toBe('disabled');
    const b = fakeHome(); b.profile('Default', { Preferences: prefs({ disable_reasons: [1, 2] }) });
    expect(detect(b).status).toBe('disabled');
  });
  test('corrupt settings files → unreadable, never a crash', () => {
    const h = fakeHome(); h.profile('Default', { Preferences: '{ half written', 'Secure Preferences': 'garbage' });
    expect(detect(h).status).toBe('unreadable');
  });
  test('corrupt Secure Preferences but good Preferences still finds it', () => {
    const h = fakeHome(); h.profile('Default', { 'Secure Preferences': '{ nope', Preferences: prefs({ state: 1 }) });
    expect(detect(h).status).toBe('enabled');
  });
  test('best result across profiles wins (one disabled, one enabled)', () => {
    const h = fakeHome();
    h.profile('Default', { Preferences: prefs({ state: 0 }) });
    h.profile('Profile 1', { Preferences: prefs({ state: 1 }) });
    expect(detect(h).status).toBe('enabled');
  });
  test('no browser profiles at all', () => {
    const h = fakeHome();
    expect(detect(h).status).toBe('no-browser');
  });
  test('a damaged extension folder overrides everything', () => {
    const h = fakeHome(); h.profile('Default', { Preferences: prefs({ state: 1 }) });
    const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-extdir-'));
    expect(detect(h, bad).status).toBe('folder-corrupt');
  });
  test('describe() always has a title and detail', () => {
    for (const status of ['enabled', 'disabled', 'partial', 'unreadable', 'not-installed', 'no-browser', 'folder-corrupt']) {
      const d = Finder.describe({ status, folder: { missing: [], error: null } });
      expect(typeof d.title).toBe('string');
      expect(d.detail.length).toBeGreaterThan(0);
    }
  });
});

suite('extfinder · launching a browser with the extension', () => {
  const env = { ProgramFiles: 'C:\\PF', 'ProgramFiles(x86)': 'C:\\PF86', LOCALAPPDATA: 'C:\\L' };
  const chromeExe = Finder.browserExes(PLATFORM, env, 'chrome')[0];
  const fsWith = (exists) => Object.assign({}, fs, { existsSync: (p) => exists(p) });

  test('starts Chrome detached with --load-extension and the extensions page', () => {
    const calls = [];
    const r = Finder.forceLoad({ platform: PLATFORM, env, extDir: EXT, fs: fsWith((p) => p === chromeExe), spawn: (exe, args, o) => { calls.push({ exe, args, o }); return { on() {}, unref() {} }; } });
    expect(r.ok).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].exe).toBe(chromeExe);
    expect(calls[0].args[0]).toBe('--load-extension=' + EXT);
    expect(calls[0].args[1]).toBe('chrome://extensions');
    expect(calls[0].o.detached).toBe(true);
  });
  test('no browser installed → clear failure, nothing spawned', () => {
    let spawned = 0;
    const r = Finder.forceLoad({ platform: PLATFORM, env, extDir: EXT, fs: fsWith(() => false), spawn: () => { spawned++; } });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no-browser');
    expect(spawned).toBe(0);
  });
  test('damaged extension folder is refused before any launch', () => {
    let spawned = 0;
    const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-extdir-'));
    const r = Finder.forceLoad({ platform: PLATFORM, env, extDir: bad, fs: fsWith(() => true), spawn: () => { spawned++; } });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('folder-corrupt');
    expect(spawned).toBe(0);
  });
  test('a spawn that throws degrades to launch-failed', () => {
    const r = Finder.forceLoad({ platform: PLATFORM, env, extDir: EXT, fs: fsWith((p) => p === chromeExe), spawn: () => { throw new Error('EACCES'); } });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('launch-failed');
  });
});
