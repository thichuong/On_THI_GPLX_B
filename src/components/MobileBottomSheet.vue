<script setup>
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  currentMode: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['select-mode', 'close']);

const modes = [
  {
    id: 'exam',
    icon: '📝',
    name: 'Thi Thử Chuẩn (30 Câu)',
    desc: 'Cấu trúc đề chuẩn Cục CSGT, bấm giờ 20 phút',
    class: 'mode-exam'
  },
  {
    id: 'quick-exam',
    icon: '⚡',
    name: 'Thi Nhanh Cấp Tốc (20 Câu)',
    desc: 'Rút gọn 10 phút, kiểm tra nhanh kiến thức',
    class: 'mode-quick'
  },
  {
    id: 'critical',
    icon: '⚠️',
    name: '60 Câu Điểm Liệt',
    desc: 'Bắt buộc đúng 100%, sai 1 câu là không đạt',
    class: 'mode-critical'
  },
  {
    id: 'chapter',
    icon: '📚',
    name: 'Ôn Tập Theo Chương',
    desc: 'Luyện kỹ theo 6 chương giáo trình lý thuyết',
    class: 'mode-chapter'
  },
  {
    id: 'all',
    icon: '🔍',
    name: 'Tra Cứu 600 Câu Hỏi',
    desc: 'Tìm kiếm từ khóa, xem toàn bộ đề và lời giải',
    class: 'mode-all'
  },
  {
    id: 'mistakes',
    icon: '❌',
    name: 'Danh Sách Câu Hay Sai',
    desc: 'Gom các câu đã từng làm sai để làm lại cho nhớ',
    class: 'mode-mistakes'
  },
  {
    id: 'bookmarks',
    icon: '⭐',
    name: 'Câu Hỏi Đã Đánh Dấu',
    desc: 'Danh sách câu hỏi quan trọng bạn tự lưu',
    class: 'mode-bookmarks'
  }
];

function handleSelect(modeId) {
  emit('select-mode', modeId);
  emit('close');
}
</script>

<template>
  <div
    v-if="isOpen"
    id="mobile-mode-sheet"
    class="mobile-sheet-backdrop show"
    role="dialog"
    aria-modal="true"
    aria-labelledby="mobile-sheet-title"
    @click.self="emit('close')"
  >
    <div class="mobile-sheet-container">
      <div class="mobile-sheet-handle-bar">
        <span class="mobile-sheet-handle"></span>
      </div>
      <div class="mobile-sheet-header">
        <div class="mobile-sheet-title-box">
          <h2 id="mobile-sheet-title" class="mobile-sheet-title">Chọn Chế Độ Học & Thi</h2>
          <p class="mobile-sheet-subtitle">Chạm để chuyển nhanh chế độ luyện thi</p>
        </div>
        <button
          type="button"
          id="close-mobile-sheet-btn"
          class="mobile-sheet-close-btn"
          aria-label="Đóng bảng chọn"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
      <div class="mobile-sheet-content">
        <div class="mobile-mode-list" role="list">
          <button
            v-for="m in modes"
            :key="m.id"
            type="button"
            class="mobile-mode-card"
            :class="{ active: currentMode === m.id }"
            :data-mode="m.id"
            role="listitem"
            @click="handleSelect(m.id)"
          >
            <div class="mode-card-icon" :class="m.class">{{ m.icon }}</div>
            <div class="mode-card-info">
              <div class="mode-card-name">{{ m.name }}</div>
              <div class="mode-card-desc">{{ m.desc }}</div>
            </div>
            <div class="mode-card-status">
              <span v-if="currentMode === m.id" class="mode-active-indicator">✓</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
