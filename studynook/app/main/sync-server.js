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
   ============================================================ */
'use strict';

const http = require('http');
const NookRules = require('../../extension/rules.js');

const PORT = 47470;
const dedupe = (arr) => arr.filter((x, i) => arr.indexOf(x) === i);

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

  _json(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type,x-nook-token',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  }

  _readBody(req) {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (c) => { data += c; if (data.length > 64000) req.destroy(); });
      req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    });
  }

  _token(req) { return req.headers['x-nook-token'] || ''; }

  async _handle(req, res) {
    const url = (req.url || '').split('?')[0];
    if (req.method === 'OPTIONS') return this._json(res, 200, { ok: true });

    const store = this.hooks.store;

    if (url === '/ping' && req.method === 'GET') {
      return this._json(res, 200, { ok: true, app: 'studynook', port: PORT });
    }

    if (url === '/pair' && req.method === 'POST') {
      // brute-force throttle: max 10 attempts per minute
      const now = Date.now();
      this.pairAttempts = (this.pairAttempts || []).filter((t) => now - t < 60000);
      if (this.pairAttempts.length >= 10) return this._json(res, 429, { ok: false, error: 'Too many attempts — wait a minute' });
      this.pairAttempts.push(now);
      const body = await this._readBody(req);
      const code = String(body.code || '').toUpperCase().trim();
      if (code === store.data.ext.code) {
        return this._json(res, 200, { ok: true, token: store.data.ext.token });
      }
      return this._json(res, 401, { ok: false, error: 'Wrong pairing code' });
    }

    // ---- token-protected from here ----
    if (this._token(req) !== store.data.ext.token) {
      return this._json(res, 401, { ok: false, error: 'Not paired' });
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
      });
    }

    if (url === '/heartbeat' && req.method === 'POST') {
      const body = await this._readBody(req);
      store.data.ext.version = String(body.version || '').slice(0, 20);
      return this._json(res, 200, { ok: true });
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
      return this._json(res, 200, { ok: true });
    }

    return this._json(res, 404, { ok: false, error: 'Not found' });
  }
}

module.exports = { SyncServer, PORT };
