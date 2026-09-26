/* ============================================================
   StudyNook extension · rules.js — builds declarativeNetRequest
   redirect rules from your block/allow lists. PURE + shared with
   the unit tests (UMD).
   ------------------------------------------------------------
   Entries support PATHS, because real students don't wander to
   other domains — they wander to youtube.com/shorts while a
   lecture is open on youtube.com/watch:
     "youtube.com"          → whole domain (subdomains included)
     "youtube.com/shorts"   → only that path prefix (higher priority)
   In allow mode, path-block rules override the allowlist, so you
   can allow youtube.com for lectures and still nap the Shorts.
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NookRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ALWAYS_SAFE = ['localhost', '127.0.0.1', '::1'];
  const BLOCKED_PAGE = '/blocked/blocked.html';   // extensionPath (leading slash!)

  /* Entries support PATHS, because real students don't wander to
     other domains — they wander to youtube.com/shorts while a
     lecture is open on youtube.com/watch:
       "youtube.com"          → whole domain (subdomains included)
       "youtube.com/shorts"   → only that path prefix (higher priority)
     In allow mode, path-block rules override the allowlist, so you
     can allow youtube.com for lectures and still nap the Shorts. */

  /** "https://www.YouTube.com/shorts/x?y" → {domain:'youtube.com', path:'/shorts/x?y'}
      Query is KEPT so you can pin exact pages (youtube.com/watch?v=lec). */
  function parseRule(raw) {
    let s = String(raw || '').trim().toLowerCase();
    s = s.replace(/^(https?:\/\/)?(www\.)?/, '');
    const slash = s.indexOf('/');
    let domain = s, path = '';
    if (slash !== -1) { domain = s.slice(0, slash); path = s.slice(slash); }
    domain = domain.split(/[?#]/)[0];
    path = path.split('#')[0];                 // keep query, drop fragment
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    if (path === '/') path = '';
    return { domain, path };
  }
  function normalizeDomain(d) { return parseRule(d).domain; }
  /** Full entry incl. path: "YouTube.com/shorts/" → "youtube.com/shorts" */
  function normalizeEntry(raw) {
    const r = parseRule(raw);
    return r.domain ? r.domain + r.path : '';
  }

  function isBlockingActive(sites, sessionActive) {
    if (!sites || !sites.enabled) return false;
    if (sites.when === 'always') return true;
    return !!sessionActive; // 'session' → only while focusing
  }

  /**
   * @param sites {enabled, mode:'block'|'allow', when:'session'|'always', block:[], allow:[]}
   * @param sessionActive boolean (a focus phase is running)
   * @returns DNR rules. Block rules use priority 2 so they win over
   *          the allow-mode catch-all (priority 1).
   */
  function buildRules(sites, sessionActive) {
    if (!isBlockingActive(sites, sessionActive)) return [];
    const rules = [];
    const redirect = { type: 'redirect', redirect: { extensionPath: BLOCKED_PAGE } };
    const types = ['main_frame', 'sub_frame'];
    let id = 1;

    // --- allow mode: exact-page entries (full urls pasted in the allow list)
    //     stay open via priority-3 allow rules; whole-domain entries widen ---
    const pureAllow = [];
    if (sites.mode === 'allow') {
      for (const raw of (sites.allow || [])) {
        const r = parseRule(raw);
        if (!r.domain) continue;
        if (r.path) rules.push({ id: id++, priority: 3, action: { type: 'allow' }, condition: { urlFilter: '||' + r.domain + r.path, resourceTypes: types } });
        else pureAllow.push(r.domain);
      }
    }

    // --- explicit block entries (domains AND paths), priority 2 ---
    for (const raw of (sites.block || [])) {
      const r = parseRule(raw);
      if (!r.domain) continue;
      if (r.path) {
        rules.push({
          id: id++, priority: 2, action: redirect,
          condition: { urlFilter: '||' + r.domain + r.path, resourceTypes: types }
        });
      } else {
        rules.push({
          id: id++, priority: 2, action: redirect,
          condition: { requestDomains: [r.domain], resourceTypes: types }
        });
      }
    }

    // --- allow mode: catch-all for everything NOT allowed, priority 1 ---
    if (sites.mode === 'allow') {
      const allow = pureAllow.concat(ALWAYS_SAFE);
      rules.push({
        id: id++, priority: 1, action: redirect,
        condition: {
          regexFilter: '^https?://',
          excludedRequestDomains: allow,
          resourceTypes: types
        }
      });
    }
    return rules;
  }

  function hostOf(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch (e) { return ''; }
  }
  function pathOf(url) {
    try { return new URL(url).pathname.toLowerCase(); } catch (e) { return ''; }
  }
  function matchesDomain(host, dom) {
    if (!dom) return false;
    return host === dom || host.endsWith('.' + dom);
  }
  function matchesRule(url, r) {
    const host = hostOf(url);
    if (!matchesDomain(host, r.domain)) return false;
    if (!r.path) return true;
    return urlPathSearch(url).indexOf(r.path) === 0;   // path+query prefix
  }
  function urlPathSearch(url) {
    try { const u = new URL(url); return (u.pathname + u.search).toLowerCase(); } catch (e) { return ''; }
  }

  /** Would this URL be redirected right now? (mirrors the DNR priorities) */
  function wouldBlock(sites, sessionActive, url) {
    if (!isBlockingActive(sites, sessionActive)) return false;
    if (!/^https?:/i.test(url || '')) return false;
    const host = hostOf(url);
    if (!host || ALWAYS_SAFE.indexOf(host) !== -1) return false;
    const blocks = (sites.block || []).map(parseRule);
    if (blocks.some((r) => matchesRule(url, r))) return true;      // priority 2 wins
    if (sites.mode === 'allow') {
      // exact-page entries (full urls) stay open — priority 3
      for (const raw of (sites.allow || [])) {
        const r = parseRule(raw);
        if (r.path && matchesRule(url, r)) return false;
      }
      // only path-less entries widen the allow to whole domains
      const pure = (sites.allow || []).map(parseRule).filter((r) => r.domain && !r.path).map((r) => r.domain);
      return !pure.some((dom) => matchesDomain(host, dom));
    }
    return false;
  }

  return { parseRule, normalizeDomain, normalizeEntry, isBlockingActive, buildRules, hostOf, pathOf, urlPathSearch, matchesDomain, wouldBlock, ALWAYS_SAFE, BLOCKED_PAGE };
});
