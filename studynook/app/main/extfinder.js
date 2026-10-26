/* ============================================================
   StudyNook · extfinder.js — is the extension installed and on?
   ------------------------------------------------------------
     1. VALIDATE — check the extension folder on disk is complete
        (a truncated/corrupt folder can never load).
     2. DETECT   — read each browser profile's own settings files
        (Secure Preferences / Preferences, extensions section only)
        to learn whether OUR unpacked extension folder is registered,
        enabled, disabled, half-registered, or absent.
   Read-only on browser data; the extension folder always comes from
   the app, never from the renderer. fs/env are injectable for tests.
   (The old "open a browser with --load-extension" helper was removed:
   current Chrome ignores that flag.)
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'manifest.json', 'background.js', 'rules.js',
  'blocked/blocked.html', 'blocked/blocked.js', 'popup/popup.html', 'popup/popup.js'
];

const pathFor = (platform) => (platform === 'win32' ? path.win32 : path.posix);

/* ---------- 1. is the folder on disk complete? ---------- */
function validateFolder(dir, fsx) {
  fsx = fsx || fs;
  const missing = [];
  for (const f of REQUIRED_FILES) {
    try { const st = fsx.statSync(path.join(dir, f)); if (!st.isFile() || st.size === 0) missing.push(f); }
    catch (e) { missing.push(f); }
  }
  let manifest = null, error = null;
  try { manifest = JSON.parse(fsx.readFileSync(path.join(dir, 'manifest.json'), 'utf8')); }
  catch (e) { error = 'manifest.json is unreadable'; }
  if (manifest && manifest.manifest_version !== 3) error = 'manifest.json is not Manifest V3';
  return { ok: missing.length === 0 && !error, missing, error, version: (manifest && manifest.version) || null };
}

/* ---------- browser locations ---------- */
function browserRoots(platform, env, home) {
  const P = pathFor(platform);
  if (platform === 'win32') {
    const base = env.LOCALAPPDATA || P.join(home, 'AppData', 'Local');
    return [
      { id: 'chrome', name: 'Chrome', root: P.join(base, 'Google', 'Chrome', 'User Data') },
      { id: 'edge', name: 'Edge', root: P.join(base, 'Microsoft', 'Edge', 'User Data') },
      { id: 'brave', name: 'Brave', root: P.join(base, 'BraveSoftware', 'Brave-Browser', 'User Data') },
      { id: 'chromium', name: 'Chromium', root: P.join(base, 'Chromium', 'User Data') }
    ];
  }
  if (platform === 'darwin') {
    const base = P.join(home, 'Library', 'Application Support');
    return [
      { id: 'chrome', name: 'Chrome', root: P.join(base, 'Google', 'Chrome') },
      { id: 'edge', name: 'Edge', root: P.join(base, 'Microsoft Edge') },
      { id: 'brave', name: 'Brave', root: P.join(base, 'BraveSoftware', 'Brave-Browser') },
      { id: 'chromium', name: 'Chromium', root: P.join(base, 'Chromium') }
    ];
  }
  const base = P.join(home, '.config');
  return [
    { id: 'chrome', name: 'Chrome', root: P.join(base, 'google-chrome') },
    { id: 'edge', name: 'Edge', root: P.join(base, 'microsoft-edge') },
    { id: 'brave', name: 'Brave', root: P.join(base, 'BraveSoftware', 'Brave-Browser') },
    { id: 'chromium', name: 'Chromium', root: P.join(base, 'chromium') }
  ];
}


/* Chrome stores the unpacked-extension path as given; compare loosely. */
function samePath(a, b, platform) {
  const P = pathFor(platform);
  const norm = (p) => P.normalize(String(p)).replace(/[\\/]+$/, '');
  const x = norm(a), y = norm(b);
  return platform === 'linux' ? x === y : x.toLowerCase() === y.toLowerCase();
}

