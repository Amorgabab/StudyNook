/* StudyNook · feed/journal data contract (Nook redesign) */
'use strict';
const path = require('path');
const store = require(path.join(__dirname, '..', 'app', 'main', 'store.js'));

suite('journal feed · kind/xp contract', () => {
  test('good/warn kinds survive sanitization; unknown kinds become info', () => {
    const d = store.sanitizeData({ feed: [
      { t: Date.now(), emoji: '✅', kind: 'good', xp: 5, text: 'Task done: Read Chapter 4' },
      { t: Date.now(), emoji: '⚡', kind: 'warn', text: 'interrupted' },
      { t: Date.now(), emoji: '🌱', kind: 'weird', text: 'started' },
      { t: 'junk', emoji: 'x'.repeat(30), kind: 'good', xp: -9, text: null }
    ] });
    expect(d.feed[0].kind).toBe('good');
    expect(d.feed[0].xp).toBe(5);
    expect(d.feed[1].kind).toBe('warn');
    expect(d.feed[2].kind).toBe('info');
    expect(typeof d.feed[3].t).toBe('number');
    expect(d.feed[3].emoji.length <= 8).toBeTruthy();
    expect(d.feed[3].xp).toBe(0);
    expect(d.feed[3].text).toBe('');
  });
  test('missing fields get safe defaults', () => {
    const d = store.sanitizeData({ feed: [{ }] });
    expect(d.feed[0].kind).toBe('info');
    expect(d.feed[0].xp).toBe(0);
    expect(d.feed[0].emoji).toBe('🌱');
  });
});
