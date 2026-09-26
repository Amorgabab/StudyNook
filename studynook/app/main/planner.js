/* ============================================================
   StudyNook · planner.js  (PURE LOGIC — no dependencies)
   ------------------------------------------------------------
   Decides WHICH running processes count as "targets" under the
   two guard modes:
     • block mode → close apps on your blocklist
     • allow mode → close everything EXCEPT allowlist + OS-safety list
   The actual killing happens in guardian.js (main process).
   This file only reasons, so it can be unit-tested safely.
   ============================================================ */
'use strict';

const catalog = require('../shared/catalog.js');

/**
 * @param {Array<{pid:number, name:string, norm:string}>} procs  running processes
 * @param {object} opts
 *   mode:      'block' | 'allow'
 *   block:     [{label, procs:[norm...], enabled}]   (block mode lists)
 *   allow:     [{label, procs:[norm...], enabled}]   (allow mode lists)
 *   allowOnce: { [norm]: untilTimestampMs }           (temporary "leave it alone")
 *   platform:  'win32' | 'darwin' | 'linux'
 *   selfPid:   number  (our own PID — never touch)
 * @returns {Array<{pid, name, norm, label, reason}>}
 */
function chooseTargets(procs, opts) {
  const platform = opts.platform === 'darwin' || opts.platform === 'linux' ? opts.platform : 'win32';
  const never = catalog.NEVER_KILL[platform] || catalog.NEVER_KILL.win;
  const now = Date.now();
  const allowedOnce = (norm) => {
    const until = opts.allowOnce && opts.allowOnce[norm];
    return !!until && until > now;
  };
  const isNeverKill = (norm) => never.some((n) => norm === n || norm.startsWith(n + ' ') || norm.startsWith(n + '.'));

  // Build lookup of enabled entries → normalized proc names
  const blockNames = new Map(); // norm -> label
  for (const e of (opts.block || [])) {
    if (e.enabled === false) continue;
    for (const p of (e.procs || [])) {
      const n = catalog.normalizeProcName(p);
      if (n) blockNames.set(n, e.label || n);
    }
  }
  const allowNames = new Set();
  for (const e of (opts.allow || [])) {
    if (e.enabled === false) continue;
    for (const p of (e.procs || [])) {
      const n = catalog.normalizeProcName(p);
      if (n) allowNames.add(n);
    }
  }

  const targets = [];
  const seen = new Set();

  for (const p of procs) {
    if (p.pid === opts.selfPid) continue;                 // us
    if (isNeverKill(p.norm)) continue;                   // OS safety
    if (allowedOnce(p.norm)) continue;                   // "leave it for 5 min"
    if (seen.has(p.pid)) continue;
    let hit = null;
    if (opts.mode === 'block') {
      if (blockNames.has(p.norm)) hit = { label: blockNames.get(p.norm), reason: 'blocklist' };
    } else {
      if (!allowNames.has(p.norm)) hit = { label: p.name, reason: 'not-on-allowlist' };
    }
    if (hit) {
      seen.add(p.pid);
      targets.push({ pid: p.pid, name: p.name, norm: p.norm, label: hit.label, reason: hit.reason });
    }
  }
  return targets;
}

/** Group targets by label → [{label, pids:[...], norms:[...], count}] (for logs & warnings) */
function groupTargets(targets) {
  const m = new Map();
  for (const t of targets) {
    if (!m.has(t.label)) m.set(t.label, { pids: [], norms: new Set() });
    const g = m.get(t.label);
    g.pids.push(t.pid);
    g.norms.add(t.norm);
  }
  return [...m.entries()].map(([label, g]) => ({ label, pids: g.pids, norms: [...g.norms], count: g.pids.length }));
}

module.exports = { chooseTargets, groupTargets };
