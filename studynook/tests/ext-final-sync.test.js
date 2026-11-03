'use strict';
/* The extension keeps blocking if the app disappears mid-focus. So after a CLEAN end of a session the
   app must not quit before the extension has polled once more and heard the session is over. */
const { SyncServer } = require('../app/main/sync-server.js');

const mk = () => new SyncServer({ store: { data: { ext: {} } }, session: {} });

suite('sync server · final poll before a clean quit', () => {
  test('quitting is held only when the extension was last told blocking is on and it is off now', () => {
    const s = mk();
    expect(s.staleBlockingForExt(false)).toBe(false);          // never polled: nothing to wait for
    s.lastBlocking = true; s.lastStateAt = Date.now();
    expect(s.staleBlockingForExt(false)).toBe(true);           // told "on", off now: wait
    expect(s.staleBlockingForExt(true)).toBe(false);           // still blocking: a quit is a real kill/shutdown, leave ghost focus alone
    s.lastBlocking = false;
    expect(s.staleBlockingForExt(false)).toBe(false);          // it already knows blocking is off
  });
  test('an old poll does not hold the quit (the extension is long gone)', () => {
    const s = mk();
    s.lastBlocking = true; s.lastStateAt = Date.now() - 60000;
    expect(s.staleBlockingForExt(false)).toBe(false);
  });
  test('waitForPoll resolves when the extension polls, and by itself after the timeout', async () => {
    const s = mk();
    let resolved = false;
    const p = s.waitForPoll(5000).then(() => { resolved = true; });
    await new Promise((r) => setTimeout(r, 30));
    expect(resolved).toBe(false);
    for (const done of [...s._pollWaiters]) done();            // what the /state handler does
    await p;
    expect(resolved).toBe(true);
    expect(s._pollWaiters.size).toBe(0);
    const t0 = Date.now();
    await s.waitForPoll(60);
    expect(Date.now() - t0 >= 50).toBe(true);
  });
});
