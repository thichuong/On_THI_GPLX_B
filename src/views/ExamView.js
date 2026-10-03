/**
 * Exam View: Manages mock tests (50-question standard & 20-question quick)
 * and wrong question redo mode with unseen question cycling.
 */
import { BaseView } from './BaseView.js';
import { store } from '../core/store.js';
import { questionService } from '../services/questionService.js';
import { ExamEngine, EXAM_PRESETS } from '../services/examEngine.js';
import { StorageService } from '../services/storageService.js';
import { TimerService } from '../services/timerService.js';
import { QuestionCard } from '../components/QuestionCard.js';
import { QuestionPalette } from '../components/QuestionPalette.js';
import { confirmModal } from '../components/ConfirmModal.js';
import { resultModal } from '../components/ResultModal.js';
import { $, scrollToQuestion } from '../utils/dom.js';

export class ExamView extends BaseView {
  constructor(examType = 'standard', quickSubMode = 'new') {
    super(`ExamView-${examType}`);
    this.examType = examType; // 'standard' | 'quick'
    this.quickSubMode = quickSubMode; // 'new' | 'retry_wrong'
    this.timer = new TimerService();
    this.recordedWrongIds = new Set();
    this.fixedWrongIds = new Set();
    this.cycleResetNotice = false;
  }

  mount(container) {
    this.container = container;
    const currentState = store.getState();

    // If starting a different exam type or exam hasn't started, prepare
    if (currentState.examType !== this.examType || !currentState.isExamStarted) {
      this.prepareExam();
    } else {
      this.render();
    }
  }

  setSubMode(subMode) {
    this.quickSubMode = subMode;
    this.prepareExam();
  }

  prepareExam() {
    this.timer.stop();
    this.recordedWrongIds.clear();
    this.fixedWrongIds.clear();
    this.cycleResetNotice = false;

    store.setState({
      examType: this.examType,
      isExamStarted: false,
      isExamSubmitted: false,
      isReviewMode: false,
      examResult: null,
      examQuestions: [],
      currentExamIndex: 0,
      userAnswers: {}
    });

    this.render();
  }

  beginExam() {
    this.timer.stop();
    this.recordedWrongIds.clear();
    this.fixedWrongIds.clear();
    this.cycleResetNotice = false;

    const preset = EXAM_PRESETS[this.examType] || EXAM_PRESETS.standard;
    const allQuestions = questionService.getAll();
    const isWrongRedo = this.examType === 'quick' && this.quickSubMode === 'retry_wrong';

    let questions = [];
    let durationSeconds = preset.durationSeconds;

    if (isWrongRedo) {
      const wrongIds = StorageService.getWrongQuestionIds();
      if (wrongIds.length === 0) {
        return;
      }

      questions = ExamEngine.generateExam(allQuestions, 'quick', {
        mode: 'wrong_redo',
        wrongQuestionIds: wrongIds,
        totalQuestions: 20
      });

      // Duration: 30s per question, min 3 mins, max 10 mins
      durationSeconds = Math.min(10 * 60, Math.max(3 * 60, questions.length * 30));
    } else {
      const seenSet = StorageService.getSeenExamQuestionIds(this.examType);
      questions = ExamEngine.generateExam(allQuestions, this.examType, {
        minCritical: preset.minCritical,
        maxCritical: preset.maxCritical,
        shuffleQuestions: true,
        seenQuestionIds: seenSet,
        onCycleReset: () => {
          StorageService.resetExamCycle(this.examType);
          this.cycleResetNotice = true;
        }
      });

      // Add selected questions to seen pool
      StorageService.addSeenExamQuestionIds(this.examType, questions.newlySelectedIds || questions.map(q => q.id));
    }

    store.setState({
      examType: this.examType,
      examQuestions: questions,
      currentExamIndex: 0,
      userAnswers: {},
      isExamStarted: true,
      isExamSubmitted: false,
      isReviewMode: false,
      examResult: null
    });

    // Start timer
    this.timer.start(durationSeconds, {
      onTick: (timerData) => this.updateTimerUI(timerData),
      onTimeout: () => this.finalizeSubmission()
    });

    this.render();
  }

