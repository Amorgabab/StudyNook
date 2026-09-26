/* ============================================================
   StudyNook extension · background.js — the service worker
   ------------------------------------------------------------
   • Talks to the desktop app over http://127.0.0.1:47470
     (fast 5s polling while you focus, slow 30s otherwise)
   • Builds declarativeNetRequest redirect rules (rules.js)
   • Falls back to STANDALONE mode (own lists + mini timer)
     when the desktop app isn't running
   • Badge shows the session countdown
   ============================================================ */
'use strict';

importScripts('rules.js');

const DESK = 'http://127.0.0.1:47470';
const R = self.NookRules;

/* ---------- tiny storage helpers ----------
   Writes are serialized: concurrent get-then-set calls can no longer
   clobber each other (audit + log + bounces all share this store). */
let _dbQ = Promise.resolve();
const db = {
  async get(def) {
    const o = await chrome.storage.local.get('nook');
    return Object.assign(def || {}, (o && o.nook) || {});
  },
  set(patch) {
    _dbQ = _dbQ.then(() => this.get({}).then((cur) => chrome.storage.local.set({ nook: Object.assign(cur, patch) })), () => {});
    return _dbQ;
  }
};
const DEFAULTS = {
  token: null,
  connected: false,
  lastSync: 0,
  sites: { enabled: true, mode: 'block', when: 'session', block: ['youtube.com', 'twitter.com', 'x.com', 'reddit.com', 'twitch.tv', 'instagram.com', 'tiktok.com', 'facebook.com'], allow: ['wikipedia.org', 'google.com', 'docs.google.com', 'chatgpt.com'] },
  session: { active: false, running: false, phase: 'idle', remainingSec: 0, totalSec: 0 },
  timer: null,           // standalone timer {running, phase, endsAt, pausedRemaining, workMin, breakMin}
  bounces: {},           // domain → count
  lastBlocked: null      // {domain, ts}
};

/* ---------- desktop sync ---------- */
async function deskFetch(path, opts) {
  const st = await db.get(DEFAULTS);
  const headers = Object.assign({}, (opts && opts.headers) || {});
  if (st.token) headers['x-nook-token'] = st.token;
  const res = await fetch(DESK + path, Object.assign({ headers, cache: 'no-store' }, opts || {}));
  if (res.status === 401) throw new Error('unauthorized');
  return res.json();
}

async function syncOnce() {
  const st = await db.get(DEFAULTS);
  const prevActive = sessionIsActive(st);
  try {
    const s = await deskFetch('/state');
    if (!s.ok) throw new Error('bad state');
    const wasConnected = st.connected;
    const sessionActive = !!(s.session && s.session.active && s.session.phase === 'focus' && s.session.running);
    if (!wasConnected) {
      // returning from standalone: don't clobber pins/blocks added locally while offline
      const localPins = (st.sites.allow || []).filter((e) => R.parseRule(e).path).filter((e) => !(s.sites.allow || []).includes(e));
      const localBlocks = (st.sites.block || []).filter((e) => !(s.sites.block || []).includes(e));
      if (localPins.length || localBlocks.length) {
        try {
          await fetch(DESK + '/sites', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-nook-token': st.token || '' },
            body: JSON.stringify({ allow: (s.sites.allow || []).concat(localPins), block: (s.sites.block || []).concat(localBlocks) })
          });
          s.sites.allow = (s.sites.allow || []).concat(localPins);
          s.sites.block = (s.sites.block || []).concat(localBlocks);
        } catch (e) {}
      }
    }
    await db.set({ connected: true, lastSync: Date.now(), sites: s.sites, session: s.session, pet: s.pet, streak: s.streak });
    if (!wasConnected) console.log('[nook] desktop connected');
    if (!prevActive && sessionActive) auditOpenTabs();   // session just started → nap open offenders
    await updateRules();
    updateBadge(s.session);
    // Belt #3: re-check every open tab on each sync (~5s in sessions, ~30s
    // idle). The audit self-gates; hardcoded Shorts is caught even idle.
    auditOpenTabs();
    // fast loop while focusing keeps sync near-instant
    if (sessionActive) setTimeout(() => syncOnce().catch(() => {}), 5000);
  } catch (e) {
    if (e && e.message === 'unauthorized') {
      // desktop was reset / re-paired elsewhere: drop our stale token so the pair card returns
      await db.set({ token: null, connected: false });
      return;
    }
    if (st.connected) console.log('[nook] desktop gone → standalone');
    await db.set({ connected: false });
    await updateRules();
    auditOpenTabs();   // standalone sweep too (already-open tabs included)
    tickStandalone();
  }
}

