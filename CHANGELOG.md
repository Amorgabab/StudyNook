# Changelog

All notable changes to StudyNook. Versions follow the installer (`StudyNook-Setup-x.y.z.exe`)
published on the [Releases](https://github.com/Amorgabab/StudyNook/releases) page. The browser
extension has its own version number (see `studynook/extension/manifest.json`).

The commit history before 1.5.1 is rough (bulk uploads and auto-generated titles). This file is
the readable version of it.

## 1.5.3

- Build tooling: electron-builder 24 → 26.18. This clears all `npm audit` findings (they
  affected the build machine, not the installed app). No change to how the app behaves.
- Added `THIRD-PARTY-NOTICES.md` (Electron, Lucide, Inter) and ship it with the installer.
- Added issue and pull request templates and this changelog.

## 1.5.2

- Electron 31 → 45 (security updates and a current Chromium).
- The Apps page banner now says "Iron lock is active" instead of "Iron focus is running",
  because the lock outlasts the session.

## 1.5.1

- Closing the window now quits StudyNook when nothing needs to keep running, so it no longer
  lingers in Task Manager. It still hides to the tray while a session runs, while the guard or
  website blocking is set to run "Always", or when Settings → General → "Keep running in the
  tray" is on.
- The Task box and the app name/process boxes now clear after you add something. They kept
  their text since the 1.5.0 draft-preservation change.

## 1.5.0

- **New interface** in English, Arabic (right to left), French and Spanish, with light, dark,
  auto and system themes, a Settings page with eight sections, in-app Help with search, and a
  welcome tour.
- **Student resilience:** a watchdog relaunches StudyNook if it is killed during a session,
  sessions are recovered after a crash or restart, and Iron sessions can only end early after
  a 60-second wait and typing a sentence.
- **Extension handling:** finds the Chrome extension automatically, warns when it goes
  missing during a session, and (for Iron sessions) can close the browser.
- **Faster and leaner:** `main.js` split into modules, fewer process scans while idle, the
  extension rewrites blocking rules only when they change, and the mini timer is updated by
  push instead of polling.
- ESLint, a Windows CI workflow, a contributor guide (`CLAUDE.md`) and a new README with a
  GitHub Pages site.
- New personal-use license: download and use for yourself, no redistribution.

## First release

- Focus timer (Pomodoro and free focus), tasks, notes, app blocking, website blocking through
  a companion Chrome extension, progress, achievements and a study companion.