  updateTimerUI({ formatted, status }) {
    const timerElem = $('#timer-val', this.container);
    if (!timerElem) return;

    timerElem.textContent = formatted;
    timerElem.className = `timer-display ${status !== 'normal' ? status : ''}`;
  }

  render(preserveScroll = false) {
    if (!this.container) return;
    const state = store.getState();

    if (!state.isExamStarted) {
      this.renderStartScreen();
      return;
    }

    if (state.examQuestions.length === 0) return;

    const savedWindowScrollY = preserveScroll ? (window.pageYOffset || document.documentElement.scrollTop) : null;
    const savedScrollTop = QuestionPalette.preserveScroll('.exam-sidebar .palette-grid');

    const q = state.examQuestions[state.currentExamIndex];
    const userAnswer = state.userAnswers[q.id];
    const totalQuestions = state.examQuestions.length;
    const isQuick = this.examType === 'quick';
    const isWrongRedo = isQuick && this.quickSubMode === 'retry_wrong';
    const isInstantFeedback = isQuick;

    let examBadgeText = '';
    let examBadgeStyle = '';

    if (isWrongRedo) {
      examBadgeText = `🔄 LÀM LẠI CÂU SAI (${totalQuestions} CÂU) - ĐÚNG SẼ XÓA KHỎI DANH SÁCH`;
      examBadgeStyle = 'background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.4);';
    } else if (isQuick) {
      examBadgeText = '⚡ THI NHANH - KẾT QUẢ TRỰC TIẾP (20 CÂU)';
      examBadgeStyle = 'background: rgba(245, 158, 11, 0.2); color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);';
    } else {
      examBadgeText = '📝 THI THỬ CHUẨN (30 CÂU / 20 PHÚT)';
      examBadgeStyle = 'background: rgba(99, 102, 241, 0.2); color: #818cf8; border-color: rgba(99, 102, 241, 0.4);';
    }

    const questionCardHtml = QuestionCard.render({
      question: q,
      currentIndex: state.currentExamIndex,
      totalQuestions,
      userAnswer,
      isSubmitted: state.isExamSubmitted,
      isReviewMode: state.isReviewMode,
      isPractice: false,
      isInstantFeedback,
      isWrongRedo,
      badgePrefix: examBadgeText,
      badgeStyle: examBadgeStyle
    });

    const paletteTitle = isWrongRedo
      ? `Làm lại (${totalQuestions} câu sai)`
      : (isQuick ? `Thi Nhanh (${totalQuestions} câu)` : `Danh sách ${totalQuestions} câu`);

    const paletteHtml = QuestionPalette.render({
      questions: state.examQuestions,
      currentIndex: state.currentExamIndex,
      answers: state.userAnswers,
      isSubmitted: state.isExamSubmitted,
      isPractice: false,
      isInstantFeedback,
      title: paletteTitle
    });

    const timeStr = this.timer.getFormattedProgress();
    const answeredCount = Object.keys(state.userAnswers).length;
    const isAllAnswered = answeredCount === totalQuestions;

    this.container.innerHTML = `
      <div class="exam-layout">
        <!-- Question Area -->
        <div id="question-card-wrapper">
          ${questionCardHtml}
        </div>

        <!-- Right Exam Sidebar -->
        <div class="exam-sidebar">
          <div class="sidebar-card">
            <div class="timer-widget">
              <div class="timer-label">
                <span>⏱️ Thời gian:</span>
              </div>
              <div id="timer-val" class="timer-display ${this.timer.getStatus() !== 'normal' ? this.timer.getStatus() : ''}">
                ${timeStr}
              </div>
            </div>

            ${isWrongRedo ? `
              <div class="fixed-counter-badge" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 0.6rem 0.85rem; font-size: 0.875rem; color: #10b981; font-weight: 600; text-align: center;">
                ✨ Đã sửa đúng: <strong>${this.fixedWrongIds.size}</strong> / ${totalQuestions} câu
              </div>
            ` : ''}

            ${state.isExamSubmitted ? `
              <button class="btn-submit-exam" id="btn-retry-exam" style="background: linear-gradient(135deg, #6366f1, #4f46e5);">
                🔄 Thi Đề Mới (Trộn ${totalQuestions} câu)
              </button>
            ` : `
              <button class="btn-submit-exam" id="btn-submit-test">
                ${isQuick ? (isAllAnswered ? '🏁 Hoàn Thành & Xem Điểm' : '🏁 Xem Tổng Kết Bài Thi') : '📤 Nộp Bài Thi Sát Hạch'}
              </button>
            `}
          </div>

          <div id="palette-wrapper">
            ${paletteHtml}
          </div>
        </div>
      </div>
    `;

    this.bindActiveExamEvents(q, savedScrollTop);
    if (savedWindowScrollY !== null) {
      window.scrollTo({ top: savedWindowScrollY, behavior: 'instant' });
    }
  }

