/**
 * Chapter View: Study and practice questions organized by 6 chapters
 */
import { BaseView } from './BaseView.js';
import { store } from '../core/store.js';
import { questionService, CHAPTERS } from '../services/questionService.js';
import { StorageService } from '../services/storageService.js';
import { QuestionCard } from '../components/QuestionCard.js';
import { QuestionPalette } from '../components/QuestionPalette.js';
import { confirmModal } from '../components/ConfirmModal.js';
import { $, scrollToQuestion } from '../utils/dom.js';

export class ChapterView extends BaseView {
  constructor() {
    super('ChapterView');
    this.questions = [];
  }

  mount(container) {
    this.container = container;

    // Restore saved active chapter and progress
    const activeChapter = StorageService.getActiveChapter();
    const chapterProg = StorageService.getChapterProgress(activeChapter);
    this.questions = questionService.getByChapter(activeChapter);

    const safeIndex = Math.min(chapterProg.lastIndex || 0, Math.max(0, this.questions.length - 1));
    store.setState({
      selectedChapter: activeChapter,
      currentPracticeIndex: safeIndex,
      practiceAnswers: chapterProg.answers || {}
    });

    this.render();
  }

  loadChapterQuestions() {
    const state = store.getState();
    this.questions = questionService.getByChapter(state.selectedChapter);
    if (state.currentPracticeIndex >= this.questions.length) {
      const validIndex = Math.max(0, this.questions.length - 1);
      store.setState({ currentPracticeIndex: validIndex });
      StorageService.saveChapterLastIndex(state.selectedChapter, validIndex);
    }
  }

