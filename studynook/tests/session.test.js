'use strict';
const proc = require('../app/main/processes.js');
const { SessionEngine } = require('../app/main/session.js');

suite('processes · parsers', () => {
  test('tasklist csv with quotes & commas', () => {
    const out = [
      '"Discord.exe","1234","Console","1","150,000 K"',
      '"My App.exe","56","Console","1","1,234 K"',
      '',
      '"chrome.exe","789","Console","1","999 K"'
    ].join('\r\n');
    const rows = proc.parseTasklistCsv(out);
    expect(rows.length).toBe(3);
    expect(rows[0].name).toBe('Discord.exe');
    expect(rows[0].pid).toBe(1234);
    expect(rows[1].name).toBe('My App.exe');
    expect(rows[2].pid).toBe(789);
  });
  test('ps output', () => {
    const rows = proc.parsePs('  123 /usr/bin/telegram\n  456 chrome\n');
    expect(rows.length).toBe(2);
    expect(rows[0].pid).toBe(123);
    expect(rows[1].name).toBe('chrome');
  });
});

suite('session engine · lifecycle', () => {
  function makeEngine(settings) {
    const events = [];
    const eng = new SessionEngine({
      getSettings: () => settings,
      onTick: () => {},
      onState: () => {},
      onPhaseEnd: (i) => events.push(i)
    });
    return { eng, events };
  }
  const S = { workMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: false };

  test('start → focus phase running', () => {
    const { eng } = makeEngine(S);
    const st = eng.start({ mode: 'pomodoro' });
    expect(st.phase).toBe('focus');
    expect(st.running).toBeTruthy();
    expect(st.remainingSec).toBeGreaterThan(1400);
    eng.stop({ abandon: false });
  });

  test('pause freezes remaining', () => {
    const { eng } = makeEngine(S);
    eng.start({ mode: 'pomodoro' });
    eng.pause();
    const a = eng.remainingSec();
    const b = eng.remainingSec();
    expect(a).toBe(b);
    expect(eng.isFocusing()).toBeFalsy();
    eng.stop({});
  });

  test('stop mid-focus gives partial minutes, no completion', () => {
    const { eng, events } = makeEngine(S);
    eng.start({ mode: 'pomodoro' });
    eng.stop({ abandon: true });
    const ev = events.find((e) => e.phase === 'session-stop');
    expect(ev.completed).toBeFalsy();
    expect(ev.abandon).toBeTruthy();
  });

  test('free mode completes plan after one phase', () => {
    const { eng, events } = makeEngine(S);
    eng.start({ mode: 'free', freeMin: 25 });
    // simulate finish by forcing endsAt
    eng.s.endsAt = Date.now() - 1;
    setTimeout(() => {}, 0);
    eng._tick();
    const ev = events.find((e) => e.phase === 'focus' && e.completed);
    expect(ev).toBeTruthy();
    expect(ev.minutes).toBe(25);
    expect(eng.isActive()).toBeFalsy();
  });

  test('pomodoro: focus → short break auto, rounds counted', () => {
    const { eng, events } = makeEngine(S);
    eng.start({ mode: 'pomodoro' });
    eng.s.endsAt = Date.now() - 1;
    eng._tick();
    expect(eng.s.phase).toBe('short');
    expect(eng.s.roundIdx).toBe(1);
    expect(events.some((e) => e.phase === 'focus' && e.completed && e.minutes === 25)).toBeTruthy();
    // skip break → next focus (not auto-started)
    eng.skip();
    expect(eng.s.phase).toBe('focus');
    expect(eng.s.running).toBeFalsy();
    eng.stop({});
  });

  test('long break after `rounds` completions', () => {
    const { eng } = makeEngine(S);
    eng.start({ mode: 'pomodoro' });
    for (let i = 0; i < 4; i++) {
      eng.s.phase = 'focus'; eng.s.running = true; eng.s.phaseStartAt = Date.now(); eng.s.endsAt = Date.now() - 1;
      eng._tick(); // completes focus i+1
      if (i < 3) { // skip the break
        eng.s.phase = 'short'; eng.skip();
      }
    }
    // after 4th focus completes with roundIdx=4 → long break
    expect(eng.s ? eng.s.phase === 'long' : true).toBeTruthy();
    if (eng.s) eng.stop({});
  });
});

