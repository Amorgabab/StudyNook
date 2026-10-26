/* ============================================================
   StudyNook · extfinder.js — find (and nudge-load) the extension
   ------------------------------------------------------------
   Chrome-family browsers do NOT let another program silently
   install an extension: that needs the user's click in the
   browser (or an admin-managed policy, which StudyNook does not
   touch). So "force load" here means the strongest thing that is
   still honest and safe:

     1. DETECT  — read each browser profile's own settings files
        (Secure Preferences / Preferences, extensions section only)
        to learn whether OUR unpacked extension folder is registered,
        enabled, disabled, half-registered, or absent.
     2. VALIDATE — check the extension folder itself on disk is
        complete (a truncated/corrupt folder can never load).
     3. LAUNCH  — start an installed browser with
        --load-extension=<our folder> and open the extensions page.
        That flag only applies to a freshly started browser process
        (a running one ignores it) and some newer branded Chrome
        builds ignore it entirely; the page it opens is the
        fallback ("Load unpacked" → pick the folder).

   Everything is read-only on browser data, uses no shell, and takes
   the extension folder from the app — never from the renderer.
   Pure where possible (fs/spawn/env injectable) so it unit-tests.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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

function browserExes(platform, env, id) {
  const P = pathFor(platform);
  if (platform === 'win32') {
    const pf = env.ProgramFiles || 'C:\\Program Files';
    const pf86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = env.LOCALAPPDATA || '';
    const w = (...a) => P.join(...a);
    return ({
      chrome: [w(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'), w(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'), local && w(local, 'Google', 'Chrome', 'Application', 'chrome.exe')],
      edge: [w(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), w(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe')],
      brave: [w(pf, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'), w(pf86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'), local && w(local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')],
      chromium: [local && w(local, 'Chromium', 'Application', 'chrome.exe')]
    }[id] || []).filter(Boolean);
  }
  if (platform === 'darwin') {
    return ({
      chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
      edge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
      brave: ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'],
      chromium: ['/Applications/Chromium.app/Contents/MacOS/Chromium']
    }[id] || []);
  }
  return ({
    chrome: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'],
    edge: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable'],
    brave: ['/usr/bin/brave-browser', '/usr/bin/brave'],
    chromium: ['/usr/bin/chromium', '/usr/bin/chromium-browser']
  }[id] || []);
}

const BROWSER_ORDER = ['chrome', 'edge', 'brave', 'chromium'];

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
  const reasons = Number(hit.reasons) > 0;
  if (hit.state === 0 || reasons) return { status: 'disabled', id: hit.id };
  if (hit.state === 1) return { status: 'enabled', id: hit.id };
  return { status: 'partial', id: hit.id };                   // registered but state missing/garbled
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
    case 'partial': return { title: 'Extension is only half-registered', detail: 'Remove it at chrome://extensions, then use "Open browser with extension" or Load unpacked again.' };
    case 'unreadable': return { title: 'Could not read the browser settings', detail: 'The browser may be writing them right now. Try again in a moment.' };
    case 'folder-corrupt': return { title: 'The extension folder is damaged' + miss, detail: (r.folder.error ? r.folder.error + '. ' : '') + 'Reinstall StudyNook to restore it.' };
    case 'no-browser': return { title: 'No Chrome, Edge, Brave or Chromium profile found', detail: 'Install a Chromium-based browser, then load the extension.' };
    default: return { title: 'Extension is not installed in your browser', detail: 'Use "Open browser with extension", or Load unpacked from chrome://extensions.' };
  }
}

/* ---------- 4. launch a browser with the extension ---------- */
function forceLoad(opts) {
  opts = opts || {};
  const platform = opts.platform || process.platform;
  const env = opts.env || process.env;
  const fsx = opts.fs || fs;
  const spawnFn = opts.spawn || spawn;

  const folder = validateFolder(opts.extDir, fsx);
  if (!folder.ok) return { ok: false, reason: 'folder-corrupt', detail: describe({ status: 'folder-corrupt', folder }).title + '. Reinstall StudyNook.' };

  const order = opts.browserId && BROWSER_ORDER.includes(opts.browserId) ? [opts.browserId] : BROWSER_ORDER;
  for (const id of order) {
    const exe = browserExes(platform, env, id).find((p) => { try { return fsx.existsSync(p); } catch (e) { return false; } });
    if (!exe) continue;
    const args = ['--load-extension=' + opts.extDir, 'chrome://extensions'];
    try {
      const child = spawnFn(exe, args, { detached: true, stdio: 'ignore' });
      if (child && child.on) child.on('error', () => {});     // async ENOENT must not crash the app
      if (child && child.unref) child.unref();
    } catch (e) { return { ok: false, reason: 'launch-failed', detail: 'Could not start the browser: ' + e.message }; }
    const name = id.charAt(0).toUpperCase() + id.slice(1);
    return {
      ok: true, browser: id, name, exe, args,
      detail: 'If your browser was already open the extension flag is ignored (and some newer Chrome builds ignore it too). The extensions page is open: turn on Developer mode → Load unpacked → pick ' + opts.extDir
    };
  }
  return { ok: false, reason: 'no-browser', detail: 'No Chrome, Edge, Brave or Chromium install was found.' };
}

module.exports = { detect, describe, forceLoad, validateFolder, inspectProfile, browserRoots, browserExes, REQUIRED_FILES };
