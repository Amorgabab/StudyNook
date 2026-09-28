/* ============================================================
   StudyNook · sync-server.js — tiny localhost bridge for the
   Chrome extension (127.0.0.1 only, token-protected)
   ------------------------------------------------------------
   GET  /ping          → {ok, app}                (no token)
   POST /pair  {code}  → {token}                  (6-char code shown in Settings)
   GET  /state         → full rules + session     (header x-nook-token)
   POST /heartbeat     → {ok}                     (header x-nook-token)
   The extension polls /state: every ~5s while you're in a focus
   session (fast sync), every 30s otherwise.

   SECURITY MODEL (hardened):
   • Host-header validation on EVERY request → DNS-rebinding from
     a remote website is refused (only 127.0.0.1/localhost names).
   • No wildcard CORS: cross-origin reads are opt-in per origin via
     Settings → "Allow browser access" (off by default). With that
     off, only same-origin callers (the extension's service worker,
     which sends no Origin header to http URLs) can read anything.
   • An empty pairing token NEVER matches — requests carrying no
     token are rejected outright.
   • Pairing throttles per client IP (so one noisy caller cannot
     lock out the real user) and fails closed if the token is unset.
   ============================================================ */
'use strict';

const http = require('http');
const crypto = require('crypto');
const NookRules = require('../../extension/rules.js');

const PORT = 47470;
const dedupe = (arr) => arr.filter((x, i) => arr.indexOf(x) === i);
/* Only these Host spellings are accepted — kills DNS rebinding: a remote
   site whose name resolves to 127.0.0.1 still sends ITS OWN host header. */
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

class SyncServer {
  /**
   * @param hooks
   *   store: Store
   *   session: SessionEngine
   *   onExtStatus(connectedBool)
   */
  constructor(hooks) {
    this.hooks = hooks;
    this.server = null;
    this.lastConnected = false;
    this.pairAttempts = new Map(); // ip → [timestamps]
  }

  start() {
    this.server = http.createServer((req, res) => this._handle(req, res));
    this.server.on('error', (e) => {
      console.error('[sync] server error:', e.message);
      this.error = e.code === 'EADDRINUSE' ? 'port 47470 is busy — extension pairing unavailable until freed' : (e.message || 'bridge error');
    });
    this.server.listen(PORT, '127.0.0.1');
    console.log('[sync] listening on 127.0.0.1:' + PORT);
  }
  stop() { if (this.server) this.server.close(); this.server = null; }

  connected() {
    const last = this.hooks.store.data.ext.lastSeen || 0;
    return Date.now() - last < 90000;
  }

