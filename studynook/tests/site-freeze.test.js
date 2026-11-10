'use strict';
/* Iron freezes the WEBSITE lists too: a blocked site (tiktok.com) can be added but not removed, and the
   allowed list cannot change, from the app window and from the extension's popup. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const Iron = require('../app/shared/iron.js');
const { SyncServer } = require('../app/main/sync-server.js');
const I18n = require('../app/shared/i18n.js');

suite('iron · website lists are frozen', () => {
  const cur = { block: ['tiktok.com', 'youtube.com'], allow: ['wikipedia.org'] };
  test('a blocked site cannot be removed', () => {
    const r = Iron.freezeSites(cur, { block: ['youtube.com'], allow: ['wikipedia.org'] });
    expect(r.block).toEqual(['tiktok.com', 'youtube.com']);
  });
  test('new sites can still be added to the blocked list', () => {
    const r = Iron.freezeSites(cur, { block: ['tiktok.com', 'youtube.com', 'instagram.com'], allow: ['wikipedia.org'] });
    expect(r.block).toEqual(['tiktok.com', 'youtube.com', 'instagram.com']);
  });
  test('the allowed list cannot change: nothing added, nothing removed', () => {
    expect(Iron.freezeSites(cur, { block: cur.block, allow: ['wikipedia.org', 'tiktok.com'] }).allow).toEqual(['wikipedia.org']);
    expect(Iron.freezeSites(cur, { block: cur.block, allow: [] }).allow).toEqual(['wikipedia.org']);
  });
  test('wiping both lists changes nothing', () => {
    const r = Iron.freezeSites(cur, { block: [], allow: [] });
    expect(r.block).toEqual(['tiktok.com', 'youtube.com']);
    expect(r.allow).toEqual(['wikipedia.org']);
  });
  test('other fields (mode, enabled) pass through untouched', () => {
    const r = Iron.freezeSites(cur, { block: [], allow: [], mode: 'allow', enabled: true });
    expect(r.mode).toBe('allow');
    expect(r.enabled).toBe(true);
  });
  test('during a focus round blocking cannot be switched off and the mode cannot be flipped', () => {
    const c = Object.assign({ enabled: true, mode: 'block' }, cur);
    const r = Iron.freezeSites(c, { block: [], allow: [], enabled: false, mode: 'allow' }, true);
    expect(r.enabled).toBe(true);
    expect(r.mode).toBe('block');
  });
  test('missing or odd input does not throw', () => {
    expect(Iron.freezeSites(undefined, undefined).block).toEqual([]);
    expect(Iron.freezeSites({ block: 'x' }, { block: null }).allow).toEqual([]);
  });
});

suite('sync server · extension edits respect the Iron freeze', () => {
  const mk = (focus) => new SyncServer({ store: { data: {} }, session: { isIronFocus: () => focus } });
  test('frozen during an Iron focus', () => {
    expect(mk(true)._listsFrozen({ settings: { timer: {} } })).toBe(true);
  });
  test('frozen while the multi-day self-lock runs, even with no session', () => {
    expect(mk(false)._listsFrozen({ settings: { timer: { ironLockedUntil: Date.now() + 3600 * 1000 } } })).toBe(true);
  });
  test('frozen during any focus round, Iron or not', () => {
    const s = new SyncServer({ store: { data: {} }, session: { isFocusPhase: () => true, isIronFocus: () => false } });
    expect(s._listsFrozen({ settings: { timer: {} } })).toBe(true);
  });
  test('not frozen outside Iron', () => {
    expect(mk(false)._listsFrozen({ settings: { timer: {} } })).toBe(false);
    expect(mk(false)._listsFrozen({ settings: { timer: { ironLockedUntil: Date.now() - 1000 } } })).toBe(false);
  });
  test('a missing session never throws', () => {
    expect(new SyncServer({ store: { data: {} }, session: {} })._listsFrozen({})).toBe(false);
  });
});

suite('iron · every way to edit the website lists is guarded', () => {
  test('the app window and the extension bridge both apply freezeSites', () => {
    expect(/listsFrozenNow\(\)\) Object\.assign\(d\.sites, Iron\.freezeSites\(before, d\.sites, /.test(read('app/main/ipc.js'))).toBe(true);
    expect(/_listsFrozen\(d\)\) Object\.assign\(d\.sites, Iron\.freezeSites\(before, d\.sites, /.test(read('app/main/sync-server.js'))).toBe(true);
  });
  test('the Websites page hides remove buttons and disables adding to the allowed list while frozen', () => {
    const v = read('app/ui/js/views-manage.js');
    expect(/const frozen = App\.listsFrozen\(\)/.test(v)).toBe(true);
    expect(/frozen \? null : N\.el\('button'/.test(v)).toBe(true);
    expect(/canAdd = !\(frozen && key === 'allow'\)/.test(v)).toBe(true);
  });
  test('the frozen notice exists in every language', () => {
    for (const l of ['en', 'ar', 'fr', 'es']) {
      expect(!!I18n.DICTS[l]['sites.frozen'] && !!I18n.DICTS[l]['sites.frozen.short']).toBe(true);
    }
  });
});
