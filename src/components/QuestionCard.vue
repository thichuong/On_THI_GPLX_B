<script setup>
import { computed } from 'vue';
import { useLightbox } from '../composables/useLightbox.js';

const props = defineProps({
  question: {
    type: Object,
    required: true
  },
  currentIndex: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  userAnswer: {
    type: [Number, String, null],
    default: null
  },
  isSubmitted: {
    type: Boolean,
    default: false
  },
  isReviewMode: {
    type: Boolean,
    default: false
  },
  isPractice: {
    type: Boolean,
    default: false
  },
  isInstantFeedback: {
    type: Boolean,
    default: false
  },
  showInstantAnswer: {
    type: Boolean,
    default: false
  },
  isWrongRedo: {
    type: Boolean,
    default: false
  },
  isBookmarked: {
    type: Boolean,
    default: false
  },
  badgePrefix: {
    type: String,
    default: ''
  },
  badgeStyle: {
    type: String,
    default: ''
  }
});

const emit = defineEmits([
  'select-option',
  'redo-question',
  'toggle-bookmark',
  'prev-question',
  'next-question',
  'toggle-instant-answer'
]);

const lightbox = useLightbox();

const isAnswered = computed(() => {
  return props.userAnswer !== undefined && props.userAnswer !== null;
});

const isRevealed = computed(() => {
  return props.isSubmitted ||
    (props.isPractice && (props.showInstantAnswer || isAnswered.value)) ||
    (props.isInstantFeedback && isAnswered.value);
});

const isUserCorrect = computed(() => {
  return isAnswered.value && Number(props.userAnswer) === Number(props.question.correct_option);
});

function handleOptionClick(optNum) {
  if (props.isInstantFeedback && isAnswered.value) {
    return; // Locked after answering in instant feedback mode until redo
  }
  emit('select-option', optNum);
}

function handleImageClick() {
  if (props.question.image) {
    lightbox.open(props.question.image, `Câu ${props.question.id}`);
  }
}
</script>

