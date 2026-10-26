/* ============================================================
   StudyNook · uiprefs.js  (PURE LOGIC — shared by every window)
   ------------------------------------------------------------
   One answer to "which theme is on right now?", so the main
   window, the mini timer and the warning card can never disagree.
     system → follows Windows (systemDark from Electron nativeTheme)
     light / dark → fixed
     auto → dark from 19:00 to 07:00, light otherwise
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NookPrefs = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const THEMES = ['system', 'light', 'dark', 'auto'];
  const AUTO_DARK_FROM = 19;   // 19:00
  const AUTO_LIGHT_FROM = 7;   // 07:00
  const LANGS = ['en', 'ar', 'fr', 'es'];
  const RTL = ['ar'];

  function resolveTheme(setting, systemDark, hour) {
    if (setting === 'light' || setting === 'dark') return setting;
    if (setting === 'auto') {
      const h = Number(hour);
      return h >= AUTO_DARK_FROM || h < AUTO_LIGHT_FROM ? 'dark' : 'light';
    }
    return systemDark ? 'dark' : 'light';            // 'system' and anything unknown
  }

  function normLang(v) { return LANGS.includes(v) ? v : 'en'; }
  function dirFor(lang) { return RTL.includes(lang) ? 'rtl' : 'ltr'; }

  /** Apply theme + language to a document (browser windows only). */
  function applyToDocument(doc, settings, systemDark) {
    const s = settings || {};
    const el = doc.documentElement;
    el.dataset.theme = resolveTheme(s.theme, systemDark, new Date().getHours());
    const lang = normLang(s.language);
    el.lang = lang;
    el.dir = dirFor(lang);
  }

  return { THEMES, LANGS, AUTO_DARK_FROM, AUTO_LIGHT_FROM, resolveTheme, normLang, dirFor, applyToDocument };
});
