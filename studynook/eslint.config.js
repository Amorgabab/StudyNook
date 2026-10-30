/* StudyNook · eslint.config.js — small ruleset: catch real mistakes, not style.
   Run with `npm run lint`. Files are grouped by where they run so that
   `no-undef` knows which globals exist (Node, browser, or the extension). */
'use strict';
const js = require('@eslint/js');
const globals = require('globals');

const shared = {
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  'no-undef': 'error',
  'no-dupe-keys': 'error',
  'no-unreachable': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }]
};

module.exports = [
  { ignores: ['node_modules/**', 'dist-installer/**', 'data/**', 'app/ui/fonts/**', 'extension/fonts/**', 'app/shared/icons.js', 'extension/icons.js'] },
  js.configs.recommended,
  // Electron main process, tools and tests: Node (CommonJS)
  { files: ['app/main/**/*.js', 'build/**/*.js', 'tools/**/*.js', 'tests/**/*.js', 'eslint.config.js'], languageOptions: { sourceType: 'commonjs', globals: { ...globals.node, test: 'readonly', suite: 'readonly', expect: 'readonly' } }, rules: shared },
  // Pure modules shared by main and the windows: UMD (Node + browser)
  { files: ['app/shared/**/*.js'], languageOptions: { sourceType: 'script', globals: { ...globals.node, ...globals.browser } }, rules: shared },
  // Window scripts: browser plus the preload bridge and our shared globals
  {
    files: ['app/ui/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser, nook: 'readonly', t: 'writable', N: 'writable', App: 'writable', Views: 'writable', Mochi: 'writable', Audio2: 'writable',
        NookI18n: 'readonly', NookPrefs: 'readonly', NookIcons: 'readonly', NookProgress: 'readonly', NookCatalog: 'readonly', NookIron: 'readonly',
        NookRules: 'readonly', NookQuotes: 'readonly', NookHelp: 'writable', NookLang: 'writable'
      }
    },
    rules: shared
  },
  // Browser extension: service worker, popup and blocked page
  {
    files: ['extension/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...globals.serviceworker, chrome: 'readonly', importScripts: 'readonly', module: 'readonly', NookIcons: 'readonly', NookExtI18n: 'writable', NookRules: 'writable', NookBlockLabel: 'readonly' } },
    rules: shared
  }
];