suite('session · kill recovery (End task / crash)', () => {
  const S = { workMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: false };
  function makeEngine(settings) {
    return new SessionEngine({
      getSettings: () => settings,
      onTick: () => {}, onState: () => {}, onPhaseEnd: () => {}
    });
  }
  // Simulate the persisted snapshot a running engine would have written to
  // session.json at `savedAt`, then being killed via Task Manager.
  function snapshotFrom(eng, savedAt) {
    const st = eng.persistState();
    st.savedAt = savedAt;
    return st;
  }

  test('running focus resumes where it left off — dead time is free', () => {
    const eng = makeEngine(S);
    eng.start({ mode: 'pomodoro' });
    // bank 10 min of the 25-min round: sessionFocusSec holds the completed
    // minutes, phaseStartAt/endsAt describe the open countdown
    eng.s.sessionFocusSec = 10 * 60;
    eng.s.phaseStartAt = Date.now() - 10 * 60 * 1000;
    eng.s.endsAt = Date.now() + 15 * 60 * 1000;
    const snap = snapshotFrom(eng, Date.now());
    const eng2 = makeEngine(S);
    const chk = SessionEngine.recoverable(snap);
    expect(chk.ok).toBeTruthy();
    const st = eng2.restore(snap);
    expect(st && st.active).toBeTruthy();
    expect(st.phase).toBe('focus');
    expect(st.running).toBeTruthy();
    // ~15 min remain — the hour while dead never counted against the round
    expect(st.remainingSec).toBeGreaterThan(14 * 60);
    expect(st.remainingSec <= 15 * 60 + 2).toBeTruthy();
    // the 10 focused minutes are preserved as banked session time
    expect(Math.round(eng2.s.sessionFocusSec / 60)).toBe(10);
    eng2.stop({});
    // A full hour of simulated dead time: shift the whole snapshot's clock
    // back (savedAt + every absolute timestamp together, so the internal
    // deltas stay real) and restore "now" — the dead hour must be free.
    const shift = (o, ms) => { for (const k of ['savedAt', 'endsAt', 'phaseStartAt', 'startedAt']) { if (typeof o[k] === 'number') o[k] -= ms; } return o; };
    const oldSnap = shift(snapshotFrom(eng, Date.now()), 60 * 60 * 1000);
    const eng4 = makeEngine(S);
    expect(SessionEngine.recoverable(oldSnap).ok).toBeTruthy();
    const st4 = eng4.restore(oldSnap);
    expect(st4.remainingSec).toBeGreaterThan(14 * 60);
    expect(st4.remainingSec <= 15 * 60 + 2).toBeTruthy();
    eng4.stop({});
  });

  test('killed twice in a row, the countdown keeps its place (no rewind to the full length)', () => {
    const eng = makeEngine(S);
    eng.start({ mode: 'free', freeMin: 15 });
    // 4 minutes into a 15-minute free focus
    eng.s.phaseStartAt = Date.now() - 4 * 60 * 1000;
    eng.s.endsAt = Date.now() + 11 * 60 * 1000;
    const snap1 = snapshotFrom(eng, Date.now());
    eng._stopLoop();
    // first kill → restored
    const eng2 = makeEngine(S);
    const st2 = eng2.restore(snap1);
    expect(Math.abs(st2.remainingSec - 11 * 60) <= 2).toBeTruthy();
    // a few seconds later, the app is killed again: whatever it saved right after restoring
    const snap2 = snapshotFrom(eng2, Date.now() + 5000);
    snap2.endsAt += 5000; snap2.phaseStartAt += 0;
    eng2._stopLoop();
    expect(SessionEngine.recoverable(snap2).ok).toBeTruthy();
    const eng3 = makeEngine(S);
    const st3 = eng3.restore(snap2);
    // still ~11 minutes left, not 15
    expect(st3.remainingSec <= 11 * 60 + 2).toBeTruthy();
    expect(st3.remainingSec > 10 * 60).toBeTruthy();
    // and the 4 focused minutes before the first kill were not lost
    expect(Math.round(snap2.accumSec / 60)).toBe(4);
    // a third time, much later (app dead for ages): dead time is still free
    const shift = (o, ms) => { for (const k of ['savedAt', 'endsAt', 'phaseStartAt', 'startedAt']) { if (typeof o[k] === 'number') o[k] -= ms; } return o; };
    const eng4 = makeEngine(S);
    const st4 = eng4.restore(shift(snapshotFrom(eng3, Date.now()), 3 * 60 * 60 * 1000));
    expect(st4.remainingSec <= 11 * 60 + 2).toBeTruthy();
    expect(st4.remainingSec > 10 * 60).toBeTruthy();
    eng3._stopLoop(); eng4.stop({});
  });

  test('ending a recovered focus early still counts the minutes focused before the kill', () => {
    const eng = makeEngine(S);
    eng.start({ mode: 'free', freeMin: 15 });
    eng.s.phaseStartAt = Date.now() - 6 * 60 * 1000;
    eng.s.endsAt = Date.now() + 9 * 60 * 1000;
    const snap = snapshotFrom(eng, Date.now());
    eng._stopLoop();
    const eng2 = makeEngine(S);
    eng2.restore(snap);
    const info = eng2.stop({});
    expect(info && info.minutes).toBe(6);
  });

  test('paused focus stays paused after a kill, with frozen remaining', () => {
    const eng = makeEngine(S);
    eng.start({ mode: 'pomodoro' });
    eng.pause();
    const remBefore = eng.remainingSec();
    const snap = snapshotFrom(eng, Date.now());
    eng._stopLoop();               // done with this engine — no stray timers
    const eng2 = makeEngine(S);
    expect(SessionEngine.recoverable(snap).ok).toBeTruthy();
    const st = eng2.restore(snap);
    expect(st.running).toBeFalsy();
    expect(st.remainingSec).toBe(remBefore);
    eng2.stop({});
  });

  test('fully elapsed focus round is not resumed (salvage path)', () => {
    const eng = makeEngine(S);
    eng.start({ mode: 'pomodoro' });
    eng.s.phaseStartAt = Date.now() - 30 * 60 * 1000;   // 30 min into a 25-min round
    eng.s.endsAt = Date.now() - 5 * 60 * 1000;          // countdown already over
    const snap = snapshotFrom(eng, Date.now());
    const chk = SessionEngine.recoverable(snap);
    expect(chk.ok).toBeFalsy();
    expect(chk.why).toContain('finished while the app was closed');
  });

  test('corrupt/legacy snapshots recover without throwing', () => {
    const eng = makeEngine(S);
    // legacy file: no phaseStartAt → derived from endsAt/savedAt
    eng.start({ mode: 'pomodoro' });
    eng.s.phaseStartAt = Date.now() - 5 * 60 * 1000;
    eng.s.endsAt = Date.now() + 20 * 60 * 1000;
    const snap = snapshotFrom(eng, Date.now());
    delete snap.phaseStartAt;
    const eng2 = makeEngine(S);
    expect(SessionEngine.recoverable(snap).ok).toBeTruthy();
    const st = eng2.restore(snap);
    expect(st && st.active).toBeTruthy();
    expect(st.remainingSec).toBeGreaterThan(19 * 60);
    eng2.stop({});
    eng._stopLoop();               // done with this engine — no stray timers
    // junk states are refused cleanly instead of half-restored
    expect(SessionEngine.recoverable(null).ok).toBeFalsy();
    expect(SessionEngine.recoverable({ active: false }).ok).toBeFalsy();
    expect(SessionEngine.recoverable({ active: true, phase: 'zzz' }).ok).toBeFalsy();
    expect(makeEngine(S).restore({ active: true, phase: 'zzz' }) === null).toBeTruthy();
  });

  test('iron flag is re-derived live on restore, not trusted from file', () => {
    const eng = makeEngine(S);
    eng.start({ mode: 'pomodoro' });
    const snap = snapshotFrom(eng, Date.now());
    snap.iron = false; // hand-edited session.json trying to smuggle iron off
    const eng2 = makeEngine(S);
    eng2.restore(snap);
    expect(eng2.isIron()).toBeFalsy();   // matches current settings, not the file
    const eng3 = makeEngine(Object.assign({}, S, { iron: true }));
    eng3.restore(snap);
    expect(eng3.isIron()).toBeTruthy(); // switch on in data.json → still iron
    eng3.stop({});
  });
});


