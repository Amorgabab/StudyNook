# StudyNook UI Redesign — Specification

Status: implemented on branch `ui-redesign` (based on `force-extension-version`).
Direction: **professional but cozy** — calm warm neutrals, one terracotta accent,
line icons, real typography, generous and consistent spacing. Nothing decorative
that does not carry information.

---

## 1. Foundations

### 1.1 Typography

| Use | Family | Size / line-height | Weight |
|---|---|---|---|
| Page title | Inter | 22 / 28 | 650 |
| Section title (card) | Inter | 15 / 22 | 600 |
| Body | Inter | 14 / 22 | 400 |
| Label (form, row) | Inter | 13.5 / 20 | 500 |
| Secondary / help text | Inter | 13 / 20 | 400, `--text-muted` |
| Caption / metadata | Inter | 12 / 16 | 500, `--text-muted` |
| Overline (stat label) | Inter | 11 / 16, letter-spacing .04em, uppercase | 600 |
| Timer digits | Inter, `font-variant-numeric: tabular-nums` | 56 / 1 | 600 |
| Stat value | Inter, tabular-nums | 22 / 28 | 600 |
| Code / process names | `ui-monospace, Cascadia Mono, Consolas` | 12 / 16 | 500 |

* Inter is bundled (variable font, Latin subset, `app/ui/fonts/`). No network fonts.
* Arabic: Inter has no Arabic glyphs, so `:lang(ar)` uses `"Segoe UI", Tahoma, sans-serif`
  (Segoe UI ships with full Arabic shaping on Windows).
* Fallback stack: `Inter, "Segoe UI", system-ui, sans-serif`.

### 1.2 Colour tokens

All colour comes from CSS custom properties on `:root[data-theme]`. Components
never hard-code colours.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F7F5F2` | `#171513` | Window background |
| `--surface` | `#FFFFFF` | `#211E1B` | Cards, sidebar, modals |
| `--surface-2` | `#F2EFEB` | `#2A2622` | Inputs, list rows, wells |
| `--border` | `#E6E1DB` | `#38332E` | Hairlines, card borders |
| `--border-strong` | `#D4CDC5` | `#4A443E` | Input borders, hover |
| `--text` | `#1F1B18` | `#F2EEE9` | Primary text |
| `--text-muted` | `#6B625B` | `#A8A099` | Secondary text |
| `--text-faint` | `#958B83` | `#7D766F` | Placeholders, disabled |
| `--accent` | `#C8643F` | `#E08A66` | Primary actions, focus, timer ring |
| `--accent-hover` | `#B4552F` | `#EA9A78` | Primary hover |
| `--accent-soft` | `#F8E9E2` | `#3A2A22` | Selected nav, soft badges |
| `--on-accent` | `#FFFFFF` | `#1A1310` | Text on accent |
| `--success` | `#4E8A5A` | `#7DBA89` | Done, connected, break ring |
| `--success-soft` | `#E7F1E8` | `#22302A` | |
| `--warning` | `#B7791F` | `#E0A54A` | Paused, attention |
| `--warning-soft` | `#FBF0DC` | `#3A2F1C` | |
| `--danger` | `#B5443B` | `#E57A70` | Destructive, interrupted |
| `--danger-soft` | `#F8E5E3` | `#3B2221` | |
| `--focus-ring` | `0 0 0 3px rgba(200,100,63,.35)` | `0 0 0 3px rgba(224,138,102,.45)` | Keyboard focus |
| `--shadow-1` | `0 1px 2px rgba(31,27,24,.06)` | `0 1px 2px rgba(0,0,0,.4)` | Cards |
| `--shadow-2` | `0 8px 24px rgba(31,27,24,.12)` | `0 8px 24px rgba(0,0,0,.5)` | Modals, toasts, popovers |

Contrast: body text ≥ 7:1, muted text ≥ 4.5:1, accent buttons ≥ 4.5:1 in both themes.

### 1.3 Spacing, radius, sizing

