/**
 * Practice View: Manages practice modes (Critical 60, Mistakes, Bookmarks)
 */
import { BaseView } from './BaseView.js';
import { store } from '../core/store.js';
import { questionService } from '../services/questionService.js';
import { StorageService } from '../services/storageService.js';
import { QuestionCard } from '../components/QuestionCard.js';
import { QuestionPalette } from '../components/QuestionPalette.js';
import { confirmModal } from '../components/ConfirmModal.js';
import { $, scrollToQuestion } from '../utils/dom.js';

export class PracticeView extends BaseView {
  /**
   * @param {string} mode 'critical' | 'mistakes' | 'bookmarks'
   * @param {string} title
   */
  constructor(mode, title) {
    super(`PracticeView-${mode}`);
    this.mode = mode;
    this.title = title;
    this.questions = [];
  }

  mount(container) {
    this.container = container;
    this.loadQuestions(true);
    this.render();
  }

  loadQuestions(initial = false) {
    if (this.mode === 'critical') {
      this.questions = questionService.getCriticalQuestions();
      const prog = StorageService.getCriticalProgress();
      const safeIndex = Math.min(prog.lastIndex || 0, Math.max(0, this.questions.length - 1));
      store.setState({
        currentPracticeIndex: safeIndex,
        practiceAnswers: { ...(prog.answers || {}) }
      });
    } else if (this.mode === 'mistakes') {
      const wrongMap = StorageService.getWrongQuestions();
      const wrongIds = Object.keys(wrongMap).map(Number);
      this.questions = questionService.getByIds(wrongIds);
      if (initial) {
        store.setState({ currentPracticeIndex: 0, practiceAnswers: {} });
      } else {
        const state = store.getState();
        if (state.currentPracticeIndex >= this.questions.length) {
          store.setState({ currentPracticeIndex: Math.max(0, this.questions.length - 1) });
        }
      }
    } else if (this.mode === 'bookmarks') {
      const bookmarkIds = StorageService.getBookmarks();
      this.questions = questionService.getByIds(bookmarkIds);
      if (initial) {
        store.setState({ currentPracticeIndex: 0, practiceAnswers: {} });
      } else {
        const state = store.getState();
        if (state.currentPracticeIndex >= this.questions.length) {
          store.setState({ currentPracticeIndex: Math.max(0, this.questions.length - 1) });
        }
      }
    }
  }

