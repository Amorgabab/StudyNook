'use strict';
const Iron = require('../app/shared/iron.js');

suite('iron gate · sentence matching', () => {
  test('exact match passes', () => expect(Iron.matches('i choose to end my focus early')).toBeTruthy());
  test('case-insensitive', () => expect(Iron.matches('I CHOOSE TO END MY FOCUS EARLY')).toBeTruthy());
  test('extra whitespace tolerated', () => expect(Iron.matches('  i   choose to  end my focus early ')).toBeTruthy());
  test('wrong sentence rejected', () => expect(Iron.matches('i choose to end my focus')).toBeFalsy());
  test('empty rejected', () => expect(Iron.matches('')).toBeFalsy());
  test('cooldown is one minute', () => expect(Iron.COOLDOWN_SEC).toBe(60));
});

suite('iron gate · 4-day settings lock', () => {
  test('lock lasts 4 days', () => {
    const now = 1000000;
    const until = Iron.makeLock(now);
    expect(until - now).toBe(4 * 24 * 60 * 60 * 1000);
  });
  test('locked before expiry, open after', () => {
    const now = 1000000;
    const until = Iron.makeLock(now);
    expect(Iron.isLocked(until, now + 1000)).toBeTruthy();
    expect(Iron.isLocked(until, until + 1)).toBeFalsy();
    expect(Iron.isLocked(0, now)).toBeFalsy();
  });
  test('remaining text sane', () => {
    const now = 1000000;
    const until = now + (3 * 86400000) + (4 * 3600000) + (12 * 60000);
    expect(Iron.remainingHms(until, now)).toBe('3d 4h 12m');
  });
});
