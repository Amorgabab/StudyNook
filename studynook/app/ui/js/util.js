/* StudyNook · util.js — DOM + format helpers (window.N) and the global t() */
'use strict';
window.t = function (key, vars) { return NookI18n.t(key, vars); };

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
      e.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return e;
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs) {
    const e = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  }
  /** Lucide icon as a DOM node. */
  function icon(name, size, cls) {
    const tpl = document.createElement('template');
    tpl.innerHTML = NookIcons.svg(name, { size: size || 20, cls });
    return tpl.content.firstChild;
  }
  /** Button with optional leading icon. opts: { cls, icon, size, label (aria), title, onclick, disabled } */
  function btn(text, opts) {
    opts = opts || {};
    const b = el('button', { class: 'btn ' + (opts.cls || ''), title: opts.title, 'aria-label': opts.label, disabled: opts.disabled, onclick: opts.onclick, type: 'button' });
    if (opts.icon) b.appendChild(icon(opts.icon, opts.iconSize || 16, opts.iconCls));
    if (text) b.appendChild(el('span', { text }));
    return b;
  }
  /** Square icon-only button (aria-label required). */
  function iconBtn(name, label, onclick, cls) {
    const b = el('button', { class: 'btn btn-icon ' + (cls || ''), 'aria-label': label, title: label, onclick, type: 'button' });
    b.appendChild(icon(name, 16));
    return b;
  }
  /** Accessible on/off switch. */
  function toggle(checked, onChange, opts) {
    opts = opts || {};
    return el('button', {
      class: 'switch', role: 'switch', type: 'button', 'aria-checked': checked ? 'true' : 'false',
      'aria-label': opts.label, title: opts.title, disabled: opts.disabled,
      onclick: opts.disabled ? null : () => onChange(!checked)
    });
  }
  /** Segmented control. options: [[value, label, iconName?], ...] */
  function seg(options, current, onPick, opts) {
    opts = opts || {};
    const s = el('div', { class: 'seg' + (opts.full ? ' full' : ''), role: 'group', 'aria-label': opts.label });
    for (const [v, lbl, ico] of options) {
      const b = el('button', { type: 'button', 'aria-pressed': current === v ? 'true' : 'false', title: opts.titles ? opts.titles[v] : null, onclick: () => onPick(v) });
      if (ico) b.appendChild(icon(ico, 16));
      b.appendChild(el('span', { text: lbl }));
      s.appendChild(b);
    }
    return s;
  }
  /** Number field with − / + buttons. */
  function stepper(val, min, max, onSet, step, label) {
    step = step || 1;
    const inp = el('input', { type: 'number', value: String(val), min: String(min), max: String(max), 'aria-label': label });
    const clamp = (v) => Math.max(min, Math.min(max, isNaN(v) ? val : v));
    const set = (v) => { v = clamp(v); inp.value = v; onSet(v); };
    inp.addEventListener('change', () => set(parseInt(inp.value, 10)));
    const dec = el('button', { type: 'button', 'aria-label': t('common.decrease'), onclick: () => set((parseInt(inp.value, 10) || val) - step) }, icon('minus', 14));
    const inc = el('button', { type: 'button', 'aria-label': t('common.increase'), onclick: () => set((parseInt(inp.value, 10) || val) + step) }, icon('plus', 14));
    return el('span', { class: 'stepper' }, dec, inp, inc);
  }
  /** Standard page header. */
  function pageHead(title, sub, actions) {
    return el('div', { class: 'page-head' },
      el('div', {}, el('h1', { class: 'page-title', text: title }), sub ? el('p', { class: 'page-sub', text: sub }) : null),
      actions ? el('div', { class: 'row' }, actions) : null);
  }
  /** Card with a header (icon + title + optional actions). */
  function card(title, iconName, actions, cls) {
    const c = el('section', { class: 'card ' + (cls || '') });
    if (title) {
      c.appendChild(el('div', { class: 'card-head' },
        el('h2', { class: 'card-title' }, iconName ? icon(iconName, 18) : null, el('span', { text: title })),
        actions ? el('div', { class: 'row' }, actions) : null));
    }
    return c;
  }
  function callout(kind, iconName, text, title) {
    return el('div', { class: 'callout ' + kind }, icon(iconName, 18), el('div', { class: 'grow' }, title ? el('b', { text: title }) : null, el('span', { text })));
  }
  function empty(iconName, title, text) {
    return el('div', { class: 'empty' }, icon(iconName, 28), el('b', { text: title }), text ? el('span', { class: 'small', text }) : null);
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }
  const fmtMin = (min) => NookI18n.minutes(min);
  const timeAgo = (ts) => NookI18n.ago(ts);
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  const pad = (n) => String(n).padStart(2, '0');
  function todayKey() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function dayKey(offset) { const d = new Date(); d.setDate(d.getDate() - offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function hour() { return new Date().getHours(); }
  function shortUrl(u, n) {
    n = n || 40;
    const s = String(u || '').replace(/^https?:\/\//, '').replace(/^www\./, '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  return { el, svgEl, icon, btn, iconBtn, toggle, seg, stepper, pageHead, card, callout, empty, fmt, fmtMin, timeAgo, esc, todayKey, dayKey, hour, shortUrl };
})();