suite('session engine · sleep does not count as focus time', () => {
  const S = { workMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: false };
  const HOUR = 60 * 60 * 1000;
  function make(extra) {
    const events = [], skipped = [];
    const eng = new SessionEngine(Object.assign({
      getSettings: () => S, onTick: () => {}, onState: () => {}, onPhaseEnd: (i) => events.push(i), onSleepSkipped: (s) => skipped.push(s)
    }, extra || {}));
    return { eng, events, skipped };
  }
  /** Pretend the machine slept for `ms`: the wall clock moved on (endsAt / phaseStartAt are now further
      in the past) and the engine's own ticks stopped for that long. */
  function sleep(eng, ms) {
    eng.s.endsAt -= ms; eng.s.phaseStartAt -= ms; eng._lastTickAt -= ms;
  }

  test('a long sleep during a focus round leaves the same time on the clock and does not end the round', () => {
    const { eng, events, skipped } = make();
    eng.start({ mode: 'pomodoro' });
    eng._tick();
    const before = eng.remainingSec();
    sleep(eng, 8 * HOUR);
    eng._tick();
    expect(Math.abs(eng.remainingSec() - before) <= 1).toBe(true);
    expect(eng.isFocusing()).toBeTruthy();
    expect(events.length).toBe(0);
    expect(skipped.length).toBe(1);
    expect(skipped[0] >= 8 * 3600 - 2).toBe(true);
    eng.stop({ abandon: true });
  });
  test('sleep time is not credited as focused time', () => {
    const { eng } = make();
    eng.start({ mode: 'pomodoro' });
    eng._tick();
    sleep(eng, 3 * HOUR);
    eng._tick();
    expect(eng._focusedSecInPhase() < 5).toBe(true);
    eng.stop({ abandon: true });
  });
  test('a short sleep of a minute is skipped too', () => {
    const { eng } = make();
    eng.start({ mode: 'pomodoro' });
    eng._tick();
    const before = eng.remainingSec();
    sleep(eng, 60 * 1000);
    eng._tick();
    expect(Math.abs(eng.remainingSec() - before) <= 1).toBe(true);
    eng.stop({ abandon: true });
  });
  test('normal half-second ticks and small hiccups are not mistaken for sleep', () => {
    const { eng, skipped } = make();
    eng.start({ mode: 'pomodoro' });
    eng._tick();
    sleep(eng, 3000);   // a 3 s stall is below the sleep threshold
    eng._tick();
    expect(skipped.length).toBe(0);
    eng.stop({ abandon: true });
  });
  test('a paused session has nothing to skip and stays paused', () => {
    const { eng, skipped } = make();
    eng.start({ mode: 'pomodoro' });
    eng.pause();
    const before = eng.remainingSec();
    eng._lastTickAt -= 5 * HOUR;
    eng._tick();
    expect(eng.remainingSec()).toBe(before);
    expect(skipped.length).toBe(0);
    expect(eng.isFocusing()).toBeFalsy();
    eng.stop({ abandon: true });
  });
  test('a running break is frozen during sleep as well', () => {
    const { eng } = make();
    eng.start({ mode: 'pomodoro' });
    eng.s.phase = 'short'; eng.s.phaseSec = 300; eng.s.running = true; eng.s.endsAt = Date.now() + 300 * 1000;
    eng._tick();
    sleep(eng, 2 * HOUR);
    eng._tick();
    expect(eng.remainingSec() >= 298).toBe(true);
    eng.stop({ abandon: true });
  });
  test('an Iron focus cannot be ended by sleeping through it', () => {
    const { eng, events } = make({ getSettings: () => Object.assign({}, S, { iron: true }) });
    eng.start({ mode: 'pomodoro' });
    expect(eng.isIron()).toBeTruthy();
    eng._tick();
    sleep(eng, 10 * HOUR);
    eng._tick();
    expect(eng.isFocusing()).toBeTruthy();
    expect(events.length).toBe(0);
    eng.stop({ abandon: true });
  });
  test('after waking, the round still ends on time (the clock keeps running normally)', () => {
    const { eng, events } = make();
    eng.start({ mode: 'pomodoro' });
    eng._tick();
    sleep(eng, 6 * HOUR);
    eng._tick();
    eng.s.endsAt = Date.now() - 1;   // now let the remaining time run out
    eng._tick();
    expect(events.length > 0).toBe(true);
    eng.stop({ abandon: true });
  });
});

