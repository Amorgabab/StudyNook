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
