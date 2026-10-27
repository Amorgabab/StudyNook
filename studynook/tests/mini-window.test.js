'use strict';
/* The mini timer: it must stay reachable on screen, and its pill must be clickable. */
const fs = require('fs');
const path = require('path');
const { clampToArea } = require('../app/main/bounds.js');

const area = { x: 0, y: 0, width: 1920, height: 1040 };
const box = (x, y) => ({ x, y, width: 250, height: 74 });

suite('mini window · stays on screen', () => {
  test('a window already inside the work area is left alone', () => {
    expect(clampToArea(box(100, 200), area)).toEqual(box(100, 200));
  });
  test('dragged past any edge, it is pulled back inside', () => {
    expect(clampToArea(box(-300, 200), area)).toEqual(box(0, 200));
    expect(clampToArea(box(1900, 200), area)).toEqual(box(1670, 200));
    expect(clampToArea(box(100, -50), area)).toEqual(box(100, 0));
    expect(clampToArea(box(100, 1030), area)).toEqual(box(100, 966));
  });
  test('works on a second monitor with an offset origin', () => {
    const second = { x: 1920, y: 0, width: 1280, height: 720 };
    expect(clampToArea(box(1000, 100), second)).toEqual(box(1920, 100));
    expect(clampToArea(box(3200, 700), second)).toEqual(box(2950, 646));
  });
});

suite('mini window · pill', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'app', 'ui', 'mini.html'), 'utf8');
  const BODY = /\s*\{([^}]*)\}/.source;
  const rule = (sel) => (new RegExp(sel + BODY).exec(html) || [])[1] || '';
  test('the pill is not a drag region (Electron swallows clicks there), the icon is the handle', () => {
    expect(/app-region\s*:\s*drag/.test(rule('#pill'))).toBe(false);
    expect(/app-region\s*:\s*drag/.test(rule('#stage'))).toBe(true);
  });
  test('its shadow fits inside the window margin, so no square is clipped around it', () => {
    const inset = Number(/inset:\s*(\d+)px/.exec(rule('#pill'))[1]);
    const m = /box-shadow:\s*0\s+(\d+)px\s+(\d+)px/.exec(rule('#pill'));
    expect(Number(m[1]) + Number(m[2]) <= inset).toBe(true);
  });
});
