/* ============================================================
   StudyNook · snapshot.js — what each window is allowed to see
   ------------------------------------------------------------
   The main window needs everything (tasks, notes, history…): full().
   The floating timer and the warning card draw a handful of fields,
   so they get a ~1 KB state instead of the whole data set — it used
   to be re-sent in full to every window on every change, and the
   mini timer re-requested it every second.
   ============================================================ */
'use strict';

const PKG_VERSION = require('../../package.json').version;

function createSnapshots(ctx) {
  const { app, nativeTheme, store, session, guardian, server, EXT_DIR, SOUNDS_DIR } = ctx;
  const look = () => ({ theme: store.data.settings.theme, language: store.data.settings.language });

  function full() {
    const d = store.data;
    return {
      now: Date.now(),
      platform: process.platform,
      appVersion: PKG_VERSION,
      packaged: app.isPackaged,
      systemDark: nativeTheme.shouldUseDarkColors,
      data: {
        v: d.v, profile: d.profile, pet: d.pet, xp: d.xp, level: d.level,
        streak: d.streak, settings: d.settings, apps: d.apps, sites: d.sites,
        subjects: d.subjects, notes: d.notes,
        tasks: d.tasks, sessions: d.sessions.slice(0, 60), daily: d.daily,
        counters: d.counters, achievements: d.achievements, onboarded: d.onboarded,
        feed: d.feed || []
      },
      session: session.publicState(),
      guardian: { armed: guardian.isArmed(), pausedMinLeft: guardian.pausedMinLeft() },
      ext: { connected: ctx.extConnected, lastSeen: d.ext.lastSeen, version: d.ext.version, code: d.ext.code, bridgeError: server.error || null },
      extPath: EXT_DIR,
      soundsPath: SOUNDS_DIR,
      pendingReminder: guardian.pendingReminder
    };
  }

  /** Floating timer: session state, companion stage, theme + language. */
  function mini() {
    return {
      systemDark: nativeTheme.shouldUseDarkColors,
      data: { settings: look(), pet: { stage: store.data.pet.stage } },
      session: session.publicState()
    };
  }

  /** Warning card: the pending reminder, theme + language. */
  function reminder() {
    return {
      systemDark: nativeTheme.shouldUseDarkColors,
      data: { settings: look() },
      pendingReminder: guardian.pendingReminder
    };
  }

  return { full, mini, reminder };
}

module.exports = { createSnapshots };