* Spacing scale (only these values): **4, 8, 12, 16, 20, 24, 32, 40, 48** (`--s-1` … `--s-9`).
* Page padding: 32 (≥ 1100 px wide), 24 (< 1100 px).
* Card padding: 24. Gap between cards: 24. Gap inside a card between groups: 20.
* Row height for settings / list rows: 52 minimum, 12 vertical padding.
* Radius: 6 (badges, chips), 8 (buttons, inputs), 12 (cards, list rows), 16 (modals).
* Hit targets: ≥ 32 × 32; primary buttons 40 high; the Start button 48 high.
* Content max width: 1040 px, centred in the view.

### 1.4 Motion

* 150 ms ease-out for hover/press colour changes; 200 ms for toggles; no bouncing, no hover lifts.
* Page/card entrance: none (instant). Toast: 180 ms fade + 8 px slide.
* `prefers-reduced-motion`: all transitions off.

---

## 2. Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Titlebar 44px: [mark] StudyNook        [Lv chip][streak] _ ✕ │
├───────────┬──────────────────────────────────────────────────┤
│ Sidebar   │  Page header: Title · subtitle        [actions]  │
│ 216px     │  ─────────────────────────────────────────────── │
│ icon+label│  Content (max 1040, centred, 32px padding)       │
│ nav items │                                                  │
│ …         │                                                  │
│ ───────── │                                                  │
│ status:   │                                                  │
│ guard     │                                                  │
│ extension │                                                  │
└───────────┴──────────────────────────────────────────────────┘
```

* Titlebar: draggable, 44 px, `--bg`. Left: 20 px app mark (rounded square, accent, `book-open` icon) + "StudyNook" 14/600. No greeting text. Right: level chip (`Lv 4 · 62%` with 48 px progress bar), streak chip (`flame` + number), window buttons 40 × 32 (`minus`, `x`), close hover = `--danger`.
* Sidebar: 216 px, `--surface`, right border. Nav item 40 px high, 12 px horizontal padding, 20 px icon + 14/500 label, radius 8. Active: `--accent-soft` background, `--accent` icon + label. Bottom status block: two rows ("App guard", "Extension") each with a 8 px status dot and state text.
* Below 980 px window width the sidebar collapses to 64 px (icons only, label in tooltip).
* Every page starts with a **page header**: title (22/650), one-line subtitle (13, muted), optional right-aligned actions. 24 px below it.
* RTL (Arabic): whole layout mirrors (`dir="rtl"`); all CSS uses logical properties (`margin-inline-start`, `inset-inline-end`, `text-align: start`). Directional icons (`chevron-right`, `external-link`) flip via `[dir=rtl] .icon-flip { transform: scaleX(-1) }`.

### 2.1 Pages

| Page (nav label) | Icon | Content |
|---|---|---|
| Focus | `house` | Two columns (1.2fr / 1fr). Left: Timer card (mode tabs, ring 240 px, Start 48 px, task picker, duration chips in Free mode). Right: Today card (daily goal progress bar + 4 stats), Companion card (pet 120 px, stage, progress to next stage). Full width: Ambience card (5 sound buttons + volume), Activity card (last 8 events). |
| Tasks | `list-checks` | Add form card (title, subject, planned minutes, estimate, Add). Segmented Open/Done. List rows: checkbox, title, meta badges, sources, delete. Empty states with one sentence + action. |
| Notes | `notebook-pen` | Header action "New note". Grid of note cards (min 300 px). Autosave indicator "Saved · 2 min ago". |
| Apps | `app-window` | Status card (guard on/off toggle, armed state, "Pause guard 5 min"). Tabs: Blocked · Allowed · Library · Running. Fine-tuning lives in Settings → Blocking. |
| Websites | `globe` | Status card (site blocking toggle, block/allow list mode, armed state). Two list cards (Blocked / Allowed). Extension card: connection state, pairing code + copy, 4 setup steps, "Check extension" button. **"Open browser with extension" is removed.** |
| Progress | `chart-column` | Level card, streak card, total card; Last 7 days bar chart; 13-week activity heat-map (5 intensity steps, legend); Companion journey (6 stages); Achievements grid. |
| Settings | `settings` | See §4. |
| Help | `circle-question-mark` | See §5. |

---

## 3. Icon replacements (Lucide, 2 px stroke, 20 px default, 16 px inline)

Every emoji in the app, extension and windows is removed. Mapping:

| Where | Old | New Lucide icon |
|---|---|---|
| Nav: Nook/Focus | 🏡 | `house` |
| Nav: Tasks | 📝 | `list-checks` |
| Nav: Notes | 🗒 | `notebook-pen` |
| Nav: Apps | 🧸 | `app-window` |
| Nav: Sites | 🌐 | `globe` |
| Nav: Garden → Progress | 🌷 | `chart-column` |
| Nav: Settings | ⚙️ | `settings` |
| Nav: Help | 💡 | `circle-question-mark` |
| App mark / title | 🪺 | `book-open` in accent square |
| Streak | 🔥 | `flame` |
| Level | 🌱 | `award` |
| Pomodoro mode | 🍅 | `timer` |
| Free focus mode | 🌙 | `hourglass` |
| Start / Pause / Resume / End / Skip | SVG | `play` / `pause` / `play` / `square` / `skip-forward` |
| Iron mode | 🔒 | `lock` |
| Task picker "no task" | 🎯 | (text only) |
| Today card | 🌤️ | `sun` |
| Companion card | 🧸 | `cat` |
| Ambience: rain / fire / waves / café / off | 🌧️🔥🌊☕🔕 | `cloud-rain` / `flame` / `waves-horizontal` / `coffee` / `volume-x` |
| Activity: done / warning / info | ✓ ! · + stored emoji | `circle-check` / `circle-alert` / `circle-dot` (stored emoji ignored) |
| Task planned time / pomodoros | ⏱ 🍅 | `clock` / `timer` |
| Task source add / open | 🔗 ↗ | `link` / `external-link` |
| Delete | 🗑 | `trash` |
| Remove chip | ✕ | `x` |
| Checkbox | ✓ | `check` |
| Guard breathing room | 😮‍💨 | `pause` |
| Block / allow list | 🚫 ✅ | `ban` / `circle-check` |
| During focus / always | ⏱ ♾ | `timer` / `infinity` |
| Gentle / instant / warn only | 🕊 ⚡ 🔔 | `bell-ring` / `zap` / `bell` |
| Armed / not armed | 🟢 ⚪ | status dot (CSS) |
| App library | 📚 | `library` |
| Running now / rescan | 🔎 🔄 | `scan-search` / `refresh-cw` |
| Catalog apps (games / chat / music / video / other) | per-app emoji | `gamepad-2` / `message-circle` / `music` / `tv` / `app-window` |
| Extension connected / not | 🟢 🔴 | `plug` / `unplug` + status dot |
| Copy code | 📋 | `copy` |
| Check extension | 🔍 | `search-check` |
| Banners: warning / info / success | ⚠️ ℹ 🌈 | `triangle-alert` / `info` / `circle-check` |
| Pet stages egg → legend | 🥚🐣🐱😺🎓👑 | `egg` / `baby` / `cat` / `book-open` / `graduation-cap` / `crown` |
| Garden plants | 🌱🌿🌷🌳 | heat-map intensity squares (no icon) |
| Achievements | 24 emoji | per-achievement icon (e.g. `sprout`, `timer`, `flame`, `mountain`, `clock`, `star`, `moon`, `sunrise`, `moon-star`, `leaf`, `shield`, `shield-check`, `circle-check`, `list-checks`, `heart`, `egg`, `graduation-cap`, `crown`, `book-open`, `trophy`, `cloud-rain`, `flower`, `sun`) |
| Settings section icons | ⏱ 🎧 🛟 | `timer`, `volume-2`, `life-buoy` … (see §4) |
| Help topics | 🌱🧸🌐🐱🛟💾 | `rocket`, `timer`, `app-window`, `globe`, `chart-column`, `settings`, `database`, `wrench` |
| Mini timer pet | stage emoji | stage icon (above) |
| Warning card | 🕊️ | `bell-ring` |
| Extension popup logo / sync / reload | 🪺 🔄 ⚡ | `book-open` / `refresh-cw` / `rotate-ccw` |
| Blocked page cat / zzz / moon | 🐱 💤 | `moon` in a soft circle; decorative zzz and moon blob removed |

Icons are inline SVG generated from `lucide-static` (ISC licence) into `app/shared/icons.js`
(and an identical copy `extension/icons.js`; a test keeps them in sync).
`aria-hidden="true"` on decorative icons; icon-only buttons carry `aria-label`.

---

## 4. Settings page

Layout: left sub-navigation (sections, 200 px) + right panel with one card per
section. Each row = label (13.5/500) + one-line description (13, muted) on the
start side, control on the end side. Every setting saves immediately (no Save
button) and is validated in the main process (`settings:set`) and on load
(`sanitizeData`).

| Section (icon) | Setting | Control | Range / options | Default | Stored at |
|---|---|---|---|---|---|
| General (`sliders-horizontal`) | Language | select | English, العربية, Français, Español | English | `settings.language` |
| | Start with Windows | toggle | — (packaged app only) | off | `settings.startWithWindows` → `app.setLoginItemSettings` |
| | Your name | text | ≤ 40 chars | "" | `profile.name` |
| | Companion name | text | ≤ 20 chars | Mochi | `pet.name` |
| | Daily focus goal | stepper (15-min steps) | 0 (off) – 720 min | 120 | `settings.dailyGoalMin` |
| | Subjects | chip list + add | ≤ 40 | 6 defaults | `subjects` |
| Appearance (`palette`) | Theme | segmented | System · Light · Dark · Auto | System | `settings.theme` |
| | (info) | — | Auto = dark from 19:00 to 07:00 | — | — |
| | Mini floating timer | toggle | — | on | `settings.miniWindow` |
| Focus timer (`timer`) | Focus length | stepper | 5–180 min | 25 | `settings.timer.workMin` |
| | Short break | stepper | 1–60 | 5 | `shortMin` |
| | Long break | stepper | 5–90 | 15 | `longMin` |
| | Rounds before long break | stepper | 2–12 | 4 | `rounds` |
| | Auto-start breaks | toggle | | on | `autoStartBreaks` |
| | Auto-start next focus | toggle | | off | `autoStartFocus` |
| | Strict mode | toggle | | off | `strict` |
| | Iron session | toggle (locked badge while locked) | | off | `iron` |
| | Iron lock length | stepper | 1–30 days | 4 | `ironLockDays` |
| Blocking (`shield`) | App guard runs | segmented | During focus · Always | During focus | `settings.guardian.onlyDuringSessions` |
| | App guard mode | segmented | Blocklist · Allowlist (+ preview) | Blocklist | `guardian.mode` |
| | When a blocked app opens | segmented | Warn, then close · Close instantly · Warn only | Warn, then close | `guardian.action` |
| | Warning time | stepper | 5–300 s | 15 | `guardian.graceSec` |
| | Check every | stepper | 1–30 s | 3 | `guardian.scanSec` |
| | Website blocking runs | segmented | During focus · Always | During focus | `sites.when` |
| | Emergency pause | buttons | 5 · 15 · 60 min | — | (action) |
| Notifications (`bell`) | Focus finished | toggle | | on | `settings.notify.focusEnd` |
| | Break finished | toggle | | on | `settings.notify.breakEnd` |
| | Blocker warnings | toggle | (extension gone, app closed) | on | `settings.notify.blocker` |
| Sound (`volume-2`) | Interface sounds | toggle | | on | `settings.sound.ui` |
| | Chimes | toggle | | on | `settings.sound.chimes` |
| | Ambience volume | slider | 0–100 % | 60 % | `settings.sound.volume` |
| | Ambience files | button "Open sounds folder" | — | — | (action) |
| Data & privacy (`database`) | Back up now · Open backups folder | buttons | — | — | (action) |
| | Export / Import backup | buttons | — | — | (action) |
| | Open data folder | button | — | — | (action) |
| | Reset all data | danger button + confirm | — | — | (action) |
| About (`info`) | Version, local-first statement, Replay welcome tour, Open Help | text + buttons | — | — | — |

Removed: the old "Safety & emergency" card (its pause buttons live in Blocking),
duplicated "Open sounds folder" buttons, emoji headers, the README button (Help replaces it).

---

## 5. Help

Layout: left topic list (220 px) + article panel (max 720 px measure, 14/24 body).
Each article: title, one-paragraph summary, then sections with H3 headings,
numbered steps where order matters, bullet lists for options, and a callout box
(`info` / `triangle-alert`) for gotchas. Search field above the topic list filters
by title and body text. All articles are translated (en/ar/fr/es).

| Topic | Icon | Covers |
|---|---|---|
| Getting started | `rocket` | What StudyNook does, the 4-step first session, where the timer lives (tray, mini timer). |
| Focus sessions | `timer` | Pomodoro vs free focus, rounds, breaks, pause/resume, ending early, strict mode, Iron session and the end gate, what counts toward XP. |
| Blocking apps | `app-window` | Blocklist vs allowlist, warn/instant/warn-only, warning time, library and running list, emergency pause, what is never closed. |
| Blocking websites | `globe` | Lists and paths (`youtube.com/shorts`), during focus vs always, installing + pairing the extension, Iron behaviour if the extension is removed. |
| Tasks & notes | `list-checks` | Adding tasks, estimates, planned time, linking a task to a session, study sources, notes autosave. |
| Progress | `chart-column` | XP, levels, streaks, daily goal, companion stages (table), achievements. |
| Settings reference | `settings` | Every setting from §4 with its effect. |
| Data & privacy | `database` | Files on disk, backups, export/import, lifecycle log, auto-restart watchdog, no network/telemetry. |
| Troubleshooting | `wrench` | Extension not connected, port in use, timer missing, sounds silent, app closed unexpectedly, allowlist closed something. |

---

## 6. Theme logic (bug fix)

Bug: in Light mode at night, a time-of-day rule still painted the window
background dark (`body[data-tod="night"] #bg-scene`), so only the cards were light.

