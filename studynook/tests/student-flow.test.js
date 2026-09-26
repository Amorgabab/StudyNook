/* ============================================================
   THE STUDENT FLOW TEST 🎒
   ------------------------------------------------------------
   Simulates exactly what a student does during a study session
   in allowlist ("study mode") configuration:
     allowlist  = teacher site + youtube (lectures) + google (research)
     blocklist  = youtube.com/shorts  (the wander-hole)
   Walk: lecture → Shorts → google search → random article →
   teacher site → sneaky tiktok. Then the same walk on a BREAK
   (everything should unlock), then again in blocklist mode.
   This test is a scenario, not a feature list: the app does not
   revolve around these sites, they are just one realistic day.
   ============================================================ */
'use strict';
const R = require('../extension/rules.js');

const TEACHER = 'bassthalk.com';
const sites = {
  enabled: true,
  mode: 'allow',
  when: 'session',
  allow: [TEACHER, 'youtube.com', 'google.com'],
  block: ['youtube.com/shorts']
};
const FOCUS = true, BREAK = false;

suite('student flow · allowlist study mode (session running)', () => {
  test('1 · opens the lecture video → allowed', () => {
    expect(R.wouldBlock(sites, FOCUS, 'https://www.youtube.com/watch?v=lecture42')).toBeFalsy();
  });
  test('2 · wanders into YouTube Shorts → BLOCKED (path rule inside allowed domain)', () => {
    expect(R.wouldBlock(sites, FOCUS, 'https://www.youtube.com/shorts/abc123')).toBeTruthy();
  });
  test('2b · Shorts link with params also blocked', () => {
    expect(R.wouldBlock(sites, FOCUS, 'https://youtube.com/shorts/abc?feature=share')).toBeTruthy();
  });
  test('3 · google.com and searches → allowed', () => {
    expect(R.wouldBlock(sites, FOCUS, 'https://www.google.com')).toBeFalsy();
    expect(R.wouldBlock(sites, FOCUS, 'https://www.google.com/search?q=mitochondria+definition')).toBeFalsy();
  });
  test('4 · clicks a search-result article on another domain → BLOCKED', () => {
    expect(R.wouldBlock(sites, FOCUS, 'https://www.britannica.com/science/mitochondrion')).toBeTruthy();
    expect(R.wouldBlock(sites, FOCUS, 'https://news.example.org/science/123')).toBeTruthy();
  });
  test('5 · teacher website (any page) → allowed', () => {
    expect(R.wouldBlock(sites, FOCUS, 'https://' + TEACHER + '/assignments')).toBeFalsy();
    expect(R.wouldBlock(sites, FOCUS, 'https://www.' + TEACHER + '/')).toBeFalsy();
  });
  test('6 · sneaky tiktok → BLOCKED (not on allowlist)', () => {
    expect(R.wouldBlock(sites, FOCUS, 'https://www.tiktok.com/foryou')).toBeTruthy();
  });
});

suite('student flow · break time unlocks everything again', () => {
  test('Shorts, articles and tiktok all load on a break', () => {
    expect(R.wouldBlock(sites, BREAK, 'https://www.youtube.com/shorts/abc')).toBeFalsy();
    expect(R.wouldBlock(sites, BREAK, 'https://www.britannica.com/x')).toBeFalsy();
    expect(R.wouldBlock(sites, BREAK, 'https://www.tiktok.com/foryou')).toBeFalsy();
  });
});

suite('student flow · blocklist mode (only named villains)', () => {
  const b = {
    enabled: true, mode: 'block', when: 'session',
    block: ['youtube.com/shorts', 'tiktok.com'],
    allow: []
  };
  test('lecture, search, article, teacher → all allowed', () => {
    expect(R.wouldBlock(b, FOCUS, 'https://www.youtube.com/watch?v=1')).toBeFalsy();
    expect(R.wouldBlock(b, FOCUS, 'https://www.google.com/search?q=hi')).toBeFalsy();
    expect(R.wouldBlock(b, FOCUS, 'https://www.britannica.com/x')).toBeFalsy();
    expect(R.wouldBlock(b, FOCUS, 'https://' + TEACHER + '/')).toBeFalsy();
  });
  test('Shorts + tiktok → BLOCKED', () => {
    expect(R.wouldBlock(b, FOCUS, 'https://www.youtube.com/shorts/x')).toBeTruthy();
    expect(R.wouldBlock(b, FOCUS, 'https://www.tiktok.com/foryou')).toBeTruthy();
  });
});

suite('student flow · rules actually generated for Chrome', () => {
  test('allow-mode walk produces catch-all + shorts hole', () => {
    const rules = R.buildRules(sites, FOCUS);
    const catchAll = rules.find((r) => r.condition.regexFilter);
    const shorts = rules.find((r) => r.condition.urlFilter === '||youtube.com/shorts');
    expect(!!catchAll).toBeTruthy();
    expect(!!shorts).toBeTruthy();
    expect(shorts.priority).toBeGreaterThan(catchAll.priority);
    expect(catchAll.condition.excludedRequestDomains).toContain(TEACHER);
  });
  test('break → zero rules (nothing redirected)', () => {
    expect(R.buildRules(sites, BREAK).length).toBe(0);
  });
});
