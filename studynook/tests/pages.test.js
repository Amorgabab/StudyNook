'use strict';
/* The repo front page (README), the GitHub Pages site (docs/) and the license must stay consistent. */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(REPO, p));
const isRelative = (u) => u && !/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(u);
const stripHash = (u) => u.split('#')[0].split('?')[0];

suite('pages · README', () => {
  const md = read('README.md');
  test('every relative link and image exists', () => {
    const targets = [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).concat([...md.matchAll(/(?:src|srcset|href)="([^"]+)"/g)].map((m) => m[1]));
    const missing = [...new Set(targets.filter(isRelative).map(stripHash).filter(Boolean))].filter((p) => !exists(p));
    expect(missing).toEqual([]);
  });
  test('every image has alt text', () => {
    const imgs = [...md.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(imgs.length).toBeGreaterThan(5);
    expect(imgs.filter((i) => !/\balt="[^"]+"/.test(i))).toEqual([]);
  });
  test('documents the commands that exist in package.json', () => {
    const scripts = JSON.parse(read('studynook/package.json')).scripts;
    for (const s of ['start', 'test', 'lint', 'smoke', 'dist']) {
      expect(typeof scripts[s]).toBe('string');
      expect(md.includes('`npm ' + (s === 'start' ? 'start' : s === 'test' ? 'test' : 'run ' + s) + '`') || md.includes('npm run ' + s) || md.includes('npm ' + s)).toBe(true);
    }
  });
});

suite('pages · GitHub Pages site', () => {
  const html = read('docs/index.html');
  test('is served as-is (no Jekyll)', () => { expect(exists('docs/.nojekyll')).toBe(true); });
  test('every local asset it references exists', () => {
    const urls = [...html.matchAll(/(?:src|srcset|href)="([^"]+)"/g)].map((m) => m[1]).concat([...html.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]));
    const missing = [...new Set(urls.filter(isRelative).filter((u) => !u.startsWith('data:')).map(stripHash).filter(Boolean))].filter((p) => !exists('docs/' + p));
    expect(missing).toEqual([]);
  });
  test('has the essentials: title, description, language, skip link, one h1', () => {
    expect(/<html lang="en"/.test(html)).toBe(true);
    expect(/<title>[^<]{10,}<\/title>/.test(html)).toBe(true);
    expect(/<meta name="description" content="[^"]{40,}"/.test(html)).toBe(true);
    expect(/class="skip"/.test(html)).toBe(true);
    expect((html.match(/<h1\b/g) || []).length).toBe(1);
  });
  test('every image has alt text and dimensions (no layout shift)', () => {
    const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(imgs.length).toBeGreaterThan(5);
    expect(imgs.filter((i) => !/\balt="[^"]+"/.test(i) || !/\bwidth="\d+"/.test(i) || !/\bheight="\d+"/.test(i))).toEqual([]);
  });
  test('uses no external scripts, fonts or trackers', () => {
    expect(/<script\b/i.test(html)).toBe(false);
    expect(/(?:src|href)="https?:\/\/(?!github\.com\/Amorgabab\/StudyNook|amorgabab\.github\.io)/.test(html.replace(/<link rel="canonical"[^>]*>/, ''))).toBe(false);
  });
  test('screenshots are real PNGs of a sensible size', () => {
    const dir = path.join(REPO, 'docs', 'assets');
    const pngs = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));
    expect(pngs.length).toBeGreaterThan(6);
    for (const f of pngs) {
      const b = fs.readFileSync(path.join(dir, f));
      expect(b.slice(1, 4).toString()).toBe('PNG');
      expect(b.length < 400 * 1024).toBe(true);
    }
  });
});

suite('pages · license', () => {
  test('LICENSE exists, forbids redistribution and allows personal use', () => {
    const lic = read('LICENSE');
    expect(/NOT open-source/i.test(lic)).toBe(true);
    expect(/redistribute/i.test(lic)).toBe(true);
    expect(/personal use/i.test(lic)).toBe(true);
    expect(/Inter typeface/.test(lic) && /Lucide/.test(lic)).toBe(true);   // third-party notices stay
  });
  test('package.json points at the license file instead of claiming MIT', () => {
    const lic = JSON.parse(read('studynook/package.json')).license;
    expect(lic).toBe('SEE LICENSE IN ../LICENSE');
  });
  test('README and site do not claim an open-source license', () => {
    expect(/\bMIT License\b|Open source license/i.test(read('README.md').replace(/Electron \(MIT\)/, ''))).toBe(false);
  });
});
