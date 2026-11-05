'use strict';
/* The welcome tour (4 phases, ringed elements) and the About page's release link. Electron-free:
   it reads the sources and checks that every promise the tour makes has something behind it. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const I18n = require('../app/shared/i18n.js');

const app = read('app/ui/js/app.js');
const tourSrc = /const TOUR = \[([\s\S]*?)\n {2}\];/.exec(app)[1];
const steps = tourSrc.split('\n').filter((l) => /\bkey:/.test(l));

suite('tour · structure', () => {
  test('ten steps in four phases, each phase with one to three steps', () => {
    expect(steps.length).toBe(10);
    const counts = [0, 0, 0, 0];
    for (const s of steps) counts[Number(/ph:\s*(\d)/.exec(s)[1])]++;
    for (const c of counts) expect(c >= 1 && c <= 3).toBe(true);
  });
  test('every step and phase has text in all four languages', () => {
    for (const l of ['en', 'ar', 'fr', 'es']) {
      const d = I18n.DICTS[l];
      for (let n = 1; n <= 10; n++) { expect(!!d['tour.' + n + '.t']).toBe(true); expect(!!d['tour.' + n + '.d']).toBe(true); }
      for (let n = 1; n <= 4; n++) expect(!!d['tour.ph' + n]).toBe(true);
      expect(/\{n\}/.test(d['tour.phase']) && /\{total\}/.test(d['tour.phase']) && /\{name\}/.test(d['tour.phase'])).toBe(true);
    }
  });
  test('every step uses an icon that exists', () => {
    const Icons = require('../app/shared/icons.js');
    for (const s of steps) {
      const name = /icon:\s*'([^']+)'/.exec(s)[1];
      expect(Icons.has(name)).toBe(true);
    }
  });
});

suite('tour · ringed elements exist', () => {
  const sources = ['app/ui/js/views-home.js', 'app/ui/js/views-manage.js', 'app/ui/js/app.js', 'app/ui/index.html'].map(read).join('\n');
  test('each ring target is something the app really draws', () => {
    expect(/home-start/.test(read('app/ui/js/views-home.js'))).toBe(true);
    expect(/'pair-code'/.test(read('app/ui/js/views-manage.js'))).toBe(true);
    expect(/mochi-box/.test(read('app/ui/js/views-home.js'))).toBe(true);
    expect(/id="chip-streak"/.test(read('app/ui/index.html'))).toBe(true);
    expect(/ring-time/.test(read('app/ui/js/views-home.js'))).toBe(true);
    expect(/'data-view': view/.test(sources)).toBe(true);
  });
  test('the nav views the tour names exist', () => {
    const navViews = [...app.matchAll(/\['(\w+)', '[\w-]+', 'nav\.\w+'\]/g)].map((m) => m[1]);
    for (const s of steps) {
      const v = /view:\s*'(\w+)'/.exec(s)[1];
      expect(navViews.includes(v)).toBe(true);
    }
  });
  test('the ring is coloured only by the accent token and honours reduced motion', () => {
    const css = read('app/ui/styles.css');
    const ring = /\.tour-ring \{([^}]*)\}/.exec(css)[1];
    expect(/var\(--accent\)/.test(ring)).toBe(true);
    expect(/#[0-9a-f]{3,6}\b/i.test(ring)).toBe(false);
    expect(/prefers-reduced-motion: reduce[\s\S]*animation: none !important/.test(css)).toBe(true);
  });
  test('Escape ends the tour and Skip is hidden on the last step', () => {
    expect(/e\.key === 'Escape'[\s\S]*end\(\)/.test(app)).toBe(true);
    expect(/last \? null : N\.btn\(t\('tour\.skip'\)/.test(app)).toBe(true);
  });
});

suite('about · release link', () => {
  const ipc = read('app/main/ipc.js');
  test('the link opens one fixed GitHub address, never a renderer-supplied one', () => {
    expect(/const RELEASES_URL = 'https:\/\/github\.com\/Amorgabab\/StudyNook\/releases\/latest'/.test(ipc)).toBe(true);
    expect(/H\('app:openReleases', \(\) => \{ shell\.openExternal\(RELEASES_URL\)/.test(ipc)).toBe(true);
  });
  test('the channel is whitelisted and the page calls it only on click', () => {
    expect(/'app:openReleases'/.test(read('app/main/preload.js'))).toBe(true);
    expect(/onclick: \(\) => nook\.invoke\('app:openReleases'\)/.test(read('app/ui/js/views-misc.js'))).toBe(true);
  });
  test('nothing in the app fetches the network by itself', () => {
    for (const f of ['app/ui/js/app.js', 'app/ui/js/views-misc.js', 'app/main/main.js']) {
      expect(/\bfetch\(\s*['"`]https?:|XMLHttpRequest|https\.get\(/.test(read(f))).toBe(false);
    }
  });
  test('the About text says it is open source and never checks for updates, in every language', () => {
    for (const l of ['en', 'ar', 'fr', 'es']) {
      const d = I18n.DICTS[l];
      for (const k of ['set.a.license', 'set.a.license.desc', 'set.a.release', 'set.a.release.desc', 'set.a.release.link']) expect(!!d[k]).toBe(true);
    }
    expect(/MIT/.test(I18n.DICTS.en['set.a.license.desc'])).toBe(true);
    expect(/never checks for updates/.test(I18n.DICTS.en['set.a.release.desc'])).toBe(true);
  });
});
