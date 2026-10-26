/* ============================================================
   StudyNook · lifecycle.js — tiny append-only event log
   ------------------------------------------------------------
   One shared file (data/lifecycle.log) that both the app and the
   watchdog append to, so "why did it close / did it restart?" has
   a plain-text answer. Never throws; rotates once past 256 KB.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_BYTES = 256 * 1024;

function makeLogger(file, who) {
  return function log(event, extra) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      try { if (fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, file + '.1'); } catch (e) {}
      const tail = extra === undefined ? '' : ' ' + (typeof extra === 'string' ? extra : JSON.stringify(extra));
      fs.appendFileSync(file, new Date().toISOString() + ' [' + who + ' ' + process.pid + '] ' + event + tail + '\n');
    } catch (e) { /* logging must never break the app */ }
  };
}

module.exports = { makeLogger, MAX_BYTES };
