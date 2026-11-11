'use strict';
/* watch.js · closing the browser when the extension goes quiet is an IRON-only rule.
   1.5.15 broke it: `blockActive` became true for every focus round (so pausing keeps blocking), and
   watch.js was reading that flag as "this is an Iron focus", so a normal focus closed Chrome too.
   These tests drive the real watcher with the real session engine, a fake clock and a fake process list. */
const processes = require('../app/main/processes.js');
const ExtFinder = require('../app/main/extfinder.js');
const ExtWatch = require('../app/shared/extwatch.js');
const { createWatch } = require('../app/main/watch.js');
const { SessionEngine } = require('../app/main/session.js');

const S = { workMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: false };
const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };

/** Runs `body` with: a silent extension last seen in Chrome, Chrome running, and a clock the test moves. */
async function scenario(settings, body) {
  const realNow = Date.now, realList = processes.listProcessesShared, realDetect = ExtFinder.detect;
  let clock = realNow();
  Date.now = () => clock;
  processes.listProcessesShared = async () => [{ norm: 'chrome', pid: 1 }];
  ExtFinder.detect = () => ({ status: 'disabled' });
  const kills = [], notes = [], logs = [];
  const eng = new SessionEngine({ getSettings: () => settings, onTick: () => {}, onState: () => {}, onPhaseEnd: () => {} });
  const store = {
    data: { ext: { browser: 'chrome', lastSeen: clock - 2 * 60 * 1000 }, sites: { enabled: true } },
    mutate(fn) { fn(this.data); }
  };
  const watch = createWatch({
    app: {}, store, session: eng,
    guardian: { killNow: async (p) => { kills.push(p); return true; } },
    server: { connected: () => false },
    T: (k) => k, notify: (title, msg) => notes.push(msg), broadcast: () => {}, addFeed: () => {},
    pushSnapshot: () => {}, lifeLog: (k) => logs.push(k), DATA_DIR: '', EXT_DIR: ''
  });
  const poll = async (advanceMs) => { clock += advanceMs || 0; watch.pollExtStatus(); await flush(); };
  try { await body({ eng, poll, kills, notes, logs }); }
  finally {
    try { eng.stop({ abandon: true }); } catch (e) { /* already ended */ }
    Date.now = realNow; processes.listProcessesShared = realList; ExtFinder.detect = realDetect;
  }
}
const PAST_REPAIR = ExtWatch.REPAIR_MS + 1000;

suite('watch · only an Iron focus closes the browser when the extension is silent', () => {
  test('normal focus: the browser is never closed, however long the extension stays silent', async () => {
    await scenario(S, async ({ eng, poll, kills, logs }) => {
      eng.start({ mode: 'pomodoro' });
      expect(eng.publicState().blockActive).toBe(true);   // blocking is on in a normal focus...
      expect(eng.ironActive()).toBe(false);               // ...but it is not an Iron promise
      await poll(0);
      await poll(PAST_REPAIR);
      await poll(PAST_REPAIR);
      expect(kills).toEqual([]);
      expect(logs.includes('iron-closed-browser')).toBe(false);
    });
  });
  test('normal focus, paused: still never closed', async () => {
    await scenario(S, async ({ eng, poll, kills }) => {
      eng.start({ mode: 'pomodoro' });
      eng.pause();
      await poll(0);
      await poll(PAST_REPAIR);
      expect(kills).toEqual([]);
    });
  });
  test('normal focus: the "extension went quiet" warning does not threaten to close the browser', async () => {
    await scenario(S, async ({ eng, poll, notes }) => {
      eng.start({ mode: 'pomodoro' });
      await poll(0);
      expect(notes.length).toBe(1);
      expect(notes[0].includes('main.n.extGone.iron')).toBe(false);
    });
  });
  test('Iron focus: left alone inside the repair window, closed after it', async () => {
    await scenario(Object.assign({}, S, { iron: true }), async ({ eng, poll, kills, notes, logs }) => {
      eng.start({ mode: 'pomodoro' });
      expect(eng.ironActive()).toBe(true);
      await poll(0);
      expect(kills).toEqual([]);                           // time to re-enable the extension
      expect(notes[0].includes('main.n.extGone.iron')).toBe(true);
      await poll(PAST_REPAIR);
      expect(kills).toEqual(['chrome']);
      expect(logs.includes('iron-closed-browser')).toBe(true);
    });
  });
  test('Iron break: nothing is closed (the rule covers the focus phase only)', async () => {
    await scenario(Object.assign({}, S, { iron: true }), async ({ eng, poll, kills }) => {
      eng.start({ mode: 'pomodoro' });
      eng.s.phase = 'short'; eng.s.phaseSec = 300; eng.s.running = true; eng.s.endsAt = Date.now() + 300 * 1000;
      await poll(0);
      await poll(PAST_REPAIR);
      expect(kills).toEqual([]);
    });
  });
});
