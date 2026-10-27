'use strict';
/* Keeps a window rectangle inside a display's work area (the mini timer must never be
   dragged where it cannot be reached). Pure, so it is unit-tested without Electron. */
function clampToArea(b, area) {
  const w = Math.min(b.width, area.width), h = Math.min(b.height, area.height);
  const x = Math.min(Math.max(b.x, area.x), area.x + area.width - w);
  const y = Math.min(Math.max(b.y, area.y), area.y + area.height - h);
  return { x, y, width: b.width, height: b.height };
}
module.exports = { clampToArea };
