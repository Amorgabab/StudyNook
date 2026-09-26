/* StudyNook · util.js — tiny DOM + format helpers (window.N) */
'use strict';
window.N = (function () {
  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else if (k === 'dataset') Object.assign(e.dataset, v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      e.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return e;
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const e = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  }
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  function fmtMin(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return min + 'm';
    const h = Math.floor(min / 60), r = min % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }
  function timeAgo(ts) {
    if (!ts) return 'never';
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 10) return 'just now';
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function todayKey() { const p = (n) => String(n).padStart(2, '0'); const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function dayKey(offset) { const p = (n) => String(n).padStart(2, '0'); const d = new Date(); d.setDate(d.getDate() - offset); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
  function hour() { return new Date().getHours(); }
  function shortUrl(u, n) {
    n = n || 34;
    const s = String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  /** Cozy number field: [−] input [+] (native spinners hidden via CSS) */
  function stepper(val, min, max, onSet, step) {
    step = step || 1;
    const inp = el('input', { class: 'input', type: 'number', value: String(val), min: String(min), max: String(max) });
    const clamp = (v) => Math.max(min, Math.min(max, isNaN(v) ? val : v));
    const set = (v) => { v = clamp(v); inp.value = v; onSet(v); };
    inp.addEventListener('change', () => set(parseInt(inp.value, 10)));
    return el('span', { class: 'stepper' },
      el('button', { text: '−', title: 'decrease', onclick: () => set((parseInt(inp.value, 10) || val) - step) }),
      inp,
      el('button', { text: '+', title: 'increase', onclick: () => set((parseInt(inp.value, 10) || val) + step) })
    );
  }
  return { el, svgEl, fmt, fmtMin, timeAgo, esc, todayKey, dayKey, hour, stepper, shortUrl };
})();
