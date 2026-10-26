# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

The Electron app lives in `studynook/`; the repo root only holds the README, LICENSE and `.gitignore`. Run all npm commands from `studynook/`.

## Commands (run from `studynook/`)

- `npm install` — install dependencies (Electron 31, electron-builder 24).
- `npm start` — launch the desktop app (`electron .`). Dev mode keeps data in `studynook/data/`.
- `npm test` — unit tests: `node tests/run.js`. There is no built-in filter; `run.js` requires every `tests/*.test.js` and exits explicitly when done. To run one file, write a one-off runner that defines `global.test`, `global.suite` and `global.expect` (as `run.js` does) and requires just that file.
- `npm run smoke` — `node tests/smoke.js`. Boots store, session, guardian and the sync server in plain Node (no Electron) and talks to `127.0.0.1:47470` like the extension does. It does not detect a busy port: if another StudyNook (for example the installed app) holds 47470, its checks hit that app and fail confusingly. Close other copies first.
- `npm run dist` — build the Windows NSIS installer into `dist-installer/`. `Make-Installer.bat` wraps `npm install` + `npm run dist` for end users.
- `NOOK_SMOKE=1` makes the real Electron app quit after 6 s and write `data/smoke.log` (renderer console messages are logged there too).
- `node tools/build-icons.js <lucide icon-nodes.json>` regenerates the bundled icon set (see below).

There is no linter configured.

## Architecture (big picture)

Three runtimes cooperate, and most features span more than one of them:

1. **Electron main process** (`app/main/`). `main.js` is the entry point and wires everything together: `store.js` (single JSON file `data.json`, atomic writes, `sanitizeData` on load/import), `session.js` (focus timer engine, persists `session.json` every few seconds), `guardian.js` (scans processes every `scanSec` and warns/kills distractions; decisions are in pure `planner.js`, process listing in `processes.js`), `sync-server.js` (localhost HTTP bridge on 127.0.0.1:47470 for the Chrome extension, token-protected), `watchdog.js` (detached helper that relaunches the app if it dies mid-session), `extfinder.js` (read-only check of whether the extension is installed/enabled in Chrome-family profiles), `lifecycle.js` (`data/lifecycle.log`), and the windows and tray.
2. **Renderer** (`app/ui/`). Plain HTML/CSS/JS, no bundler. `index.html` is the main window; `mini.html` is the floating timer; `reminder.html` is the app-warning card. `app/ui/js/views-*.js` hold the pages; `app/ui/help/help-<lang>.js` hold the Help articles. The renderer talks to main only through `window.nook`, exposed by `app/main/preload.js` (contextIsolation on, nodeIntegration off).
3. **Chrome extension** (`extension/`, Manifest V3). `background.js` polls the desktop app's bridge and builds declarativeNetRequest redirect rules from `rules.js`. When the desktop app is not running it falls back to its own "standalone" lists and timer, and keeps blocking until a focus the app last reported would have ended. The popup and blocked page use `ui.css`, `icons.js` and their own small `i18n.js`.

`app/shared/` holds pure modules loaded by main **and** the UI windows (UMD style): `progress.js`, `iron.js`, `taskdays.js`, `links.js`, `catalog.js`, `extwatch.js`, `uiprefs.js` (theme/language resolution), `i18n.js` + `lang/{en,ar,fr,es}.js`, and the generated `icons.js`. `extension/rules.js` is shared the same way: `main.js` requires it and the extension loads it via `importScripts`. Tests live in `tests/` and cover these pure modules plus the main-process logic directly.

### Cross-cutting rules that are easy to break

- **Adding an IPC channel** means three edits: a handler in `registerIpc()` in `main.js`, the name in the `INVOKE` set in `preload.js` (and in `ON` for main→renderer events), and the call in the renderer. A channel missing from the whitelist fails silently in the UI.
- **Settings writes are validated in two places.** `settings:set` clamps or enum-checks every field (raw-value sections are listed in `RAW_SECTIONS`); `sites:set` checks enums and booleans and normalizes/dedupes lists; `sanitizeData` does the same at load and import. A new setting needs handling in both paths and a default in `defaultData()`.
- **All user-facing text goes through i18n.** Use `t('key')` in windows and `T('key')` in `main.js`; add the key to `lang/en.js` **and** `ar/fr/es`. `tests/ui-redesign.test.js` fails on missing keys, mismatched `{placeholders}` or unknown literal keys. Arabic is RTL, so CSS must use logical properties (`margin-inline-start`, `inset-inline-end`), never left/right.
- **Theme is resolved in one place.** `NookPrefs.resolveTheme(setting, systemDark, hour)` decides light/dark for every window; colours come only from the CSS tokens in `styles.css` (`:root` and `:root[data-theme="dark"]`). Don't reintroduce time-of-day backgrounds.
- **Icons are generated.** `app/shared/icons.js` and `extension/icons.js` are written by `tools/build-icons.js` and must stay identical; add a Lucide name to that script's list and re-run it. No emoji in UI source (a test checks).
- **Iron Session is the authority for locks.** `app/shared/iron.js` decides what is frozen (timer strictness, site blocking, app-list edits, the multi-day self-lock). Any write that could soften a rule during an Iron focus must go through the `Iron.*` helpers, which `main.js`, `store.js`, `session.js`, `guardian.js` and the UI share (`sync-server.js` does not use them; `store.enforceIron()` re-applies the rules on every write, including bridge writes).
- **Session recovery.** On boot `recoverInterruptedSession()` restores a persisted running session instead of discarding it, and `ensureWatchdog()` keeps the relaunch helper alive during sessions. Changes to the session state shape must keep `session.restore()` and `SessionEngine.recoverable()` in step; ending a session deletes `session.json`, which is the watchdog's "don't restart" signal.
- **Window close is gated.** `main.js` blocks closing the main window while any session exists (running or paused), and during an Iron focus it routes through a typed gate first.
- **Localhost bridge security.** `sync-server.js` validates the Host header on every request (DNS-rebinding guard), requires the token for everything but `/ping` and `/pair`, and throttles pairing. Do not loosen these checks.

## Conventions and gotchas

- Data files are plain JSON in `studynook/data/` in dev, or `%APPDATA%`'s userData folder when packaged. Don't change the `data.json` shape without updating `defaultData()` and `sanitizeData()` in `store.js`.
- Design rules (tokens, spacing scale, typography, icon mapping, settings table) live in `docs/UI-REDESIGN-SPEC.md`; watchdog/extension-finder notes in `docs/FORCE-EXTENSION-NOTES.md`; the earlier security pass in `docs/HARDENING-REPORT.md`.
- The app (`studynook/package.json`) and the extension (`extension/manifest.json`) have separate version numbers. When the extension changes, bump `extension/manifest.json` and `extension/version.json` together: the extension popup compares them to detect a stale worker and offers a reload.
- Use the `NOOK_SMOKE` hook and `tests/smoke.js` only for end-to-end checks; unit tests should stay Electron-free.
