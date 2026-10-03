/**
 * DOM Utility Helpers
 */

/**
 * Escape HTML characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Shortcut to query an element by selector.
 * @param {string} selector
 * @param {Element|Document} [context=document]
 * @returns {Element|null}
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Shortcut to query all elements by selector.
 * @param {string} selector
 * @param {Element|Document} [context=document]
 * @returns {NodeListOf<Element>}
 */
export function $$(selector, context = document) {
  return context.querySelectorAll(selector);
}

/**
 * Smoothly scrolls the viewport to the question card, taking into account
 * the sticky app header height.
 * Supports legacy boolean param or options object.
 * @param {boolean|Object} [options=true]
 */
export function scrollToQuestion(options = true) {
  if (typeof window === 'undefined') return;
  const target = document.getElementById('question-card-wrapper') || document.querySelector('.question-card');
  if (!target) return;

  const isSmooth = typeof options === 'boolean' ? options : (options.smooth !== false);
  const force = typeof options === 'object' ? Boolean(options.force) : false;

  const header = document.querySelector('.app-header');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const rect = target.getBoundingClientRect();

  // If not forced, only scroll if top is obscured by header or too far below viewport
  if (!force) {
    const isVisibleInComfortZone = rect.top >= (headerHeight + 5) && rect.top <= (window.innerHeight * 0.5);
    if (isVisibleInComfortZone) {
      return; // Already nicely in view, avoid jarring scroll jump
    }
  }

  const targetTop = rect.top + window.pageYOffset;
  const offsetPosition = Math.max(0, targetTop - headerHeight - 12);

  window.scrollTo({
    top: offsetPosition,
    behavior: isSmooth ? 'smooth' : 'instant'
  });
}

/**
 * Execute an action while guaranteeing window and element scroll positions are preserved.
 * @param {Function} action
 * @param {string|Element} [elementSelector]
 */
export function preserveScroll(action, elementSelector = null) {
  if (typeof window === 'undefined') {
    return action();
  }

  const savedWindowY = window.pageYOffset || document.documentElement.scrollTop;
  let elem = null;
  let savedElemScroll = 0;

  if (elementSelector) {
    elem = typeof elementSelector === 'string' ? document.querySelector(elementSelector) : elementSelector;
    if (elem) {
      savedElemScroll = elem.scrollTop;
    }
  }

  const result = action();

  // Restore immediately
  window.scrollTo({ top: savedWindowY, behavior: 'instant' });
  if (elem) {
    // If element might have been recreated, re-query it
    const restoredElem = typeof elementSelector === 'string' ? document.querySelector(elementSelector) : elem;
    if (restoredElem) {
      restoredElem.scrollTop = savedElemScroll;
    }
  }

  return result;
}