  renderStartScreen() {
    const isQuick = this.examType === 'quick';
    const preset = EXAM_PRESETS[this.examType] || EXAM_PRESETS.standard;
    const cycleStatus = StorageService.getCycleStatus(this.examType, 600);
    const wrongIds = StorageService.getWrongQuestionIds();
    const wrongCount = wrongIds.length;
    const isWrongRedoMode = isQuick && this.quickSubMode === 'retry_wrong';

    this.container.innerHTML = `
      <div class="exam-start-container">
        <div class="exam-start-card">
          <!-- Quick exam mode tabs if in quick mode -->
          ${isQuick ? `
            <div class="quick-mode-selector">
              <button class="quick-mode-tab ${this.quickSubMode === 'new' ? 'active' : ''}" id="tab-quick-new">
                <span>⚡ Thi Nhanh Đề Mới</span>
              </button>
              <button class="quick-mode-tab ${this.quickSubMode === 'retry_wrong' ? 'active' : ''}" id="tab-quick-wrong">
                <span>🔄 Làm Lại Câu Sai</span>
                ${wrongCount > 0 ? `<span class="badge-wrong-count">${wrongCount}</span>` : ''}
              </button>
            </div>
          ` : ''}

          <div class="exam-start-header">
            <div class="exam-start-icon">
              ${isWrongRedoMode ? '🔄' : (isQuick ? '⚡' : '📝')}
            </div>
            <div class="badge badge-index" style="${
              isWrongRedoMode
                ? 'background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.4);'
                : (isQuick ? 'background: rgba(245, 158, 11, 0.2); color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);' : '')
            }">
              ${
                isWrongRedoMode
                  ? 'CHẾ ĐỘ LÀM LẠI CÂU SAI - TỰ ĐỘNG XÓA KHI LÀM ĐÚNG'
                  : (isQuick ? 'CHẾ ĐỘ THI NHANH (20 CÂU) - PHẢN HỒI TỨC THÌ' : 'CHẾ ĐỘ THI THỬ CHUẨN (30 CÂU)')
              }
            </div>
            <h2 class="exam-start-title">
              ${
                isWrongRedoMode
                  ? `Làm Lại ${Math.min(20, wrongCount)} Câu Hỏi Bị Sai`
                  : (isQuick ? 'Sẵn Sàng Thi Nhanh (20 Câu)' : 'Sẵn Sàng Làm Bài Thi Sát Hạch')
              }
            </h2>
            <p class="exam-start-desc">
              ${
                isWrongRedoMode
                  ? 'Hệ thống sẽ lấy tối đa 20 câu hỏi bạn đã từng làm sai để bạn rèn luyện lại. <strong>Đặc biệt: Khi bạn trả lời đúng câu sai nào, hệ thống sẽ tự động xóa câu đó khỏi danh sách câu sai!</strong>'
                  : (isQuick
                    ? 'Bài thi nhanh 20 câu trong 10 phút: <strong>Ưu tiên các câu chưa làm trong chu kỳ</strong>. Kết quả đúng/sai và giải thích hiển thị trực tiếp ngay khi chọn đáp án.'
                    : 'Đề thi 30 câu (20 phút) được tạo theo cấu trúc chuẩn Cục CSGT 2025. <strong>Ưu tiên các câu chưa làm trong chu kỳ</strong> và chỉ reset khi không đủ câu.')
              }
            </p>
          </div>

          <!-- Question Cycle Progress Bar (Only in normal cycle modes) -->
          ${!isWrongRedoMode ? `
            <div class="cycle-progress-card">
              <div class="cycle-progress-header">
                <span class="cycle-progress-title">📊 Tiến độ chu kỳ câu hỏi:</span>
                <span class="cycle-progress-count">
                  Đã thi <strong>${cycleStatus.seenCount}</strong> / ${cycleStatus.totalAvailable} câu (Còn <strong>${cycleStatus.remainingCount}</strong> câu chưa làm)
                </span>
              </div>
              <div class="cycle-progress-bar-bg">
                <div class="cycle-progress-bar-fill" style="width: ${Math.round((cycleStatus.seenCount / cycleStatus.totalAvailable) * 100)}%;"></div>
              </div>
              <div class="cycle-progress-footer">
                <span class="cycle-progress-hint">💡 Hệ thống luôn trộn các câu chưa làm. Khi số câu còn lại dưới ${preset.totalQuestions} câu, chu kỳ sẽ tự động làm mới.</span>
                ${cycleStatus.seenCount > 0 ? `
                  <button id="btn-reset-cycle" class="btn-reset-cycle" title="Đặt lại chu kỳ để bắt đầu lại từ đầu">
                    🔄 Đặt lại chu kỳ
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- Info Grid -->
          <div class="exam-info-grid">
            <div class="exam-info-item">
              <div class="exam-info-item-icon timer">⏱️</div>
              <div class="exam-info-item-text">
                <span class="exam-info-item-label">Thời gian làm bài</span>
                <span class="exam-info-item-val">
                  ${isWrongRedoMode ? `${Math.min(10, Math.max(3, Math.ceil(Math.min(20, wrongCount) * 0.5)))} Phút` : `${preset.durationMinutes} Phút`}
                </span>
              </div>
            </div>

            <div class="exam-info-item">
              <div class="exam-info-item-icon questions">📋</div>
              <div class="exam-info-item-text">
                <span class="exam-info-item-label">Số lượng câu</span>
                <span class="exam-info-item-val">
                  ${isWrongRedoMode ? `${Math.min(20, wrongCount)} Câu sai` : `${preset.totalQuestions} Câu trắc nghiệm`}
                </span>
              </div>
            </div>

            <div class="exam-info-item">
              <div class="exam-info-item-icon pass">🎯</div>
              <div class="exam-info-item-text">
                <span class="exam-info-item-label">Cơ chế xóa câu sai</span>
                <span class="exam-info-item-val">
                  ${isWrongRedoMode ? 'Đúng câu nào xóa câu đó' : `Đạt từ ${preset.passThreshold}/${preset.totalQuestions} câu`}
                </span>
              </div>
            </div>

            <div class="exam-info-item">
              <div class="exam-info-item-icon critical">⚠️</div>
              <div class="exam-info-item-text">
                <span class="exam-info-item-label">Câu điểm liệt</span>
                <span class="exam-info-item-val">
                  ${isWrongRedoMode ? 'Tự động theo dõi' : 'Bắt buộc đúng'}
                </span>
              </div>
            </div>
          </div>

          <!-- Rules Card -->
          <div class="exam-rules-card">
            <h4>📌 Quy định & Hướng dẫn làm bài:</h4>
            <ul class="exam-rules-list">
              <li>Mỗi câu hỏi chỉ có <strong>duy nhất 1 đáp án đúng</strong>.</li>
              ${isWrongRedoMode ? `
                <li><strong>Cơ chế tự xóa câu sai:</strong> Khi bạn chọn đúng đáp án, câu hỏi đó sẽ được xóa ngay lập tức khỏi danh sách các câu làm sai.</li>
                <li><strong>Giữ lại nếu sai:</strong> Nếu bạn tiếp tục chọn sai, câu hỏi vẫn sẽ nằm lại trong danh sách để bạn luyện tiếp.</li>
                <li><strong>Số lượng linh hoạt:</strong> Đề thi lấy tối đa 20 câu sai. Nếu danh sách có ít hơn 20 câu (ví dụ 5 câu), bài thi sẽ gồm đúng 5 câu đó.</li>
              ` : (isQuick ? `
                <li><strong>Phản hồi trực tiếp:</strong> Hệ thống chấm điểm và hiển thị đáp án đúng cùng giải thích ngay khi bạn chọn.</li>
                <li><strong>Chốt đáp án:</strong> Mỗi câu đã chọn sẽ được khóa lại để đảm bảo tính khách quan của bài thi.</li>
                <li><strong>Ưu tiên câu chưa làm:</strong> Đề thi luôn lấy các câu bạn chưa từng làm trong chu kỳ hiện tại.</li>
              ` : `
                <li>Đồng hồ tính giờ sẽ <strong>bắt đầu tính thời gian</strong> ngay khi bạn bấm nút "Bắt Đầu Làm Bài".</li>
                <li>Làm sai bất kỳ <strong>câu hỏi điểm liệt</strong> nào, bài thi sẽ bị tính là <strong>Không Đạt</strong> ngay lập tức.</li>
                <li>Hệ thống <strong>ưu tiên trộn các câu chưa làm</strong> cho tới khi không đủ 30 câu mới reset chu kỳ.</li>
              `)}
              <li>Phím <kbd class="kbd">1</kbd> - <kbd class="kbd">4</kbd> để chọn đáp án, phím <kbd class="kbd">Enter ↵</kbd> hoặc <kbd class="kbd">←</kbd> <kbd class="kbd">→</kbd> để chuyển câu hỏi.</li>
            </ul>
          </div>

          ${isWrongRedoMode && wrongCount === 0 ? `
            <div class="empty-wrong-notice" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-lg); padding: 1.25rem; color: #10b981; font-weight: 600; text-align: center; width: 100%;">
              🎉 Xin chúc mừng! Bạn hiện không có câu hỏi nào bị sai trong danh sách. Hãy làm thêm các đề thi mới để luyện tập nhé!
            </div>
            <button class="btn-start-exam-main" id="btn-back-to-new-quick" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
              <span>⚡ Chuyển Sang Thi Nhanh Đề Mới (20 Câu)</span>
            </button>
          ` : `
            <button id="btn-start-exam" class="btn-start-exam-main" aria-label="Bắt đầu làm bài thi" style="${
              isWrongRedoMode ? 'background: linear-gradient(135deg, #ef4444, #dc2626); box-shadow: 0 4px 18px rgba(239, 68, 68, 0.45);' : ''
            }">
              <span>${isWrongRedoMode ? `🚀 Bắt Đầu Làm Lại (${Math.min(20, wrongCount)} Câu Sai)` : '🚀 Bắt Đầu Làm Bài'}</span>
            </button>
            <div class="exam-start-keyboard-hint">
              <span>(Hoặc nhấn phím <kbd class="kbd">Enter ↵</kbd> để bắt đầu ngay)</span>
            </div>
          `}
        </div>
      </div>
    `;

