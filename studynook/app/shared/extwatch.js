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

module.exports = { shouldWarn, SILENT_MS, RECENT_MS };
