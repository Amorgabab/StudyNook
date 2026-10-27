'use strict';
/* IPC contract: every channel preload.js lets the UI call has a handler (and vice versa),
   the handlers behave, and each window only receives the state it needs. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../app/main/store.js');
const { SessionEngine } = require('../app/main/session.js');
const { registerIpc } = require('../app/main/ipc.js');
const { createSnapshots } = require('../app/main/snapshot.js');

const preload = fs.readFileSync(path.join(__dirname, '..', 'app', 'main', 'preload.js'), 'utf8');
const setFrom = (name) => {
  const m = new RegExp('const ' + name + ' = new Set\\(\\[([\\s\\S]*?)\\]\\);').exec(preload);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

/* A fake Electron + the live objects ipc.js expects, around a real Store in a temp folder. */
function rig() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-ipc-'));
  const store = new Store(path.join(dir, 'data.json'));
  const session = new SessionEngine({ getSettings: () => store.data.settings.timer, onPhaseEnd: () => {}, onState: () => {} });
  const handlers = new Map();
  const sent = [];
  const guardian = { pauseFor: () => true, _loop: () => {}, previewAllowlist: async () => [], killNow: async () => 0, allowOnce: () => true, pausedMinLeft: () => 0, isArmed: () => false, pendingReminder: null };
  const ctx = {
    ipcMain: { handle: (ch, fn) => handlers.set(ch, fn) },
    shell: { openPath: () => {}, openExternal: () => {} },
    store, session, guardian, server: { error: null },
    DATA_DIR: dir, SOUNDS_DIR: path.join(dir, 'sounds'), EXT_DIR: path.join(__dirname, '..', 'extension'),
    app: { isPackaged: false }, nativeTheme: { shouldUseDarkColors: false },
    extConnected: false, gateCleared: false,
    T: (k) => k, broadcast: (ch, p) => sent.push([ch, p]), pushSnapshot: () => {}, addFeed: () => {},
    grantXp: () => [], sendRewardEvents: () => {}, grantAchievements: () => [], writeBackup: () => 'backup.json',
    applyLoginItem: () => {}, buildTrayMenu: () => {}, hideReminderWindow: () => {}, win: () => null,
    snapshotFor: () => ({ ok: 'snapshot' })
  };
  registerIpc(ctx);
  const call = (ch, payload) => handlers.get(ch)({ sender: 'x' }, payload);   // Electron passes (event, payload)
  return { ctx, handlers, call, sent, store, session };
}

suite('ipc · preload whitelist and handlers agree', () => {
  const { handlers } = rig();
  test('every whitelisted channel has a handler', () => {
    expect(setFrom('INVOKE').filter((ch) => !handlers.has(ch))).toEqual([]);
  });
  test('every handler is whitelisted (otherwise the UI can never reach it)', () => {
    expect([...handlers.keys()].filter((ch) => !setFrom('INVOKE').includes(ch))).toEqual([]);
  });
  test('the removed week-planner channels are really gone', () => {
    for (const ch of ['tasks:setDate', 'tasks:unschedule', 'tasks:focusNow', 'help:readme', 'ext:forceLoad']) expect(handlers.has(ch)).toBe(false);
    expect(setFrom('ON').includes('focus-request')).toBe(false);
  });
});

