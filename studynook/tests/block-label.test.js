'use strict';
/* What the extension's blocked page shows in place of a countdown. */
const { blockLabel } = require('../extension/blocked/label.js');

const focus = (over) => Object.assign({ active: true, phase: 'focus', running: true, remainingSec: 600 }, over);

suite('blocked page · label', () => {
  test('a running focus counts down', () => {
    expect(blockLabel({ connected: true, session: focus() }).kind).toBe('countdown');
  });
  test('a PAUSED session says paused, with the frozen time (it is not "always on")', () => {
    const l = blockLabel({ connected: true, session: focus({ running: false, remainingSec: 7142 }) });
    expect(l.kind).toBe('paused');
    expect(l.remainingSec).toBe(7142);
  });
  test('the app was closed in the middle of a session: say so', () => {
    expect(blockLabel({ connected: false, session: focus({ running: false }) }).kind).toBe('offline');
  });
  test('standalone mode (no desktop app) keeps its own countdown', () => {
    const l = blockLabel({ connected: false, timer: { running: true, phase: 'focus', endsAt: 123 }, session: { active: false } });
    expect(l.kind).toBe('countdown');
    expect(l.endsAt).toBe(123);
  });
  test('"always" is only shown when the student really chose always-on blocking', () => {
    expect(blockLabel({ connected: true, sites: { when: 'always' }, session: { active: false } }).kind).toBe('always');
    expect(blockLabel({ connected: false, sites: { when: 'always' }, session: focus() }).kind).toBe('always');
    expect(blockLabel({ connected: true, sites: { when: 'session' }, session: { active: false } }).kind).toBe('always');   // nothing else to say
  });
  test('empty or missing state never throws', () => {
    expect(blockLabel(undefined).kind).toBe('always');
    expect(blockLabel({}).kind).toBe('always');
  });
});
