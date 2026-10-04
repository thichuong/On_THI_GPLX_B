<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { questionService } from '../services/questionService.js';
import { ExamEngine, EXAM_PRESETS } from '../services/examEngine.js';
import { StorageService } from '../services/storageService.js';
import { useTimer } from '../composables/useTimer.js';
import { useBookmarks } from '../composables/useBookmarks.js';
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts.js';
import { scrollToQuestion } from '../utils/dom.js';
import QuestionCard from '../components/QuestionCard.vue';
import QuestionPalette from '../components/QuestionPalette.vue';
import ExamTimer from '../components/ExamTimer.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import ResultModal from '../components/ResultModal.vue';

const props = defineProps({
  examType: {
    type: String,
    default: 'standard' // 'standard' | 'quick'
  }
});

const isQuick = computed(() => props.examType === 'quick');
const preset = computed(() => EXAM_PRESETS[props.examType] || EXAM_PRESETS.standard);

const quickSubMode = ref('new'); // 'new' | 'retry_wrong'
const isExamStarted = ref(false);
const isExamSubmitted = ref(false);
const isReviewMode = ref(false);
const examQuestions = ref([]);
const currentExamIndex = ref(0);
const userAnswers = ref({});
const examResult = ref(null);
const fixedWrongIds = ref(new Set());
const recordedWrongIds = ref(new Set());

// Modals
const showConfirmModal = ref(false);
const confirmTitle = ref('');
const confirmMessage = ref('');
const showResultModal = ref(false);

const timer = useTimer();
const { isBookmarked, toggle: toggleBookmark } = useBookmarks();

const isWrongRedo = computed(() => isQuick.value && quickSubMode.value === 'retry_wrong');
const isInstantFeedback = computed(() => isQuick.value);

const currentQuestion = computed(() => {
  return examQuestions.value[currentExamIndex.value] || null;
});

const totalQuestions = computed(() => examQuestions.value.length);

const cycleStatus = computed(() => {
  return StorageService.getCycleStatus(props.examType, 600);
});

const wrongCount = computed(() => {
  return StorageService.getWrongQuestionIds().length;
});

const examBadgeText = computed(() => {
  if (isWrongRedo.value) {
    return `🔄 LÀM LẠI CÂU SAI (${totalQuestions.value} CÂU) - ĐÚNG SẼ XÓA KHỎI DANH SÁCH`;
  }
  if (isQuick.value) {
    return '⚡ THI NHANH - KẾT QUẢ TRỰC TIẾP (20 CÂU)';
  }
  return '📝 THI THỬ CHUẨN (30 CÂU / 20 PHÚT)';
});

const examBadgeStyle = computed(() => {
  if (isWrongRedo.value) {
    return 'background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.4);';
  }
  if (isQuick.value) {
    return 'background: rgba(245, 158, 11, 0.2); color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);';
  }
  return 'background: rgba(99, 102, 241, 0.2); color: #818cf8; border-color: rgba(99, 102, 241, 0.4);';
});

const paletteTitle = computed(() => {
  if (isWrongRedo.value) {
    return `Làm lại (${totalQuestions.value} câu sai)`;
  }
  if (isQuick.value) {
    return `Thi Nhanh (${totalQuestions.value} câu)`;
  }
  return `Danh sách ${totalQuestions.value} câu`;
});

function resetExamState() {
  timer.stop();
  isExamStarted.value = false;
  isExamSubmitted.value = false;
  isReviewMode.value = false;
  examQuestions.value = [];
  currentExamIndex.value = 0;
  userAnswers.value = {};
  examResult.value = null;
  fixedWrongIds.value = new Set();
  recordedWrongIds.value = new Set();
}

