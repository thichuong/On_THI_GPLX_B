import test from 'node:test';
import assert from 'node:assert/strict';

// Mock browser globals
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

class MockElement {
  constructor(tag = 'div', attributes = {}) {
    this.tagName = tag.toUpperCase();
    const set = new Set();
    this.classList = {
      contains: (c) => set.has(c),
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      toggle: (c, force) => {
        if (force === undefined) {
          if (set.has(c)) set.delete(c);
          else set.add(c);
        } else if (force) {
          set.add(c);
        } else {
          set.delete(c);
        }
      }
    };
    this.attributes = { ...attributes };
    this.textContent = '';
    this.listeners = {};
    this.dataset = {};
    this.style = {};
  }

  getAttribute(name) { return this.attributes[name] || null; }
  setAttribute(name, val) { this.attributes[name] = String(val); }
  removeAttribute(name) { delete this.attributes[name]; }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  dispatchEvent(event) {
    const list = this.listeners[event.type || event] || [];
    list.forEach(fn => fn(event));
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }

  scrollIntoView() {}
}

const mockDoc = {
  elements: {},
  listeners: {},
  documentElement: new MockElement('html'),
  body: new MockElement('body'),
  querySelector(sel) {
    return this.elements[sel] || null;
  },
  querySelectorAll(sel) {
    if (sel === '.tab-btn') {
      return this.elements['.tab-btn'] || [];
    }
    if (sel === '.mobile-mode-card') {
      return this.elements['.mobile-mode-card'] || [];
    }
    return [];
  },
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  },
  dispatchEvent(event) {
    const list = this.listeners[event.type || event] || [];
    list.forEach(fn => fn(event));
  }
};

globalThis.document = mockDoc;

import { Header, MODE_CONFIGS } from '../src/components/Header.js';

test('MODE_CONFIGS has all 7 study/exam modes with icons', () => {
  const modes = ['exam', 'quick-exam', 'critical', 'chapter', 'all', 'mistakes', 'bookmarks'];
  modes.forEach(mode => {
    assert.ok(MODE_CONFIGS[mode], `Mode config for ${mode} must exist`);
    assert.ok(MODE_CONFIGS[mode].icon, `Mode ${mode} must have an icon`);
    assert.ok(MODE_CONFIGS[mode].shortTitle, `Mode ${mode} must have a shortTitle`);
  });
});

test('Header - Mobile Bottom Sheet toggle and selection workflow', () => {
  // Setup mock DOM elements
  const mobileMenuBtn = new MockElement('button');
  const mobileCurrentIcon = new MockElement('span');
  const mobileCurrentTitle = new MockElement('span');
  const mobileModeSheet = new MockElement('div');
  const closeMobileSheetBtn = new MockElement('button');

  const tabBtnExam = new MockElement('button');
  tabBtnExam.dataset.mode = 'exam';
  const tabBtnQuick = new MockElement('button');
  tabBtnQuick.dataset.mode = 'quick-exam';

  const cardExam = new MockElement('button');
  cardExam.dataset.mode = 'exam';
  const cardQuick = new MockElement('button');
  cardQuick.dataset.mode = 'quick-exam';

  mockDoc.elements = {
    '.app-header': new MockElement('header'),
    '#theme-toggle-btn': new MockElement('button'),
    '#theme-icon': new MockElement('span'),
    '#mobile-menu-btn': mobileMenuBtn,
    '#mobile-current-icon': mobileCurrentIcon,
    '#mobile-current-title': mobileCurrentTitle,
    '#mobile-mode-sheet': mobileModeSheet,
    '#close-mobile-sheet-btn': closeMobileSheetBtn,
    '.tab-btn': [tabBtnExam, tabBtnQuick],
    '.mobile-mode-card': [cardExam, cardQuick]
  };

  let chosenMode = null;
  const headerInstance = new Header();
  headerInstance.init({
    onModeChange: (mode) => { chosenMode = mode; }
  });

  // 1. Initial State: Sheet is closed
  assert.equal(headerInstance.isMobileSheetOpen(), false);

  // 2. Click mobileMenuBtn opens sheet
  mobileMenuBtn.click();
  assert.equal(headerInstance.isMobileSheetOpen(), true);
  assert.equal(mobileModeSheet.classList.contains('show'), true);
  assert.equal(mobileMenuBtn.getAttribute('aria-expanded'), 'true');
  assert.equal(mockDoc.body.style.overflow, 'hidden');

  // 3. Click close button closes sheet
  closeMobileSheetBtn.click();
  assert.equal(headerInstance.isMobileSheetOpen(), false);
  assert.equal(mobileModeSheet.classList.contains('show'), false);
  assert.equal(mobileMenuBtn.getAttribute('aria-expanded'), 'false');
  assert.equal(mockDoc.body.style.overflow, '');

  // 4. Click mobile menu again, then click a mode card
  mobileMenuBtn.click();
  assert.equal(headerInstance.isMobileSheetOpen(), true);

  cardQuick.click();
  assert.equal(chosenMode, 'quick-exam');
  assert.equal(headerInstance.isMobileSheetOpen(), false, 'Sheet must close after selecting mode');

  // 5. Calling setActiveTab updates active states and mobile menu button display
  headerInstance.setActiveTab('quick-exam');
  assert.equal(tabBtnQuick.classList.contains('active'), true);
  assert.equal(tabBtnExam.classList.contains('active'), false);
  assert.equal(cardQuick.classList.contains('active'), true);
  assert.equal(cardExam.classList.contains('active'), false);

  assert.equal(mobileCurrentIcon.textContent, '⚡');
  assert.equal(mobileCurrentTitle.textContent, 'Thi Nhanh (20 Câu)');
});