<template>
  <div class="question-card" id="question-card">
    <!-- Header Meta & Bookmark -->
    <div class="question-header">
      <div class="question-meta">
        <span v-if="badgePrefix" class="badge badge-index" :style="badgeStyle">{{ badgePrefix }}</span>
        <span class="badge badge-index">Câu {{ currentIndex + 1 }} / {{ totalQuestions }} (Mã: #{{ question.id }})</span>
        <span class="badge badge-chapter">Chương {{ question.chapter }}</span>
        <span v-if="question.is_critical" class="badge badge-critical">⚠️ CÂU ĐIỂM LIỆT</span>
      </div>
      <button
        type="button"
        class="btn-bookmark"
        :class="{ active: isBookmarked }"
        id="btn-toggle-bookmark"
        title="Lưu câu hỏi để xem lại sau"
        @click="emit('toggle-bookmark', question.id)"
      >
        <span>{{ isBookmarked ? '★ Đã lưu' : '☆ Lưu câu này' }}</span>
      </button>
    </div>

    <!-- Question Title -->
    <h2 class="question-title">{{ question.question }}</h2>

    <!-- Question Image (if any) -->
    <div
      v-if="question.image"
      class="question-image-container"
      id="question-img-wrap"
      title="Bấm để phóng to hình ảnh"
      @click="handleImageClick"
    >
      <img
        :src="question.image"
        :alt="`Hình minh họa câu ${question.id}`"
        class="question-image"
        loading="lazy"
      />
      <div class="zoom-hint">🔍</div>
    </div>

    <!-- Options List -->
    <div class="options-list">
      <button
        v-for="(optText, idx) in question.options"
        :key="idx"
        type="button"
        class="option-item"
        :class="{
          selected: !isRevealed && Number(userAnswer) === idx + 1,
          correct: isRevealed && (idx + 1) === Number(question.correct_option),
          incorrect: isRevealed && Number(userAnswer) === (idx + 1) && (idx + 1) !== Number(question.correct_option),
          locked: isInstantFeedback && isAnswered
        }"
        :data-option-num="idx + 1"
        :aria-disabled="isInstantFeedback && isAnswered ? 'true' : undefined"
        @click="handleOptionClick(idx + 1)"
      >
        <span class="option-key">{{ idx + 1 }}</span>
        <span class="option-text">{{ optText }}</span>
        <span v-if="isRevealed && (idx + 1) === Number(question.correct_option)" class="option-status-icon correct">✔️</span>
        <span v-else-if="isRevealed && Number(userAnswer) === (idx + 1)" class="option-status-icon incorrect">❌</span>
      </button>
    </div>

    <!-- Instant Feedback & Explanation Box -->
    <div v-if="isRevealed" class="explanation-container">
      <!-- Status Feedback Banner -->
      <div
        v-if="isAnswered && (isPractice || isInstantFeedback)"
        class="status-feedback"
        :class="isUserCorrect ? 'correct' : 'wrong'"
      >
        <div class="feedback-content">
          <span class="feedback-icon">{{ isUserCorrect ? '🎉' : '❌' }}</span>
          <div class="feedback-details">
            <span class="feedback-main">
              {{ isUserCorrect ? 'Chính xác! Bạn đã chọn đáp án đúng.' : (question.is_critical ? '💥 SAI CÂU ĐIỂM LIỆT! Câu này nếu thi thật sẽ bị TRƯỢT TRỰC TIẾP.' : `Chưa chính xác. Đáp án đúng là ý số ${question.correct_option}.`) }}
            </span>
            <span v-if="!isUserCorrect && !question.is_critical" class="feedback-sub">
              Hãy đọc kỹ phần giải thích chi tiết bên dưới để nắm vững quy tắc.
            </span>
          </div>
        </div>
        <button
          v-if="isPractice || isInstantFeedback || isWrongRedo"
          type="button"
          class="btn-redo-question"
          @click="emit('redo-question', question.id)"
        >
          🔄 Làm lại câu này
        </button>
      </div>

      <!-- Explanation Box -->
      <div class="explanation-box">
        <div class="explanation-header">
          <span class="explanation-title">💡 GIẢI THÍCH CHI TIẾT & MẸO NHỚ</span>
        </div>
        <div class="explanation-correct-answer">
          <strong>Đáp án đúng: Ý số {{ question.correct_option }}.</strong>
        </div>
        <div class="explanation-text">{{ question.explanation || 'Đang cập nhật giải thích chi tiết cho câu hỏi này.' }}</div>
      </div>
    </div>

    <!-- Placeholder hint if in practice mode and not answered -->
    <div v-else-if="isPractice || isInstantFeedback" class="practice-hint-placeholder">
      <span>👉 Bấm chọn một đáp án ở trên để kiểm tra kết quả ngay lập tức</span>
    </div>

    <!-- Bottom Controls -->
    <div class="question-controls">
      <button
        type="button"
        class="btn-nav"
        id="btn-prev-question"
        :disabled="currentIndex === 0"
        @click="emit('prev-question')"
      >
        ⬅️ Câu trước <span class="kbd">←</span>
      </button>

      <div class="question-progress-info">
        <label v-if="isPractice" class="instant-answer-toggle">
          <input
            type="checkbox"
            :checked="showInstantAnswer"
            @change="emit('toggle-instant-answer', $event.target.checked)"
          />
          <span>Luôn hiện giải thích</span>
        </label>
        <span v-else class="progress-text-center">
          Câu {{ currentIndex + 1 }} / {{ totalQuestions }}
        </span>
      </div>

      <button
        type="button"
        class="btn-nav"
        id="btn-next-question"
        :disabled="currentIndex >= totalQuestions - 1"
        @click="emit('next-question')"
      >
        Câu tiếp ➡️ <span class="kbd">→</span>
      </button>
    </div>
  </div>
</template>
