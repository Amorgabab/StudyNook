'use strict';
/* The ambience recordings that ship with the installer, and where the app looks for them. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const IDS = ['rain', 'waves', 'fire', 'cafe'];

suite('sounds · bundled ambience', () => {
  test('each ambience has a real mp3 in assets/sounds', () => {
    for (const id of IDS) {
      const f = path.join(ROOT, 'assets', 'sounds', id + '.mp3');
      expect(fs.existsSync(f)).toBe(true);
      const b = fs.readFileSync(f);
      expect(b.length > 100000).toBe(true);
      // an MPEG audio file starts with an ID3 tag or an MPEG frame sync
      expect(b.slice(0, 3).toString() === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)).toBe(true);
    }
  });
  test('together they stay small enough not to bloat the installer', () => {
    const total = IDS.map((id) => fs.statSync(path.join(ROOT, 'assets', 'sounds', id + '.mp3')).size).reduce((a, b) => a + b, 0);
    expect(total < 16 * 1024 * 1024).toBe(true);
  });
  test('electron-builder copies assets/sounds into the install folder', () => {
    const extra = JSON.parse(read('package.json')).build.extraResources;
    expect(extra.some((e) => e.from === 'assets/sounds' && e.to === 'sounds')).toBe(true);
  });
  test('the app reads the user’s files first, then the bundled ones', () => {
    const ipc = read('app/main/ipc.js');
    expect(/for \(const dir of \[SOUNDS_DIR, BUNDLED_SOUNDS_DIR\]\)/.test(ipc)).toBe(true);
    const main = read('app/main/main.js');
    expect(/BUNDLED_SOUNDS_DIR = app\.isPackaged \? path\.join\(process\.resourcesPath, 'sounds'\) : null/.test(main)).toBe(true);
  });
});