  render() {
    if (!this.container) return;
    const state = store.getState();
    const chapterInfo = questionService.getChapterInfo(state.selectedChapter);
    const savedScrollTop = QuestionPalette.preserveScroll('.exam-sidebar .palette-grid');

    const totalQuestions = this.questions.length;
    const curIndex = totalQuestions > 0 ? Math.min(state.currentPracticeIndex, totalQuestions - 1) : 0;
    const q = this.questions[curIndex];
    const userAnswer = q ? state.practiceAnswers[q.id] : undefined;

    // Calculate current chapter stats
    const stats = StorageService.getChapterStats(state.selectedChapter, this.questions);

    const questionCardHtml = q ? QuestionCard.render({
      question: q,
      currentIndex: curIndex,
      totalQuestions,
      userAnswer,
      isPractice: true,
      showInstantAnswer: state.showInstantAnswer,
      badgePrefix: chapterInfo.shortName
    }) : '';

    const paletteHtml = QuestionPalette.render({
      questions: this.questions,
      currentIndex: curIndex,
      answers: state.practiceAnswers,
      isPractice: true,
      title: `${chapterInfo.shortName} (${totalQuestions} câu)`
    });

    const correctPercent = totalQuestions > 0 ? (stats.correct / totalQuestions) * 100 : 0;
    const wrongPercent = totalQuestions > 0 ? (stats.wrong / totalQuestions) * 100 : 0;

    this.container.innerHTML = `
      <div class="filter-bar">
        <div style="font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>📚 Chọn Chương Ôn Tập:</span>
        </div>
        <select id="chapter-select" class="filter-select" style="min-width: 340px;">
          ${CHAPTERS.map(ch => {
            const chStats = StorageService.getChapterStats(ch.id);
            const progressBadge = chStats.answered > 0 ? ` • [${chStats.answered}/${chStats.total} câu]` : '';
            return `
              <option value="${ch.id}" ${state.selectedChapter === ch.id ? 'selected' : ''}>
                ${ch.name}${progressBadge}
              </option>
            `;
          }).join('')}
        </select>
      </div>

      <!-- Chapter Progress Card -->
      <div class="chapter-progress-card">
        <div class="chapter-progress-header">
          <div class="chapter-progress-info">
            <span>📊 Tiến độ ${chapterInfo.shortName}:</span>
            <span class="chapter-progress-percent">${stats.answered}/${totalQuestions} câu (${stats.percent}%)</span>
          </div>
          <button id="btn-reset-chapter" class="btn-reset-chapter" ${stats.answered === 0 ? 'disabled' : ''} title="Đặt lại toàn bộ câu trả lời của chương này">
            <span>🔄 Làm lại chương này</span>
          </button>
        </div>

        <div class="chapter-progress-bar-track" role="progressbar" aria-valuenow="${stats.percent}" aria-valuemin="0" aria-valuemax="100">
          <div class="chapter-progress-fill correct" style="width: ${correctPercent}%;" title="${stats.correct} câu đúng"></div>
          <div class="chapter-progress-fill wrong" style="width: ${wrongPercent}%;" title="${stats.wrong} câu sai"></div>
        </div>

        <div class="chapter-progress-stats">
          <span class="chapter-stat-badge correct">🟢 ${stats.correct} câu đúng</span>
          <span>•</span>
          <span class="chapter-stat-badge wrong">🔴 ${stats.wrong} câu sai</span>
          <span>•</span>
          <span class="chapter-stat-badge remaining">⚪ ${stats.remaining} câu chưa làm</span>
        </div>
      </div>

      <div class="exam-layout" style="margin-top: 1rem;">
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

  bindEvents(currentQuestion, savedScrollTop) {
    const state = store.getState();

    // Chapter select
    $('#chapter-select', this.container)?.addEventListener('change', (e) => {
      // Save current chapter's index before switching
      StorageService.saveChapterLastIndex(state.selectedChapter, state.currentPracticeIndex);

      const newChapterId = Number(e.target.value);
      StorageService.saveActiveChapter(newChapterId);

      const newChapterProg = StorageService.getChapterProgress(newChapterId);
      this.questions = questionService.getByChapter(newChapterId);
      const safeIndex = Math.min(newChapterProg.lastIndex || 0, Math.max(0, this.questions.length - 1));

      store.setState({
        selectedChapter: newChapterId,
        currentPracticeIndex: safeIndex,
        practiceAnswers: newChapterProg.answers || {}
      });

      this.render();
    });

    // Reset chapter progress
    $('#btn-reset-chapter', this.container)?.addEventListener('click', () => {
      const chapterInfo = questionService.getChapterInfo(state.selectedChapter);
      const stats = StorageService.getChapterStats(state.selectedChapter, this.questions);

      confirmModal.showConfirmation({
        title: `Làm lại ${chapterInfo.shortName}?`,
        message: `Toàn bộ ${stats.answered} câu đã làm trong ${chapterInfo.name} sẽ được xóa để bạn ôn tập lại từ đầu. Dữ liệu các chương khác sẽ không bị ảnh hưởng.`,
        icon: '🔄',
        confirmText: 'Xác Nhận Làm Lại',
        cancelText: 'Giữ Lại',
        onConfirm: () => {
          this.resetChapter(state.selectedChapter);
        }
      });
    });

    // QuestionCard events
    if (currentQuestion) {
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
    }

    // Palette events
    QuestionPalette.bindEvents(this.container, (idx) => {
      this.renderQuestionCard(idx);
    });

    // Restore scroll
    QuestionPalette.restoreScroll(savedScrollTop, '.exam-sidebar .palette-grid');
  }

  renderQuestionCard(newIndex, scroll = true) {
    if (this.questions.length === 0) return;
    const validIndex = Math.max(0, Math.min(newIndex, this.questions.length - 1));
    const state = store.getState();

    store.setState({ currentPracticeIndex: validIndex });
    StorageService.saveChapterLastIndex(state.selectedChapter, validIndex);

    const chapterInfo = questionService.getChapterInfo(state.selectedChapter);
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
      badgePrefix: chapterInfo.shortName
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

  updateChapterStatsUI() {
    const state = store.getState();
    const totalQuestions = this.questions.length;
    const stats = StorageService.getChapterStats(state.selectedChapter, this.questions);

    const percentEl = $('.chapter-progress-percent', this.container);
    if (percentEl) {
      percentEl.textContent = `${stats.answered}/${totalQuestions} câu (${stats.percent}%)`;
    }

    const resetBtn = $('#btn-reset-chapter', this.container);
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
    if (wrongBadge) wrongBadge.textContent = `🔴 ${stats.wrong} câu sai`;
    if (remBadge) remBadge.textContent = `⚪ ${stats.remaining} câu chưa làm`;

    QuestionPalette.updateStats(this.container, {
      answeredCount: stats.answered,
      total: totalQuestions,
      isInstantOrPractice: true,
      correctCount: stats.correct,
      wrongCount: stats.wrong
    });
  }

  selectOption(optNum) {
    const state = store.getState();
    const curIndex = Math.min(state.currentPracticeIndex, this.questions.length - 1);
    const q = this.questions[curIndex];
    if (!q) return;

    const newPracticeAnswers = { ...state.practiceAnswers, [q.id]: optNum };
    store.setState({ practiceAnswers: newPracticeAnswers });

    // Persist chapter answer and current question index
    StorageService.saveChapterAnswer(state.selectedChapter, q.id, optNum, curIndex);

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
    this.updateChapterStatsUI();
  }

  resetAnswer(questionId) {
    const state = store.getState();
    const curIndex = Math.min(state.currentPracticeIndex, this.questions.length - 1);
    const q = this.questions[curIndex];
    if (!q) return;

    const newAnswers = { ...state.practiceAnswers };
    delete newAnswers[questionId];

    store.setState({ practiceAnswers: newAnswers });

    // Remove from chapter storage
    StorageService.removeChapterAnswer(state.selectedChapter, questionId);

    // In-place reset card
    QuestionCard.resetSelection(this.container, q);

    // In-place update palette button
    QuestionPalette.updateButtonState(this.container, curIndex, {
      isAnswered: false,
      isCorrect: undefined
    });

    // In-place update of stats
    this.updateChapterStatsUI();
  }

  resetChapter(chapterId) {
    StorageService.resetChapterProgress(chapterId);
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

  prevRowQuestion() {
    const state = store.getState();
    const curIndex = Math.min(state.currentPracticeIndex, this.questions.length - 1);
    const cols = QuestionPalette.getGridColumns(this.container);
    if (curIndex - cols >= 0) {
      this.renderQuestionCard(curIndex - cols);
    }
  }

  nextRowQuestion() {
    const state = store.getState();
    const curIndex = Math.min(state.currentPracticeIndex, this.questions.length - 1);
    const cols = QuestionPalette.getGridColumns(this.container);
    if (curIndex + cols < this.questions.length) {
      this.renderQuestionCard(curIndex + cols);
    }
  }

  toggleBookmark(questionId) {
    const isBm = StorageService.toggleBookmark(questionId);
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
      if (event) event.preventDefault();
      this.prevQuestion();
    } else if (key === 'ArrowRight' || key.toLowerCase() === 'd') {
      if (event) event.preventDefault();
      this.nextQuestion();
    } else if (key === 'ArrowUp' || key.toLowerCase() === 'w') {
      if (event) event.preventDefault();
      this.prevRowQuestion();
    } else if (key === 'ArrowDown' || key.toLowerCase() === 's') {
      if (event) event.preventDefault();
      this.nextRowQuestion();
    }

    if (key.toLowerCase() === 'b' && currentQ) {
      this.toggleBookmark(currentQ.id);
    }

    if (key.toLowerCase() === 'r' && currentQ) {
      this.resetAnswer(currentQ.id);
    }
  }
}