    // Bind Start Screen Events
    $('#btn-start-exam', this.container)?.addEventListener('click', () => {
      this.beginExam();
    });

    $('#btn-back-to-new-quick', this.container)?.addEventListener('click', () => {
      this.quickSubMode = 'new';
      this.render();
    });

    $('#tab-quick-new', this.container)?.addEventListener('click', () => {
      this.quickSubMode = 'new';
      this.render();
    });

    $('#tab-quick-wrong', this.container)?.addEventListener('click', () => {
      this.quickSubMode = 'retry_wrong';
      this.render();
    });

    $('#btn-reset-cycle', this.container)?.addEventListener('click', () => {
      if (confirm('Bạn có chắc muốn đặt lại chu kỳ câu hỏi? Toàn bộ 600 câu sẽ trở về trạng thái chưa làm trong chu kỳ thi.')) {
        StorageService.resetExamCycle(this.examType);
        this.render();
      }
    });
  }

  bindActiveExamEvents(currentQuestion, savedScrollTop) {
    // Bind QuestionCard events
    QuestionCard.bindEvents(this.container, {
      onSelectOption: (optNum) => this.selectOption(optNum),
      onPrev: () => this.prevQuestion(),
      onNext: () => this.nextQuestion(),
      onToggleBookmark: () => this.toggleBookmark(currentQuestion.id),
      image: currentQuestion.image
    });

    // Bind Palette events
    QuestionPalette.bindEvents(this.container, (idx) => {
      store.setState({ currentExamIndex: idx });
      this.render();
      scrollToQuestion();
    });

    // Submit button
    $('#btn-submit-test', this.container)?.addEventListener('click', () => {
      this.submitExam();
    });

    // Retry button
    $('#btn-retry-exam', this.container)?.addEventListener('click', () => {
      this.prepareExam();
    });

    // Restore scroll position
    QuestionPalette.restoreScroll(savedScrollTop, '.exam-sidebar .palette-grid');
  }

  selectOption(optionIndex) {
    const state = store.getState();
    if (state.isExamSubmitted) return; // Answer locked

    const currentQ = state.examQuestions[state.currentExamIndex];
    if (!currentQ) return;

    // In quick exam (instant feedback mode), once chosen, lock the answer
    if (this.examType === 'quick' && state.userAnswers[currentQ.id] !== undefined) {
      return;
    }

    const newUserAnswers = { ...state.userAnswers, [currentQ.id]: optionIndex };
    const isWrongRedo = this.examType === 'quick' && this.quickSubMode === 'retry_wrong';
    const isCorrect = Number(optionIndex) === Number(currentQ.correct_option);

    if (isWrongRedo) {
      if (isCorrect) {
        if (!this.fixedWrongIds.has(currentQ.id)) {
          this.fixedWrongIds.add(currentQ.id);
          StorageService.removeWrongQuestion(currentQ.id);
        }
      } else {
        // Retain in wrong list and record attempt
        StorageService.recordWrongQuestion(currentQ.id);
      }
    } else if (this.examType === 'quick') {
      // Normal quick exam mode
      if (!isCorrect && !this.recordedWrongIds.has(currentQ.id)) {
        this.recordedWrongIds.add(currentQ.id);
        StorageService.recordWrongQuestion(currentQ.id);
      }
    }

    store.setState({ userAnswers: newUserAnswers });

    const isInstantFeedback = this.examType === 'quick';
    if (!isInstantFeedback) {
      // In non-instant feedback mode (standard exam), update option selection
      // and palette in-place without re-rendering to prevent any auto-scroll
      this.updateSelectedOptionUI(optionIndex, newUserAnswers);
      return;
    }

    this.render();
  }

  updateSelectedOptionUI(optionIndex, newUserAnswers) {
    const state = store.getState();
    const currentQ = state.examQuestions[state.currentExamIndex];
    if (!currentQ) return;

    // 1. Update option buttons styling in-place
    const optionsList = $('.options-list', this.container);
    if (optionsList) {
      const optionButtons = optionsList.querySelectorAll('.option-item[data-option-num]');
      optionButtons.forEach(btn => {
        const optNum = Number(btn.dataset.optionNum);
        if (optNum === Number(optionIndex)) {
          btn.classList.add('selected');
        } else {
          btn.classList.remove('selected');
        }
      });
    }

    // 2. Update palette button for current question
    const paletteBtn = $(`.palette-btn[data-palette-index="${state.currentExamIndex}"]`, this.container);
    if (paletteBtn) {
      paletteBtn.classList.add('answered');
    }

    // 3. Update answered count in palette header
    const paletteStats = $('.palette-stats', this.container);
    const total = state.examQuestions.length;
    const answeredCount = Object.keys(newUserAnswers).length;
    if (paletteStats) {
      paletteStats.textContent = `Đã làm: ${answeredCount}/${total}`;
    }
  }

  prevQuestion() {
    const state = store.getState();
    if (state.currentExamIndex > 0) {
      store.setState({ currentExamIndex: state.currentExamIndex - 1 });
      this.render();
      scrollToQuestion();
    }
  }

  nextQuestion() {
    const state = store.getState();
    const total = state.examQuestions.length;
    if (state.currentExamIndex < total - 1) {
      store.setState({ currentExamIndex: state.currentExamIndex + 1 });
      this.render();
      scrollToQuestion();
    } else {
      // In quick exam mode, if at last question and all answered, submit to show final summary
      if (this.examType === 'quick' && !state.isExamSubmitted) {
        const answeredCount = Object.keys(state.userAnswers).length;
        if (answeredCount === total) {
          this.finalizeSubmission();
          return;
        }
      }
      store.setState({ currentExamIndex: 0 });
      this.render();
      scrollToQuestion();
    }
  }

  toggleBookmark(questionId) {
    StorageService.toggleBookmark(questionId);
    this.render(true);
  }

  submitExam() {
    const state = store.getState();
    if (state.isExamSubmitted) return;

    const answeredCount = Object.keys(state.userAnswers).length;
    const total = state.examQuestions.length;

    if (this.timer.getRemaining() > 0 && answeredCount < total) {
      const unattempted = total - answeredCount;
      confirmModal.show(unattempted, {
        onConfirm: () => this.finalizeSubmission()
      });
      return;
    }

    this.finalizeSubmission();
  }

  finalizeSubmission() {
    const state = store.getState();
    if (state.isExamSubmitted) return;

    this.timer.stop();
    const preset = EXAM_PRESETS[this.examType] || EXAM_PRESETS.standard;
    const isWrongRedo = this.examType === 'quick' && this.quickSubMode === 'retry_wrong';

    // Grade exam
    const passThreshold = isWrongRedo ? Math.ceil(state.examQuestions.length * 0.9) : preset.passThreshold;
    const examResult = ExamEngine.gradeExam(state.examQuestions, state.userAnswers, passThreshold);

    // Save history
    StorageService.saveExamResult({
      examType: isWrongRedo ? 'quick_wrong_redo' : this.examType,
      examTitle: isWrongRedo ? `Làm Lại Câu Sai (${state.examQuestions.length} Câu)` : preset.name,
      score: examResult.score,
      total: examResult.total,
      passed: examResult.passed,
      failedCritical: examResult.failedCritical,
      durationSeconds: this.timer.getElapsed(),
      wrongQuestionIds: examResult.wrongQuestionIds
    });

    // Record wrong questions in normal exam modes
    if (!isWrongRedo) {
      examResult.wrongQuestionIds.forEach(id => {
        if (!this.recordedWrongIds.has(id)) {
          this.recordedWrongIds.add(id);
          StorageService.recordWrongQuestion(id);
        }
      });
    }

    store.setState({
      isExamSubmitted: true,
      isReviewMode: true,
      examResult
    });

    this.render();

    // Show Result Modal with wrong redo context
    resultModal.show(examResult, preset, {
      isWrongRedo,
      fixedWrongCount: this.fixedWrongIds.size,
      onReview: () => {
        store.setState({ currentExamIndex: 0 });
        this.render();
      },
      onRetry: () => {
        this.prepareExam();
      }
    });
  }

  onKeyboard(key, event) {
    const state = store.getState();

    if (!state.isExamStarted) {
      if (key === 'Enter') {
        const wrongCount = StorageService.getWrongQuestionIds().length;
        if (this.examType === 'quick' && this.quickSubMode === 'retry_wrong' && wrongCount === 0) {
          return;
        }
        event.preventDefault();
        this.beginExam();
      }
      return;
    }

    // In quick exam mode, pressing Enter when current question is answered moves to next question
    if (key === 'Enter') {
      const currentQ = state.examQuestions[state.currentExamIndex];
      const isAnswered = currentQ && state.userAnswers[currentQ.id] !== undefined;
      if (this.examType === 'quick' && isAnswered) {
        event.preventDefault();
        this.nextQuestion();
        return;
      }
    }

    // 1-4 for options
    if (['1', '2', '3', '4'].includes(key)) {
      const optNum = Number(key);
      const currentQ = state.examQuestions[state.currentExamIndex];
      if (currentQ && optNum <= currentQ.options.length) {
        if (this.examType === 'quick' && state.userAnswers[currentQ.id] !== undefined) {
          return;
        }
        this.selectOption(optNum);
      }
    }

    // Arrows
    if (key === 'ArrowLeft' || key.toLowerCase() === 'a') {
      this.prevQuestion();
    } else if (key === 'ArrowRight' || key.toLowerCase() === 'd') {
      this.nextQuestion();
    }

    // Bookmark with B
    if (key.toLowerCase() === 'b') {
      const currentQ = state.examQuestions[state.currentExamIndex];
      if (currentQ) {
        this.toggleBookmark(currentQ.id);
      }
    }
  }

  unmount() {
    this.timer.stop();
    confirmModal.close();
    resultModal.close();
    super.unmount();
  }
}