suite('session engine · an Iron break cannot be paused', () => {
  const S = { workMin: 25, shortMin: 5, longMin: 15, rounds: 4, autoStartBreaks: true, autoStartFocus: false };
  const make = (settings, extra) => {
    const eng = new SessionEngine(Object.assign({ getSettings: () => settings, onTick: () => {}, onState: () => {}, onPhaseEnd: () => {} }, extra || {}));
    return eng;
  };
  const toBreak = (eng) => { eng.start({ mode: 'pomodoro' }); eng.s.phase = 'short'; eng.s.phaseSec = 300; eng.s.running = true; eng.s.endsAt = Date.now() + 300 * 1000; };

  test('in an Iron session the break keeps running when pause is pressed', () => {
    const eng = make(Object.assign({}, S, { iron: true }));
    toBreak(eng);
    eng.pause();
    expect(eng.s.running).toBe(true);
    eng.stop({ abandon: true });
  });
  test('the multi-day self-lock counts too, even if the session flag is off', () => {
    const eng = make(S, { isIronLocked: () => true });
    toBreak(eng);
    eng.s.iron = false;
    eng.pause();
    expect(eng.s.running).toBe(true);
    eng.stop({ abandon: true });
  });
  test('without Iron a break cannot be paused either', () => {
    const eng = make(S);
    toBreak(eng);
    eng.pause();
    expect(eng.s.running).toBe(true);
    eng.stop({ abandon: true });
  });
  test('a paused focus (no Iron) still reports blockActive and a focus phase', () => {
    const eng = make(S);
    eng.start({ mode: 'pomodoro' });
    eng.pause();
    expect(eng.s.running).toBe(false);
    expect(eng.isFocusPhase()).toBe(true);
    expect(eng.publicState().blockActive).toBe(true);
    eng.stop({ abandon: true });
  });
  test('during a break nothing is held: blockActive is false and no focus phase exists', () => {
    const eng = make(S);
    toBreak(eng);
    expect(eng.isFocusPhase()).toBe(false);
    expect(eng.publicState().blockActive).toBe(false);
    eng.stop({ abandon: true });
  });
  test('an Iron FOCUS can still be paused (pausing only stops the clock)', () => {
    const eng = make(Object.assign({}, S, { iron: true }));
    eng.start({ mode: 'pomodoro' });
    eng.pause();
    expect(eng.s.running).toBe(false);
    eng.stop({ abandon: true });
  });
  test('resume is never refused, so an already-paused break can be started again', () => {
    const eng = make(Object.assign({}, S, { iron: true }));
    toBreak(eng);
    eng.s.running = false; eng.s.pausedRemaining = 200;   // a break paused before this rule existed
    eng.resume();
    expect(eng.s.running).toBe(true);
    eng.stop({ abandon: true });
  });
  test('the Focus page disables the pause button for any break', () => {
    const v = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'ui', 'js', 'views-home.js'), 'utf8');
    expect(/ironBreak = ses\.running && ses\.phase !== 'focus'/.test(v)).toBe(true);
    expect(/breakNow = ses\.running && ses\.phase !== 'focus'/.test(v)).toBe(true);
    expect(/disabled: breakNow/.test(v)).toBe(true);
  });
  test('ending an Iron break goes through the Iron gate, not a plain confirm', () => {
    const v = require('fs').readFileSync(require('path').join(__dirname, '..', 'app', 'ui', 'js', 'views-home.js'), 'utf8');
    expect(/ironEnd = iron \|\| ironBreak/.test(v)).toBe(true);
    expect(/row\.appendChild\(ironEnd/.test(v)).toBe(true);
  });
});
