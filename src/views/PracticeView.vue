<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { questionService } from '../services/questionService.js';
import { StorageService } from '../services/storageService.js';
import { useBookmarks } from '../composables/useBookmarks.js';
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts.js';
import { scrollToQuestion } from '../utils/dom.js';
import QuestionCard from '../components/QuestionCard.vue';
import QuestionPalette from '../components/QuestionPalette.vue';
import ConfirmModal from '../components/ConfirmModal.vue';

const props = defineProps({
  mode: {
    type: String,
    required: true // 'critical' | 'mistakes' | 'bookmarks'
  },
  title: {
    type: String,
    default: 'Luyện tập'
  }
});

const emit = defineEmits(['navigate-mode']);

const questions = ref([]);
const currentIndex = ref(0);
const practiceAnswers = ref({});
const showInstantAnswer = ref(false);

const showConfirmModal = ref(false);
const confirmTitle = ref('');
const confirmMessage = ref('');

const { isBookmarked, toggle: toggleBookmark, refresh: refreshBookmarks } = useBookmarks();

function loadQuestions() {
  if (props.mode === 'critical') {
    questions.value = questionService.getCriticalQuestions();
    const prog = StorageService.getCriticalProgress();
    practiceAnswers.value = { ...(prog.answers || {}) };
    const safeIndex = Math.min(prog.lastIndex || 0, Math.max(0, questions.value.length - 1));
    currentIndex.value = safeIndex;
  } else if (props.mode === 'mistakes') {
    const wrongMap = StorageService.getWrongQuestions();
    const wrongIds = Object.keys(wrongMap).map(Number);
    questions.value = questionService.getByIds(wrongIds);
    practiceAnswers.value = {};
    currentIndex.value = 0;
  } else if (props.mode === 'bookmarks') {
    refreshBookmarks();
    const bmIds = StorageService.getBookmarks();
    questions.value = questionService.getByIds(bmIds);
    practiceAnswers.value = {};
    currentIndex.value = 0;
  }
}

const totalQuestions = computed(() => questions.value.length);

const currentQuestion = computed(() => {
  return questions.value[currentIndex.value] || null;
});

// Critical stats
const criticalStats = computed(() => {
  if (props.mode !== 'critical') return null;
  return StorageService.getCriticalStats(questions.value);
});

const correctPercent = computed(() => {
  if (!criticalStats.value || totalQuestions.value === 0) return 0;
  return (criticalStats.value.correct / totalQuestions.value) * 100;
});

const wrongPercent = computed(() => {
  if (!criticalStats.value || totalQuestions.value === 0) return 0;
  return (criticalStats.value.wrong / totalQuestions.value) * 100;
});

function handleOptionSelect(optNum) {
  if (!currentQuestion.value) return;
  const qId = currentQuestion.value.id;

  practiceAnswers.value = {
    ...practiceAnswers.value,
    [qId]: optNum
  };

  if (props.mode === 'critical') {
    StorageService.saveCriticalAnswer(qId, optNum);
  }
}

function handleRedoQuestion(qId) {
  const newAns = { ...practiceAnswers.value };
  delete newAns[qId];
  practiceAnswers.value = newAns;

  if (props.mode === 'critical') {
    StorageService.removeCriticalAnswer(qId);
  }
}

function handleBookmarkToggle(qId) {
  toggleBookmark(qId);
  if (props.mode === 'bookmarks') {
    // If in bookmarks mode, removing bookmark removes from current list
    const bmIds = StorageService.getBookmarks();
    questions.value = questionService.getByIds(bmIds);
    if (currentIndex.value >= questions.value.length) {
      currentIndex.value = Math.max(0, questions.value.length - 1);
    }
  }
}

async function goToQuestion(index) {
  if (index < 0 || index >= totalQuestions.value) return;
  currentIndex.value = index;
  if (props.mode === 'critical') {
    StorageService.saveCriticalLastIndex(index);
  }
  await nextTick();
  scrollToQuestion({ smooth: true });
}

function handlePrev() {
  goToQuestion(currentIndex.value - 1);
}

function handleNext() {
  goToQuestion(currentIndex.value + 1);
}

function promptResetCritical() {
  confirmTitle.value = 'Làm lại 60 câu điểm liệt?';
  confirmMessage.value = 'Toàn bộ câu trả lời của 60 câu điểm liệt sẽ được xóa để bạn rèn luyện lại từ đầu.';
  showConfirmModal.value = true;
}

function onConfirmReset() {
  StorageService.resetCriticalProgress();
  practiceAnswers.value = {};
  currentIndex.value = 0;
  showConfirmModal.value = false;
}

useKeyboardShortcuts({
  onSelectOption: (num) => {
    if (currentQuestion.value) handleOptionSelect(num);
  },
  onPrev: handlePrev,
  onNext: handleNext,
  onToggleBookmark: () => {
    if (currentQuestion.value) handleBookmarkToggle(currentQuestion.value.id);
  },
  onRedo: () => {
    if (currentQuestion.value) handleRedoQuestion(currentQuestion.value.id);
  }
});

watch(() => props.mode, () => {
  loadQuestions();
});

onMounted(() => {
  loadQuestions();
});
</script>

