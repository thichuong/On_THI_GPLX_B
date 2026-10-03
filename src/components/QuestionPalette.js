/**
 * Question Palette Component: Renders question number grid for navigation and status overview.
 */
import { StorageService } from '../services/storageService.js';
import { $ } from '../utils/dom.js';

export class QuestionPalette {
  /**
   * Render question palette HTML
   * @param {Object} options
   * @param {Array} options.questions
   * @param {number} options.currentIndex
   * @param {Object} options.answers Map of { [questionId]: selectedOption }
   * @param {boolean} [options.isSubmitted=false]
   * @param {boolean} [options.isPractice=false]
   * @param {boolean} [options.isInstantFeedback=false]
   * @param {string} [options.title='Danh sách câu']
   * @returns {string} HTML string
   */
  static render({
    questions = [],
    currentIndex = 0,
    answers = {},
    isSubmitted = false,
    isPractice = false,
    isInstantFeedback = false,
    title = 'Danh sách câu'
  }) {
    const total = questions.length;
    let answeredCount = 0;
    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach(q => {
      const ans = answers[q.id];
      if (ans !== undefined && ans !== null) {
        answeredCount++;
        if (Number(ans) === Number(q.correct_option)) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    });

    const isLargeGrid = total > 30;

    return `
      <div class="sidebar-card">
        <div class="palette-header">
          <span class="palette-title">${title} (${total})</span>
          <span class="palette-stats">
            Đã làm: ${answeredCount}/${total}
            ${(isPractice || isInstantFeedback) && answeredCount > 0 ? `<br><span style="color: var(--success); font-weight: 700;">${correctCount} Đúng</span> • <span style="color: var(--danger); font-weight: 700;">${wrongCount} Sai</span>` : ''}
          </span>
        </div>

        <div class="palette-grid ${isLargeGrid ? 'palette-grid-50' : ''}">
          ${questions.map((q, idx) => {
            const ans = answers[q.id];
            const isCurrent = Number(idx) === Number(currentIndex);
            const isAnswered = ans !== undefined && ans !== null;
            const isBm = StorageService.isBookmarked(q.id);

            let cls = 'palette-btn';
            if (isCurrent) cls += ' current';
            if (isAnswered) cls += ' answered';
            if (isBm) cls += ' bookmarked';
            if (q.is_critical) cls += ' critical-indicator';

            if (isSubmitted) {
              const isCorrect = Number(ans) === Number(q.correct_option);
              if (isCorrect) {
                cls += ' correct-mark';
              } else if (q.is_critical) {
                cls += ' critical-failed-mark';
              } else {
                cls += ' incorrect-mark';
              }
            } else if ((isPractice || isInstantFeedback) && isAnswered) {
              const isCorrect = Number(ans) === Number(q.correct_option);
              if (isCorrect) {
                cls += ' correct-mark';
              } else if (q.is_critical) {
                cls += ' critical-failed-mark';
              } else {
                cls += ' incorrect-mark';
              }
            }

            return `
              <button class="${cls}" data-palette-index="${idx}" aria-label="Câu ${idx + 1}" ${isCurrent ? 'aria-current="true"' : ''}>
                ${idx + 1}
              </button>
            `;
          }).join('')}
        </div>

        <div class="palette-legend">
          ${(isPractice || isInstantFeedback) ? `
            <div class="legend-item">
              <span class="legend-dot" style="background: var(--success); border-color: var(--success);"></span>
              <span>Đúng (${correctCount})</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot" style="background: var(--danger); border-color: var(--danger);"></span>
              <span>Sai (${wrongCount})</span>
            </div>
          ` : `
            <div class="legend-item">
              <span class="legend-dot unanswered"></span>
              <span>Chưa làm</span>
            </div>
            <div class="legend-item">
              <span class="legend-dot answered"></span>
              <span>Đã chọn</span>
            </div>
          `}
          <div class="legend-item">
            <span class="legend-dot critical"></span>
            <span>Câu liệt</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot bookmarked"></span>
            <span>Đã lưu ★</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind click event on palette buttons
   * @param {HTMLElement} container
   * @param {Function} onSelect Callback with question index
   */
  static bindEvents(container, onSelect) {
    if (!container) return;
    const buttons = container.querySelectorAll('.palette-btn[data-palette-index]');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const index = Number(btn.dataset.paletteIndex);
        if (typeof onSelect === 'function') {
          onSelect(index);
        }
      });
    });
  }

  /**
   * Helper to preserve scroll position across re-renders
   * @param {string} [selector='.palette-grid']
   * @returns {number|null}
   */
  static preserveScroll(selector = '.palette-grid') {
    const el = $(selector);
    return el ? el.scrollTop : null;
  }

  /**
   * Helper to restore scroll position and keep current button in view
   * @param {number|null} savedScrollTop
   * @param {string} [gridSelector='.palette-grid']
   * @param {string} [currentBtnSelector='.palette-btn.current']
   */
  static restoreScroll(savedScrollTop, gridSelector = '.palette-grid', currentBtnSelector = '.palette-btn.current') {
    if (typeof document === 'undefined') return;
    const grid = $(gridSelector);
    if (!grid) return;

    if (savedScrollTop !== null) {
      grid.scrollTop = savedScrollTop;
    }

    const currentBtn = $(currentBtnSelector, grid);
    if (currentBtn) {
      const btnRect = currentBtn.getBoundingClientRect();
      const containerRect = grid.getBoundingClientRect();

      if (btnRect.top < containerRect.top) {
        grid.scrollTop -= (containerRect.top - btnRect.top + 8);
      } else if (btnRect.bottom > containerRect.bottom) {
        grid.scrollTop += (btnRect.bottom - containerRect.bottom + 8);
      }
    }
  }

  /**
   * Update current question indicator on palette in-place
   * @param {HTMLElement} container
   * @param {number} newIndex
   */
  static updateCurrentIndex(container, newIndex) {
    if (!container) return;
    const targetIdx = Number(newIndex);

    // Remove current from ALL existing buttons in container
    const oldCurrents = container.querySelectorAll('.palette-btn.current, .palette-btn[aria-current="true"]');
    oldCurrents.forEach(btn => {
      btn.classList.remove('current');
      btn.removeAttribute('aria-current');
    });

    // Add current and aria-current to target button
    const newCurrent = container.querySelector(`.palette-btn[data-palette-index="${targetIdx}"]`);
    if (newCurrent) {
      newCurrent.classList.add('current');
      newCurrent.setAttribute('aria-current', 'true');
      QuestionPalette.restoreScroll(null, '.palette-grid', `.palette-btn[data-palette-index="${targetIdx}"]`);
    }
  }

  /**
   * Update button answer / bookmark state in-place
   * @param {HTMLElement} container
   * @param {number} index
   * @param {Object} state
   */
  static updateButtonState(container, index, {
    isAnswered = undefined,
    isCorrect = undefined,
    isCriticalFail = undefined,
    isBookmarked = undefined
  } = {}) {
    if (!container) return;
    const targetIdx = Number(index);
    const btn = container.querySelector(`.palette-btn[data-palette-index="${targetIdx}"]`);
    if (!btn) return;

    if (isAnswered !== undefined) {
      btn.classList.toggle('answered', Boolean(isAnswered));
    }
    if (isBookmarked !== undefined) {
      btn.classList.toggle('bookmarked', Boolean(isBookmarked));
    }
    if (isCorrect !== undefined) {
      btn.classList.toggle('correct-mark', Boolean(isCorrect));
      if (isCorrect) {
        btn.classList.remove('incorrect-mark', 'critical-failed-mark');
      }
    }
    if (isCorrect === false) {
      if (isCriticalFail) {
        btn.classList.add('critical-failed-mark');
        btn.classList.remove('correct-mark', 'incorrect-mark');
      } else {
        btn.classList.add('incorrect-mark');
        btn.classList.remove('correct-mark', 'critical-failed-mark');
      }
    } else if (isCorrect === undefined && isAnswered === false) {
      btn.classList.remove('correct-mark', 'incorrect-mark', 'critical-failed-mark');
    }
  }

  /**
   * Update palette header stats in-place
   * @param {HTMLElement} container
   * @param {Object} options
   */
  static updateStats(container, { answeredCount, total, isInstantOrPractice = false, correctCount = 0, wrongCount = 0 }) {
    if (!container) return;
    const statsEl = container.querySelector('.palette-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        Đã làm: ${answeredCount}/${total}
        ${isInstantOrPractice && answeredCount > 0 ? `<br><span style="color: var(--success); font-weight: 700;">${correctCount} Đúng</span> • <span style="color: var(--danger); font-weight: 700;">${wrongCount} Sai</span>` : ''}
      `;
    }
  }
}

