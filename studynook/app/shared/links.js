/* ============================================================
   StudyNook · links.js — study-source URL helpers (pure, UMD)
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NookLinks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /** "" / junk → ''; "www.x.com/y" → "https://www.x.com/y"; keeps http(s) only */
  function normalize(u) {
    let s = String(u == null ? '' : u).trim();
    if (!s) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
    try {
      const x = new URL(s);
      if (x.protocol !== 'http:' && x.protocol !== 'https:') return '';
      if (!x.hostname || x.hostname.indexOf('.') === -1) return '';
      return x.href;
    } catch (e) { return ''; }
  }
  function isHttpUrl(u) { return normalize(u) !== ''; }
  function short(u, n) {
    n = n || 34;
    const s = String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  return { normalize, isHttpUrl, short };
});
