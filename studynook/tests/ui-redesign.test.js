'use strict';
/* UI redesign contracts: translations, icons, theme logic, new settings, Iron sentence. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const I18n = require('../app/shared/i18n.js');
const Icons = require('../app/shared/icons.js');
const Prefs = require('../app/shared/uiprefs.js');
const Iron = require('../app/shared/iron.js');
const { sanitizeData, defaultData } = require('../app/main/store.js');

const UI_FILES = ['app/ui/js/app.js', 'app/ui/js/views-home.js', 'app/ui/js/views-manage.js', 'app/ui/js/views-garden.js', 'app/ui/js/views-misc.js', 'app/ui/js/util.js', 'app/ui/mini.js', 'app/ui/reminder.js', 'app/main/main.js'];
const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');

suite('ui · translations', () => {
  const en = I18n.DICTS.en;
  test('every language has exactly the English keys', () => {
    for (const l of ['ar', 'fr', 'es']) {
      const d = I18n.DICTS[l];
      expect(Object.keys(en).filter((k) => !(k in d))).toEqual([]);
      expect(Object.keys(d).filter((k) => !(k in en))).toEqual([]);
    }
  });
  test('placeholders like {name} match in every language', () => {
    for (const l of ['ar', 'fr', 'es']) {
      const bad = Object.keys(en).filter((k) => placeholders(en[k]) !== placeholders(I18n.DICTS[l][k]));
      expect(bad).toEqual([]);
    }
  });
  test('every literal t()/T() key used in the code exists in English', () => {
    const missing = [];
    for (const f of UI_FILES) {
      for (const m of read(f).matchAll(/\b[tT]\(\s*'([a-zA-Z0-9_.-]+)'/g)) {
        if (m[1].endsWith('.')) continue;               // dynamic prefix: t('ach.' + id + '.name')
        if (!(m[1] in en)) missing.push(f + ': ' + m[1]);
      }
    }
    expect(missing).toEqual([]);
  });
  test('names of achievements, companion stages and level titles are all translated', () => {
    const P = require('../app/shared/progress.js');
    const need = [].concat(
      P.ACHIEVEMENTS.flatMap((a) => ['ach.' + a.id + '.name', 'ach.' + a.id + '.desc']),
      P.PET_STAGES.flatMap((s) => ['stage.' + s.id + '.name', 'stage.' + s.id + '.blurb']),
      P.TITLES.map((_, i) => 'level.title.' + i));
    expect(need.filter((k) => !(k in en))).toEqual([]);
  });
  test('t() falls back to English, then to the key', () => {
    I18n.setLang('fr');
    expect(I18n.t('common.add')).toBe('Ajouter');
    expect(I18n.t('no.such.key')).toBe('no.such.key');
    expect(I18n.t('home.round', { n: 2, of: 4 })).toBe('Tour 2 sur 4');
    I18n.setLang('en');
  });
  test('extension strings exist in every language', () => {
    const ctx = { self: {} };
    vm.runInNewContext(read('extension/i18n.js'), ctx);
    const D = ctx.self.NookExtI18n.D;
    for (const l of ['ar', 'fr', 'es']) expect(Object.keys(D.en).filter((k) => !(k in D[l]))).toEqual([]);
  });
});

suite('ui · help articles', () => {
  const ctx = { self: {} };
  for (const l of ['en', 'ar', 'fr', 'es']) vm.runInNewContext(read('app/ui/help/help-' + l + '.js'), ctx);
  const H = ctx.self.NookHelp;
  test('every language has the same articles with the same structure', () => {
    const shape = (arts) => arts.map((a) => a.id + ':' + a.icon + ':' + a.blocks.map((b) => Object.keys(b).sort().join('+') + (b.ol || b.ul || (b.table && b.table.rows) || []).length).join('|'));
    for (const l of ['ar', 'fr', 'es']) expect(shape(H[l])).toEqual(shape(H.en));
  });
  test('help article icons exist', () => {
    expect(H.en.map((a) => a.icon).filter((n) => !Icons.has(n))).toEqual([]);
  });
});

suite('ui · icons', () => {
  test('app and extension icon files are identical (both generated)', () => {
    expect(read('app/shared/icons.js') === read('extension/icons.js')).toBe(true);
  });
  test('every icon name used by the UI exists in the bundle', () => {
    const files = UI_FILES.concat(['extension/popup/popup.js', 'extension/blocked/blocked.js']);
    const used = new Set();
    for (const f of files) {
      const s = read(f);
      for (const re of [/\bicon\(\s*'([a-z0-9-]+)'/g, /iconBtn\(\s*'([a-z0-9-]+)'/g, /\bicon:\s*'([a-z0-9-]+)'/g, /\bico\(\s*'([a-z0-9-]+)'/g, /\['[\w-]+',\s*'([a-z0-9-]+)'(?:,\s*'[\w.]+')?\]/g]) {
        for (const m of s.matchAll(re)) used.add(m[1]);
      }
      for (const block of s.matchAll(/(?:ACH_ICON|APP_ICON)\s*=\s*\{([\s\S]*?)\};/g)) for (const m of block[1].matchAll(/:\s*'([a-z0-9-]+)'/g)) used.add(m[1]);
      for (const block of s.matchAll(/STAGE_ICONS\s*=\s*\[([^\]]*)\]/g)) for (const m of block[1].matchAll(/'([a-z0-9-]+)'/g)) used.add(m[1]);
    }
    const notIcons = new Set(['pomodoro', 'free', 'block', 'allow', 'session', 'always', 'gentle', 'instant', 'remind', 'system', 'light', 'dark', 'auto', 'open', 'done']);
    const missing = [...used].filter((n) => !notIcons.has(n) && !Icons.has(n));
    expect(missing).toEqual([]);
  });
  test('svg() produces an accessible inline icon', () => {
    const s = Icons.svg('check', { size: 16 });
    expect(s).toContain('aria-hidden="true"');
    expect(s).toContain('width="16"');
    expect(Icons.svg('check', { label: 'Done' })).toContain('aria-label="Done"');
  });
  test('no emoji left in the UI source', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const files = ['app/ui/index.html', 'app/ui/mini.html', 'app/ui/reminder.html', 'extension/popup/popup.html', 'extension/blocked/blocked.html']
      .concat(UI_FILES.filter((f) => f.startsWith('app/ui')), ['extension/popup/popup.js', 'extension/blocked/blocked.js', 'app/ui/js/mochi.js']);
    expect(files.filter((f) => emoji.test(read(f)))).toEqual([]);
  });
});

suite('ui · theme', () => {
  test('light and dark are fixed, whatever the time or Windows says', () => {
    for (const h of [0, 12, 23]) {
      expect(Prefs.resolveTheme('light', true, h)).toBe('light');
      expect(Prefs.resolveTheme('dark', false, h)).toBe('dark');
    }
  });
  test('system follows Windows', () => {
    expect(Prefs.resolveTheme('system', true, 12)).toBe('dark');
    expect(Prefs.resolveTheme('system', false, 23)).toBe('light');
  });
  test('auto is dark from 19:00 to 07:00', () => {
    expect(Prefs.resolveTheme('auto', false, 18)).toBe('light');
    expect(Prefs.resolveTheme('auto', false, 19)).toBe('dark');
    expect(Prefs.resolveTheme('auto', false, 6)).toBe('dark');
    expect(Prefs.resolveTheme('auto', true, 7)).toBe('light');
  });
  test('the old time-of-day background rules are gone from the stylesheet', () => {
    expect(/data-tod/.test(read('app/ui/styles.css'))).toBe(false);
  });
  test('Arabic is right-to-left, others left-to-right', () => {
    expect(Prefs.dirFor('ar')).toBe('rtl');
    expect(Prefs.dirFor('fr')).toBe('ltr');
    expect(Prefs.normLang('de')).toBe('en');
  });
});

suite('ui · new settings are validated on load and import', () => {
  test('defaults', () => {
    const s = defaultData().settings;
    expect(s.theme).toBe('system');
    expect(s.language).toBe('en');
    expect(s.dailyGoalMin).toBe(120);
    expect(s.startWithWindows).toBe(false);
    expect(s.notify).toEqual({ focusEnd: true, breakEnd: true, blocker: true });
  });
  test('garbage is coerced; existing choices survive', () => {
    const d = sanitizeData({ settings: { theme: 'neon', language: 'de', dailyGoalMin: 99999, startWithWindows: 'yes', notify: { focusEnd: false, blocker: 0 } } });
    expect(d.settings.theme).toBe('system');
    expect(d.settings.language).toBe('en');
    expect(d.settings.dailyGoalMin).toBe(720);
    expect(d.settings.startWithWindows).toBe(false);
    expect(d.settings.notify.focusEnd).toBe(false);
    expect(d.settings.notify.breakEnd).toBe(true);
    expect(d.settings.notify.blocker).toBe(true);
    expect(sanitizeData({ settings: { theme: 'auto', language: 'ar' } }).settings.theme).toBe('auto');
    expect(sanitizeData({ settings: { theme: 'auto', language: 'ar' } }).settings.language).toBe('ar');
  });
});

suite('ui · translated Iron sentence', () => {
  test('every language’s sentence matches itself and a plainly typed version', () => {
    for (const l of ['en', 'ar', 'fr', 'es']) expect(Iron.matches(I18n.DICTS[l]['iron.sentence'], I18n.DICTS[l]['iron.sentence'])).toBe(true);
    expect(Iron.matches("je choisis d'arreter ma concentration plus tot", I18n.DICTS.fr['iron.sentence'])).toBe(true);
    expect(Iron.matches('ELIJO terminar mi concentracion antes de tiempo', I18n.DICTS.es['iron.sentence'])).toBe(true);
    expect(Iron.matches('اختار انهاء تركيزي مبكرا', I18n.DICTS.ar['iron.sentence'])).toBe(true);
  });
  test('a partial or different sentence still fails', () => {
    expect(Iron.matches('i choose', I18n.DICTS.en['iron.sentence'])).toBe(false);
    expect(Iron.matches('je choisis', I18n.DICTS.fr['iron.sentence'])).toBe(false);
  });
});
