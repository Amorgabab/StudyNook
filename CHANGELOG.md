# Changelog

All notable changes to StudyNook. Versions follow the installer (`StudyNook-Setup-x.y.z.exe`)
published on the [Releases](https://github.com/Amorgabab/StudyNook/releases) page. The browser
extension has its own version number (see `studynook/extension/manifest.json`).

The commit history before 1.5.1 is rough (bulk uploads and auto-generated titles). This file is
the readable version of it.

## 1.5.14

- **An Iron break can no longer be paused.** Nothing is blocked during a break, so pausing one gave an
  endless, unblocked break while the Iron promise still looked like it was running. In an Iron
  session (or while the Iron lock is on) the Pause button is now disabled during a break, with a note
  explaining why, and the tray's Pause does nothing either. An Iron focus can still be paused, and
  breaks in normal sessions can still be paused and resumed.
- **Ending an Iron session from a break now needs the Iron gate.** Before, "End session" during a break
  asked only for a plain confirmation; now it needs the same cool-down and typed sentence as ending
  during a focus.

## 1.5.13

- **Iron now locks your blocked websites too.** The app lists were already locked during an Iron
  session, but you could still remove tiktok.com (or any site) from the blocked list, or add a site to
  the allowed list, from the Websites page or from the browser extension's popup. Now, while an Iron
  focus runs or the Iron lock is on, you can still add sites to the blocked list, but you cannot remove
  one or change the allowed list. The remove buttons are hidden and a notice explains why. Outside Iron
  nothing changes: you can still edit your lists freely.

## 1.5.12

- **Sleep no longer counts as focus time.** If the PC went to sleep (or hibernated) during a session,
  the timer used to carry on as if you were still studying: sleeping through a round ended it and
  credited the full minutes, XP and streak, and an Iron session could be ended that way without its
  wait and typed sentence. The timer now stops while the PC sleeps and carries on from the same
  place when it wakes. It is logged as `sleep-skipped` in `lifecycle.log`.

- **Real ambience sounds for everyone.** The rain, waves, fire and cafe ambience used to be real
  recordings only if you added the files yourself; everyone else heard a plain synthetic noise.
  The installer now includes the four recordings. Files you put in the sounds folder (Settings,
  Sound, Open sounds folder) still replace them.

## 1.5.11

- **Allowlist mode is much safer.** It used to close every running program that was not on your
  Allowed list except about 60 named Windows programs, including background helpers and tray apps
  (on one test PC that was 131 programs, among them Windows Security and driver helpers). It now
  closes only programs that have a visible window, so background and tray programs are left alone
  (on the same PC, 4 programs). If Windows cannot tell, StudyNook leaves the program open. Store
  apps that draw their window through another process may not be closed in this mode. Blocklist
  mode is unchanged. The NVIDIA overlay is added to the programs StudyNook never closes.

## 1.5.10

- **A clearer welcome tour.** Four short phases (first session, block distractions, stay motivated,
  stay in control) in ten steps. Each step dims the screen and rings the real button or page it is
  talking about (Start, Apps, Websites and the pairing code, your companion, your streak). Press
  Esc or Skip at any time; replay it from Settings, under About. The ring uses the app's accent
  colour, pulses twice, then stays still, and does not animate if your system asks for reduced motion.
- **About page:** it now says StudyNook is open source (MIT) and has a "See the latest release"
  link. StudyNook never checks for updates by itself and does not contact any server; the link opens
  GitHub in your browser only when you click it.

## 1.5.9

- **StudyNook is now open source under the MIT License.** You can use, copy, modify and share it,
  including commercially, as long as you keep the copyright notice (Copyright (c) 2026 Amorgabab)
  and the license text. The app itself did not change; the installer now carries the MIT license.

## 1.5.8

- **The mini timer now drags by the pill and opens StudyNook from the egg.** Before, you dragged
  the egg and clicked anywhere else to open. Now you drag from anywhere on the pill except the egg,
  and clicking the egg brings StudyNook back.

## 1.5.7

- **Sites no longer stay blocked after you end a session and close StudyNook right away.** The browser
  extension keeps blocking if StudyNook disappears mid-focus (so End task cannot switch blocking off).
  It could not tell that from a clean quit, so ending a session and closing the app within a few
  seconds left sites blocked until the session's original end time. StudyNook now waits (up to 8
  seconds) for the extension's next check before it exits, and only in that situation.

## 1.5.6

- **Force-closing StudyNook during a session is now relaunched every time.**
  - A kill in the first ~2 seconds after the app opened was never relaunched, because the
    relaunch helper only started on a 2-second timer. It now starts as the app boots.
  - After the helper gave up once (5 relaunches in 10 minutes), later kills got no relaunch at all
    for the next 10 minutes. That budget is now cleared whenever you open the app yourself, and
    raised to 10 relaunches.
- **The blocked page tells the truth.** It said "Blocking is set to always on" whenever it had no
  countdown, which also covered a paused session and a closed StudyNook. It now says "Session
  paused · 1:59:02 left", "StudyNook is closed · blocking stays on", or "always on" only when that
  is really your setting. Times over an hour show as h:mm:ss.
- Browser extension 1.4.2 (new block-page text). After updating, reload the extension once from
  `chrome://extensions`.

## 1.5.5

- **Notes keep the last thing you typed.** Text typed less than half a second before closing
  StudyNook (X, Alt+F4 or tray Quit) was lost. It is now saved to disk as the window closes.
- **Reset all data now deletes attached PDFs too**, and importing data removes the PDFs of notes
  the import replaced. They used to stay in the data folder.
- **The 50,000-character note limit is visible.** Near the limit the word count becomes a
  character count, and a paste that does not fit says how much was left out. Before, the end of a
  longer note was cut off silently the next time StudyNook started.

## 1.5.4

- **New Notes page.** A notes list on one side (newest first, with search) and a large editor on
  the other. Every note has its own **Auto / LTR / RTL** text direction, so Arabic reads right to
  left and English left to right. You can attach PDFs to a note (button or drag and drop, up to 20
  of 50 MB each); they are copied into the data folder's `attachments` folder and open in your PDF
  app. Dropping a file anywhere else in the window no longer replaces the whole interface.

## 1.5.3

- **Session recovery fixed.** If StudyNook was force-closed twice during one session, the second
  recovery restarted the timer from the full length. It now keeps its place however many times
  it is killed. Ending a recovered session early also counts the minutes focused before the
  kill (it counted none). The saved session file is now written atomically, so a kill in the
  middle of a save can no longer corrupt it.
- **Taskbar icon fixed.** `StudyNook.exe` carried Electron's default atom icon (the build skipped
  editing the executable), so the taskbar, Start menu and file lists showed it instead of the
  StudyNook icon. The build now stamps the real icon and product name into the exe.
- **Mini timer fixed.** Clicking it now brings StudyNook back (it could only be dragged before:
  Electron swallows clicks on a drag region). Drag it by its icon instead. The faint square
  around it is gone, and it can no longer be dragged off the screen.
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
