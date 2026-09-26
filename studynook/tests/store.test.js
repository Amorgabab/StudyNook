'use strict';
const { sanitizeData, defaultData, deepMerge } = require('../app/main/store.js');

suite('store · defensive sanitization (load & import)', () => {
  test('garbage types coerce to safe defaults', () => {
    const d = sanitizeData({
      xp: 'lots', level: -5,
      settings: { timer: { workMin: 'abc', shortMin: 99999, rounds: 0 }, guardian: { action: 'yeet', scanSec: -3 }, sound: { volume: 7 }, theme: 'neon' },
      pet: { name: 42, totalFocusMin: 'x', stage: 99 },
      streak: { current: 'nope', lastFocusDay: 7 },
      counters: { kills: '∞' }
    });
    expect(d.xp).toBe(0);
    expect(d.level).toBe(1);
    expect(d.settings.timer.workMin).toBe(25);
    expect(d.settings.timer.shortMin).toBe(120);          // clamped
    expect(d.settings.timer.rounds).toBe(1);              // clamped up
    expect(d.settings.guardian.action).toBe('gentle');
    expect(d.settings.guardian.scanSec).toBe(1);
    expect(d.settings.sound.volume).toBe(1);
    expect(d.settings.theme).toBe('auto');
    expect(d.pet.name).toBe('Mochi');
    expect(d.pet.stage).toBe(5);                          // clamped to max stage
    expect(d.streak.current).toBe(0);
    expect(d.streak.lastFocusDay).toBe(null);
    expect(d.counters.kills).toBe(0);
  });

  test('hostile task/note/source shapes are filtered, valid kept', () => {
    const d = sanitizeData({
      tasks: [
        null, 7, 'junk',
        { id: 't1', text: 'real task', sources: [{ url: 'https://x.y/z' }, { url: 5 }, null, 'nope'] }
      ],
      notes: [{ id: 'n1', title: 'ok', body: 9 }, 'junk'],
      subjects: ['Math', 3, null, 'Science']
    });
    expect(d.tasks.length).toBe(1);
    expect(d.tasks[0].text).toBe('real task');
    expect(d.tasks[0].sources.length).toBe(1);
    expect(d.tasks[0].sources[0].url).toBe('https://x.y/z');
    expect(d.notes.length).toBe(1);
    expect(d.notes[0].body).toBe('');
    expect(d.subjects).toEqual(['Math', 'Science']);
  });

  test('unknown fields are PRESERVED (no silent destruction)', () => {
    const d = sanitizeData(Object.assign(defaultData(), { futureField: { a: 1 }, tasks: [{ id: 't9', text: 'x', custom: 'keep-me' }] }));
    expect(d.futureField.a).toBe(1);
    expect(d.tasks[0].custom).toBe('keep-me');
  });

  test('import-shaped corruption survives a full load cycle', () => {
    const corrupted = JSON.parse(JSON.stringify(deepMerge(defaultData(), { settings: { timer: { workMin: null } }, sites: { block: 'not-an-array' }, apps: null })));
    const d = sanitizeData(corrupted);
    expect(d.settings.timer.workMin).toBe(25);
    expect(Array.isArray(d.sites.block)).toBeTruthy();
    expect(Array.isArray(d.apps.block)).toBeTruthy();
  });

  test('oversized strings are capped, not crashed on', () => {
    const d = sanitizeData({ tasks: [{ id: 't1', text: 'x'.repeat(5000) }], sites: { block: ['y'.repeat(900)] } });
    expect(d.tasks[0].text.length).toBe(200);
    expect(d.sites.block[0].length).toBe(200);
  });
});