  /* ---------- security helpers ---------- */
  _hostOk(req) {
    let h = '';
    try { h = new URL('http://' + (req.headers.host || '')).hostname.toLowerCase(); } catch (e) { return false; }
    return ALLOWED_HOSTS.has(h);
  }
  /** Cross-origin reads allowed ONLY when the user opted in
      (Settings → "Allow browser access"). Otherwise: same-origin only
      (null ACAO ⇒ the browser blocks any foreign page from reading). */
  _cors(req) {
    const h = {};
    if (this.hooks.store.data.settings.bridgeAllowOrigins === true && req.headers.origin) {
      h['Access-Control-Allow-Origin'] = req.headers.origin;
      h['Access-Control-Allow-Headers'] = 'content-type,x-nook-token';
      h['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS';
      h['Vary'] = 'Origin';
    }
    return h;
  }
  _json(res, code, obj, req) {
    const body = JSON.stringify(obj);
    const headers = Object.assign({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }, req ? this._cors(req) : {});
    res.writeHead(code, headers);
    res.end(body);
  }

  _readBody(req) {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (c) => { data += c; if (data.length > 64000) req.destroy(); });
      req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    });
  }

  _token(req) { return typeof req.headers['x-nook-token'] === 'string' ? req.headers['x-nook-token'] : ''; }
  /** Constant-time compare of two ASCII secrets; an EMPTY stored token
      never matches anything (fail-closed, not accidental open door). */
  _tokenOk(req) {
    const given = this._token(req);
    const want = String(this.hooks.store.data.ext.token || '');
    if (!want || !given || given.length !== want.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(want));
    } catch (e) { return false; }
  }

  async _handle(req, res) {
    const url = (req.url || '').split('?')[0];

    // DNS-rebinding guard: refuse any request addressed to another host.
    if (!this._hostOk(req)) return this._json(res, 403, { ok: false, error: 'Bad host' });
    if (req.method === 'OPTIONS') return this._json(res, 204, {}, req);

    const store = this.hooks.store;

    if (url === '/ping' && req.method === 'GET') {
      return this._json(res, 200, { ok: true, app: 'studynook', port: PORT }, req);
    }

    if (url === '/pair' && req.method === 'POST') {
      // brute-force throttle PER CLIENT (max 10/min) — one bad actor can no
      // longer lock the real user out of pairing.
      const now = Date.now();
      const ip = (req.socket && req.socket.remoteAddress) || 'unknown';
      const attempts = (this.pairAttempts.get(ip) || []).filter((t) => now - t < 60000);
      if (attempts.length >= 10) {
        this.pairAttempts.set(ip, attempts);
        return this._json(res, 429, { ok: false, error: 'Too many attempts — wait a minute' }, req);
      }
      attempts.push(now);
      this.pairAttempts.set(ip, attempts);
      if (this.pairAttempts.size > 64) { // keep the map small
        const oldest = [...this.pairAttempts.entries()].sort((a, b) => (a[1][a[1].length - 1] || 0) - (b[1][b[1].length - 1] || 0));
        while (this.pairAttempts.size > 64 && oldest.length) this.pairAttempts.delete(oldest.shift()[0]);
      }
      const stored = String(store.data.ext.token || '');
      if (!stored) return this._json(res, 503, { ok: false, error: 'Bridge disabled — restart StudyNook' }, req);
      const body = await this._readBody(req);
      const code = String(body.code || '').toUpperCase().trim();
      const want = String(store.data.ext.code || '');
      // constant-time-ish compare (both are short fixed-alphabet strings)
      if (want && code.length === want.length && crypto.timingSafeEqual(Buffer.from(code), Buffer.from(want))) {
        return this._json(res, 200, { ok: true, token: stored }, req);
      }
      return this._json(res, 401, { ok: false, error: 'Wrong pairing code' }, req);
    }

    // ---- token-protected from here ----
    if (!this._tokenOk(req)) {
      return this._json(res, 401, { ok: false, error: 'Not paired' }, req);
    }
    const wasConnected = this.lastConnected;
    store.data.ext.lastSeen = Date.now();
    this.lastConnected = true;
    if (!wasConnected) this.hooks.onExtStatus && this.hooks.onExtStatus(true);

    if (url === '/state' && req.method === 'GET') {
      const d = store.data;
      const sess = this.hooks.session.publicState();
      return this._json(res, 200, {
        ok: true,
        now: Date.now(),
        session: sess,
        sites: {
          enabled: d.sites.enabled,
          mode: d.sites.mode,
          when: d.sites.when,
          block: d.sites.block,
          allow: d.sites.allow
        },
        pet: { name: d.pet.name, stage: d.pet.stage, totalFocusMin: d.pet.totalFocusMin },
        streak: d.streak.current,
        guardian: {
          armed: this.hooks.guardianArmed ? this.hooks.guardianArmed() : false
        }
      }, req);
    }

    if (url === '/heartbeat' && req.method === 'POST') {
      const body = await this._readBody(req);
      store.data.ext.version = String(body.version || '').slice(0, 20);
      return this._json(res, 200, { ok: true }, req);
    }

    // Extension-side quick edits (e.g. popup "block this site")
    if (url === '/sites' && req.method === 'POST') {
      const body = await this._readBody(req);
      store.mutate((d) => {
        const add = (list, v) => { const n = NookRules.normalizeEntry(v); if (n && !d.sites[list].includes(n)) d.sites[list].push(n); };
        const rm = (list, v) => { const n = NookRules.normalizeEntry(v); d.sites[list] = d.sites[list].filter((x) => x !== n); };
        if (body.addBlock) add('block', body.addBlock);
        if (body.addAllow) add('allow', body.addAllow);
        if (body.removeBlock) rm('block', body.removeBlock);
        if (body.removeAllow) rm('allow', body.removeAllow);
        if (Array.isArray(body.block)) d.sites.block = dedupe(body.block.map((x) => NookRules.normalizeEntry(x)).filter(Boolean)).slice(0, 500);
        if (Array.isArray(body.allow)) d.sites.allow = dedupe(body.allow.map((x) => NookRules.normalizeEntry(x)).filter(Boolean)).slice(0, 500);
        if (body.mode === 'block' || body.mode === 'allow') d.sites.mode = body.mode;
        if (body.when === 'session' || body.when === 'always') d.sites.when = body.when;
        if (typeof body.enabled === 'boolean') d.sites.enabled = body.enabled;
      });
      return this._json(res, 200, { ok: true }, req);
    }

    return this._json(res, 404, { ok: false, error: 'Not found' }, req);
  }
}

module.exports = { SyncServer, PORT };
