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
      // flip in place first so the knob eases; the redraw that follows the change then lands on the same state
      onclick: opts.disabled ? null : (e) => { if (e && e.currentTarget) e.currentTarget.setAttribute('aria-checked', checked ? 'false' : 'true'); onChange(!checked); }
    });
  }
  /** True when the person asked the OS for less motion: waits are skipped (CSS already drops the animations). */
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  /** Segmented control. options: [[value, label, iconName?], ...]. A sliding pill marks the pressed option:
      a click moves it in place and only then calls onPick (the redraw that follows lands on the same state).
      opts.onSlide(value) runs at click time, before the delayed onPick. */
  function seg(options, current, onPick, opts) {
    opts = opts || {};
    const s = el('div', { class: 'seg seg-ind' + (opts.full ? ' full' : ''), role: 'group', 'aria-label': opts.label });
    const pill = el('span', { class: 'seg-pill', 'aria-hidden': 'true' });
    s.appendChild(pill);
    const place = (b) => {
      if (!b || !b.offsetWidth) { pill.style.opacity = '0'; return; }
      const rtl = getComputedStyle(s).direction === 'rtl';
      const start = rtl ? s.clientWidth - (b.offsetLeft + b.offsetWidth) : b.offsetLeft;
      pill.style.insetInlineStart = start + 'px';
      pill.style.width = b.offsetWidth + 'px';
      pill.style.opacity = '1';
    };
    const btns = [];
    for (const [v, lbl, ico] of options) {
      const b = el('button', { type: 'button', 'aria-pressed': current === v ? 'true' : 'false', title: opts.titles ? opts.titles[v] : null });
      b.onclick = () => {
        if (v === current) return;
        btns.forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
        place(b);
        if (opts.onSlide) opts.onSlide(v);
        if (reduced() || !s.isConnected) onPick(v); else setTimeout(() => onPick(v), 170);
      };
      if (ico) b.appendChild(icon(ico, 16));
      b.appendChild(el('span', { text: lbl }));
      btns.push(b);
      s.appendChild(b);
    }
    // first placement happens before the first paint and without a glide; the glide is switched on after
    requestAnimationFrame(() => {
      place(btns.find((b) => b.getAttribute('aria-pressed') === 'true'));
      requestAnimationFrame(() => s.classList.add('seg-ready'));
    });
    return s;
  }
  /** Number field with − / + buttons. */
  /** Number field with − / +. `draft` (optional) keeps an unsent value across a page redraw. */
  function stepper(val, min, max, onSet, step, label, draft) {
    step = step || 1;
    const inp = el('input', { type: 'number', value: String(val), min: String(min), max: String(max), 'aria-label': label, 'data-draft': draft, 'data-draft-sync': draft ? '' : null });
    const clamp = (v) => Math.max(min, Math.min(max, isNaN(v) ? val : v));
    const set = (v) => { v = clamp(v); inp.value = v; onSet(v); };
    inp.addEventListener('change', () => set(parseInt(inp.value, 10)));
    const dec = el('button', { type: 'button', 'aria-label': t('common.decrease'), onclick: () => set((parseInt(inp.value, 10) || val) - step) }, icon('minus', 14));
    const inc = el('button', { type: 'button', 'aria-label': t('common.increase'), onclick: () => set((parseInt(inp.value, 10) || val) + step) }, icon('plus', 14));
    return el('span', { class: 'stepper' }, dec, inp, inc);
  }
  /* ---------- custom select (the native popup cannot be animated) ---------- */
  let openSelect = null;   // at most one popover is open; it is always removed when closed or when the page rebuilds
  function closeSelects() { if (openSelect) openSelect.close(true); }
  document.addEventListener('pointerdown', (e) => { if (openSelect && !openSelect.owns(e.target)) openSelect.close(); }, true);
  window.addEventListener('blur', closeSelects);
  window.addEventListener('resize', closeSelects);
  document.addEventListener('scroll', (e) => { if (openSelect && !(e.target && e.target.closest && e.target.closest('.select-pop'))) openSelect.close(true); }, true);

  /** Accessible dropdown. options: [[value, label], ...] (or {value, label}). onChange(value) runs after a pick.
      opts: { id, label (aria-label), draft (data-draft key), cls }. The returned button has a `.value` property
      (get and set, like a native select) so code reading `el.value` keeps working. */
  let selSeq = 0;
  function select(options, value, onChange, opts) {
    opts = opts || {};
    const items = options.map((o) => (Array.isArray(o) ? { value: String(o[0]), label: String(o[1]) } : { value: String(o.value), label: String(o.label) }));
    let cur = items.some((i) => i.value === String(value)) ? String(value) : (items[0] ? items[0].value : '');
    const uid = 'nsel' + (++selSeq);
    const labelEl = el('span', { class: 'select-label' });
    const trigger = el('button', {
      type: 'button', class: 'select-trigger input' + (opts.cls ? ' ' + opts.cls : ''), id: opts.id, 'aria-label': opts.label,
      'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'data-draft': opts.draft
    }, labelEl, icon('chevron-down', 16, 'select-chev'));
    const paint = () => { const it = items.find((i) => i.value === cur); labelEl.textContent = it ? it.label : ''; };
    paint();
    Object.defineProperty(trigger, 'value', {
      get() { return cur; },
      set(v) { if (items.some((i) => i.value === String(v))) { cur = String(v); paint(); } }
    });
    let pop = null, active = -1, ahead = '', aheadT = 0;
    const mark = (i, scroll) => {
      active = Math.max(0, Math.min(items.length - 1, i));
      const os = pop ? Array.from(pop.children) : [];
      os.forEach((o, k) => o.classList.toggle('active', k === active));
      const o = os[active];
      if (o) { trigger.setAttribute('aria-activedescendant', o.id); if (scroll !== false && o.scrollIntoView) o.scrollIntoView({ block: 'nearest' }); }
    };
    function place() {
      const r = trigger.getBoundingClientRect(), gap = 4, vh = window.innerHeight;
      pop.style.minWidth = r.width + 'px';
      pop.style.maxWidth = Math.max(r.width, 360) + 'px';
      const h = Math.min(pop.scrollHeight, 280);
      const below = vh - r.bottom - gap - 8, above = r.top - gap - 8;
      const flip = below < h && above > below;
      pop.classList.toggle('flip', flip);
      pop.style.maxHeight = Math.max(96, Math.min(280, flip ? above : below)) + 'px';
      pop.style.top = flip ? '' : (r.bottom + gap) + 'px';
      pop.style.bottom = flip ? (vh - r.top + gap) + 'px' : '';
      const rtl = getComputedStyle(trigger).direction === 'rtl';
      const w = pop.offsetWidth;
      pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, rtl ? r.right - w : r.left)) + 'px';
    }
    const self = {
      owns: (n) => trigger.contains(n) || !!(pop && pop.contains(n)),
      close(now) {
        if (!pop) return;
        const p = pop; pop = null;
        if (openSelect === self) openSelect = null;
        trigger.setAttribute('aria-expanded', 'false');
        trigger.removeAttribute('aria-activedescendant');
        trigger.classList.remove('open');
        if (now || reduced()) { p.remove(); return; }
        p.classList.add('closing');
        p.addEventListener('animationend', () => p.remove(), { once: true });
        setTimeout(() => p.remove(), 220);   // fallback if animationend never fires
      }
    };
    function open() {
      if (pop || !items.length) return;
      if (openSelect) openSelect.close(true);
      pop = el('div', { class: 'select-pop', role: 'listbox', id: uid, 'aria-label': opts.label });
      items.forEach((it, i) => {
        const o = el('div', { class: 'select-opt', role: 'option', id: uid + '-' + i, 'aria-selected': it.value === cur ? 'true' : 'false' },
          el('span', { class: 'select-opt-text', text: it.label }), icon('check', 14, 'select-tick'));
        o.addEventListener('mousedown', (e) => e.preventDefault());   // keep focus on the trigger
        o.addEventListener('mousemove', () => { if (active !== i) mark(i, false); });
        o.addEventListener('click', () => choose(i));
        pop.appendChild(o);
      });
      document.body.appendChild(pop);
      trigger.setAttribute('aria-controls', uid);
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('open');
      openSelect = self;
      place();
      mark(Math.max(0, items.findIndex((i) => i.value === cur)));
    }
    function choose(i) {
      const it = items[i];
      self.close();
      trigger.focus();
      if (it && it.value !== cur) { cur = it.value; paint(); if (onChange) onChange(cur); }
    }
    trigger.addEventListener('click', () => { if (pop) self.close(); else open(); });
    trigger.addEventListener('keydown', (e) => {
      const k = e.key;
      if (!pop) {
        if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') { e.preventDefault(); open(); }
        return;
      }
      if (k === 'ArrowDown') { e.preventDefault(); mark(active + 1); }
      else if (k === 'ArrowUp') { e.preventDefault(); mark(active - 1); }
      else if (k === 'Home') { e.preventDefault(); mark(0); }
      else if (k === 'End') { e.preventDefault(); mark(items.length - 1); }
      else if (k === 'Enter' || k === ' ') { e.preventDefault(); choose(active); }
      else if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); self.close(); }
      else if (k === 'Tab') self.close();
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        ahead += k.toLowerCase();
        clearTimeout(aheadT); aheadT = setTimeout(() => { ahead = ''; }, 600);
        const from = ahead.length > 1 ? active : active + 1;
        for (let n = 0; n < items.length; n++) {
          const i = (from + n) % items.length;
          if (items[i].label.toLowerCase().startsWith(ahead)) { mark(i); break; }
        }
      }
    });
    return trigger;
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
  return { el, svgEl, icon, btn, iconBtn, toggle, seg, select, closeSelects, reduced, stepper, pageHead, card, callout, empty, fmt, fmtMin, timeAgo, esc, todayKey, dayKey, hour, shortUrl };
})();
