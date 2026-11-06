/* ============================================================
   StudyNook · processes.js — list & close running programs
   ------------------------------------------------------------
   Windows: `tasklist /fo csv`  +  `taskkill /pid N /f /t`
   macOS / Linux: `ps -axo pid=,comm=`  +  `kill -9`
   All names are normalized via catalog.normalizeProcName.
   ============================================================ */
'use strict';

const { execFile } = require('child_process');
const catalog = require('../shared/catalog.js');

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 8, timeout: 8000 }, (err, stdout) => {
      resolve(err ? '' : String(stdout || ''));
    });
  });
}

/** Parse `tasklist /fo csv /nh` output. Tiny CSV reader (handles quotes). */
function parseTasklistCsv(out) {
  const rows = [];
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    if (cells.length >= 2) {
      const name = cells[0].trim();
      const pid = parseInt(cells[1], 10);
      if (name && !isNaN(pid)) rows.push({ pid, name });
    }
  }
  return rows;
}

/** Parse `ps -axo pid=,comm=` output */
function parsePs(out) {
  const rows = [];
  for (const line of out.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d+)\s+(.*)$/);
    if (m) rows.push({ pid: parseInt(m[1], 10), name: m[2].trim() });
  }
  return rows;
}

/** Parse the PID-per-line output of listWindowedPids. Anything that is not a plain number is ignored. */
function parsePidLines(out) {
  const pids = new Set();
  for (const line of String(out || '').split(/\r?\n/)) {
    if (/^\s*\d+\s*$/.test(line)) pids.add(parseInt(line, 10));
  }
  return pids;
}

/* Windows only: the PIDs of programs that have a visible top-level window. .NET's MainWindowHandle is
   the first visible, unowned window of the process, so tray-only and background programs (sync
   clients, updaters, drivers, helpers) are not in this set. Returns null when it cannot be told
   (PowerShell missing or failed), and callers then leave the program alone. */
async function listWindowedPids() {
  const out = await run('powershell', ['-NoProfile', '-NonInteractive', '-Command', '(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 }).Id']);
  const pids = parsePidLines(out);
  return pids.size ? pids : null;
}

/** opts.windows (Windows only): also mark each row `hasWindow` true/false; left undefined if unknown. */
async function listProcesses(platform, opts) {
  platform = platform || process.platform;
  let raw = [];
  let windowed = null;
  if (platform === 'win32') {
    const [csv, w] = await Promise.all([run('tasklist', ['/fo', 'csv', '/nh']), opts && opts.windows ? listWindowedPids() : null]);
    raw = parseTasklistCsv(csv);
    windowed = w;
  } else {
    raw = parsePs(await run('ps', ['-axo', 'pid=,comm=']));
  }
  return raw.map((r) => {
    const row = { pid: r.pid, name: r.name, norm: catalog.normalizeProcName(r.name) };
    if (windowed) row.hasWindow = windowed.has(r.pid);
    return row;
  }).filter((r) => r.norm);
}

/* One process list for everyone. Listing spawns `tasklist` (~400 ms on Windows), and the
   guard, the Iron browser check and the allowlist preview used to each spawn their own.
   Callers that only DECIDE (scan, preview) may reuse a list up to `maxAgeMs` old and
   share an in-flight request; callers about to KILL something use listProcesses()
   directly so they verify against a fresh list (PID-reuse safety). */
function makeShared(fetchList, now) {
  now = now || Date.now;
  let cache = { at: -Infinity, rows: [] }, inflight = null;
  return function shared(maxAgeMs) {
    maxAgeMs = maxAgeMs === undefined ? 1500 : maxAgeMs;
    if (now() - cache.at < maxAgeMs) return Promise.resolve(cache.rows);
    if (!inflight) {
      inflight = Promise.resolve().then(fetchList).then((rows) => { cache = { at: now(), rows }; return rows; })
        .finally(() => { inflight = null; });
    }
    return inflight;
  };
}
const listProcessesShared = makeShared(() => listProcesses());
const listProcessesWindowedShared = makeShared(() => listProcesses(undefined, { windows: true }));   // allowlist mode

/* SECURITY FIX: the old wrapper collapsed errors into '' and this function
   returned `out !== '' || true` — a literal always-true expression that could
   never distinguish "killed it" from "the kill command failed". Now we use a
   minimal raw execFile variant that preserves the exit status (same argv,
   same windowsHide/maxBuffer/timeout as before — behavior unchanged). */
function runRaw(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 8, timeout: 8000 }, (err, stdout) => {
      resolve({ err, out: String(stdout || '') });
    });
  });
}

async function killProcess(pid, platform) {
  platform = platform || process.platform;
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (platform === 'win32') {
    const r = await runRaw('taskkill', ['/pid', String(pid), '/f', '/t']);
    return r.err === null;          // taskkill exits non-zero when the pid is gone/denied
  }
  const r = await runRaw('kill', ['-9', String(pid)]);
  return r.err === null;            // kill prints nothing on success — exit status is the truth
}

module.exports = { listProcesses, listProcessesShared, listProcessesWindowedShared, listWindowedPids, makeShared, killProcess, parseTasklistCsv, parsePs, parsePidLines };
