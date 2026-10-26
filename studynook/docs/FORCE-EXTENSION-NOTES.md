# Force-extension & auto-recovery notes

Branch: `force-extension-version` (standalone; no PR).

## 1. Extension detection and "force load" — `app/main/extfinder.js`

Chrome-family browsers do not allow another program to silently install an
extension; installing needs the user's click in the browser or an admin-managed
policy. StudyNook does **not** edit policies, the registry, or browser profile
files. What it does instead:

| Step | What happens |
|---|---|
| Validate | Checks the shipped `extension/` folder is complete (7 required files, non-empty, valid Manifest V3). A truncated/corrupt folder is reported as `folder-corrupt`. |
| Detect | Reads each Chrome / Edge / Brave / Chromium profile's `Secure Preferences` and `Preferences` (extensions section only) and reports `enabled`, `disabled`, `partial` (registered but state missing), `not-installed`, `unreadable` (file corrupt or mid-write), `no-browser`. If one settings file is corrupt the other is still tried. Best result across profiles wins. |
| Launch | Starts an installed browser detached with `--load-extension=<folder>` and `chrome://extensions`. The flag only takes effect for a freshly started browser process and some newer branded Chrome builds ignore it; the opened page is the fallback ("Load unpacked"). |

UI: Sites tab → "Check extension" and "Open browser with extension" buttons
(IPC `ext:detect`, `ext:forceLoad`; the folder path always comes from the app,
never the renderer). The mid-focus "website blocker is off" warning now also
says which of the states above the browser is in.

Not implemented on purpose: forcing installation through the
`ExtensionInstallForcelist` policy (needs admin rights and a hosted package,
and is the mechanism malware uses).

### Removing / disabling the extension

Chrome never lets an app stop its user removing or disabling an extension, so
the app can only react:

* Any focus: once the extension has been silent for 45 s, a toast, a desktop
  notification and a feed entry say so (and what state the browser reports).
* **Iron focus only:** the app remembers which browser the extension lives in
  (`ext.browser`, from the User-Agent its requests carry: Chrome or Edge). If the
  extension stays silent and that browser has been open for 90 s, the app closes
  it (via the guardian's normal kill path) and logs `iron-closed-browser`. Reopening
  the browser starts a fresh 90 s repair window, long enough to re-enable the
  extension at `chrome://extensions`. Not applied outside Iron, when site blocking
  is off, when the extension was never paired, or when it has been gone > 2 weeks.
* Brave/Chromium are reported as "chrome" by their User-Agent, so for them the
  app may close `chrome.exe` rather than their own process.

## 2. Auto-recovery — `app/main/watchdog.js`, `app/main/lifecycle.js`

* While a session exists, `main.js` keeps one background **watchdog** running
  (the app's own runtime in node mode, so nothing extra to install). It starts
  in two hops so it is an orphan, not a child of the app, and an "End task" on
  the app's process tree does not take it along.
* Every 2 s: app alive + session → keep watching; app alive + no session →
  retire after ~6 s; app gone + no session → normal quit, exit; app gone +
  session active → relaunch (`--restarted-by-watchdog`) and watch the new PID.
* The relaunched app resumes the session from `data/session.json` (existing
  `recoverInterruptedSession`). Ending a session properly deletes that file,
  which is the "don't restart me" signal.
* Crash-loop guard: max 5 relaunches / 10 min (history in
  `data/watchdog-history.json`), then it gives up and logs why.
* `session.json` older than 12 h is never resurrected (same rule as the app).
* Everything is appended to `data/lifecycle.log` (rotates at 256 KB): `boot`,
  `session-restored`, `before-quit`, `window-all-closed`, `uncaughtException`,
  `render-process-gone`, `watchdog-started`, and the watchdog's own
  relaunch/give-up lines.

Limits: this is a speed bump, not a lock. Killing every `StudyNook.exe` at once
(Details tab, `taskkill /IM`) also kills the watchdog. A reused PID right after
a crash can delay a restart by a poll or two.

## 3. Cleanup (documented removals)

Only code proven unused by a repo-wide search was removed:

* `main.js`: unused `globalShortcut` import.
* `main.js`: dead `earned` variable (`const earned = …; void earned;`) in the
  guardian kill handler — the call is kept for its side effects.
* `main.js`: unused `listed` field pushed into `apps:scan` rows (the rows are
  re-mapped with their own `listed` flag afterwards).

A scan for single-reference functions and unused `require`s across `app/` and
`extension/` found nothing else. Dependencies in `package.json` are all used by
the build or runtime (`electron`, `electron-builder`) and were left alone.
`chat-export-1790442272545.json` at the repo root looks like a stray dev
artefact; it was not touched.