async function pair(code) {
  const res = await fetch(DESK + '/pair', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const j = await res.json();
  if (!j.ok || !j.token) return { ok: false };
  await db.set({ token: j.token });
  await fetch(DESK + '/heartbeat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-nook-token': j.token }, body: JSON.stringify({ version: chrome.runtime.getManifest().version }) }).catch(() => {});
  await syncOnce();
  return { ok: true };
}

/* ---------- rules ---------- */
async function updateRules() {
  const st = await db.get(DEFAULTS);
  const sessionActive = sessionIsActive(st);
  const rules = R.buildRules(st.sites, sessionActive);
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map((r) => r.id),
      addRules: rules
    });
  } catch (e) {
    // Never let a bad rule kill the sync loop — report and keep going.
    console.error('[nook] updateDynamicRules failed:', e && e.message, JSON.stringify(rules));
  }
}
function sessionIsActive(st) {
  if (st.connected) return !!(st.session && st.session.active && st.session.phase === 'focus' && st.session.running);
  return !!(st.timer && st.timer.running && st.timer.phase === 'focus');
}

/* ---------- blocked-tab bookkeeping ---------- */
const BLOCKED_URL = () => chrome.runtime.getURL('blocked/blocked.html');

async function recordAndNap(tabId, url, via) {
  const st = await db.get(DEFAULTS);
  const host = R.hostOf(url);
  const bounces = st.bounces || {};
  bounces[host] = (bounces[host] || 0) + 1;
  await db.set({ bounces, lastBlocked: { domain: host, ts: Date.now() } });
  try { await chrome.tabs.update(tabId, { url: BLOCKED_URL() }); } catch (e) {}
}

/* Single-page apps (YouTube!) change the URL without a page load.
   Network-level DNR rules can't see that — these events can. */
function onSpaNavigation(det) {
  if (det.frameId !== 0) return;
  db.get(DEFAULTS).then((st) => {
    if (R.wouldBlock(st.sites, sessionIsActive(st), det.url)) recordAndNap(det.tabId, det.url, 'spa-jump');
  });
}
chrome.webNavigation.onHistoryStateUpdated.addListener(onSpaNavigation);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(onSpaNavigation);

/* Belt #2: ANY tab URL change (pushState, replaceState, redirects…) also
   updates the tab object — this event always fires, no exceptions. */
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  db.get(DEFAULTS).then((st) => {
    if (R.wouldBlock(st.sites, sessionIsActive(st), changeInfo.url)) recordAndNap(tabId, changeInfo.url, 'tab-url-change');
  });
});

/* When blocking is ACTIVE (session mode while focusing, or always mode),
   nap any already-open offending tabs. State-driven: doesn't depend on
   the tab navigating, reloading, or firing any event at all. */
async function auditOpenTabs() {
  const st = await db.get(DEFAULTS);
  const focusing = sessionIsActive(st);
  if (!R.isBlockingActive(st.sites, focusing)) return;
  let tabs = [];
  try { tabs = await chrome.tabs.query({}); } catch (e) { return; }
  let napped = 0;
  for (const t of tabs) {
    if (!t.url || !/^https?:/i.test(t.url)) continue;
    if (R.wouldBlock(st.sites, focusing, t.url)) {
      const host = R.hostOf(t.url);
      const bounces = st.bounces || {};
      bounces[host] = (bounces[host] || 0) + 1;
      await db.set({ bounces, lastBlocked: { domain: host, ts: Date.now() } });
        try { await chrome.tabs.update(t.id, { url: BLOCKED_URL() }); napped++; } catch (e) {}
    }
  }
  await db.set({ lastAudit: Date.now(), lastAuditNapped: napped });
  return napped;
}

chrome.webNavigation.onBeforeNavigate.addListener(async (det) => {
  if (det.frameId !== 0) return;
  const st = await db.get(DEFAULTS);
  if (R.wouldBlock(st.sites, sessionIsActive(st), det.url)) {
    const host = R.hostOf(det.url);
    const bounces = st.bounces || {};
    bounces[host] = (bounces[host] || 0) + 1;
    await db.set({ bounces, lastBlocked: { domain: host, ts: Date.now() } });
  }
});