Fix:
* The time-of-day background gradients are deleted. `--bg` is the only window background.
* `settings.theme ∈ {system, light, dark, auto}`; one pure resolver
  (`app/shared/uiprefs.js → resolveTheme(setting, systemDark, hour)`):
  * `system` → follows Windows (`nativeTheme.shouldUseDarkColors`, pushed live on change);
  * `light` / `dark` → fixed;
  * `auto` → dark from 19:00 to 07:00, light otherwise; re-evaluated every minute.
* The resolved theme is set as `data-theme` on `<html>` in **every** window
  (main, mini timer, warning card), so all surfaces switch together.
* Extension popup and blocked page follow `prefers-color-scheme`.

---

## 7. Other surfaces

* **Mini timer** (250 × 64, always on top): `--surface` pill, 1 px border, `--shadow-2`; stage icon 18 px, time 20/600 tabular, phase label 12 muted; focus = accent left rule, break = success left rule. Click opens main window.
* **Warning card** (430 × 230): title "{App} is open", body "It will close in {n} seconds. Save your work.", large countdown 32/600 in `--warning`, buttons: "Keep open 5 min" (secondary), "Close now" (primary), "I'll close it" (ghost). Icon `bell-ring` in a warning-soft circle.
* **Extension popup** (300 wide): header (mark, name, connection dot + text, sync button), status card (state line, session line, sweep line), standalone timer buttons, pairing form; stale-version banner with `rotate-ccw` "Reload extension".
* **Blocked page**: centred 480 px card; `moon` icon in a 56 px soft circle; title "This site is blocked during focus"; domain chip; remaining time line; one quote; buttons "Go back" (primary) and "Close tab". No cat, no floating "zzz", no blurred moon.

---

## 8. Language & RTL

* `app/shared/i18n.js`: `t(key, vars)`, languages `en`, `ar`, `fr`, `es`; English is the fallback for any missing key. A test fails if a language is missing keys.
* `<html lang dir>` set from the setting; Arabic sets `dir="rtl"`.
* Main-process text (notifications, tray menu, toasts, new activity entries) uses the same dictionary. Existing activity entries keep the language they were written in.
* Numbers and times use `Intl` with the selected language.
* The Iron end-gate sentence is translated; it is typed in the selected language.
* The extension receives the language from the app (`/state`), standalone it uses the browser language.
