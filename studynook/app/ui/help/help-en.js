/* StudyNook · help/help-en.js — Help articles (English).
   Block types: { h }, { p }, { ol: [] }, { ul: [] }, { note, kind: 'info'|'warning' }, { table: { head, rows } }
   Inline: **bold**, `code`, [[key]] */
(function (root) {
  root.NookHelp = root.NookHelp || {};
  root.NookHelp.en = [
    {
      id: 'start', icon: 'rocket', title: 'Getting started',
      lead: 'StudyNook is a focus timer that closes distracting apps and blocks distracting websites while you study. Everything stays on your computer.',
      blocks: [
        { h: 'Your first session' },
        { ol: [
          'Open **Tasks** and add what you want to study (optional).',
          'On **Focus**, choose **Pomodoro** (rounds with breaks) or **Free focus** (one block of any length).',
          'Pick a task in the **Task** list if you want the time counted against it.',
          'Press **Start focus**. The timer keeps running even if you hide the window.'
        ] },
        { h: 'Turn on blocking' },
        { ul: [
          '**Apps**: add the programs that distract you. During focus they are closed after a short warning.',
          '**Websites**: add distracting sites, then install and pair the browser extension (see **Blocking websites**).'
        ] },
        { h: 'Where the timer lives' },
        { p: 'Closing the window quits StudyNook when nothing needs to keep running. It hides to the tray (bottom-right of the taskbar) if a session is running, if the guard or website blocking is set to run all the time, or if you turn on Settings → General → Keep running in the tray. While a session runs, a small **mini timer** stays on top of other windows; click it to bring StudyNook back.' },
        { note: 'You cannot close or quit StudyNook while a session exists, even when it is paused. End the session first.', kind: 'info' }
      ]
    },
    {
      id: 'focus', icon: 'timer', title: 'Focus sessions',
      lead: 'Two timer modes, optional strictness, and an Iron mode for days when you need a firm commitment.',
      blocks: [
        { h: 'Pomodoro and Free focus' },
        { table: { head: ['Mode', 'How it works'], rows: [
          ['Pomodoro', 'Focus rounds (25 min by default) separated by short breaks, with a long break after a set number of rounds. Change the lengths in **Settings → Focus timer**.'],
          ['Free focus', 'One continuous block. Pick 15–90 minutes with the chips, or type any length up to 600 minutes.']
        ] } },
        { h: 'Pausing and ending' },
        { ul: [
          '**Pause** stops the clock. App and website blocking keep running.',
          '**End session** stops early. Minutes you already focused still count, but you miss the completion bonus.',
          '**Skip break** jumps straight to the next round.'
        ] },
        { h: 'Strict mode' },
        { p: 'With strict mode on, ending a round early earns no XP for that round. Turn it on in **Settings → Focus timer**.' },
        { h: 'Iron sessions' },
        { p: 'An Iron session is a promise to yourself. While an Iron focus runs:' },
        { ul: [
          'The app guard closes blocked apps instantly and cannot be paused.',
          'Website blocking cannot be switched off.',
          'App lists can only grow: you can block more apps, but not remove, disable or allow any.',
          'Ending early requires a 60-second cool-down and typing a sentence exactly.',
          'If the browser extension disappears, StudyNook closes the browser after about 90 seconds.'
        ] },
        { note: 'Turning Iron on locks the switch for the number of days set in **Iron lock length** (default 4). Choose a length you are comfortable with before you turn it on.', kind: 'warning' },
        { h: 'What earns XP' },
        { p: 'Each focused minute earns 1 XP, a completed round adds 10 XP, and each completed task adds 5 XP.' }
      ]
    },
    {
      id: 'apps', icon: 'app-window', title: 'Blocking apps',
      lead: 'The app guard watches running programs and closes the ones you have chosen to block.',
      blocks: [
        { h: 'Adding apps' },
        { ul: [
          '**Library**: one click adds common distractions with the right process names.',
          '**Running now**: lists every program that is open, so you can block or allow it.',
          '**By name**: type a display name and the process names (find them on **Running now**).'
        ] },
        { h: 'Blocklist or allowlist' },
        { table: { head: ['Mode', 'What gets closed'], rows: [
          ['Blocklist', 'Only the apps on your **Blocked** list.'],
          ['Allowlist', 'Every app that is **not** on your **Allowed** list. Use **Preview** to see what would close before you rely on it.']
        ] } },
        { h: 'What happens when a blocked app opens' },
        { ul: [
          '**Warn, then close**: a warning card counts down (15 seconds by default), then the app closes.',
          '**Close instantly**: the app closes as soon as it is found.',
          '**Warn only**: you get a reminder, nothing is closed.'
        ] },
        { p: 'On the warning card, **Keep open 5 min** gives that app a short exception. Change these options in **Settings → Blocking**.' },
        { h: 'Emergency pause' },
        { p: 'Pause the guard for 5, 15 or 60 minutes from the Apps page or **Settings → Blocking**. This is not available during an Iron focus.' },
        { note: 'System processes (Windows Explorer, system services and similar) are never closed, whatever your lists say.', kind: 'info' }
      ]
    },
    {
      id: 'sites', icon: 'globe', title: 'Blocking websites',
      lead: 'Website blocking is done by the StudyNook browser extension, which follows your sessions automatically once it is paired.',
      blocks: [
        { h: 'Install the extension' },
        { ol: [
          'Open Chrome, Edge or Brave and go to `chrome://extensions`.',
          'Turn on **Developer mode** (top-right corner).',
          'Click **Load unpacked** and choose the folder shown on the **Websites** page.',
          'Click the StudyNook extension icon, enter the 6-letter pairing code from the Websites page and click **Pair**.'
        ] },
        { h: 'Lists' },
        { ul: [
          '**Blocklist**: the sites on your Blocked list are blocked.',
          '**Allowlist**: during focus, only the sites on your Allowed list open.',
          'Entries can include a path: `youtube.com/shorts` blocks only Shorts, not all of YouTube.'
        ] },
        { h: 'When blocking runs' },
        { p: 'Choose **During focus** or **Always** in **Settings → Blocking**. A blocked site shows a page with the time left in your session.' },
        { h: 'If the app is closed during a session' },
        { p: 'The extension keeps blocking until the session would have ended, so closing StudyNook does not unblock sites.' },
        { note: 'Browsers do not let any app prevent you from removing or turning off an extension. StudyNook warns you if the extension stops responding during focus, and in an Iron session it closes the browser.', kind: 'info' }
      ]
    },
    {
      id: 'tasks', icon: 'list-checks', title: 'Tasks & notes',
      lead: 'Keep track of what to study and link your focus time to it.',
      blocks: [
        { h: 'Tasks' },
        { ul: [
          '**Subject**: choose from the subjects in **Settings → General**.',
          '**Planned time**: how long you expect the task to take. In Free focus, picking the task sets the session length.',
          '**Estimate**: how many Pomodoros you expect. Completed rounds are counted against it.',
          '**Sources**: attach links to lecture videos, papers or textbook pages and open them with one click.'
        ] },
        { p: 'Select a task in the **Task** list on the Focus page before you start, and the session is counted against it. Completing a task earns 5 XP.' },
        { h: 'Notes' },
        { p: 'Notes are plain text and save automatically as you type. They are stored with the rest of your data on this computer.' },
        { ul: [
          '**Notes list**: the left side lists your notes, newest first. Use **Search notes** to find one by title or text.',
          '**Text direction**: each note has its own **Auto / LTR / RTL** setting. Auto follows the language you type, so Arabic notes read right to left and English notes left to right. Pick LTR or RTL to force it.',
          '**PDFs**: press **Attach PDF**, or drop PDF files onto a note, to keep lecture slides and papers with it (up to 20 per note, 50 MB each). Click a PDF to open it in your PDF app.',
          'PDFs are copied into the **attachments** folder inside your data folder (**Settings → Data & privacy → Data folder**). They are not part of **Export data** or the automatic backups, so copy that folder if you move computers.'
        ] }
      ]
    },
    {
      id: 'progress', icon: 'chart-column', title: 'Progress',
      lead: 'XP, levels, streaks, a daily goal, your companion and achievements all reflect the same thing: time spent focusing.',
      blocks: [
        { h: 'Levels and streaks' },
        { ul: [
          'Each level needs a little more XP than the last; the bar in the title bar shows your progress.',
          'Your streak counts consecutive days with at least one focused minute. Missing a day resets it.',
          'Set a **daily focus goal** in **Settings → General** to see progress on the Focus page.'
        ] },
        { h: 'Your companion' },
        { table: { head: ['Stage', 'Total focus'], rows: [
          ['Egg', 'Start'], ['Hatchling', '45 min'], ['Kitten', '3 h'], ['Study cat', '9 h'], ['Scholar', '20 h'], ['Legend', '40 h']
        ] } },
        { h: 'Achievements' },
        { p: 'There are 24 achievements, from your first session to a 30-day streak. Locked ones show what they need on the Progress page.' }
      ]
    },
    {
      id: 'settings', icon: 'settings', title: 'Settings reference',
      lead: 'Every setting is saved immediately. This is what each section controls.',
      blocks: [
        { table: { head: ['Section', 'Settings'], rows: [
          ['General', 'Language, start with Windows, your name, companion name, daily focus goal, subjects.'],
          ['Appearance', 'Theme (System, Light, Dark, Auto) and the mini timer.'],
          ['Focus timer', 'Round and break lengths, rounds before a long break, auto-start, strict mode, Iron session and its lock length.'],
          ['Blocking', 'When the app guard runs, blocklist or allowlist, what happens when a blocked app opens, warning time, check interval, when website blocking runs, emergency pause.'],
          ['Notifications', 'Focus finished, break finished, blocker warnings.'],
          ['Sound', 'Interface sounds, chimes, ambience volume, custom ambience files.'],
          ['Data & privacy', 'Backups, export, import, data folder, reset.'],
          ['About', 'Version, welcome tour, Help.']
        ] } },
        { h: 'Theme' },
        { p: '**System** follows your Windows light or dark setting. **Auto** is dark from 19:00 to 07:00 and light during the day. The whole app, including the mini timer and warning card, switches together.' }
      ]
    },
    {
      id: 'data', icon: 'database', title: 'Data & privacy',
      lead: 'StudyNook has no account and sends nothing to the internet. All data stays in one folder on your computer.',
      blocks: [
        { h: 'Files' },
        { table: { head: ['File', 'Contents'], rows: [
          ['`data.json`', 'Your settings, tasks, notes, lists and progress.'],
          ['`session.json`', 'The running session, so it can resume after a crash.'],
          ['`backups/`', 'One automatic backup per day; the last 7 are kept.'],
          ['`lifecycle.log`', 'When the app started, closed or restarted, for troubleshooting.']
        ] } },
        { p: 'Open the folder from **Settings → Data & privacy → Open data folder**.' },
        { h: 'Export and import' },
        { p: '**Export** downloads everything as a JSON file, without the extension pairing secret. **Import** replaces your data with an exported file. Import and reset are unavailable while a session runs.' },
        { h: 'Automatic recovery' },
        { p: 'If StudyNook is closed or crashes during a session, a small background helper reopens it and the session continues where it left off. Ending a session normally stops the helper.' },
        { h: 'The browser extension' },
        { p: 'The extension talks only to StudyNook on your own computer (`127.0.0.1`, port 47470), protected by the pairing code.' }
      ]
    },
    {
      id: 'trouble', icon: 'wrench', title: 'Troubleshooting',
      lead: 'Fixes for the most common problems.',
      blocks: [
        { h: 'The extension says "not connected"' },
        { ul: [
          'Make sure StudyNook is running.',
          'Check the pairing code on the Websites page matches what you entered in the extension.',
          'Use **Check extension** on the Websites page: it tells you whether the extension is installed, turned off or missing.',
          'Load the extension from the folder shown on the Websites page, not from an old copy.'
        ] },
        { h: '"Bridge error" or "port 47470 is busy"' },
        { p: 'Another program, or another copy of StudyNook, is using the port. Quit other copies and restart StudyNook.' },
        { h: 'The timer window disappeared' },
        { p: 'StudyNook is in the tray. Click the tray icon, or click the mini timer.' },
        { h: 'No sound' },
        { p: 'Click anywhere in the window once, then choose an ambience again. Check **Settings → Sound**.' },
        { h: 'The app closed unexpectedly' },
        { p: 'Reopen it; your session continues. `lifecycle.log` in the data folder records what happened.' },
        { h: 'Allowlist mode closed something I needed' },
        { p: 'Add it on **Apps → Allowed**, or use **Preview** to see what allowlist mode would close before a session starts.' }
      ]
    }
  ];
})(typeof self !== 'undefined' ? self : this);
