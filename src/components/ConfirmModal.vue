<script setup>
defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: 'Xác nhận'
  },
  message: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: '⚠️'
  },
  confirmText: {
    type: String,
    default: 'Xác Nhận'
  },
  cancelText: {
    type: String,
    default: 'Hủy Bỏ'
  },
  confirmBtnClass: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['confirm', 'cancel']);
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-backdrop show"
    role="dialog"
    aria-modal="true"
    @click.self="emit('cancel')"
  >
    <div class="modal-content" style="max-width: 440px;">
      <div style="font-size: 3rem; text-align: center; margin-bottom: 0.5rem;">{{ icon }}</div>
      <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--warning); text-align: center;">{{ title }}</h2>
      <p class="result-message" style="margin: 0.75rem 0; text-align: center;">{{ message }}</p>
      <div class="modal-actions" style="margin-top: 1rem; display: flex; gap: 0.75rem;">
        <button
          type="button"
          class="btn-nav"
          style="flex: 1;"
          @click="emit('cancel')"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          class="btn-nav btn-primary"
          :class="confirmBtnClass"
          style="flex: 1; background: var(--danger); border-color: var(--danger);"
          @click="emit('confirm')"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>