suite('ipc · handlers', () => {
  test('tasks: add, validate, toggle, remove', async () => {
    const r = rig();
    expect(await r.call('tasks:add', { text: '   ' })).toBe(null);
    const t = await r.call('tasks:add', { text: 'Chem notes', subject: 'Science', est: '3', min: '50' });
    expect(t.text).toBe('Chem notes');
    expect(t.est).toBe(3);
    expect(r.store.data.tasks.length).toBe(1);
    await r.call('tasks:toggle', { id: t.id });
    expect(r.store.data.tasks[0].done).toBe(true);
    await r.call('tasks:remove', { id: t.id });
    expect(r.store.data.tasks.length).toBe(0);
  });
  test('notes: add, save (length-capped), remove', async () => {
    const r = rig();
    const n = await r.call('notes:add');
    await r.call('notes:save', { id: n.id, title: 'T'.repeat(500), body: 'b' });
    expect(r.store.data.notes[0].title.length).toBe(120);
    await r.call('notes:remove', { id: n.id });
    expect(r.store.data.notes.length).toBe(0);
  });
  test('settings:set validates the new settings', async () => {
    const r = rig();
    await r.call('settings:set', { section: 'language', values: 'fr' });
    expect(r.store.data.settings.language).toBe('fr');
    await r.call('settings:set', { section: 'language', values: 'xx' });
    expect(r.store.data.settings.language).toBe('en');
    await r.call('settings:set', { section: 'dailyGoalMin', values: 99999 });
    expect(r.store.data.settings.dailyGoalMin).toBe(720);
    await r.call('settings:set', { section: 'theme', values: 'neon' });
    expect(r.store.data.settings.theme).toBe('system');
    await r.call('settings:set', { section: 'notify', values: { focusEnd: false, bogus: true } });
    expect(r.store.data.settings.notify.focusEnd).toBe(false);
    expect('bogus' in r.store.data.settings.notify).toBe(false);
  });
  test('get-snapshot is answered per window via ctx.snapshotFor', async () => {
    const r = rig();
    expect(await r.call('get-snapshot')).toEqual({ ok: 'snapshot' });
  });
  test('closing the window is refused while a session exists', async () => {
    const r = rig();
    r.session.start({ mode: 'free', freeMin: 5 });
    expect(await r.call('win:close')).toBe(false);
    expect(r.sent.some((s) => s[0] === 'close-blocked')).toBe(true);
    r.session.stop({});
  });
  test('closing the idle window quits, unless something must keep running', async () => {
    const r = rig(); let quit = 0, hid = 0;
    r.ctx.quitApp = () => { quit++; }; r.ctx.win = () => ({ hide: () => { hid++; } });
    await r.call('win:close');
    expect([quit, hid]).toEqual([1, 0]);
    r.store.data.settings.closeToTray = true;
    await r.call('win:close');
    expect([quit, hid]).toEqual([1, 1]);
    r.store.data.settings.closeToTray = false; r.store.data.sites.when = 'always';
    await r.call('win:close');
    expect([quit, hid]).toEqual([1, 2]);
  });
});

suite('snapshots · each window gets only what it draws', () => {
  function heavy() {
    const r = rig();
    r.store.data.notes = Array.from({ length: 40 }, (_, i) => ({ id: 'n' + i, title: 'N' + i, body: 'x'.repeat(8000), updatedAt: 1 }));
    r.store.data.tasks = Array.from({ length: 200 }, (_, i) => ({ id: 't' + i, text: 'Task ' + i, done: false, est: 1, min: 0, pomosDone: 0, sources: [] }));
    return { r, snaps: createSnapshots(r.ctx) };
  }
  test('the mini timer state is tiny even for a heavy user', () => {
    const { snaps } = heavy();
    expect(JSON.stringify(snaps.full()).length).toBeGreaterThan(300000);
    expect(JSON.stringify(snaps.mini()).length < 2000).toBe(true);
    expect(JSON.stringify(snaps.reminder()).length < 2000).toBe(true);
  });
  test('mini and reminder carry exactly the fields their scripts read', () => {
    const { snaps } = heavy();
    const m = snaps.mini(), q = snaps.reminder();
    expect(typeof m.session.active).toBe('boolean');
    expect(typeof m.data.pet.stage).toBe('number');
    expect(typeof m.data.settings.language).toBe('string');
    expect(typeof m.data.settings.theme).toBe('string');
    expect('pendingReminder' in q).toBe(true);
    expect(typeof q.data.settings.theme).toBe('string');
  });
});
