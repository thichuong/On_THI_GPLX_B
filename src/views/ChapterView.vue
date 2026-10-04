<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { questionService, CHAPTERS } from '../services/questionService.js';
import { StorageService } from '../services/storageService.js';
import { useBookmarks } from '../composables/useBookmarks.js';
import { useKeyboardShortcuts } from '../composables/useKeyboardShortcuts.js';
import { scrollToQuestion } from '../utils/dom.js';
import QuestionCard from '../components/QuestionCard.vue';
import QuestionPalette from '../components/QuestionPalette.vue';
import ConfirmModal from '../components/ConfirmModal.vue';

const activeChapter = ref(StorageService.getActiveChapter() || 1);
const chapterQuestions = ref([]);
const currentIndex = ref(0);
const practiceAnswers = ref({});
const showInstantAnswer = ref(false);

const showConfirmModal = ref(false);
const confirmTitle = ref('');
const confirmMessage = ref('');

const { isBookmarked, toggle: toggleBookmark } = useBookmarks();

function loadChapter(chapterId) {
  activeChapter.value = chapterId;
  StorageService.saveActiveChapter(chapterId);

  chapterQuestions.value = questionService.getByChapter(chapterId);
  const prog = StorageService.getChapterProgress(chapterId);
  practiceAnswers.value = { ...(prog.answers || {}) };

  const safeIndex = Math.min(prog.lastIndex || 0, Math.max(0, chapterQuestions.value.length - 1));
  currentIndex.value = safeIndex;
}

const currentQuestion = computed(() => {
  return chapterQuestions.value[currentIndex.value] || null;
});

const totalQuestions = computed(() => chapterQuestions.value.length);

const chapterInfo = computed(() => {
  return questionService.getChapterInfo(activeChapter.value);
});

const chapterStats = computed(() => {
  return StorageService.getChapterStats(activeChapter.value, chapterQuestions.value);
});

const correctPercent = computed(() => {
  return totalQuestions.value > 0 ? (chapterStats.value.correct / totalQuestions.value) * 100 : 0;
});

const wrongPercent = computed(() => {
  return totalQuestions.value > 0 ? (chapterStats.value.wrong / totalQuestions.value) * 100 : 0;
});

function handleChapterChange(e) {
  const newChapterId = Number(e.target.value);
  StorageService.saveChapterLastIndex(activeChapter.value, currentIndex.value);
  loadChapter(newChapterId);
}

function handleOptionSelect(optNum) {
  if (!currentQuestion.value) return;
  const qId = currentQuestion.value.id;

  practiceAnswers.value = {
    ...practiceAnswers.value,
    [qId]: optNum
  };

  StorageService.saveChapterAnswer(activeChapter.value, qId, optNum);
}

function handleRedoQuestion(qId) {
  const newAns = { ...practiceAnswers.value };
  delete newAns[qId];
  practiceAnswers.value = newAns;

  StorageService.removeChapterAnswer(activeChapter.value, qId);
}

async function goToQuestion(index) {
  if (index < 0 || index >= totalQuestions.value) return;
  currentIndex.value = index;
  StorageService.saveChapterLastIndex(activeChapter.value, index);
  await nextTick();
  scrollToQuestion({ smooth: true });
}

function handlePrev() {
  goToQuestion(currentIndex.value - 1);
}

function handleNext() {
  goToQuestion(currentIndex.value + 1);
}

function promptResetChapter() {
  confirmTitle.value = `Làm lại ${chapterInfo.value.shortName}?`;
  confirmMessage.value = `Toàn bộ ${chapterStats.value.answered} câu đã làm trong ${chapterInfo.value.name} sẽ được xóa để bạn ôn tập lại từ đầu. Dữ liệu các chương khác sẽ không bị ảnh hưởng.`;
  showConfirmModal.value = true;
}

function onConfirmReset() {
  StorageService.resetChapterProgress(activeChapter.value);
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
    if (currentQuestion.value) toggleBookmark(currentQuestion.value.id);
  },
  onRedo: () => {
    if (currentQuestion.value) handleRedoQuestion(currentQuestion.value.id);
  }
});

onMounted(() => {
  loadChapter(activeChapter.value);
});
</script>

<template>
  <div class="chapter-view">
    <!-- Chapter Filter Bar -->
    <div class="filter-bar">
      <div style="font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem;">
        <span>📚 Chọn Chương Ôn Tập:</span>
      </div>
      <select
        id="chapter-select"
        class="filter-select"
        style="min-width: 340px;"
        :value="activeChapter"
        @change="handleChapterChange"
      >
        <option
          v-for="ch in CHAPTERS"
          :key="ch.id"
          :value="ch.id"
        >
          {{ ch.name }} • [{{ StorageService.getChapterStats(ch.id).answered }}/{{ StorageService.getChapterStats(ch.id).total }} câu]
        </option>
      </select>
    </div>

    <!-- Chapter Progress Card -->
    <div class="chapter-progress-card">
      <div class="chapter-progress-header">
        <div class="chapter-progress-info">
          <span>📊 Tiến độ {{ chapterInfo?.shortName }}:</span>
          <span class="chapter-progress-percent">
            {{ chapterStats.answered }}/{{ totalQuestions }} câu ({{ chapterStats.percent }}%)
          </span>
        </div>
        <button
          type="button"
          id="btn-reset-chapter"
          class="btn-reset-chapter"
          :disabled="chapterStats.answered === 0"
          title="Đặt lại toàn bộ câu trả lời của chương này"
          @click="promptResetChapter"
        >
          <span>🔄 Làm lại chương này</span>
        </button>
      </div>

      <div
        class="chapter-progress-bar-track"
        role="progressbar"
        :aria-valuenow="chapterStats.percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="chapter-progress-fill correct"
          :style="{ width: `${correctPercent}%` }"
          :title="`${chapterStats.correct} câu đúng`"
        ></div>
        <div
          class="chapter-progress-fill wrong"
          :style="{ width: `${wrongPercent}%` }"
          :title="`${chapterStats.wrong} câu sai`"
        ></div>
      </div>

      <div class="chapter-progress-stats">
        <span class="chapter-stat-badge correct">🟢 {{ chapterStats.correct }} câu đúng</span>
        <span>•</span>
        <span class="chapter-stat-badge wrong">🔴 {{ chapterStats.wrong }} câu sai</span>
        <span>•</span>
        <span class="chapter-stat-badge remaining">⚪ {{ chapterStats.remaining }} câu chưa làm</span>
      </div>
    </div>

    <!-- Layout: Question Card & Palette -->
    <div v-if="currentQuestion" class="exam-layout" style="margin-top: 1rem;">
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
          :badge-prefix="chapterInfo?.shortName"
          @select-option="handleOptionSelect"
          @redo-question="handleRedoQuestion"
          @toggle-bookmark="toggleBookmark"
          @prev-question="handlePrev"
          @next-question="handleNext"
          @toggle-instant-answer="showInstantAnswer = $event"
        />
      </div>

      <div class="exam-sidebar">
        <div id="palette-wrapper">
          <QuestionPalette
            :questions="chapterQuestions"
            :current-index="currentIndex"
            :answers="practiceAnswers"
            :is-submitted="false"
            :is-practice="true"
            :is-instant-feedback="false"
            :title="`${chapterInfo?.shortName} (${totalQuestions} câu)`"
            @select-index="goToQuestion"
          />
        </div>
      </div>
    </div>

    <ConfirmModal
      :is-open="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="Xác Nhận Làm Lại"
      cancel-text="Giữ Lại"
      @confirm="onConfirmReset"
      @cancel="showConfirmModal = false"
    />
  </div>
</template>
