/**
 * Question Card Component: Displays question, image, options, explanation, and controls.
 */
import { StorageService } from '../services/storageService.js';
import { eventBus } from '../core/eventBus.js';
import { escapeHtml, $ } from '../utils/dom.js';

export class QuestionCard {
  /**
   * Render Question Card HTML
   * @param {Object} params
   * @param {Object} params.question
   * @param {number} params.currentIndex
   * @param {number} params.totalQuestions
   * @param {number|null} [params.userAnswer=null]
   * @param {boolean} [params.isSubmitted=false]
   * @param {boolean} [params.isReviewMode=false]
   * @param {boolean} [params.isPractice=false]
   * @param {boolean} [params.showInstantAnswer=false]
   * @param {string} [params.badgePrefix='']
   * @param {string} [params.badgeStyle='']
   * @returns {string} HTML string
   */
  static render({
    question,
    currentIndex,
    totalQuestions,
    userAnswer = null,
    isSubmitted = false,
    isReviewMode = false,
    isPractice = false,
    isInstantFeedback = false,
    showInstantAnswer = false,
    isWrongRedo = false,
    badgePrefix = '',
    badgeStyle = ''
  }) {
    if (!question) return '';

    const isBookmarked = StorageService.isBookmarked(question.id);
    const isAnswered = userAnswer !== undefined && userAnswer !== null;
    const isRevealed = isSubmitted || (isPractice && (showInstantAnswer || isAnswered)) || (isInstantFeedback && isAnswered);

    // Feedback banner for practice mode and instant feedback exam mode
    let feedbackHtml = '';
    if ((isPractice || isInstantFeedback) && isAnswered) {
      if (Number(userAnswer) === Number(question.correct_option)) {
        if (isWrongRedo) {
          feedbackHtml = `
            <div class="practice-feedback correct" style="border-color: #10b981; background: rgba(16, 185, 129, 0.15);">
              <span class="feedback-icon">🎉</span>
              <div class="feedback-text">
                <strong>Chính xác tuyệt vời!</strong> Bạn đã trả lời đúng đáp án <strong>#${question.correct_option}</strong>.<br/>
                <span style="color: #10b981; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.25rem;">
                  ✨ Đã xóa câu này khỏi danh sách câu sai!
                </span>
              </div>
            </div>
          `;
        } else {
          feedbackHtml = `
            <div class="practice-feedback correct">
              <span class="feedback-icon">🎉</span>
              <div class="feedback-text">
                <strong>Chính xác!</strong> Bạn đã chọn đúng đáp án <strong>#${question.correct_option}</strong>.
              </div>
            </div>
          `;
        }
      } else {
        const isCriticalFail = question.is_critical;
        feedbackHtml = `
          <div class="practice-feedback incorrect ${isCriticalFail ? 'critical-warning-box' : ''}">
            <span class="feedback-icon">${isCriticalFail ? '🚨' : '❌'}</span>
            <div class="feedback-text">
              <strong>Chưa chính xác!</strong> Bạn đã chọn ý <strong>#${userAnswer}</strong>, đáp án đúng là ý <strong>#${question.correct_option}</strong>.
              ${isCriticalFail ? `
                <div style="margin-top: 0.35rem; color: #ef4444; font-weight: 700;">
                  ⚠️ ĐÂY LÀ CÂU HỎI ĐIỂM LIỆT! Làm sai câu này đồng nghĩa bài thi sẽ BỊ TRƯỢT (Không Đạt).
                </div>
              ` : ''}
              ${isWrongRedo ? `
                <div style="margin-top: 0.35rem; color: #f59e0b; font-size: 0.85rem; font-weight: 600;">
                  📌 Câu này vẫn được giữ lại trong danh sách câu sai để bạn ôn tiếp.
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
    }

    return `
      <div class="question-card">
        <div class="question-header">
          <div class="question-meta">
            ${badgePrefix ? `<span class="badge badge-index" style="${badgeStyle}">${badgePrefix}</span>` : ''}
            <span class="badge badge-index">Câu ${currentIndex + 1} / ${totalQuestions} (Mã: #${question.id})</span>
            <span class="badge badge-chapter">Chương ${question.chapter}</span>
            ${question.is_critical ? `<span class="badge badge-critical">⚠️ CÂU ĐIỂM LIỆT</span>` : ''}
          </div>
          <button class="btn-bookmark ${isBookmarked ? 'active' : ''}" id="btn-toggle-bookmark" title="Lưu câu hỏi để xem lại sau">
            <span>${isBookmarked ? '★ Đã lưu' : '☆ Lưu câu này'}</span>
          </button>
        </div>

        <h2 class="question-title">${escapeHtml(question.question)}</h2>

        ${question.image ? `
          <div class="question-image-container" id="question-img-wrap" title="Bấm để phóng to hình ảnh">
            <img src="${question.image}" alt="Hình minh họa câu ${question.id}" class="question-image" onerror="this.onerror=null; this.classList.add('img-load-failed'); this.insertAdjacentHTML('afterend', '<div class=\\'img-offline-notice\\'><span>⚠️ Ảnh câu hỏi chưa được tải offline. Bạn có thể mở mạng hoặc tải trọn gói Offline để xem đầy đủ.</span></div>');" />
            <div class="zoom-hint">🔍</div>
          </div>
        ` : ''}

        <div class="options-list">
          ${question.options.map((optText, idx) => {
            const optNum = idx + 1;
            const isCorrectOption = optNum === Number(question.correct_option);
            const isUserSelected = Number(userAnswer) === optNum;

            let optClass = 'option-item';
            let statusIconHtml = '';

            if (isRevealed) {
              if (isCorrectOption) {
                optClass += ' correct';
                statusIconHtml = `<span class="option-status-icon correct">✔️</span>`;
              } else if (isUserSelected && !isCorrectOption) {
                optClass += ' incorrect';
                statusIconHtml = `<span class="option-status-icon incorrect">❌</span>`;
              }
              if (isInstantFeedback && isAnswered) {
                optClass += ' locked';
              }
            } else if (isUserSelected) {
              optClass += ' selected';
            }

            return `
              <button class="${optClass}" data-option-num="${optNum}" ${isInstantFeedback && isAnswered ? 'aria-disabled="true"' : ''}>
                <span class="option-key">${optNum}</span>
                <span class="option-text">${escapeHtml(optText)}</span>
                ${statusIconHtml}
              </button>
            `;
          }).join('')}
        </div>

        ${isRevealed ? `
          <div class="explanation-box">
            ${feedbackHtml}
            <div class="explanation-title">
              <span>💡 ${isPractice ? 'Đáp án chuẩn & Lời khuyên chi tiết' : (isInstantFeedback ? 'Kết quả & Giải thích chi tiết' : 'Giải thích chi tiết & Đáp án đúng')}</span>
            </div>
            <div class="explanation-content">
              <div class="explanation-correct-answer">
                <strong>Đáp án đúng: Ý số ${question.correct_option}.</strong>
              </div>
              <div class="explanation-text">${escapeHtml((question.explanation || (question.is_critical ? 'Đây là câu hỏi mất an toàn giao thông nghiêm trọng (câu điểm liệt), người lái xe bắt buộc phải nắm rõ và chấp hành nghiêm túc.' : 'Căn cứ theo Luật Trật tự, an toàn giao thông đường bộ và Quy chuẩn Báo hiệu đường bộ 2025.')).trim())}</div>
            </div>
          </div>
        ` : ((isPractice || isInstantFeedback) ? `
          <div class="practice-hint-placeholder">
            <span>👉 Bấm chọn một đáp án ở trên để kiểm tra kết quả ngay lập tức</span>
          </div>
        ` : '')}

        <!-- Bottom Controls -->
        <div class="question-controls">
          <button class="btn-nav" id="btn-prev-question" ${currentIndex === 0 ? 'disabled' : ''}>
            ⬅️ Câu trước <span class="kbd">←</span>
          </button>

          ${isPractice ? `
            <div class="question-controls-center" style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
              ${isAnswered ? `
                <button class="btn-nav btn-sm" id="btn-reset-practice" title="Chọn lại đáp án cho câu này">
                  🔄 Chọn lại <span class="kbd">R</span>
                </button>
              ` : ''}

              <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; cursor: pointer; user-select: none;">
                <input type="checkbox" id="chk-instant-ans" ${showInstantAnswer ? 'checked' : ''} />
                <span>👁️ Luôn hiện đáp án & giải thích</span>
              </label>
            </div>
          ` : (isInstantFeedback ? `
            <div class="keyboard-hints question-controls-center">
              ${isAnswered ? `
                <span style="color: var(--success); font-weight: 600;">✓ Đã ghi nhận</span>
                <span>|</span>
                <span>Phím <span class="kbd">Enter ↵</span> / <span class="kbd">→</span>: Câu tiếp</span>
              ` : `
                <span>Phím <span class="kbd">1-4</span>: Chọn đáp án</span>
                <span>|</span>
                <span>Phím <span class="kbd">←</span> <span class="kbd">→</span>: Chuyển câu</span>
              `}
            </div>
          ` : `
            <div class="keyboard-hints question-controls-center">
              <span>Phím <span class="kbd">1-4</span>: Chọn đáp án</span>
              <span>|</span>
              <span>Phím <span class="kbd">←</span> <span class="kbd">→</span>: Chuyển câu</span>
            </div>
          `)}

          <button class="btn-nav btn-primary" id="btn-next-question" ${isPractice && currentIndex === totalQuestions - 1 ? 'disabled' : ''}>
            ${!isPractice && currentIndex === totalQuestions - 1 ? (isSubmitted ? 'Xem lại từ đầu' : (isInstantFeedback ? 'Xem kết quả 🏁' : 'Xem câu 1 ➡️')) : 'Câu tiếp ➡️'} <span class="kbd">→</span>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Bind events on rendered QuestionCard
   * @param {HTMLElement} container
   * @param {Object} callbacks
   * @param {Function} callbacks.onSelectOption
   * @param {Function} callbacks.onPrev
   * @param {Function} callbacks.onNext
   * @param {Function} callbacks.onToggleBookmark
   * @param {Function} [callbacks.onResetAnswer]
   * @param {Function} [callbacks.onToggleInstantAnswer]
   * @param {string} [callbacks.image]
   */
  static bindEvents(container, {
    onSelectOption,
    onPrev,
    onNext,
    onToggleBookmark,
    onResetAnswer,
    onToggleInstantAnswer,
    image
  }) {
    if (!container) return;

    // Option clicks
    container.querySelectorAll('.option-item[data-option-num]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('locked')) return;
        const optNum = Number(btn.dataset.optionNum);
        if (typeof onSelectOption === 'function') {
          onSelectOption(optNum);
        }
      });
    });

    // Prev / Next
    $('#btn-prev-question', container)?.addEventListener('click', () => {
      if (typeof onPrev === 'function') onPrev();
    });

    $('#btn-next-question', container)?.addEventListener('click', () => {
      if (typeof onNext === 'function') onNext();
    });

    // Bookmark
    $('#btn-toggle-bookmark', container)?.addEventListener('click', () => {
      if (typeof onToggleBookmark === 'function') onToggleBookmark();
    });

    // Image zoom Lightbox
    if (image) {
      $('#question-img-wrap', container)?.addEventListener('click', () => {
        eventBus.emit('lightbox:open', image);
      });
    }

    // Practice reset
    $('#btn-reset-practice', container)?.addEventListener('click', () => {
      if (typeof onResetAnswer === 'function') onResetAnswer();
    });

    // Instant answer toggle
    $('#chk-instant-ans', container)?.addEventListener('change', (e) => {
      if (typeof onToggleInstantAnswer === 'function') {
        onToggleInstantAnswer(e.target.checked);
      }
    });
  }
}

