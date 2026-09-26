/* ============================================================
   StudyNook · preload.js — the ONLY bridge between the UI and
   the engine. Exposes a tiny, whitelisted API as `window.nook`.
   (contextIsolation: on, nodeIntegration: off → safe)
   ============================================================ */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Commands the UI may send → main process
const INVOKE = new Set([
  'get-snapshot',
  'session:start', 'session:pause', 'session:resume', 'session:skip', 'session:stop',
  'settings:set', 'profile:set', 'pet:rename', 'pet:pet',
  'tasks:add', 'tasks:toggle', 'tasks:remove', 'tasks:addSource', 'tasks:removeSource', 'open:url',
  'schedule:add', 'schedule:update', 'schedule:remove', 'schedule:toggle',
  'subjects:set', 'notes:add', 'notes:save', 'notes:remove',
  'data:backupNow', 'data:openBackups', 'data:openSounds', 'sound:get',
  'apps:add', 'apps:remove', 'apps:toggle', 'apps:addCatalog', 'apps:scan',
  'apps:previewAllow', 'apps:killNow',
  'sites:set', 'guardian:pause',
  'data:export', 'data:import', 'data:reset', 'data:openFolder', 'help:readme',
  'ambient:minute', 'onboarding:done', 'iron:passed',
  'win:min', 'win:close', 'win:show-main',
  'reminder:allowOnce', 'reminder:killNow', 'reminder:dismiss'
]);

// Events the UI may listen to ← main process
const ON = new Set([
  'snapshot', 'tick', 'session-event', 'reward', 'guard', 'reminder', 'ext-status', 'iron-gate',
  'close-blocked', 'data-blocked'
]);

contextBridge.exposeInMainWorld('nook', {
  invoke: (channel, payload) => {
    if (!INVOKE.has(channel)) return Promise.reject(new Error('Blocked channel: ' + channel));
    return ipcRenderer.invoke(channel, payload);
  },
  on: (channel, cb) => {
    if (!ON.has(channel)) return () => {};
    const listener = (_e, data) => cb(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
