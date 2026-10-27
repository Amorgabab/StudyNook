'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeFileAtomic } = require('../app/main/atomic.js');

suite('atomic file write', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-atomic-'));
  test('creates and overwrites, leaving no temp file behind', () => {
    const f = path.join(dir, 'session.json');
    writeFileAtomic(f, '{"a":1}');
    expect(fs.readFileSync(f, 'utf8')).toBe('{"a":1}');
    writeFileAtomic(f, '{"a":2}');
    expect(fs.readFileSync(f, 'utf8')).toBe('{"a":2}');
    expect(fs.existsSync(f + '.tmp')).toBe(false);
  });
  test('a stale half-written temp file from an earlier kill never corrupts the real one', () => {
    const f = path.join(dir, 'session2.json');
    writeFileAtomic(f, '{"ok":true}');
    fs.writeFileSync(f + '.tmp', '{"ok":tr');            // what a kill mid-write leaves behind
    expect(JSON.parse(fs.readFileSync(f, 'utf8')).ok).toBe(true);
    writeFileAtomic(f, '{"ok":false}');                  // the next save replaces it cleanly
    expect(JSON.parse(fs.readFileSync(f, 'utf8')).ok).toBe(false);
    expect(fs.existsSync(f + '.tmp')).toBe(false);
  });
});