/* ---------- 2. what does ONE profile say about our extension? ---------- */
function inspectProfile(profileDir, extDir, platform, fsx) {
  fsx = fsx || fs;
  const P = pathFor(platform);
  let readAny = false, hit = null;
  for (const f of ['Secure Preferences', 'Preferences']) {
    let json;
    try { json = JSON.parse(fsx.readFileSync(P.join(profileDir, f), 'utf8')); readAny = true; }
    catch (e) { continue; }                                   // missing / mid-write / corrupt → try the other file
    const settings = json && json.extensions && json.extensions.settings;
    if (!settings || typeof settings !== 'object') continue;
    for (const id of Object.keys(settings)) {
      const e = settings[id];
      if (e && typeof e.path === 'string' && samePath(e.path, extDir, platform)) { hit = { id, state: e.state, reasons: e.disable_reasons }; break; }
    }
    if (hit) break;
  }
  if (!readAny) return { status: 'unreadable' };
  if (!hit) return { status: 'not-installed' };
  /* What Chrome (verified on 155) actually writes: an ENABLED extension has no
     `state` at all and `disable_reasons: []`; a DISABLED one has
     `disable_reasons: [1]` (a list — older builds used a number / state 0). */
  const r = hit.reasons;
  const hasReasons = Array.isArray(r) ? r.length > 0 : Number(r) > 0;
  if (hit.state === 0 || hasReasons) return { status: 'disabled', id: hit.id };
  if (hit.state === undefined || hit.state === 1) return { status: 'enabled', id: hit.id };
  return { status: 'partial', id: hit.id };                   // registered but in an unknown state (e.g. terminated)
}

const RANK = ['enabled', 'disabled', 'partial', 'unreadable', 'not-installed'];

/* ---------- 3. scan every browser profile on the machine ---------- */
function detect(opts) {
  opts = opts || {};
  const platform = opts.platform || process.platform;
  const env = opts.env || process.env;
  const home = opts.home || require('os').homedir();
  const fsx = opts.fs || fs;
  const P = pathFor(platform);
  const folder = validateFolder(opts.extDir, fsx);

  const browsers = [];
  for (const b of browserRoots(platform, env, home)) {
    let names = [];
    try { names = fsx.readdirSync(b.root); } catch (e) { continue; }   // browser not installed for this user
    const profiles = names
      .filter((n) => n === 'Default' || /^Profile \d+$/.test(n))
      .map((n) => Object.assign({ profile: n }, inspectProfile(P.join(b.root, n), opts.extDir, platform, fsx)));
    if (profiles.length) browsers.push({ id: b.id, name: b.name, profiles });
  }

  let status;
  if (!folder.ok) status = 'folder-corrupt';
  else if (!browsers.length) status = 'no-browser';
  else {
    const all = browsers.flatMap((b) => b.profiles.map((p) => p.status));
    status = RANK.find((s) => all.includes(s)) || 'not-installed';
  }
  return { status, folder, browsers };
}

/* Student-readable text for a detect() result. */
function describe(r) {
  const miss = r.folder && r.folder.missing && r.folder.missing.length ? ' (missing: ' + r.folder.missing.slice(0, 3).join(', ') + ')' : '';
  switch (r.status) {
    case 'enabled': return { title: 'Extension is installed and on', detail: 'Your browser reports it enabled. If it still shows "not connected", open its popup and pair it with the code in Sites.' };
    case 'disabled': return { title: 'Extension is installed but turned off', detail: 'Open chrome://extensions and switch StudyNook back on.' };
    case 'partial': return { title: 'Extension is only half-registered', detail: 'Remove it at chrome://extensions, then use Load unpacked again.' };
    case 'unreadable': return { title: 'Could not read the browser settings', detail: 'The browser may be writing them right now. Try again in a moment.' };
    case 'folder-corrupt': return { title: 'The extension folder is damaged' + miss, detail: (r.folder.error ? r.folder.error + '. ' : '') + 'Reinstall StudyNook to restore it.' };
    case 'no-browser': return { title: 'No Chrome, Edge, Brave or Chromium profile found', detail: 'Install a Chromium-based browser, then load the extension.' };
    default: return { title: 'Extension is not installed in your browser', detail: 'Open chrome://extensions, turn on Developer mode and use Load unpacked.' };
  }
}

module.exports = { detect, describe, validateFolder, inspectProfile, browserRoots, REQUIRED_FILES };
