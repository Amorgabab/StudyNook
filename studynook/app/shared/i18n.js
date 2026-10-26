/* ============================================================
   StudyNook · i18n.js — translations for the app (all windows
   and the main process). Dictionaries live in app/shared/lang/.
     t('tasks.add')                    → "Add task"
     t('home.round', { n: 2, of: 4 })  → "Round 2 of 4"
   Missing keys fall back to English, then to the key itself
   (a test makes sure every language has every English key).
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory({
      en: require('./lang/en.js'), ar: require('./lang/ar.js'),
      fr: require('./lang/fr.js'), es: require('./lang/es.js')
    });
  } else {
    root.NookI18n = factory(root.NookLang || {});
  }
})(typeof self !== 'undefined' ? self : this, function (DICTS) {
  'use strict';
  let lang = 'en';

  function setLang(l) { lang = DICTS[l] ? l : 'en'; return lang; }
  function getLang() { return lang; }

  function fill(s, vars) {
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  }
  /** Translate in the current language (or `forLang`). */
  function t(key, vars, forLang) {
    const d = DICTS[forLang || lang] || {};
    const s = d[key] !== undefined ? d[key] : (DICTS.en && DICTS.en[key] !== undefined ? DICTS.en[key] : key);
    return fill(s, vars);
  }
  function has(key) { return !!(DICTS.en && DICTS.en[key] !== undefined); }

  /** Locale-aware number/time helpers. */
  const LOCALES = { en: 'en-GB', ar: 'ar', fr: 'fr-FR', es: 'es-ES' };
  function locale() { return LOCALES[lang] || 'en-GB'; }
  function num(n) { try { return new Intl.NumberFormat(locale()).format(n); } catch (e) { return String(n); } }
  function date(ts, opts) { try { return new Intl.DateTimeFormat(locale(), opts || { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ts)); } catch (e) { return new Date(ts).toDateString(); } }
  function weekday(ts) { return date(ts, { weekday: 'short' }); }

  /** Minutes → "1 h 20 min" style, translated. */
  function minutes(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return t('fmt.min', { n: num(min) });
    const h = Math.floor(min / 60), r = min % 60;
    return r ? t('fmt.hmin', { h: num(h), m: num(r) }) : t('fmt.h', { h: num(h) });
  }
  /** Minutes → compact "1h 15m" for tight stat tiles. */
  function minutesShort(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return t('fmt.mShort', { n: num(min) });
    const h = Math.floor(min / 60), r = min % 60;
    return r ? t('fmt.hmShort', { h: num(h), m: num(r) }) : t('fmt.hShort', { h: num(h) });
  }
  /** Timestamp → "just now" / "5 min ago" / "3 h ago" / "2 d ago". */
  function ago(ts) {
    if (!ts) return t('fmt.never');
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 45) return t('fmt.justNow');
    if (s < 3600) return t('fmt.minAgo', { n: num(Math.max(1, Math.round(s / 60))) });
    if (s < 86400) return t('fmt.hAgo', { n: num(Math.floor(s / 3600)) });
    return t('fmt.dAgo', { n: num(Math.floor(s / 86400)) });
  }

  return { t, has, setLang, getLang, num, date, weekday, minutes, minutesShort, ago, LANGS: Object.keys(DICTS), DICTS };
});
