/* ============================================================
   EXTENSION EMULATION TESTS 🧪
   Loads the REAL extension/background.js + rules.js into a VM
   with a fake Chrome API, then simulates a browser:
     • already-open tabs (the recurring bug class)
     • SPA in-page jumps (Shorts click / TikTok scroll)
     • URL-change events
     • breaks, always-mode, standalone timer
     • GOOGLE in every scenario (must never be napped)
   If any of these regress, this file fails loudly.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT = path.join(__dirname, '..', 'extension');
const BLOCKED = 'chrome-extension://testext/blocked/blocked.html';

/* ---------- fake chrome ---------- */
function makeChrome() {
  const chrome = {
    _store: {},                 // storage.local
    _tabs: [],                  // [{id,url}]
    _nextTabId: 1,
    _rules: [],
    _napLog: [],                // recorded naps {id, url}
    _listeners: { onUpdated: [], historyState: [], fragState: [], beforeNav: [], alarm: [], message: [] },
    _alarms: {}
  };
  chrome.storage = {
    local: {
      get: (key) => Promise.resolve(key ? { [key]: chrome._store[key] } : Object.assign({}, chrome._store)),
      set: (obj) => { Object.assign(chrome._store, obj); return Promise.resolve(); }
    }
  };
  chrome.tabs = {
    query: () => Promise.resolve(chrome._tabs.map((t) => Object.assign({}, t))),
    get: (id) => Promise.resolve(chrome._tabs.find((t) => t.id === id) || null),
    update: (id, props) => {
      const t = chrome._tabs.find((t) => t.id === id);
      if (t && props.url) { chrome._napLog.push({ id, url: props.url, from: t.url }); t.url = props.url; }
      return Promise.resolve(t);
    },
    create: (props) => { const t = { id: chrome._nextTabId++, url: props.url }; chrome._tabs.push(t); return Promise.resolve(t); },
    remove: (id) => { chrome._tabs = chrome._tabs.filter((t) => t.id !== id); return Promise.resolve(); },
    onUpdated: { addListener: (fn) => chrome._listeners.onUpdated.push(fn) }
  };
  chrome.webNavigation = {
    onBeforeNavigate: { addListener: (fn) => chrome._listeners.beforeNav.push(fn) },
    onHistoryStateUpdated: { addListener: (fn) => chrome._listeners.historyState.push(fn) },
    onReferenceFragmentUpdated: { addListener: (fn) => chrome._listeners.fragState.push(fn) }
  };
  chrome.alarms = {
    create: (name, opts) => { chrome._alarms[name] = opts; },
    onAlarm: { addListener: (fn) => chrome._listeners.alarm.push(fn) }
  };
  chrome.declarativeNetRequest = {
    getDynamicRules: () => Promise.resolve(chrome._rules.slice()),
    updateDynamicRules: ({ removeRuleIds, addRules }) => {
      chrome._rules = chrome._rules.filter((r) => !removeRuleIds.includes(r.id)).concat(addRules || []);
      return Promise.resolve();
    }
  };
  chrome.runtime = {
    getURL: (p) => 'chrome-extension://testext/' + p,
    getManifest: () => ({ version: '1.2.0' }),
    onInstalled: { addListener: () => {} },
    onStartup: { addListener: () => {} },
    onMessage: { addListener: (fn) => chrome._listeners.message.push(fn) }
  };
  chrome.action = { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} };
  return chrome;
}

