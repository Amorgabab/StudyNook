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
  const syncHandlers = new Map();
  const sent = [];
  const guardian = { pauseFor: () => true, _loop: () => {}, previewAllowlist: async () => [], killNow: async () => 0, allowOnce: () => true, pausedMinLeft: () => 0, isArmed: () => false, pendingReminder: null };
  const ctx = {
    ipcMain: { handle: (ch, fn) => handlers.set(ch, fn), on: (ch, fn) => syncHandlers.set(ch, fn) },
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
  // ipcRenderer.sendSync: the handler sets event.returnValue
  const callSync = (ch, payload) => { const e = { sender: 'x', returnValue: undefined }; syncHandlers.get(ch)(e, payload); return e.returnValue; };
  return { ctx, handlers, syncHandlers, call, callSync, sent, store, session };
}

suite('ipc · preload whitelist and handlers agree', () => {
  const { handlers } = rig();
  test('every whitelisted channel has a handler', () => {
    expect(setFrom('INVOKE').filter((ch) => !handlers.has(ch))).toEqual([]);
  });
  test('synchronous channels match their handlers both ways', () => {
    const { syncHandlers } = rig();
    expect(setFrom('SYNC').filter((ch) => !syncHandlers.has(ch))).toEqual([]);
    expect([...syncHandlers.keys()].filter((ch) => !setFrom('SYNC').includes(ch))).toEqual([]);
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

suite('ipc · notes and PDF attachments', () => {
  const fs2 = require('fs');
  const mkPdf = (r, name) => { const f = path.join(r.ctx.DATA_DIR, name); fs2.writeFileSync(f, '%PDF-1.4\n%%EOF\n'); return f; };
  test('a note starts auto-direction with no attachments; direction is validated on save', async () => {
    const r = rig();
    const n = await r.call('notes:add');
    expect(n.dir).toBe('auto');
    expect(n.attachments).toEqual([]);
    await r.call('notes:save', { id: n.id, dir: 'rtl' });
    expect(r.store.data.notes[0].dir).toBe('rtl');
    await r.call('notes:save', { id: n.id, dir: 'sideways' });
    expect(r.store.data.notes[0].dir).toBe('auto');
  });
  test('attach by dialog and by path; open uses only ids; remove deletes the file', async () => {
    const r = rig();
    const n = await r.call('notes:add');
    r.ctx.dialog = { showOpenDialog: async () => ({ canceled: false, filePaths: [mkPdf(r, 'one.pdf')] }) };
    expect((await r.call('notes:attach', { id: n.id })).added).toBe(1);
    const viaPath = await r.call('notes:attachPaths', { id: n.id, paths: [mkPdf(r, 'two.pdf'), '/etc/passwd', 42] });
    expect(viaPath.added).toBe(1);
    const atts = r.store.data.notes[0].attachments;
    expect(atts.length).toBe(2);
    const opened = [];
    r.ctx.shell.openPath = async (f) => { opened.push(f); return ''; };
    expect((await r.call('notes:openAttachment', { id: n.id, att: atts[0].id })).ok).toBe(true);
    expect(opened[0].startsWith(path.join(r.ctx.DATA_DIR, 'attachments', n.id))).toBe(true);
    expect((await r.call('notes:openAttachment', { id: n.id, att: '../../etc/passwd' })).ok).toBe(false);
    expect(opened.length).toBe(1);
    const file = opened[0];
    expect(await r.call('notes:removeAttachment', { id: n.id, att: atts[0].id })).toBe(true);
    expect(fs2.existsSync(file)).toBe(false);
    expect(r.store.data.notes[0].attachments.length).toBe(1);
  });
  test('cancelling the dialog attaches nothing; a missing note is refused', async () => {
    const r = rig();
    const n = await r.call('notes:add');
    r.ctx.dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
    expect((await r.call('notes:attach', { id: n.id })).added).toBe(0);
    expect((await r.call('notes:attachPaths', { id: 'nope', paths: [mkPdf(r, 'x.pdf')] })).ok).toBe(false);
  });
  test('saving on window close writes data.json to disk at once, not after the usual delay', async () => {
    const r = rig();
    const n = await r.call('notes:add');
    r.store.saveNow();
    expect(r.callSync('notes:saveNow', { id: n.id, title: 'T', body: 'typed right before closing' })).toBe(true);
    const onDisk = JSON.parse(fs2.readFileSync(path.join(r.ctx.DATA_DIR, 'data.json'), 'utf8'));
    expect(onDisk.notes.find((x) => x.id === n.id).body).toBe('typed right before closing');
  });
  test('reset deletes every attached PDF; import keeps only the PDFs of notes it brings back', async () => {
    const r = rig();
    const a = await r.call('notes:add');
    const b = await r.call('notes:add');
    await r.call('notes:attachPaths', { id: a.id, paths: [mkPdf(r, 'keep.pdf')] });
    await r.call('notes:attachPaths', { id: b.id, paths: [mkPdf(r, 'drop.pdf')] });
    const root = path.join(r.ctx.DATA_DIR, 'attachments');
    // import an export that only contains note a
    const exported = JSON.parse(JSON.stringify(r.store.data));
    exported.notes = exported.notes.filter((x) => x.id === a.id);
    expect(await r.call('data:import', { json: JSON.stringify(exported) })).toBe(true);
    expect(fs2.existsSync(path.join(root, a.id))).toBe(true);
    expect(fs2.existsSync(path.join(root, b.id))).toBe(false);
    expect(await r.call('data:reset')).toBe(true);
    expect(fs2.readdirSync(root)).toEqual([]);
  });
  test('deleting a note deletes its PDFs from disk', async () => {
    const r = rig();
    const n = await r.call('notes:add');
    await r.call('notes:attachPaths', { id: n.id, paths: [mkPdf(r, 'gone.pdf')] });
    const dir = path.join(r.ctx.DATA_DIR, 'attachments', n.id);
    expect(fs2.existsSync(dir)).toBe(true);
    await r.call('notes:remove', { id: n.id });
    expect(fs2.existsSync(dir)).toBe(false);
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
