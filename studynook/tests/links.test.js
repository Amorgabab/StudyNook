'use strict';
const L = require('../app/shared/links.js');

suite('links · study source urls', () => {
  test('keeps full https urls', () => expect(L.normalize('https://www.youtube.com/watch?v=xENH7mCZuJ0')).toBe('https://www.youtube.com/watch?v=xENH7mCZuJ0'));
  test('keeps doi urls', () => expect(L.normalize('https://www.science.org/doi/10.1126/sciimmunol.aeg5223')).toBe('https://www.science.org/doi/10.1126/sciimmunol.aeg5223'));
  test('adds https when scheme missing', () => expect(L.normalize('www.youtube.com/watch?v=1')).toBe('https://www.youtube.com/watch?v=1'));
  test('rejects junk', () => { expect(L.normalize('')).toBe(''); expect(L.normalize('   ')).toBe(''); expect(L.normalize('not a url')).toBe(''); });
  test('rejects non-http schemes', () => { expect(L.normalize('file:///c:/x')).toBe(''); expect(L.normalize('javascript:alert(1)')).toBe(''); });
  test('short() trims scheme and length', () => {
    expect(L.short('https://www.youtube.com/watch?v=xENH7mCZuJ0')).toBe('youtube.com/watch?v=xENH7mCZuJ0');
    expect(L.short('https://www.science.org/doi/10.1126/sciimmunol.aeg5223', 20)).toBe('science.org/doi/10.…'.slice(0, 20));
  });
});
