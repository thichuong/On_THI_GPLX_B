import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

// Mock document
const docAttrs = {};
globalThis.document = {
  documentElement: {
    setAttribute(name, val) {
      docAttrs[name] = String(val);
    },
    getAttribute(name) {
      return docAttrs[name] || null;
    }
  },
  querySelector() {
    return null;
  }
};

// Mock window.matchMedia
let prefersDark = true;
globalThis.window = {
  matchMedia(query) {
    return {
      matches: prefersDark,
      addEventListener() {},
      removeEventListener() {}
    };
  }
};

import { StorageService } from '../src/services/storageService.js';
import { useTheme } from '../src/composables/useTheme.js';

test.beforeEach(() => {
  localStorage.clear();
  for (const k in docAttrs) delete docAttrs[k];
  prefersDark = true;
});

test('Theme - Default mode is "system" when user has not configured anything', () => {
  assert.equal(localStorage.getItem('theme'), null);
  assert.equal(localStorage.getItem('gplx_theme'), null);
  assert.equal(StorageService.getTheme(), 'system');
});

test('Theme - StorageService.setTheme updates both storage keys and retrieves correctly', () => {
  StorageService.setTheme('light');
  assert.equal(StorageService.getTheme(), 'light');
  assert.equal(localStorage.getItem('theme'), 'light');
  assert.equal(localStorage.getItem('gplx_theme'), 'light');

  StorageService.setTheme('dark');
  assert.equal(StorageService.getTheme(), 'dark');

  StorageService.setTheme('system');
  assert.equal(StorageService.getTheme(), 'system');
});

test('Theme - useTheme toggleTheme cycles: system -> light -> dark -> system', () => {
  const { theme, toggleTheme, applyTheme } = useTheme();

  applyTheme('system');
  assert.equal(theme.value, 'system');

  toggleTheme();
  assert.equal(theme.value, 'light');

  toggleTheme();
  assert.equal(theme.value, 'dark');

  toggleTheme();
  assert.equal(theme.value, 'system');
});

test('Theme - applyTheme updates documentElement attributes and resolved theme', () => {
  const { theme, resolvedTheme, applyTheme, themeIcon, themeLabel } = useTheme();

  prefersDark = true;
  applyTheme('system');
  assert.equal(theme.value, 'system');
  assert.equal(resolvedTheme.value, 'dark');
  assert.equal(themeIcon.value, '💻');
  assert.equal(themeLabel.value, 'Hệ thống');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(document.documentElement.getAttribute('data-theme-mode'), 'system');

  applyTheme('light');
  assert.equal(theme.value, 'light');
  assert.equal(resolvedTheme.value, 'light');
  assert.equal(themeIcon.value, '☀️');
  assert.equal(themeLabel.value, 'Sáng');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(document.documentElement.getAttribute('data-theme-mode'), 'light');

  applyTheme('dark');
  assert.equal(theme.value, 'dark');
  assert.equal(resolvedTheme.value, 'dark');
  assert.equal(themeIcon.value, '🌙');
  assert.equal(themeLabel.value, 'Tối');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(document.documentElement.getAttribute('data-theme-mode'), 'dark');
});