/* ---------- load the real extension code ---------- */
function loadExtension(chrome) {
  const sandbox = {
    chrome,
    console: { log: () => {}, error: () => {}, warn: () => {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: () => Promise.reject(new Error('desktop offline (standalone mode)')),
    Date, Math, JSON, Object, Array, Promise, RegExp, URL, isNaN, parseInt, String, Number
  };
  const ctx = vm.createContext(sandbox);
  sandbox.self = sandbox;
  sandbox.importScripts = (f) => vm.runInContext(fs.readFileSync(path.join(EXT, f), 'utf8'), ctx, { filename: f });
  vm.runInContext(fs.readFileSync(path.join(EXT, 'background.js'), 'utf8'), ctx, { filename: 'background.js' });
  return ctx;
}

/* ---------- helpers ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function flush(n = 6) { for (let i = 0; i < n; i++) await sleep(5); }

function setup(opts) {
  const chrome = makeChrome();
  loadExtension(chrome);
  const nook = {
    token: null,
    // a live desktop session implies a paired connection (models reality)
    connected: opts.connected !== undefined ? opts.connected : !!(opts.session && opts.session.active),
    lastSync: 0,
    sites: opts.sites,
    session: opts.session || { active: false, running: false, phase: 'idle', remainingSec: 0, totalSec: 0 },
    timer: opts.timer || null,
    bounces: {}, lastBlocked: null
  };
  chrome._store.nook = nook;
  for (const u of (opts.tabs || [])) chrome._tabs.push({ id: chrome._nextTabId++, url: u });
  return chrome;
}
async function fireBadge(chrome) {
  for (const fn of chrome._listeners.alarm) await fn({ name: 'badge' });
  await flush();
}
async function fireSlow(chrome) {
  for (const fn of chrome._listeners.alarm) await fn({ name: 'slow' });
  await flush();
}
async function fireHistoryState(chrome, tabId, url) {
  const t = chrome._tabs.find((t) => t.id === tabId);
  if (t) t.url = url;
  for (const fn of chrome._listeners.historyState) await fn({ frameId: 0, tabId, url });
  await flush();
}
async function fireTabsUpdated(chrome, tabId, url) {
  const t = chrome._tabs.find((t) => t.id === tabId);
  if (t) t.url = url;
  for (const fn of chrome._listeners.onUpdated) await fn(tabId, { url });
  await flush();
}
const napped = (chrome) => chrome._napLog.map((n) => n.from);
const tabUrl = (chrome, id) => (chrome._tabs.find((t) => t.id === id) || {}).url;

const SITES = (over) => Object.assign({ enabled: true, mode: 'block', when: 'session', block: ['tiktok.com'], allow: ['google.com', 'wikipedia.org'] }, over || {});
const FOCUS_SESSION = { active: true, running: true, phase: 'focus', remainingSec: 1200, totalSec: 1500 };
const BREAK_SESSION = { active: true, running: true, phase: 'short', remainingSec: 200, totalSec: 300 };

/* ============================================================ */
suite('extension emulation · ALREADY-OPEN tabs (the bug class)', () => {
  test('blocklist path entry: open shorts tab + session → napped; google kept', async () => {
    const c = setup({ sites: SITES({ block: ['tiktok.com', 'youtube.com/shorts'] }), session: FOCUS_SESSION, tabs: ['https://www.youtube.com/shorts/abc', 'https://www.google.com'] });
    await fireBadge(c);
    expect(tabUrl(c, 1)).toBe(BLOCKED);
    expect(tabUrl(c, 2)).toBe('https://www.google.com');
  });

  test('blocklist: open tiktok tab + running session → napped; google kept', async () => {
    const c = setup({ sites: SITES(), session: FOCUS_SESSION, tabs: ['https://www.tiktok.com/foryou', 'https://www.google.com/search?q=calc'] });
    await fireBadge(c);
    expect(tabUrl(c, 1)).toBe(BLOCKED);
    expect(tabUrl(c, 2)).toBe('https://www.google.com/search?q=calc');
  });

  test('always-mode: open tiktok tab, NO session → napped', async () => {
    const c = setup({ sites: SITES({ when: 'always' }), tabs: ['https://www.tiktok.com/foryou', 'https://www.google.com'] });
    await fireBadge(c);
    expect(tabUrl(c, 1)).toBe(BLOCKED);
    expect(tabUrl(c, 2)).toBe('https://www.google.com');
  });

  test('session mode, NO session: rules sleep — nothing napped, google safe', async () => {
    const c = setup({ sites: SITES({ block: ['tiktok.com', 'youtube.com/shorts'] }), tabs: ['https://www.tiktok.com/foryou', 'https://www.youtube.com/shorts/x', 'https://www.google.com'] });
    await fireBadge(c);
    expect(tabUrl(c, 1)).toBe('https://www.tiktok.com/foryou');
    expect(tabUrl(c, 2)).toBe('https://www.youtube.com/shorts/x');
    expect(tabUrl(c, 3)).toBe('https://www.google.com');
  });

  test('break time: everything unlocked again (tiktok, shorts), google safe', async () => {
    const c = setup({ sites: SITES({ block: ['tiktok.com', 'youtube.com/shorts'] }), session: BREAK_SESSION, tabs: ['https://www.tiktok.com/foryou', 'https://www.youtube.com/shorts/x', 'https://www.google.com'] });
    await fireBadge(c);
    expect(tabUrl(c, 1)).toBe('https://www.tiktok.com/foryou');
    expect(tabUrl(c, 2)).toBe('https://www.youtube.com/shorts/x');
    expect(tabUrl(c, 3)).toBe('https://www.google.com');
  });

  test('blocking OFF: nothing napped at all (google, tiktok, shorts)', async () => {
    const c = setup({ sites: SITES({ enabled: false }), session: FOCUS_SESSION, tabs: ['https://www.tiktok.com', 'https://www.youtube.com/shorts/x', 'https://www.google.com'] });
    await fireBadge(c);
    expect(napped(c).length).toBe(0);
  });
});

suite('extension emulation · in-page SPA jumps & URL changes', () => {
  test('Shorts click inside YouTube (pushState) → napped instantly, google tab untouched', async () => {
    const c = setup({ sites: SITES({ block: ['tiktok.com', 'youtube.com/shorts'] }), session: FOCUS_SESSION, tabs: ['https://www.youtube.com/watch?v=lec', 'https://www.google.com'] });
    await fireHistoryState(c, 1, 'https://www.youtube.com/shorts/v1');
    expect(tabUrl(c, 1)).toBe(BLOCKED);
    expect(tabUrl(c, 2)).toBe('https://www.google.com');
  });

  test('pushState to shorts: napped when path entry listed + session; unlisted → untouched', async () => {
    const c = setup({ sites: SITES({ block: ['tiktok.com', 'youtube.com/shorts'] }), session: FOCUS_SESSION, tabs: ['https://www.youtube.com/watch?v=lec'] });
    await fireHistoryState(c, 1, 'https://www.youtube.com/shorts/v2');
    expect(tabUrl(c, 1)).toBe(BLOCKED);
    const c2 = setup({ sites: SITES({ block: ['tiktok.com'] }), session: FOCUS_SESSION, tabs: ['https://www.youtube.com/watch?v=lec'] });
    await fireHistoryState(c2, 1, 'https://www.youtube.com/shorts/v3');
    expect(tabUrl(c2, 1)).toBe('https://www.youtube.com/shorts/v3');
  });

  test('tabs.onUpdated: tiktok URL change during session → napped', async () => {
    const c = setup({ sites: SITES(), session: FOCUS_SESSION, tabs: ['https://www.example.com'] });
    await fireTabsUpdated(c, 1, 'https://www.tiktok.com/@someone');
    expect(tabUrl(c, 1)).toBe(BLOCKED);
  });

  test('tabs.onUpdated: google URL change during session → NOT napped', async () => {
    const c = setup({ sites: SITES(), session: FOCUS_SESSION, tabs: ['https://www.google.com'] });
    await fireTabsUpdated(c, 1, 'https://www.google.com/search?q=photosynthesis');
    expect(tabUrl(c, 1)).toBe('https://www.google.com/search?q=photosynthesis');
    expect(napped(c).length).toBe(0);
  });

  test('allow-mode: google search allowed, wandered article napped, google home kept', async () => {
    const c = setup({
      sites: SITES({ mode: 'allow', allow: ['google.com', 'bassthalk.com'], block: ['youtube.com/shorts'] }),
      session: FOCUS_SESSION,
      tabs: ['https://www.google.com', 'https://www.britannica.com/x', 'https://bassthalk.com/hw']
    });
    await fireBadge(c);
    expect(tabUrl(c, 1)).toBe('https://www.google.com');
    expect(tabUrl(c, 2)).toBe(BLOCKED);
    expect(tabUrl(c, 3)).toBe('https://bassthalk.com/hw');
  });
});

suite('extension emulation · rules & standalone timer', () => {
  test('DNR rules include the user\'s shorts path rule when listed + blocking active', async () => {
    const c = setup({ sites: SITES({ when: 'always', block: ['tiktok.com', 'youtube.com/shorts'] }), tabs: [] });
    await fireSlow(c);   // syncOnce → desktop offline → updateRules
    expect(c._rules.some((r) => r.condition.urlFilter === '||youtube.com/shorts')).toBeTruthy();
  });
  test('standalone timer start naps already-open offenders', async () => {
    const c = setup({ sites: SITES({ when: 'session' }), tabs: ['https://www.tiktok.com/foryou', 'https://www.google.com'] });
    // send the timer start message like the popup does
    const resp = await new Promise((resolve) => { c._listeners.message[0]({ type: 'timer', op: 'start', workMin: 25, breakMin: 5 }, {}, resolve); });
    await flush(10);
    expect(resp.ok).toBeTruthy();
    expect(tabUrl(c, 1)).toBe(BLOCKED);
    expect(tabUrl(c, 2)).toBe('https://www.google.com');
  });
});

suite('extension emulation · lecture-lock pins', () => {
  test('allow-mode: pinned lecture stays, SPA wander to another video napped, google safe', async () => {
    const lockSites = { enabled: true, mode: 'allow', when: 'session', allow: ['youtube.com/watch?v=lec123', 'google.com'], block: ['youtube.com/shorts'] };
    const c = setup({ sites: lockSites, session: FOCUS_SESSION, tabs: ['https://www.youtube.com/watch?v=lec123', 'https://www.google.com'] });
    await fireBadge(c);   // audit must leave pinned lecture + google alone
    expect(tabUrl(c, 1)).toBe('https://www.youtube.com/watch?v=lec123');
    expect(tabUrl(c, 2)).toBe('https://www.google.com');
    await fireHistoryState(c, 1, 'https://www.youtube.com/watch?v=recommended99');  // wander off mid-lecture
    expect(tabUrl(c, 1)).toBe(BLOCKED);
    await fireBadge(c);   // and the sweep agrees
    expect(tabUrl(c, 2)).toBe('https://www.google.com');
  });
});
