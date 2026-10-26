# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

The Electron app lives in `studynook/`; the repo root only holds the README, LICENSE and `.gitignore`. Run all npm commands from `studynook/`.

## Commands (run from `studynook/`)

- `npm install` — install dependencies (Electron 31, electron-builder 24).
- `npm start` — launch the desktop app (`electron .`). Dev mode keeps data in `studynook/data/`.
- `npm test` — unit tests: `node tests/run.js`. There is no built-in filter; `run.js` requires every `tests/*.test.js`. To run one file, temporarily comment out the others or write a one-off runner that requires just that file after defining `global.test`, `global.suite` and `global.expect` (the same way `run.js` does).
- `npm run smoke` — `node tests/smoke.js`. Boots store, session, guardian and the sync server in plain Node (no Electron) and talks to `127.0.0.1:47470` like the extension does, so it fails if that port is already in use. Run it after changing `sync-server.js`.
- `npm run dist` — build the Windows NSIS installer into `dist-installer/`. `Make-Installer.bat` wraps `npm install` + `npm run dist` for end users.
- Setting `NOOK_SMOKE=1` makes the real app quit after 6 s and write `data/smoke.log`.

There is no linter configured.

## Architecture (big picture)

Three runtimes cooperate, and most features span more than one of them:

1. **Electron main process** (`app/main/`). `main.js` is the entry point and wires everything together: `store.js` (single JSON file `data.json`, atomic writes, `sanitizeData` on load/import), `session.js` (focus timer engine, persists `session.json` every few seconds), `guardian.js` (scans processes every `scanSec` and warns/kills distractions; decisions are in pure `planner.js`, process listing in `processes.js`), `sync-server.js` (localhost HTTP bridge on 127.0.0.1:47470 for the Chrome extension, token-protected), and the windows and tray.
2. **Renderer** (`app/ui/`). Plain HTML/CSS/JS, no bundler. `index.html` is the main window; `mini.html` is the floating timer; `reminder.html` is the app-warning card. `app/ui/js/views-*.js` hold the views. The renderer talks to main only through `window.nook`, exposed by `app/main/preload.js` (contextIsolation on, nodeIntegration off).
3. **Chrome extension** (`extension/`, Manifest V3). `background.js` polls the desktop app's bridge and builds declarativeNetRequest redirect rules from `rules.js`. When the desktop app is not running it falls back to its own "standalone" lists and mini timer.

`app/shared/` holds pure modules used by main and by the UI (`progress.js` for XP/levels/achievements, `iron.js`, `taskdays.js`, `links.js`, `catalog.js`). `extension/rules.js` is shared the same way: `main.js` requires it, and the extension loads it via `importScripts`. Tests live in `tests/` and cover these pure modules plus the main-process logic directly.

### Cross-cutting rules that are easy to break

- **Adding an IPC channel** means three edits: a handler in `registerIpc()` in `main.js`, the name in the `INVOKE` set in `preload.js` (and in `ON` for main→renderer events), and the call in the renderer. A channel missing from the whitelist fails silently in the UI.
- **Settings writes are sanitized in two places.** `settings:set` and `sites:set` clamp values by hand (`num()`, enum checks), and `sanitizeData` does the same at load and import. A new setting needs a clamp in both paths.
- **Iron Session is the authority for locks.** `app/shared/iron.js` decides what is frozen (timer strictness, site blocking, list edits, the multi-day self-lock). Any write that could soften a rule during an iron focus must go through the `Iron.*` helpers, which the main process, the UI and the bridge all share. `store.enforceIron()` re-applies the rules on every write.
- **Session recovery.** On boot `recoverInterruptedSession()` restores a persisted running session instead of discarding it. Changes to the session state shape must keep `session.restore()` and `SessionEngine.recoverable()` in step.
- **Window close is gated.** `main.js` blocks closing the main window while any session exists (running or paused), and during an iron focus it routes through a typed gate first.
- **Localhost bridge security.** `sync-server.js` validates the Host header on every request (DNS-rebinding guard), requires the token for everything but `/ping` and `/pair`, and throttles pairing. Do not loosen these checks.

## Conventions and gotchas

- Data files are plain JSON in `studynook/data/` in dev, or `%APPDATA%`'s userData folder when packaged. Don't change the `data.json` shape without updating `defaultData()` and `sanitizeData()` in `store.js`.
- `docs/HARDENING-REPORT.md` records the last security/reliability pass, including the test counts (111 unit, 17 smoke). Keep test counts in mind when adding tests.
- The app (`studynook/package.json`) and the extension (`extension/manifest.json`) have separate version numbers. When the extension changes, bump `extension/manifest.json` and `extension/version.json` together: the extension uses `version.json` to detect a stale worker.
- Use the `NOOK_SMOKE` hook and `tests/smoke.js` only for end-to-end checks; unit tests should stay Electron-free.
