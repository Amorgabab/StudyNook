/* ============================================================
   StudyNook · tests/run.js — tiny zero-dependency test runner
   (sync AND async tests). Run with:  npm test
   ============================================================ */
'use strict';
const path = require('path');
const fs = require('fs');

const queue = [];
let passed = 0, failed = 0;
const failures = [];

global.expect = function (actual) {
  return {
    toBe(exp) {
      if (actual !== exp) throw new Error(`expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`);
    },
    toEqual(exp) {
      const a = JSON.stringify(actual), b = JSON.stringify(exp);
      if (a !== b) throw new Error(`expected ${b}, got ${a}`);
    },
    toBeTruthy() { if (!actual) throw new Error(`expected truthy, got ${JSON.stringify(actual)}`); },
    toBeFalsy() { if (actual) throw new Error(`expected falsy, got ${JSON.stringify(actual)}`); },
    toBeGreaterThan(n) { if (!(actual > n)) throw new Error(`expected > ${n}, got ${actual}`); },
    toContain(item) { if (!actual.includes(item)) throw new Error(`expected to contain ${JSON.stringify(item)}`); }
  };
};
global.test = function (name, fn) { queue.push({ name, fn }); };
global.suite = function (name, fn) { console.log('\n' + name); fn(); };

const dir = __dirname;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort()) {
  require(path.join(dir, f));
}

(async () => {
  for (const t of queue) {
    try { await t.fn(); passed++; console.log('  ✓ ' + t.name); }
    catch (e) { failed++; failures.push(t.name + ' → ' + e.message); console.log('  ✗ ' + t.name + ' → ' + e.message); }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) { console.log('\nFailures:'); failures.forEach((f) => console.log(' - ' + f)); process.exit(1); }
})();
