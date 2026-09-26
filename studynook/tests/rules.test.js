'use strict';
const R = require('../extension/rules.js');

const SITES = (over) => Object.assign({
  enabled: true, mode: 'block', when: 'session',
  block: ['youtube.com', 'www.reddit.com'], allow: ['google.com', 'docs.google.com']
}, over || {});

suite('rules · exact-page allow (allow mode only)', () => {
  test('block mode: allow list (incl. full urls) is ignored', () => {
    const s = { enabled: true, mode: 'block', when: 'session', block: ['youtube.com'], allow: ['youtube.com/watch?v=lec1'] };
    expect(R.wouldBlock(s, true, 'https://www.youtube.com/watch?v=lec1')).toBeTruthy();
  });
  test('allow mode: pasted full url opens, rest of site naps', () => {
    const s = { enabled: true, mode: 'allow', when: 'session', block: [], allow: ['youtube.com/watch?v=lec1'] };
    expect(R.wouldBlock(s, true, 'https://www.youtube.com/watch?v=lec1')).toBeFalsy();
    expect(R.wouldBlock(s, true, 'https://www.youtube.com/feed')).toBeTruthy();
  });
});

suite('rules · lecture-lock (pin exact page in allow mode)', () => {
  const lock = { enabled: true, mode: 'allow', when: 'session', allow: ['youtube.com/watch?v=lec123', 'google.com'], block: ['youtube.com/shorts'] };
  test('pinned lecture allowed', () => expect(R.wouldBlock(lock, true, 'https://www.youtube.com/watch?v=lec123')).toBeFalsy());
  test('pinned lecture with extra params allowed (prefix)', () => expect(R.wouldBlock(lock, true, 'https://www.youtube.com/watch?v=lec123&t=42')).toBeFalsy());
  test('wandering to another video is blocked', () => expect(R.wouldBlock(lock, true, 'https://www.youtube.com/watch?v=other99')).toBeTruthy());
  test('shorts blocked', () => expect(R.wouldBlock(lock, true, 'https://www.youtube.com/shorts/x')).toBeTruthy());
  test('domain-allow still works (google search)', () => expect(R.wouldBlock(lock, true, 'https://www.google.com/search?q=x')).toBeFalsy());
  test('unknown domain blocked', () => expect(R.wouldBlock(lock, true, 'https://tiktok.com/x')).toBeTruthy());
  test('buildRules emits allow-action pin rule at priority 3', () => {
    const rules = R.buildRules(lock, true);
    const pin = rules.find((r) => r.action.type === 'allow');
    expect(pin.priority).toBe(3);
    expect(pin.condition.urlFilter).toBe('||youtube.com/watch?v=lec123');
  });
});

suite('rules · normalize & parse', () => {
  test('strips scheme/www/path', () => {
    expect(R.normalizeDomain('https://www.YouTube.com/watch?v=1')).toBe('youtube.com');
    expect(R.normalizeDomain('reddit.com/')).toBe('reddit.com');
  });
  test('keeps path prefix in parseRule (query preserved for pins)', () => {
    const r = R.parseRule('YouTube.com/shorts/?x=1');
    expect(r.domain).toBe('youtube.com');
    expect(r.path).toBe('/shorts/?x=1');
    const r2 = R.parseRule('youtube.com/shorts/');
    expect(r2.path).toBe('/shorts');
    const r3 = R.parseRule('youtube.com/watch?v=Lec');
    expect(r3.path).toBe('/watch?v=lec');
  });
  test('normalizeEntry keeps paths, strips junk', () => {
    expect(R.normalizeEntry('https://www.youtube.com/shorts/')).toBe('youtube.com/shorts');
    expect(R.normalizeEntry('Reddit.com')).toBe('reddit.com');
    expect(R.normalizeEntry('   ')).toBe('');
  });
});

