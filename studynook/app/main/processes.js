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

async function listProcesses(platform) {
  platform = platform || process.platform;
  let raw = [];
  if (platform === 'win32') {
    raw = parseTasklistCsv(await run('tasklist', ['/fo', 'csv', '/nh']));
  } else {
    raw = parsePs(await run('ps', ['-axo', 'pid=,comm=']));
  }
  return raw.map((r) => ({ pid: r.pid, name: r.name, norm: catalog.normalizeProcName(r.name) })).filter((r) => r.norm);
}

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

module.exports = { listProcesses, killProcess, parseTasklistCsv, parsePs };
