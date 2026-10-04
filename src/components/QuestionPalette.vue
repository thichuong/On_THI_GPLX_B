<script setup>
import { computed } from 'vue';
import { useBookmarks } from '../composables/useBookmarks.js';

const props = defineProps({
  questions: {
    type: Array,
    required: true
  },
  currentIndex: {
    type: Number,
    required: true
  },
  answers: {
    type: Object,
    default: () => ({})
  },
  isSubmitted: {
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
  title: {
    type: String,
    default: 'Danh sách câu'
  }
});

const emit = defineEmits(['select-index']);

const { isBookmarked } = useBookmarks();

const stats = computed(() => {
  let answeredCount = 0;
  let correctCount = 0;
  let wrongCount = 0;

  props.questions.forEach(q => {
    const ans = props.answers[q.id];
    if (ans !== undefined && ans !== null) {
      answeredCount++;
      if (Number(ans) === Number(q.correct_option)) {
        correctCount++;
      } else {
        wrongCount++;
      }
    }
  });

  return {
    total: props.questions.length,
    answeredCount,
    correctCount,
    wrongCount
  };
});

function getButtonClasses(q, idx) {
  const ans = props.answers[q.id];
  const isCurrent = idx === props.currentIndex;
  const isAnswered = ans !== undefined && ans !== null;
  const isBm = isBookmarked(q.id);

  let cls = ['palette-btn'];
  if (isCurrent) cls.push('current');
  if (isAnswered) cls.push('answered');
  if (isBm) cls.push('bookmarked');
  if (q.is_critical) cls.push('critical-indicator');

  if (props.isSubmitted || ((props.isPractice || props.isInstantFeedback) && isAnswered)) {
    const isCorrect = Number(ans) === Number(q.correct_option);
    if (isCorrect) {
      cls.push('correct-mark');
    } else if (q.is_critical) {
      cls.push('critical-failed-mark');
    } else {
      cls.push('incorrect-mark');
    }
  }

  return cls.join(' ');
}
</script>

<template>
  <div class="sidebar-card">
    <div class="palette-header">
      <span class="palette-title">{{ title }} ({{ questions.length }})</span>
      <span class="palette-stats">
        Đã làm: {{ stats.answeredCount }}/{{ stats.total }}
        <template v-if="(isPractice || isInstantFeedback) && stats.answeredCount > 0">
          <br />
          <span style="color: var(--success); font-weight: 700;">{{ stats.correctCount }} Đúng</span> • 
          <span style="color: var(--danger); font-weight: 700;">{{ stats.wrongCount }} Sai</span>
        </template>
      </span>
    </div>

    <!-- Palette Grid -->
    <div class="palette-grid" :class="{ 'palette-grid-50': questions.length > 30 }">
      <button
        v-for="(q, idx) in questions"
        :key="q.id"
        type="button"
        :class="getButtonClasses(q, idx)"
        :aria-label="`Câu ${idx + 1}`"
        :aria-current="idx === currentIndex ? 'true' : undefined"
        :data-palette-index="idx"
        @click="emit('select-index', idx)"
      >
        {{ idx + 1 }}
      </button>
    </div>

    <!-- Palette Legend -->
    <div class="palette-legend">
      <template v-if="isPractice || isInstantFeedback">
        <div class="legend-item"><span class="legend-dot correct"></span> Đúng</div>
        <div class="legend-item"><span class="legend-dot incorrect"></span> Sai</div>
        <div class="legend-item"><span class="legend-dot critical-badge"></span> Điểm liệt</div>
        <div class="legend-item"><span class="legend-dot current"></span> Đang xem</div>
      </template>
      <template v-else-if="!isSubmitted">
        <div class="legend-item"><span class="legend-dot answered"></span> Đã làm</div>
        <div class="legend-item"><span class="legend-dot unanswered"></span> Chưa làm</div>
        <div class="legend-item"><span class="legend-dot current"></span> Đang làm</div>
        <div class="legend-item"><span class="legend-dot critical-badge"></span> Điểm liệt</div>
      </template>
      <template v-else>
        <div class="legend-item"><span class="legend-dot correct"></span> Đúng</div>
        <div class="legend-item"><span class="legend-dot incorrect"></span> Sai</div>
        <div class="legend-item"><span class="legend-dot critical-failed"></span> Liệt hỏng</div>
        <div class="legend-item"><span class="legend-dot unanswered"></span> Bỏ qua</div>
      </template>
    </div>
  </div>
</template>
