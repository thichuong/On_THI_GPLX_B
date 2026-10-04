<script setup>
import { ref, computed } from 'vue';
import { questionService } from '../services/questionService.js';
import { useBookmarks } from '../composables/useBookmarks.js';
import { useLightbox } from '../composables/useLightbox.js';

const searchQuery = ref('');
const filterType = ref('all');
const displayLimit = ref(50);

const { isBookmarked, toggle: toggleBookmark } = useBookmarks();
const lightbox = useLightbox();

const totalWithImages = computed(() => {
  return questionService.getQuestionsWithImages().length;
});

const filteredQuestions = computed(() => {
  return questionService.search(searchQuery.value, filterType.value);
});

const displayedQuestions = computed(() => {
  return filteredQuestions.value.slice(0, displayLimit.value);
});

function handleImageClick(imgUrl, qId) {
  lightbox.open(imgUrl, `Câu ${qId}`);
}
</script>

<template>
  <div class="search-explorer-view">
    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchQuery"
          type="text"
          id="search-input"
          class="search-input"
          placeholder="Tìm kiếm theo từ khóa (nồng độ cồn, biển cấm, ngã tư...) hoặc số câu..."
        />
      </div>

      <select
        v-model="filterType"
        id="filter-type-select"
        class="filter-select"
      >
        <option value="all">Tất cả câu hỏi (600 câu)</option>
        <option value="critical">⚠️ 60 Câu điểm liệt</option>
        <option value="with_image">🖼️ Câu có hình ảnh ({{ totalWithImages }} câu)</option>
      </select>

      <div style="font-size: 0.875rem; color: var(--text-secondary); font-weight: 600;">
        Tìm thấy: {{ filteredQuestions.length }} câu
      </div>
    </div>

    <!-- Questions List -->
    <div class="questions-list" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
      <!-- Empty State -->
      <div v-if="filteredQuestions.length === 0" class="empty-state">
        <div class="empty-icon">🔍</div>
        <h2>Không tìm thấy câu hỏi phù hợp</h2>
        <p>Hãy thử tìm bằng từ khóa khác hoặc xóa bộ lọc.</p>
      </div>

      <div
        v-for="q in displayedQuestions"
        :key="q.id"
        class="question-card"
        style="padding: 1.5rem;"
      >
        <div class="question-header" style="border: none; padding: 0;">
          <div class="question-meta">
            <span class="badge badge-index">Câu {{ q.id }}</span>
            <span class="badge badge-chapter">Chương {{ q.chapter }}</span>
            <span v-if="q.is_critical" class="badge badge-critical">⚠️ CÂU ĐIỂM LIỆT</span>
          </div>
          <button
            type="button"
            class="btn-bookmark"
            :class="{ active: isBookmarked(q.id) }"
            @click="toggleBookmark(q.id)"
          >
            <span>{{ isBookmarked(q.id) ? '★ Đã lưu' : '☆ Lưu' }}</span>
          </button>
        </div>

        <h3 class="question-title" style="font-size: 1.05rem; margin-top: 0.5rem;">{{ q.question }}</h3>

        <!-- Image if any -->
        <div
          v-if="q.image"
          class="question-image-container"
          style="max-height: 260px; cursor: pointer; margin-top: 0.75rem;"
          title="Bấm để phóng to hình ảnh"
          @click="handleImageClick(q.image, q.id)"
        >
          <img
            :src="q.image"
            :alt="`Câu ${q.id}`"
            class="question-image"
            style="max-height: 240px;"
            loading="lazy"
          />
          <div class="zoom-hint" title="Phóng to hình ảnh">🔍</div>
        </div>

        <!-- Options list with correct answer highlighted -->
        <div class="options-list" style="margin-top: 0.75rem;">
          <div
            v-for="(opt, idx) in q.options"
            :key="idx"
            class="option-item"
            :class="{ correct: (idx + 1) === Number(q.correct_option) }"
            style="padding: 0.75rem 1rem; cursor: default;"
          >
            <span class="option-key">{{ idx + 1 }}</span>
            <span class="option-text" style="font-size: 0.9375rem;">{{ opt }}</span>
            <span v-if="(idx + 1) === Number(q.correct_option)" class="option-status-icon correct">✔️</span>
          </div>
        </div>

        <!-- Explanation -->
        <div v-if="q.explanation" class="explanation-box" style="margin-top: 1rem;">
          <div class="explanation-title">
            <span>💡 Giải thích chi tiết & Đáp án đúng</span>
          </div>
          <div class="explanation-content">
            <div class="explanation-correct-answer">
              <strong>Đáp án đúng: Ý số {{ q.correct_option }}.</strong>
            </div>
            <div class="explanation-text">{{ q.explanation.trim() }}</div>
          </div>
        </div>
      </div>

      <!-- Limit disclaimer & load more -->
      <div
        v-if="filteredQuestions.length > displayLimit"
        style="text-align: center; padding: 1.25rem; color: var(--text-secondary); font-size: 0.9rem;"
      >
        <p>Đang hiển thị {{ displayLimit }} / {{ filteredQuestions.length }} câu hỏi.</p>
        <button
          type="button"
          class="btn-nav"
          style="margin-top: 0.5rem;"
          @click="displayLimit += 50"
        >
          Tải Thêm 50 Câu Nữa ⬇️
        </button>
      </div>
    </div>
  </div>
</template>
