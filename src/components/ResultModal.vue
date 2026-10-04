<script setup>
const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  result: {
    type: Object,
    default: null
  },
  preset: {
    type: Object,
    default: () => ({ shortName: 'Thi Thử' })
  },
  isWrongRedo: {
    type: Boolean,
    default: false
  },
  fixedWrongCount: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['review', 'retry', 'close']);
</script>

<template>
  <div
    v-if="isOpen && result"
    class="modal-backdrop show"
    role="dialog"
    aria-modal="true"
    @click.self="emit('close')"
  >
    <div class="modal-content" style="max-width: 480px;">
      <!-- Wrong Redo Finish Header -->
      <template v-if="isWrongRedo">
        <div class="result-status-badge passed" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border-color: rgba(16, 185, 129, 0.4);">
          <span>✨ HOÀN THÀNH ÔN LẠI CÂU SAI</span>
        </div>
        <p class="result-message" style="color: #34d399;">
          Bạn đã sửa đúng và <strong>xóa thành công {{ fixedWrongCount || result.score }}/{{ result.total }} câu</strong> khỏi danh sách câu làm sai!
          <template v-if="result.wrongCount > 0">
            <br />
            <span style="color: #f59e0b; font-size: 0.875rem;">(Còn {{ result.wrongCount }} câu chưa chính xác vẫn được lưu lại để bạn tiếp tục rèn luyện).</span>
          </template>
          <template v-else>
            <br />
            <strong>Xuất sắc! Bạn đã giải quyết toàn bộ các câu hỏi này!</strong>
          </template>
        </p>
      </template>

      <!-- Standard Exam Passed -->
      <template v-else-if="result.passed">
        <div class="result-status-badge passed">
          <span>🎉 ĐẠT ({{ (preset?.shortName || 'BÀI THI').toUpperCase() }})</span>
        </div>
        <p class="result-message">
          Chúc mừng! Bạn đã hoàn thành xuất sắc bài thi với <strong>{{ result.score }}/{{ result.total }}</strong> điểm! (Yêu cầu đạt tối thiểu {{ result.passThreshold }}/{{ result.total }} điểm).
        </p>
      </template>

      <!-- Standard Exam Failed -->
      <template v-else>
        <div class="result-status-badge failed">
          <span>❌ KHÔNG ĐẠT</span>
        </div>
        <p class="result-message" style="color: #f87171;">
          <template v-if="result.failedCritical">
            ❌ <strong>RỚT TRỰC TIẾP DO SAI CÂU ĐIỂM LIỆT!</strong><br />
            Bạn đã trả lời sai câu điểm liệt bắt buộc (Câu {{ result.failedCriticalQuestions?.map(q => q.id).join(', ') }}).
          </template>
          <template v-else>
            Chưa đủ điểm đạt chuẩn ({{ result.score }}/{{ result.total }} - yêu cầu tối thiểu {{ result.passThreshold }}/{{ result.total }} điểm).
          </template>
        </p>
      </template>

      <!-- Score Breakdown Box -->
      <div class="result-breakdown" style="display: flex; gap: 0.75rem; justify-content: center; margin: 1.25rem 0;">
        <div class="score-card" style="flex: 1; padding: 0.75rem; background: rgba(16, 185, 129, 0.15); border-radius: var(--radius-md); text-align: center; border: 1px solid rgba(16, 185, 129, 0.3);">
          <div style="font-size: 1.5rem; font-weight: 800; color: #10b981;">{{ result.score }}</div>
          <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Số câu đúng</div>
        </div>
        <div class="score-card" style="flex: 1; padding: 0.75rem; background: rgba(239, 68, 68, 0.15); border-radius: var(--radius-md); text-align: center; border: 1px solid rgba(239, 68, 68, 0.3);">
          <div style="font-size: 1.5rem; font-weight: 800; color: #ef4444;">{{ result.wrongCount }}</div>
          <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Số câu sai</div>
        </div>
        <div class="score-card" style="flex: 1; padding: 0.75rem; background: rgba(100, 116, 139, 0.15); border-radius: var(--radius-md); text-align: center; border: 1px solid rgba(100, 116, 139, 0.3);">
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">{{ result.total - (result.score + result.wrongCount) }}</div>
          <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Chưa làm</div>
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-actions" style="display: flex; gap: 0.75rem; margin-top: 1.25rem;">
        <button
          type="button"
          class="btn-nav"
          id="btn-review-exam"
          style="flex: 1;"
          @click="emit('review')"
        >
          📋 Xem Lại Đáp Án
        </button>
        <button
          type="button"
          class="btn-nav btn-primary"
          id="btn-retry-exam"
          style="flex: 1;"
          @click="emit('retry')"
        >
          🔄 Làm Đề Mới
        </button>
      </div>
    </div>
  </div>
</template>
