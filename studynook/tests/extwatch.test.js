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

suite('extwatch · Iron focus closes the browser if the blocker is gone', () => {
  const NOW2 = 1_800_000_000_000;
  const IRON = { ironFocus: true, sitesEnabled: true, lastSeen: NOW2 - 120 * 1000, now: NOW2, browser: 'chrome', runningSince: NOW2 - 100 * 1000 };
  const close = (over) => ExtWatch.shouldCloseBrowser(Object.assign({}, IRON, over));

  test('extension silent, browser open past the repair window → close it', () => {
    expect(close({})).toBe(true);
  });
  test('inside the repair window the browser is left alone (time to re-enable)', () => {
    expect(close({ runningSince: NOW2 - 30 * 1000 })).toBe(false);
  });
  test('only during an Iron focus', () => {
    expect(close({ ironFocus: false })).toBe(false);
  });
  test('extension back (recent poll) → nothing closes', () => {
    expect(close({ lastSeen: NOW2 - 5 * 1000 })).toBe(false);
  });
  test('site blocking off, never paired, unknown browser, long-gone extension → nothing closes', () => {
    expect(close({ sitesEnabled: false })).toBe(false);
    expect(close({ lastSeen: 0 })).toBe(false);
    expect(close({ browser: '' })).toBe(false);
    expect(close({ lastSeen: NOW2 - ExtWatch.RECENT_MS - 1000 })).toBe(false);
    expect(close({ runningSince: null })).toBe(false);
  });
  test('browser identity comes from the User-Agent', () => {
    expect(ExtWatch.browserFromUA('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/155.0.0.0 Safari/537.36')).toBe('chrome');
    expect(ExtWatch.browserFromUA('Mozilla/5.0 Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0')).toBe('edge');
    expect(ExtWatch.browserFromUA('curl/8.0')).toBe('');
    expect(ExtWatch.browserProcess('edge')).toBe('msedge');
    expect(ExtWatch.browserProcess('chrome')).toBe('chrome');
    expect(ExtWatch.browserProcess('')).toBe('');
  });
});