  render() {
    if (!this.container) return;

    if (this.questions.length === 0) {
      this.renderEmptyState();
      return;
    }

    const state = store.getState();
    const savedScrollTop = QuestionPalette.preserveScroll('.exam-sidebar .palette-grid');

    const curIndex = Math.min(state.currentPracticeIndex, this.questions.length - 1);
    const q = this.questions[curIndex];
    const userAnswer = state.practiceAnswers[q.id];
    const totalQuestions = this.questions.length;

    // Critical progress statistics
    let criticalStatsHtml = '';
    if (this.mode === 'critical') {
      const stats = StorageService.getCriticalStats(this.questions);
      const correctPercent = totalQuestions > 0 ? (stats.correct / totalQuestions) * 100 : 0;
      const wrongPercent = totalQuestions > 0 ? (stats.wrong / totalQuestions) * 100 : 0;

      criticalStatsHtml = `
        <div class="critical-progress-card">
          <div class="chapter-progress-header">
            <div class="chapter-progress-info">
              <span>⚠️ Tiến độ 60 Câu Điểm Liệt:</span>
              <span class="chapter-progress-percent" style="color: ${stats.wrong > 0 ? '#ef4444' : 'var(--accent-primary)'};">${stats.answered}/${totalQuestions} câu (${stats.percent}%)</span>
            </div>
            <button id="btn-reset-critical" class="btn-reset-chapter" ${stats.answered === 0 ? 'disabled' : ''} title="Đặt lại toàn bộ câu trả lời của 60 câu điểm liệt">
              <span>🔄 Làm lại 60 câu</span>
            </button>
          </div>

          <div class="chapter-progress-bar-track" role="progressbar" aria-valuenow="${stats.percent}" aria-valuemin="0" aria-valuemax="100">
            <div class="chapter-progress-fill correct" style="width: ${correctPercent}%;" title="${stats.correct} câu đúng"></div>
            <div class="chapter-progress-fill wrong" style="width: ${wrongPercent}%;" title="${stats.wrong} câu sai"></div>
          </div>

          <div class="chapter-progress-stats">
            <span class="chapter-stat-badge correct">🟢 ${stats.correct} câu đúng</span>
            <span>•</span>
            <span class="chapter-stat-badge wrong" style="${stats.wrong > 0 ? 'font-weight: 700; color: #ef4444;' : ''}">🔴 ${stats.wrong} câu sai ${stats.wrong > 0 ? '(nguy cơ trượt)' : ''}</span>
            <span>•</span>
            <span class="chapter-stat-badge remaining">⚪ ${stats.remaining} câu chưa làm</span>
          </div>

          ${stats.isAllCorrect ? `
            <div class="critical-success-banner" style="margin-top: 0.35rem; padding: 0.5rem 0.85rem; border-radius: var(--radius-md); background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #10b981; font-size: 0.875rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
              <span>🎉</span>
              <span>Xuất sắc! Bạn đã trả lời đúng toàn bộ 60/60 câu điểm liệt. Hãy tự tin khi bước vào kỳ thi thật!</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    const questionCardHtml = QuestionCard.render({
      question: q,
      currentIndex: curIndex,
      totalQuestions,
      userAnswer,
      isPractice: true,
      showInstantAnswer: state.showInstantAnswer,
      badgePrefix: this.title
    });

    const paletteHtml = QuestionPalette.render({
      questions: this.questions,
      currentIndex: curIndex,
      answers: state.practiceAnswers,
      isPractice: true,
      title: `Danh sách câu (${totalQuestions})`
    });

    this.container.innerHTML = `
      ${criticalStatsHtml}
      ${this.mode === 'mistakes' ? `
        <div class="mistakes-header-actions" style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; background: var(--bg-card); padding: 0.85rem 1.25rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
          <div>
            <div style="font-weight: 700; color: #ef4444; display: flex; align-items: center; gap: 0.5rem; font-size: 1rem;">
              <span>❌ Danh sách ${totalQuestions} câu hỏi bạn đã làm sai</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
              Ôn tập kỹ từng câu hoặc bấm nút bên cạnh để làm bài thi nhanh 20 câu sai có bấm giờ (làm đúng sẽ xóa khỏi danh sách).
            </div>
          </div>
          <button id="btn-quick-exam-wrong" class="btn-nav" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; font-weight: 700; border: none; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);">
            ⚡ Thi Nhanh 20 Câu Sai Này
          </button>
        </div>
      ` : ''}
      <div class="exam-layout" style="${this.mode === 'critical' ? 'margin-top: 1rem;' : ''}">
        <div id="question-card-wrapper">
          ${questionCardHtml}
        </div>
        <div class="exam-sidebar">
          <div id="palette-wrapper">
            ${paletteHtml}
          </div>
        </div>
      </div>
    `;

    this.bindEvents(q, savedScrollTop);
  }

  renderEmptyState() {
    this.container.innerHTML = `
      <div class="empty-state" style="margin-top: 1rem;">
        <div class="empty-icon">📭</div>
        <h2>Chưa có câu hỏi nào trong danh sách này</h2>
        <p>Hãy làm bài thi hoặc ôn tập các chương để lưu câu hỏi vào đây nhé!</p>
        <button class="btn-nav btn-primary" id="btn-back-to-exam" style="margin-top: 1rem;">
          📝 Làm Đề Thi Thử 30 Câu
        </button>
      </div>
    `;

    $('#btn-back-to-exam', this.container)?.addEventListener('click', () => {
      // Trigger router navigation to 'exam'
      window.dispatchEvent(new CustomEvent('app:navigate', { detail: 'exam' }));
    });
  }

