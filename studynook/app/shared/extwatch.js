/* ============================================================
   StudyNook · extwatch.js  (PURE LOGIC — no dependencies)
   ------------------------------------------------------------
   Decides when to tell the student that the Chrome extension has
   gone quiet in the middle of a focus session (removed, disabled,
   or Chrome closed) — website blocking silently stops without it.
   One warning per silence, re-armed when the extension returns
   or the focus ends.
   ============================================================ */
'use strict';

const SILENT_MS = 45 * 1000;                       // extension polls every 5–30s; longer = gone
const RECENT_MS = 14 * 24 * 60 * 60 * 1000;        // not seen for 2 weeks = long gone, stop nagging

function shouldWarn({ focusing, sitesEnabled, lastSeen, now, warned }) {
  if (!focusing || !sitesEnabled || warned) return false;
  const seen = Number(lastSeen) || 0;
  if (seen <= 0) return false;                      // never paired: nothing was lost
  const age = now - seen;
  return age > SILENT_MS && age < RECENT_MS;
}

/* ---------- Iron focus: no blocker, no browser ----------
   Chrome will never stop a user removing or disabling an extension, so the
   only lever the app has is the one it already uses for blocked apps: closing
   them. Only during an IRON focus (the promise that site blocking stays on),
   and only after a repair window — the browser must have been running for
   REPAIR_MS while the extension stayed silent, so there is time to re-enable
   it at chrome://extensions (which needs the browser open). Closing the
   browser restarts the window. */
const REPAIR_MS = 90 * 1000;

/** The extension's own requests carry the browser's User-Agent. */
function browserFromUA(ua) {
  ua = String(ua || '');
  if (/\bEdg(e|A|iOS)?\//.test(ua)) return 'edge';
  if (/\b(Chrome|Chromium)\//.test(ua)) return 'chrome';
  return '';
}
/** Process name (as catalog.normalizeProcName spells it) of that browser. */
function browserProcess(browser) { return browser === 'edge' ? 'msedge' : browser === 'chrome' ? 'chrome' : ''; }

function shouldCloseBrowser({ ironFocus, sitesEnabled, lastSeen, now, browser, runningSince }) {
  if (!ironFocus || !sitesEnabled || !browserProcess(browser) || !runningSince) return false;
  const seen = Number(lastSeen) || 0;
  if (seen <= 0) return false;
  const age = now - seen;
  return age > SILENT_MS && age < RECENT_MS && now - runningSince >= REPAIR_MS;
}

module.exports = { shouldWarn, shouldCloseBrowser, browserFromUA, browserProcess, SILENT_MS, RECENT_MS, REPAIR_MS };