function beginExam() {
  resetExamState();

  const allQuestions = questionService.getAll();
  let questions = [];
  let durationSeconds = preset.value.durationSeconds;

  if (isWrongRedo.value) {
    const wrongIds = StorageService.getWrongQuestionIds();
    if (wrongIds.length === 0) return;

    questions = ExamEngine.generateExam(allQuestions, 'quick', {
      mode: 'wrong_redo',
      wrongQuestionIds: wrongIds,
      totalQuestions: 20
    });
    durationSeconds = Math.min(10 * 60, Math.max(3 * 60, questions.length * 30));
  } else {
    const seenSet = StorageService.getSeenExamQuestionIds(props.examType);
    questions = ExamEngine.generateExam(allQuestions, props.examType, {
      minCritical: preset.value.minCritical,
      maxCritical: preset.value.maxCritical,
      shuffleQuestions: true,
      seenQuestionIds: seenSet,
      onCycleReset: () => {
        StorageService.resetExamCycle(props.examType);
      }
    });
    StorageService.addSeenExamQuestionIds(props.examType, questions.newlySelectedIds || questions.map(q => q.id));
  }

  examQuestions.value = questions;
  isExamStarted.value = true;

  timer.start(durationSeconds, () => {
    finalizeSubmission();
  });
}

function handleOptionSelect(optNum) {
  if (!currentQuestion.value) return;
  const qId = currentQuestion.value.id;

  userAnswers.value = {
    ...userAnswers.value,
    [qId]: optNum
  };

  const isCorrect = Number(optNum) === Number(currentQuestion.value.correct_option);

  // In wrong redo mode: correctly answered questions are cleared from mistakes
  if (isWrongRedo.value) {
    if (isCorrect) {
      StorageService.removeWrongQuestion(qId);
      fixedWrongIds.value.add(qId);
      fixedWrongIds.value = new Set(fixedWrongIds.value);
    }
  } else if (isInstantFeedback.value) {
    if (!isCorrect) {
      StorageService.recordWrongQuestion(qId, optNum, currentQuestion.value.correct_option);
      recordedWrongIds.value.add(qId);
    } else {
      StorageService.recordCorrectQuestion(qId);
    }
  }
}

function handleRedoQuestion(qId) {
  const newAns = { ...userAnswers.value };
  delete newAns[qId];
  userAnswers.value = newAns;

  if (isWrongRedo.value) {
    fixedWrongIds.value.delete(qId);
    fixedWrongIds.value = new Set(fixedWrongIds.value);
  }
}

async function goToQuestion(index) {
  if (index < 0 || index >= totalQuestions.value) return;
  currentExamIndex.value = index;
  await nextTick();
  scrollToQuestion({ smooth: true });
}

function handleNext() {
  goToQuestion(currentExamIndex.value + 1);
}

function handlePrev() {
  goToQuestion(currentExamIndex.value - 1);
}

function confirmSubmission() {
  const answeredCount = Object.keys(userAnswers.value).length;
  const remaining = totalQuestions.value - answeredCount;

  if (remaining > 0) {
    confirmTitle.value = 'Chưa Hoàn Thành Bài Thi!';
    confirmMessage.value = `Bạn vẫn còn ${remaining}/${totalQuestions.value} câu chưa trả lời. Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?`;
  } else {
    confirmTitle.value = 'Xác Nhận Nộp Bài Thi';
    confirmMessage.value = 'Bạn đã hoàn thành tất cả các câu hỏi. Bạn có chắc chắn muốn kết thúc bài thi và chấm điểm ngay không?';
  }

  showConfirmModal.value = true;
}

function onConfirmSubmit() {
  showConfirmModal.value = false;
  finalizeSubmission();
}

function finalizeSubmission() {
  timer.stop();
  isExamSubmitted.value = true;

  const result = ExamEngine.gradeExam(examQuestions.value, userAnswers.value, preset.value);
  examResult.value = result;

  // Record wrong questions for standard exam
  if (!isWrongRedo.value && !isInstantFeedback.value) {
    examQuestions.value.forEach(q => {
      const ans = userAnswers.value[q.id];
      if (Number(ans) === Number(q.correct_option)) {
        StorageService.recordCorrectQuestion(q.id);
      } else {
        StorageService.recordWrongQuestion(q.id, ans || null, q.correct_option);
      }
    });
  }

  showResultModal.value = true;
}