/* ---------- standalone timer ---------- */
function tickStandalone() {
  // called on alarms & sync failures: advance standalone timer phases
  db.get(DEFAULTS).then((st) => {
    const t = st.timer;
    if (!t || !t.running) { updateBadge(null); return; }
    if (Date.now() >= t.endsAt) {
      const next = t.phase === 'focus' ? 'break' : 'focus';
      const sec = (next === 'focus' ? t.workMin : t.breakMin) * 60;
      db.set({ timer: Object.assign(t, { phase: next, endsAt: Date.now() + sec * 1000 }) }).then(async () => {
        await updateRules();
        chrome.alarms.create('phase', { when: Date.now() + sec * 1000 });
      });
    }
    updateBadgeFromTimer(t);
  });
}
function updateBadgeFromTimer(t) {
  if (!t || !t.running) { chrome.action.setBadgeText({ text: '' }); return; }
  const rem = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
  chrome.action.setBadgeText({ text: t.phase === 'focus' ? String(Math.ceil(rem / 60)) : '☕' });
  chrome.action.setBadgeBackgroundColor({ color: t.phase === 'focus' ? '#E8886B' : '#7FB685' });
}
function updateBadge(session) {
  if (!session || !session.active || !session.running) { chrome.action.setBadgeText({ text: '' }); return; }
  chrome.action.setBadgeText({ text: session.phase === 'focus' ? String(Math.ceil(session.remainingSec / 60)) : '☕' });
  chrome.action.setBadgeBackgroundColor({ color: session.phase === 'focus' ? '#E8886B' : '#7FB685' });
}

/* ---------- lifecycle ---------- */
chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create('slow', { periodInMinutes: 0.5 }); syncOnce(); });
chrome.runtime.onStartup.addListener(() => { chrome.alarms.create('slow', { periodInMinutes: 0.5 }); syncOnce(); });
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'slow') syncOnce();
  if (a.name === 'phase') tickStandalone();
  if (a.name === 'badge') db.get(DEFAULTS).then((st) => {
    st.connected ? updateBadge(st.session) : updateBadgeFromTimer(st.timer);
    auditOpenTabs();   // periodic state-driven sweep (self-gates)
  });
});
chrome.alarms.create('badge', { periodInMinutes: 0.5 });

/* ---------- messages from popup / blocked page ---------- */
chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  (async () => {
    try { send(await handle(msg)); } catch (e) { send({ ok: false, error: String(e && e.message || e) }); }
  })();
  return true; // async response
});

async function handle(msg) {
  const st = await db.get(DEFAULTS);
  switch (msg.type) {
    case 'get-state':
      return { ok: true, state: st, manifest: chrome.runtime.getManifest().version };
    case 'sync':
      await syncOnce();
      return { ok: true, state: await db.get(DEFAULTS) };
    case 'audit-now': {
      const n = await auditOpenTabs();
      return { ok: true, napped: n, state: await db.get(DEFAULTS) };
    }
    case 'pair':
      return pair(String(msg.code || '').trim().toUpperCase());
    case 'timer': {
      const t = st.timer || { running: false, phase: 'focus', endsAt: 0, pausedRemaining: 0, workMin: 25, breakMin: 5 };
      if (msg.op === 'start') {
        t.workMin = msg.workMin || t.workMin; t.breakMin = msg.breakMin || t.breakMin;
        t.running = true; t.phase = 'focus'; t.endsAt = Date.now() + t.workMin * 60000; t.pausedRemaining = 0;
        chrome.alarms.create('phase', { when: t.endsAt });
      } else if (msg.op === 'pause') {
        t.pausedRemaining = Math.max(0, Math.round((t.endsAt - Date.now()) / 1000)); t.running = false;
      } else if (msg.op === 'resume') {
        t.endsAt = Date.now() + (t.pausedRemaining || t.workMin * 60) * 1000; t.running = true;
        chrome.alarms.create('phase', { when: t.endsAt });
      } else if (msg.op === 'stop') {
        st.timer = null; await db.set({ timer: null }); await updateRules(); updateBadge(null);
        return { ok: true };
      }
      await db.set({ timer: t });
      await updateRules();
      updateBadgeFromTimer(t);
      if (t.running) auditOpenTabs();   // AFTER storage write: sweep sees the fresh timer
      return { ok: true };
    }
    default:
      return { ok: false, error: 'unknown message' };
  }
}
