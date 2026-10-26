'use strict';
const ExtWatch = require('../app/shared/extwatch.js');

const NOW = 1_800_000_000_000;
const BASE = { focusing: true, sitesEnabled: true, lastSeen: NOW - 60 * 1000, now: NOW, warned: false };
const ask = (over) => ExtWatch.shouldWarn(Object.assign({}, BASE, over));

suite('extwatch · Chrome extension went quiet during focus', () => {
  test('warns when a paired extension is silent mid-focus', () => {
    expect(ask({})).toBe(true);
  });
  test('still connected (recent poll) → no warning', () => {
    expect(ask({ lastSeen: NOW - 10 * 1000 })).toBe(false);
  });
  test('warns only once per silence', () => {
    expect(ask({ warned: true })).toBe(false);
  });
  test('no warning outside a focus', () => {
    expect(ask({ focusing: false })).toBe(false);
  });
  test('no warning when site blocking is switched off anyway', () => {
    expect(ask({ sitesEnabled: false })).toBe(false);
  });
  test('never-paired extension (lastSeen 0) is not nagged', () => {
    expect(ask({ lastSeen: 0 })).toBe(false);
  });
  test('extension long gone (over 2 weeks) is not nagged', () => {
    expect(ask({ lastSeen: NOW - ExtWatch.RECENT_MS - 1000 })).toBe(false);
  });
});
