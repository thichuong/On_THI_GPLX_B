import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node.js environment
globalThis.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

import { QuestionPalette } from '../src/components/QuestionPalette.js';

test('QuestionPalette - Render highlights current question with class and aria-current', () => {
  const mockQuestions = [
    { id: 1, correct_option: 1, is_critical: false },
    { id: 2, correct_option: 2, is_critical: true },
    { id: 3, correct_option: 3, is_critical: false }
  ];

  const html = QuestionPalette.render({
    questions: mockQuestions,
    currentIndex: 1,
    answers: {},
    isSubmitted: false,
    title: 'Danh sách 3 câu'
  });

  // Verify second question (index 1) has current class and aria-current="true"
  assert.ok(html.includes('data-palette-index="1"'), 'Must render button with index 1');
  assert.ok(html.includes('class="palette-btn current critical-indicator" data-palette-index="1"'), 'Question 2 must have current class');
  assert.ok(html.includes('aria-current="true"'), 'Question 2 must have aria-current="true"');

  // Verify first and third questions do not have current class
  assert.ok(!html.includes('class="palette-btn current" data-palette-index="0"'), 'Question 1 must not be current');
  assert.ok(!html.includes('class="palette-btn current" data-palette-index="2"'), 'Question 3 must not be current');
});

test('QuestionPalette - updateCurrentIndex switches current class cleanly in DOM', () => {
  // Simple DOM element mock
  class MockElement {
    constructor(tagName, attrs = {}) {
      this.tagName = tagName;
      this.attrs = { ...attrs };
      const set = new Set((attrs.class || '').split(' ').filter(Boolean));
      this.classList = {
        _set: set,
        add(c) { set.add(c); },
        remove(c) { set.delete(c); },
        has(c) { return set.has(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (set.has(c)) set.delete(c); else set.add(c);
          } else if (force) {
            set.add(c);
          } else {
            set.delete(c);
          }
        }
      };
      this.children = [];
    }
    getAttribute(name) { return this.attrs[name]; }
    setAttribute(name, val) { this.attrs[name] = String(val); }
    removeAttribute(name) { delete this.attrs[name]; }
    querySelector(sel) {
      if (sel.includes('.palette-btn.current')) {
        for (const child of this.children) {
          if (child.classList.has('current')) return child;
        }
      }
      const match = sel.match(/data-palette-index="(\d+)"/);
      if (match) {
        const idx = match[1];
        return this.children.find(c => c.attrs['data-palette-index'] === idx) || null;
      }
      return null;
    }
    querySelectorAll(sel) {
      if (sel.includes('.palette-btn.current')) {
        return this.children.filter(c => c.classList.has('current'));
      }
      return [];
    }
  }

  const container = new MockElement('div');
  const btn0 = new MockElement('button', { class: 'palette-btn current', 'data-palette-index': '0' });
  const btn1 = new MockElement('button', { class: 'palette-btn', 'data-palette-index': '1' });
  const btn2 = new MockElement('button', { class: 'palette-btn', 'data-palette-index': '2' });
  container.children = [btn0, btn1, btn2];

  assert.ok(btn0.classList.has('current'), 'btn0 starts as current');
  assert.ok(!btn1.classList.has('current'), 'btn1 starts not current');

  // Update current to index 1
  QuestionPalette.updateCurrentIndex(container, 1);

  assert.ok(!btn0.classList.has('current'), 'btn0 should no longer have current');
  assert.ok(btn1.classList.has('current'), 'btn1 should have current');
  assert.equal(btn1.getAttribute('aria-current'), 'true');
});
