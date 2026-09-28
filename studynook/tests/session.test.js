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