function onReviewResult() {
  showResultModal.value = false;
  isReviewMode.value = true;
  goToQuestion(0);
}

function onRetryResult() {
  showResultModal.value = false;
  beginExam();
}

function handleResetCycle() {
  if (confirm('Bạn có chắc muốn đặt lại chu kỳ câu hỏi để bắt đầu lại từ đầu không?')) {
    StorageService.resetExamCycle(props.examType);
  }
}

useKeyboardShortcuts({
  onSelectOption: (num) => {
    if (isExamStarted.value && currentQuestion.value) {
      if (isInstantFeedback.value && userAnswers.value[currentQuestion.value.id] !== undefined) return;
      handleOptionSelect(num);
    }
  },
  onPrev: () => {
    if (isExamStarted.value) handlePrev();
  },
  onNext: () => {
    if (isExamStarted.value) handleNext();
  },
  onToggleBookmark: () => {
    if (isExamStarted.value && currentQuestion.value) toggleBookmark(currentQuestion.value.id);
  },
  onRedo: () => {
    if (isExamStarted.value && currentQuestion.value) handleRedoQuestion(currentQuestion.value.id);
  }
});

watch(() => props.examType, () => {
  resetExamState();
});
</script>

<template>
  <div class="exam-view">
    <!-- 1. Start Screen if Exam Not Started -->
    <div v-if="!isExamStarted" class="exam-start-container">
      <div class="exam-start-card">
        <!-- Quick exam mode tabs -->
        <div v-if="isQuick" class="quick-mode-selector">
          <button
            type="button"
            class="quick-mode-tab"
            :class="{ active: quickSubMode === 'new' }"
            @click="quickSubMode = 'new'"
          >
            <span>⚡ Thi Nhanh Đề Mới</span>
          </button>
          <button
            type="button"
            class="quick-mode-tab"
            :class="{ active: quickSubMode === 'retry_wrong' }"
            @click="quickSubMode = 'retry_wrong'"
          >
            <span>🔄 Làm Lại Câu Sai</span>
            <span v-if="wrongCount > 0" class="badge-wrong-count">{{ wrongCount }}</span>
          </button>
        </div>

        <div class="exam-start-header">
          <div class="exam-start-icon">
            {{ isWrongRedo ? '🔄' : (isQuick ? '⚡' : '📝') }}
          </div>
          <div class="badge badge-index" :style="examBadgeStyle">
            {{
              isWrongRedo
                ? 'CHẾ ĐỘ LÀM LẠI CÂU SAI - TỰ ĐỘNG XÓA KHI LÀM ĐÚNG'
                : (isQuick ? 'CHẾ ĐỘ THI NHANH (20 CÂU) - PHẢN HỒI TỨC THÌ' : 'CHẾ ĐỘ THI THỬ CHUẨN (30 CÂU)')
            }}
          </div>
          <h2 class="exam-start-title">
            {{
              isWrongRedo
                ? `Làm Lại ${Math.min(20, wrongCount)} Câu Hỏi Bị Sai`
                : (isQuick ? 'Sẵn Sàng Thi Nhanh (20 Câu)' : 'Sẵn Sàng Làm Bài Thi Sát Hạch')
            }}
          </h2>
          <p class="exam-start-desc">
            <template v-if="isWrongRedo">
              Hệ thống sẽ lấy tối đa 20 câu hỏi bạn đã từng làm sai để bạn rèn luyện lại. <strong>Đặc biệt: Khi bạn trả lời đúng câu sai nào, hệ thống sẽ tự động xóa câu đó khỏi danh sách câu sai!</strong>
            </template>
            <template v-else-if="isQuick">
              Bài thi nhanh 20 câu trong 10 phút: <strong>Ưu tiên các câu chưa làm trong chu kỳ</strong>. Kết quả đúng/sai và giải thích hiển thị trực tiếp ngay khi chọn đáp án.
            </template>
            <template v-else>
              Đề thi 30 câu (20 phút) được tạo theo cấu trúc chuẩn Cục CSGT 2025. <strong>Ưu tiên các câu chưa làm trong chu kỳ</strong> và chỉ reset khi không đủ câu.
            </template>
          </p>
        </div>

        <!-- Question Cycle Progress Bar -->
        <div v-if="!isWrongRedo" class="cycle-progress-card">
          <div class="cycle-progress-header">
            <span class="cycle-progress-title">📊 Tiến độ chu kỳ câu hỏi:</span>
            <span class="cycle-progress-count">
              Đã thi <strong>{{ cycleStatus.seenCount }}</strong> / {{ cycleStatus.totalAvailable }} câu (Còn <strong>{{ cycleStatus.remainingCount }}</strong> câu chưa làm)
            </span>
          </div>
          <div class="cycle-progress-bar-bg">
            <div
              class="cycle-progress-bar-fill"
              :style="{ width: `${Math.round((cycleStatus.seenCount / cycleStatus.totalAvailable) * 100)}%` }"
            ></div>
          </div>
          <div class="cycle-progress-footer">
            <span class="cycle-progress-hint">💡 Hệ thống luôn trộn các câu chưa làm. Khi số câu còn lại dưới {{ preset.totalQuestions }} câu, chu kỳ sẽ tự động làm mới.</span>
            <button
              v-if="cycleStatus.seenCount > 0"
              type="button"
              class="btn-reset-cycle"
              title="Đặt lại chu kỳ để bắt đầu lại từ đầu"
              @click="handleResetCycle"
            >
              🔄 Đặt lại chu kỳ
            </button>
          </div>
        </div>

        <!-- Info Grid -->
        <div class="exam-info-grid">
          <div class="exam-info-item">
            <div class="exam-info-item-icon timer">⏱️</div>
            <div class="exam-info-item-text">
              <span class="exam-info-item-label">Thời gian làm bài</span>
              <span class="exam-info-item-val">
                {{ isWrongRedo ? `${Math.min(10, Math.max(3, Math.ceil(Math.min(20, wrongCount) * 0.5)))} Phút` : `${preset.durationMinutes} Phút` }}
              </span>
            </div>
          </div>

          <div class="exam-info-item">
            <div class="exam-info-item-icon count">📋</div>
            <div class="exam-info-item-text">
              <span class="exam-info-item-label">Số lượng câu hỏi</span>
              <span class="exam-info-item-val">
                {{ isWrongRedo ? `${Math.min(20, wrongCount)} Câu` : `${preset.totalQuestions} Câu` }}
              </span>
            </div>
          </div>

          <div class="exam-info-item">
            <div class="exam-info-item-icon pass">🎯</div>
            <div class="exam-info-item-text">
              <span class="exam-info-item-label">Điểm đạt chuẩn</span>
              <span class="exam-info-item-val">
                {{ isWrongRedo ? 'Đúng câu nào xóa câu đó' : `${preset.passThreshold}/${preset.totalQuestions} câu` }}
              </span>
            </div>
          </div>

          <div class="exam-info-item">
            <div class="exam-info-item-icon alert">⚠️</div>
            <div class="exam-info-item-text">
              <span class="exam-info-item-label">Câu điểm liệt</span>
              <span class="exam-info-item-val">Không được sai</span>
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div class="exam-start-actions" style="margin-top: 1.5rem; text-align: center;">
          <button
            type="button"
            class="btn-nav btn-primary"
            style="width: 100%; max-width: 320px; padding: 1rem; font-size: 1.1rem; font-weight: 700; margin: 0 auto; display: inline-flex; justify-content: center;"
            :disabled="isWrongRedo && wrongCount === 0"
            @click="beginExam"
          >
            {{ isWrongRedo ? (wrongCount === 0 ? '✨ Không Có Câu Sai Nào' : '🚀 Bắt Đầu Làm Lại Câu Sai') : '🚀 Bắt Đầu Làm Bài Thi' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 2. Active Exam Layout -->
    <div v-else-if="currentQuestion" class="exam-layout">
      <!-- Question Area -->
      <div id="question-card-wrapper">
        <QuestionCard
          :key="currentQuestion.id"
          :question="currentQuestion"
          :current-index="currentExamIndex"
          :total-questions="totalQuestions"
          :user-answer="userAnswers[currentQuestion.id]"
          :is-submitted="isExamSubmitted"
          :is-review-mode="isReviewMode"
          :is-practice="false"
          :is-instant-feedback="isInstantFeedback"
          :is-wrong-redo="isWrongRedo"
          :is-bookmarked="isBookmarked(currentQuestion.id)"
          :badge-prefix="examBadgeText"
          :badge-style="examBadgeStyle"
          @select-option="handleOptionSelect"
          @redo-question="handleRedoQuestion"
          @toggle-bookmark="toggleBookmark"
          @prev-question="handlePrev"
          @next-question="handleNext"
        />
      </div>

      <!-- Right Exam Sidebar -->
      <div class="exam-sidebar">
        <div class="sidebar-card">
          <div class="timer-widget">
            <div class="timer-label">
              <span>⏱️ Thời gian:</span>
            </div>
            <ExamTimer
              :formatted-time="timer.formattedTime.value"
              :formatted-total="timer.formattedTotal.value"
              :is-urgent="timer.isUrgent.value"
            />
          </div>

          <!-- Wrong Redo Fixed Counter -->
          <div
            v-if="isWrongRedo"
            class="fixed-counter-badge"
            style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 0.6rem 0.85rem; font-size: 0.875rem; color: #10b981; font-weight: 600; text-align: center;"
          >
            ✨ Đã sửa đúng: <strong>{{ fixedWrongIds.size }}</strong> / {{ totalQuestions }} câu
          </div>

          <!-- Submit / Retry Button -->
          <button
            v-if="isExamSubmitted"
            type="button"
            class="btn-submit-exam"
            id="btn-retry-exam"
            style="background: linear-gradient(135deg, #6366f1, #4f46e5);"
            @click="beginExam"
          >
            🔄 Thi Đề Mới (Trộn {{ totalQuestions }} câu)
          </button>
          <button
            v-else
            type="button"
            class="btn-submit-exam"
            id="btn-submit-test"
            @click="confirmSubmission"
          >
            {{ isQuick ? (Object.keys(userAnswers).length === totalQuestions ? '🏁 Hoàn Thành & Xem Điểm' : '🏁 Xem Tổng Kết Bài Thi') : '📤 Nộp Bài Thi Sát Hạch' }}
          </button>
        </div>

        <div id="palette-wrapper">
          <QuestionPalette
            :questions="examQuestions"
            :current-index="currentExamIndex"
            :answers="userAnswers"
            :is-submitted="isExamSubmitted"
            :is-practice="false"
            :is-instant-feedback="isInstantFeedback"
            :title="paletteTitle"
            @select-index="goToQuestion"
          />
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ConfirmModal
      :is-open="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="Nộp Bài Ngay"
      cancel-text="Làm Tiếp"
      @confirm="onConfirmSubmit"
      @cancel="showConfirmModal = false"
    />

    <ResultModal
      :is-open="showResultModal"
      :result="examResult"
      :preset="preset"
      :is-wrong-redo="isWrongRedo"
      :fixed-wrong-count="fixedWrongIds.size"
      @review="onReviewResult"
      @retry="onRetryResult"
      @close="showResultModal = false"
    />
  </div>
</template>