suite('rules · activity window', () => {
  test('session mode blocks only while focusing', () => {
    expect(R.isBlockingActive(SITES(), false)).toBeFalsy();
    expect(R.isBlockingActive(SITES(), true)).toBeTruthy();
  });
  test('always mode blocks regardless', () => {
    expect(R.isBlockingActive(SITES({ when: 'always' }), false)).toBeTruthy();
  });
  test('disabled never blocks', () => {
    expect(R.isBlockingActive(SITES({ enabled: false, when: 'always' }), true)).toBeFalsy();
  });
});

suite('rules · DNR building (block mode)', () => {
  test('one rule per domain, VALID redirect key extensionPath', () => {
    const rules = R.buildRules(SITES(), true);
    const dom = rules.filter((r) => r.condition.requestDomains);
    expect(dom.length).toBe(2);
    expect(dom[0].action.redirect.extensionPath).toBe('/blocked/blocked.html');
    expect(dom[0].action.redirect.extensionPage).toBe(undefined);
    expect(dom[0].condition.requestDomains).toEqual(['youtube.com']);
    expect(dom[1].condition.requestDomains).toEqual(['reddit.com']); // www stripped
    expect(dom[0].condition.resourceTypes).toEqual(['main_frame', 'sub_frame']);
  });
  test('path entries become urlFilter rules', () => {
    const rules = R.buildRules(SITES({ block: ['youtube.com/feed'] }), true);
    const feed = rules.find((r) => r.condition.urlFilter === '||youtube.com/feed');
    expect(feed.priority).toBe(2);
    expect(feed.condition.resourceTypes).toEqual(['main_frame', 'sub_frame']);
  });
  test('idle in session mode → zero rules', () => {
    expect(R.buildRules(SITES(), false).length).toBe(0);
  });
});

suite('rules · DNR building (allow mode)', () => {
  test('catch-all with exclusions incl. localhost, priority 1', () => {
    const rules = R.buildRules(SITES({ mode: 'allow' }), true);
    const catchAll = rules.find((r) => r.condition.regexFilter);
    expect(catchAll.priority).toBe(1);
    const c = catchAll.condition;
    expect(c.regexFilter).toBe('^https?://');
    expect(c.excludedRequestDomains).toContain('localhost');
    expect(c.excludedRequestDomains).toContain('google.com');
    expect(c.excludedRequestDomains).toContain('docs.google.com');
  });
  test('path-blocks inside allowed domains ride along at priority 2', () => {
    const rules = R.buildRules(SITES({ mode: 'allow', block: ['youtube.com/feed'] }), true);
    const pathRule = rules.find((r) => r.condition.urlFilter === '||youtube.com/feed');
    expect(pathRule.priority).toBe(2);
    expect(pathRule.action.redirect.extensionPath).toBe('/blocked/blocked.html');
  });
});

suite('rules · wouldBlock', () => {
  test('subdomains of blocked domains blocked', () => {
    expect(R.wouldBlock(SITES(), true, 'https://m.youtube.com/watch')).toBeTruthy();
  });
  test('allowed site passes in block mode', () => {
    expect(R.wouldBlock(SITES(), true, 'https://wikipedia.org/wiki/Focus')).toBeFalsy();
  });
  test('allow mode blocks unknown, allows listed', () => {
    const s = SITES({ mode: 'allow' });
    expect(R.wouldBlock(s, true, 'https://twitter.com')).toBeTruthy();
    expect(R.wouldBlock(s, true, 'https://docs.google.com/x')).toBeFalsy();
    expect(R.wouldBlock(s, true, 'http://localhost:3000')).toBeFalsy();
  });
  test('path rule blocks inside an allowed domain', () => {
    const s = SITES({ mode: 'allow', allow: ['youtube.com'], block: ['youtube.com/shorts'] });
    expect(R.wouldBlock(s, true, 'https://www.youtube.com/watch?v=lec1')).toBeFalsy();
    expect(R.wouldBlock(s, true, 'https://www.youtube.com/shorts/xyz')).toBeTruthy();
  });
  test('chrome:// and extension pages untouched', () => {
    expect(R.wouldBlock(SITES(), true, 'chrome://settings')).toBeFalsy();
    expect(R.wouldBlock(SITES(), true, 'https://')).toBeFalsy();
  });
});
