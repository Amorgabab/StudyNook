# StudyNook — Production Hardening Report

Baseline: app v1.2.1 / extension v1.3.1 → after hardening: app v1.2.2 / extension v1.3.2.
Method: Preserve → Inspect → Verify → Harden → Polish. No rewrites, no architecture changes.

## A. BASELINE (before changes)
- 101/101 unit tests (incl. VM browser-emulation of the real extension worker)
- 16/16 integration smoke checks
- All contract systems verified working by user real-world testing.

## B. CHANGES MADE
| File | Problem | Change | Reason | Risk |
|---|---|---|---|---|
| app/main/store.js | Corrupt/hostile import or data file could poison state (NaN timers, renderer crash); deepMerge crashed on `null` objects | Added `sanitizeData()` (type/range coercion for every known field; unknown fields PRESERVED); null-safe deepMerge; `num()` treats null/'' as default | P1 data safety | low — defaults only apply to invalid values |
| app/main/main.js | import bypassed sanitization; bridge failure invisible | import routes through sanitizeData; snapshot exposes `ext.bridgeError` | P1/P3 | low |
| app/main/sync-server.js | `/pair` brute-forceable (6-char code, local attacker); port conflict silent | 10 attempts/min throttle → 429; capture EADDRINUSE into server.error | P2 security / P3 observability | low |
| app/main/guardian.js | Kill path trusted a stale PID list (PID-reuse could kill wrong process) | Re-verify each PID against a fresh process list immediately before killing (`_killGroup`, `killNow`); optional `hooks.listProcesses/killProcess` injection for tests | P2 safety | low — verified by 3 new tests |
| app/main/session.js | System-clock jump backwards stretched countdown indefinitely | `_tick` clamps: if remaining > phase length, resync from last sane remainder | P2 reliability | low — 2 new tests |
| extension/background.js | Concurrent get-then-set storage writes could clobber each other (log/bounces/audit share store) | Serialized write queue (promise mutex) | P2 reliability | low |
| app/ui/js/app.js | Bridge failure had no UI state | sidebar pill shows `bridge: error` (warn style) | P3 UX/state completeness | none |
| app/ui/js/views-manage.js | Notes "saved X ago" label went stale after autosave | label updates to "saved just now" on actual save | P4 UX | none |
| app/ui/js/views-misc.js | Diagnostics paste included pairing code | code stripped from Copy-diagnostics blob | P2 security (secret hygiene) | none |
| shared/progress.js, shared/quotes.js, ui/js/audio.js | Dead exports (`yesterdayStr`, `BLOCK_LINES`, `Audio2.current`) | removed after repo-wide usage grep | P3 maintainability | none |
| tests/store.test.js, tests/hardening.test.js, tests/smoke.js | coverage gaps for the above | +5 sanitize tests, +5 guardian/session tests, +1 throttle smoke check | — | — |
| versions | staleness detection needs new marker | ext 1.3.2 / version.json 1.3.2 / app 1.2.2 | P3 | none |

## C. LEFT UNCHANGED (inspected, working, contract-protected)
Session engine & credit rules; App Guardian scan/warn/kill flow, styles, safety hierarchy, exits; planner; Tab Guardian four layers + session-start audit + priorities (3/2/1); napping page; standalone mode; localhost bridge protocol & port 47470 & pairing UX; stale-worker detection + one-click reload; persistence format & atomic writes; daily backups (7); rewards/levels/streaks/24 achievements/garden; Mochi thresholds & moods; Iron Session (gate, 4-day lock, unclosable rules) & escape ladder; ambience file-first + synth fallback; visual design (no glitter); diagnostics pages; start.bat/vbs launchers; extension popup/tests page workflows.

## D. TEST RESULTS (after)
- Unit: **111/111 pass** (was 101; +10 new regression tests)
- Integration smoke: **17/17 pass** (was 16; +1 pair-throttle check)
- Syntax: all JS files clean
- Extension worker VM-emulation suite included in the 111 (already-open tabs, SPA wanders, sweeps, lecture-lock, google-safe)
- Manual/real-browser: not runnable from this sandbox — covered by user workflows + in-browser 🧪 self-test (unchanged, still present)

## E. SECURITY
Found & fixed: pair brute-force throttle; diagnostics secret leak (pairing code); PID-reuse kill safety; hostile-import sanitization; null-merge crash. Audited clean: preload channel whitelist, contextIsolation, CSP headers on all pages, `open:url` scheme allow-list (http/https only), execFile argv (no shell interpolation), localhost-only bridge + token auth, no eval/remote code, no telemetry, import uses JSON.parse + sanitize only.

## F. DATA SAFETY
Verified: atomic tmp+rename writes (pre-existing); daily backups retained 7 (pre-existing); import now sanitized + type-coerced + session-guarded; unknown/future fields preserved through sanitize & merge (tested); corrupted `null`/wrong-type structures load safely (tested); oversized strings capped (tested); export completeness unchanged.

## G. UX (behavior-neutral)
Notes saved-indicator freshness; bridge-error pill state; diagnostics blob hygiene. No workflow, layout, or interaction-model changes.

## H. REMAINING RISKS (honest)
- Real Chrome/Windows behavior (DNR timing, SPA events, tasklist quirks) cannot be executed from this sandbox; mitigated by VM emulation + user-side 🧪 self-test + block log.
- Electron GUI itself is not headless-tested here (no display in sandbox); main-process logic is covered by smoke + unit tests.
- Sanitization defaults could mask a *future* legitimate out-of-range value (e.g. workMin > 600) — clamps chosen generously to match UI limits.
- Pair throttle is per-process (restart resets it); acceptable for a local bridge.

## I. REQUIRED EXTERNAL RESOURCES
**No additional resources are required.** (Optional, as before: real ambience mp3s in `assets/sounds/`; the synthesized fallback remains.)