<template>
  <div class="practice-view">
    <!-- Empty State -->
    <div v-if="totalQuestions === 0" class="empty-state" style="margin-top: 1.5rem;">
      <div class="empty-icon">{{ mode === 'mistakes' ? '🎉' : '⭐' }}</div>
      <h2>{{ mode === 'mistakes' ? 'Không có câu hỏi nào bị sai!' : 'Chưa có câu hỏi đã lưu' }}</h2>
      <p>{{ mode === 'mistakes' ? 'Tuyệt vời! Bạn chưa từng làm sai câu nào hoặc đã sửa đúng hết các câu sai.' : 'Hãy bấm nút ☆ Lưu ở mỗi câu hỏi khi luyện tập để xem lại sau tại đây.' }}</p>
      <button
        type="button"
        class="btn-nav btn-primary"
        style="margin-top: 1rem;"
        @click="emit('navigate-mode', 'exam')"
      >
        📝 Làm Đề Thi Thử 30 Câu
      </button>
    </div>

    <template v-else>
      <!-- Critical Progress Banner -->
      <div v-if="mode === 'critical' && criticalStats" class="critical-progress-card">
        <div class="chapter-progress-header">
          <div class="chapter-progress-info">
            <span>⚠️ Tiến độ 60 Câu Điểm Liệt:</span>
            <span class="chapter-progress-percent" :style="{ color: criticalStats.wrong > 0 ? '#ef4444' : 'var(--accent-primary)' }">
              {{ criticalStats.answered }}/{{ totalQuestions }} câu ({{ criticalStats.percent }}%)
            </span>
          </div>
          <button
            type="button"
            id="btn-reset-critical"
            class="btn-reset-chapter"
            :disabled="criticalStats.answered === 0"
            title="Đặt lại toàn bộ câu trả lời của 60 câu điểm liệt"
            @click="promptResetCritical"
          >
            <span>🔄 Làm lại 60 câu</span>
          </button>
        </div>

        <div class="chapter-progress-bar-track" role="progressbar" :aria-valuenow="criticalStats.percent" aria-valuemin="0" aria-valuemax="100">
          <div class="chapter-progress-fill correct" :style="{ width: `${correctPercent}%` }" :title="`${criticalStats.correct} câu đúng`"></div>
          <div class="chapter-progress-fill wrong" :style="{ width: `${wrongPercent}%` }" :title="`${criticalStats.wrong} câu sai`"></div>
        </div>

        <div class="chapter-progress-stats">
          <span class="chapter-stat-badge correct">🟢 {{ criticalStats.correct }} câu đúng</span>
          <span>•</span>
          <span class="chapter-stat-badge wrong" :style="{ fontWeight: criticalStats.wrong > 0 ? '700' : 'normal', color: criticalStats.wrong > 0 ? '#ef4444' : undefined }">
            🔴 {{ criticalStats.wrong }} câu sai {{ criticalStats.wrong > 0 ? '(nguy cơ trượt)' : '' }}
          </span>
          <span>•</span>
          <span class="chapter-stat-badge remaining">⚪ {{ criticalStats.remaining }} câu chưa làm</span>
        </div>

        <div
          v-if="criticalStats.isAllCorrect"
          class="critical-success-banner"
          style="margin-top: 0.5rem; padding: 0.5rem 0.85rem; border-radius: var(--radius-md); background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #10b981; font-size: 0.875rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;"
        >
          <span>🎉</span>
          <span>Xuất sắc! Bạn đã trả lời đúng toàn bộ 60/60 câu điểm liệt. Hãy tự tin khi bước vào kỳ thi thật!</span>
        </div>
      </div>

      <!-- Mistakes Action Bar -->
      <div
        v-if="mode === 'mistakes'"
        class="mistakes-header-actions"
        style="margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; background: var(--bg-card); padding: 0.85rem 1.25rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color);"
      >
        <div>
          <div style="font-weight: 700; color: #ef4444; display: flex; align-items: center; gap: 0.5rem; font-size: 1rem;">
            <span>❌ Danh sách {{ totalQuestions }} câu hỏi bạn đã làm sai</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
            Ôn tập kỹ từng câu hoặc bấm nút bên cạnh để thi nhanh bấm giờ (làm đúng sẽ tự động xóa).
          </div>
        </div>
        <button
          type="button"
          class="btn-nav"
          style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; font-weight: 700; border: none; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.35);"
          @click="emit('navigate-mode', 'quick-exam')"
        >
          ⚡ Thi Nhanh Câu Sai Này
        </button>
      </div>

      <!-- Layout: Question Card & Palette -->
      <div v-if="currentQuestion" class="exam-layout" :style="{ marginTop: mode === 'critical' ? '1rem' : undefined }">
        <div id="question-card-wrapper">
          <QuestionCard
            :key="currentQuestion.id"
            :question="currentQuestion"
            :current-index="currentIndex"
            :total-questions="totalQuestions"
            :user-answer="practiceAnswers[currentQuestion.id]"
            :is-submitted="false"
            :is-review-mode="false"
            :is-practice="true"
            :is-instant-feedback="false"
            :show-instant-answer="showInstantAnswer"
            :is-bookmarked="isBookmarked(currentQuestion.id)"
            :badge-prefix="title"
            @select-option="handleOptionSelect"
            @redo-question="handleRedoQuestion"
            @toggle-bookmark="handleBookmarkToggle"
            @prev-question="handlePrev"
            @next-question="handleNext"
            @toggle-instant-answer="showInstantAnswer = $event"
          />
        </div>

        <div class="exam-sidebar">
          <div id="palette-wrapper">
            <QuestionPalette
              :questions="questions"
              :current-index="currentIndex"
              :answers="practiceAnswers"
              :is-submitted="false"
              :is-practice="true"
              :is-instant-feedback="false"
              :title="`Danh sách (${totalQuestions})`"
              @select-index="goToQuestion"
            />
          </div>
        </div>
      </div>
    </template>

    <ConfirmModal
      :is-open="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="Xác Nhận Làm Lại"
      cancel-text="Hủy Bỏ"
      @confirm="onConfirmReset"
      @cancel="showConfirmModal = false"
    />
  </div>
</template>