  bindEvents(currentQuestion, savedScrollTop) {
    const state = store.getState();

    // Critical progress reset button
    if (this.mode === 'critical') {
      $('#btn-reset-critical', this.container)?.addEventListener('click', () => {
        const stats = StorageService.getCriticalStats(this.questions);
        confirmModal.showConfirmation({
          title: 'Làm lại 60 câu điểm liệt?',
          message: `Toàn bộ ${stats.answered} câu đã làm trong phần 60 câu hỏi điểm liệt sẽ được xóa để bạn ôn tập lại từ đầu. Dữ liệu câu sai chung sẽ không bị ảnh hưởng.`,
          icon: '🔄',
          confirmText: 'Xác Nhận Làm Lại',
          cancelText: 'Giữ Lại',
          onConfirm: () => {
            this.resetCritical();
          }
        });
      });
    }

    // QuestionCard events
    QuestionCard.bindEvents(this.container, {
      onSelectOption: (optNum) => this.selectOption(optNum),
      onPrev: () => this.prevQuestion(),
      onNext: () => this.nextQuestion(),
      onToggleBookmark: () => this.toggleBookmark(currentQuestion.id),
      onResetAnswer: () => this.resetAnswer(currentQuestion.id),
      onToggleInstantAnswer: (checked) => {
        store.setState({ showInstantAnswer: checked });
        this.render();
      },
      image: currentQuestion.image
    });

    // Palette events
    QuestionPalette.bindEvents(this.container, (idx) => {
      this.renderQuestionCard(idx);
    });

    // Quick exam wrong questions button
    $('#btn-quick-exam-wrong', this.container)?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:navigate', {
        detail: { mode: 'quick-exam', subMode: 'retry_wrong' }
      }));
    });

    // Restore scroll position
    QuestionPalette.restoreScroll(savedScrollTop, '.exam-sidebar .palette-grid');
  }

  renderQuestionCard(newIndex, scroll = true) {
    if (this.questions.length === 0) return;
    const validIndex = Math.max(0, Math.min(newIndex, this.questions.length - 1));
    store.setState({ currentPracticeIndex: validIndex });

    if (this.mode === 'critical') {
      StorageService.saveCriticalLastIndex(validIndex);
    }

    const state = store.getState();
    const q = this.questions[validIndex];
    if (!q) return;

    const totalQuestions = this.questions.length;
    const userAnswer = state.practiceAnswers[q.id];

    const questionCardHtml = QuestionCard.render({
      question: q,
      currentIndex: validIndex,
      totalQuestions,
      userAnswer,
      isPractice: true,
      showInstantAnswer: state.showInstantAnswer,
      badgePrefix: this.title
    });

    const cardWrapper = $('#question-card-wrapper', this.container);
    if (cardWrapper) {
      cardWrapper.innerHTML = questionCardHtml;
      QuestionCard.bindEvents(cardWrapper, {
        onSelectOption: (optNum) => this.selectOption(optNum),
        onPrev: () => this.prevQuestion(),
        onNext: () => this.nextQuestion(),
        onToggleBookmark: () => this.toggleBookmark(q.id),
        onResetAnswer: () => this.resetAnswer(q.id),
        onToggleInstantAnswer: (checked) => {
          store.setState({ showInstantAnswer: checked });
          this.renderQuestionCard(validIndex, false);
        },
        image: q.image
      });
    }

    QuestionPalette.updateCurrentIndex(this.container, validIndex);

    if (scroll) {
      scrollToQuestion();
    }
  }

  updateStatsUI() {
    const state = store.getState();
    const totalQuestions = this.questions.length;
    let answeredCount = 0;
    let correctCount = 0;
    let wrongCount = 0;

    this.questions.forEach(q => {
      const ans = state.practiceAnswers[q.id];
      if (ans !== undefined && ans !== null) {
        answeredCount++;
        if (Number(ans) === Number(q.correct_option)) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    });

    QuestionPalette.updateStats(this.container, {
      answeredCount,
      total: totalQuestions,
      isInstantOrPractice: true,
      correctCount,
      wrongCount
    });

    if (this.mode === 'critical') {
      const stats = StorageService.getCriticalStats(this.questions);
      const percentEl = $('.chapter-progress-percent', this.container);
      if (percentEl) {
        percentEl.textContent = `${stats.answered}/${totalQuestions} câu (${stats.percent}%)`;
        percentEl.style.color = stats.wrong > 0 ? '#ef4444' : 'var(--accent-primary)';
      }

      const resetBtn = $('#btn-reset-critical', this.container);
      if (resetBtn) {
        resetBtn.disabled = stats.answered === 0;
      }

      const correctTrack = $('.chapter-progress-fill.correct', this.container);
      const wrongTrack = $('.chapter-progress-fill.wrong', this.container);
      if (correctTrack) correctTrack.style.width = `${(stats.correct / totalQuestions) * 100}%`;
      if (wrongTrack) wrongTrack.style.width = `${(stats.wrong / totalQuestions) * 100}%`;

      const correctBadge = $('.chapter-stat-badge.correct', this.container);
      const wrongBadge = $('.chapter-stat-badge.wrong', this.container);
      const remBadge = $('.chapter-stat-badge.remaining', this.container);
      if (correctBadge) correctBadge.textContent = `🟢 ${stats.correct} câu đúng`;
      if (wrongBadge) {
        wrongBadge.textContent = `🔴 ${stats.wrong} câu sai ${stats.wrong > 0 ? '(nguy cơ trượt)' : ''}`;
        wrongBadge.style.color = stats.wrong > 0 ? '#ef4444' : '';
        wrongBadge.style.fontWeight = stats.wrong > 0 ? '700' : '';
      }
      if (remBadge) remBadge.textContent = `⚪ ${stats.remaining} câu chưa làm`;
    }
  }

  selectOption(optNum) {
    const state = store.getState();
    const curIndex = Math.min(state.currentPracticeIndex, this.questions.length - 1);
    const q = this.questions[curIndex];
    if (!q) return;

    const newPracticeAnswers = { ...state.practiceAnswers, [q.id]: optNum };
    store.setState({ practiceAnswers: newPracticeAnswers });

    if (this.mode === 'critical') {
      StorageService.saveCriticalAnswer(q.id, optNum, curIndex);
    }

    const isCorrect = Number(optNum) === Number(q.correct_option);
    if (!isCorrect) {
      StorageService.recordWrongQuestion(q.id);
    } else {
      StorageService.recordCorrectQuestion(q.id);
    }

    // In-place DOM update of question card
    QuestionCard.updateSelection(this.container, {
      question: q,
      selectedOption: optNum,
      isPractice: true,
      isInstantFeedback: false,
      onResetAnswer: () => this.resetAnswer(q.id)
    });

    // In-place update of palette button
    QuestionPalette.updateButtonState(this.container, curIndex, {
      isAnswered: true,
      isCorrect,
      isCriticalFail: q.is_critical
    });

    // In-place update of stats & progress bar
    this.updateStatsUI();
  }

  resetAnswer(questionId) {
    const state = store.getState();
    const curIndex = Math.min(state.currentPracticeIndex, this.questions.length - 1);
    const q = this.questions[curIndex];
    if (!q) return;

    const newAnswers = { ...state.practiceAnswers };
    delete newAnswers[questionId];

    store.setState({ practiceAnswers: newAnswers });

    if (this.mode === 'critical') {
      StorageService.removeCriticalAnswer(questionId);
    }

    // In-place reset card
    QuestionCard.resetSelection(this.container, q);

    // In-place update palette button
    QuestionPalette.updateButtonState(this.container, curIndex, {
      isAnswered: false,
      isCorrect: undefined
    });

    // In-place update of stats
    this.updateStatsUI();
  }

  resetCritical() {
    StorageService.resetCriticalProgress();
    store.setState({
      practiceAnswers: {},
      currentPracticeIndex: 0
    });
    this.render();
    scrollToQuestion();
  }

  prevQuestion() {
    const state = store.getState();
    if (state.currentPracticeIndex > 0) {
      this.renderQuestionCard(state.currentPracticeIndex - 1);
    }
  }

  nextQuestion() {
    const state = store.getState();
    if (state.currentPracticeIndex < this.questions.length - 1) {
      this.renderQuestionCard(state.currentPracticeIndex + 1);
    }
  }

  toggleBookmark(questionId) {
    const isBm = StorageService.toggleBookmark(questionId);
    if (this.mode === 'bookmarks') {
      this.loadQuestions();
      this.render();
      return;
    }
    const state = store.getState();
    const curIndex = Math.min(state.currentPracticeIndex, this.questions.length - 1);
    QuestionCard.updateBookmark(this.container, isBm);
    QuestionPalette.updateButtonState(this.container, curIndex, { isBookmarked: isBm });
  }

  onKeyboard(key, event) {
    const state = store.getState();
    if (this.questions.length === 0) return;

    const curIndex = Math.min(state.currentPracticeIndex, this.questions.length - 1);
    const currentQ = this.questions[curIndex];

    if (['1', '2', '3', '4'].includes(key)) {
      const optNum = Number(key);
      if (currentQ && optNum <= currentQ.options.length) {
        this.selectOption(optNum);
      }
    }

    if (key === 'ArrowLeft' || key.toLowerCase() === 'a') {
      this.prevQuestion();
    } else if (key === 'ArrowRight' || key.toLowerCase() === 'd') {
      this.nextQuestion();
    }

    if (key.toLowerCase() === 'b' && currentQ) {
      this.toggleBookmark(currentQ.id);
    }

    if (key.toLowerCase() === 'r' && currentQ) {
      this.resetAnswer(currentQ.id);
    }
  }
}

