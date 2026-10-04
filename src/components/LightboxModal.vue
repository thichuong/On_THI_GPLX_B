<script setup>
import { onMounted, onUnmounted } from 'vue';
import { useLightbox } from '../composables/useLightbox.js';

const { isOpen, currentImageUrl, currentAlt, close } = useLightbox();

function handleKeyDown(e) {
  if (e.key === 'Escape' && isOpen.value) {
    close();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-backdrop show"
    id="lightbox-modal"
    role="dialog"
    aria-modal="true"
    @click.self="close"
  >
    <div class="lightbox-content" style="position: relative; max-width: 90vw; max-height: 90vh;">
      <button
        type="button"
        class="lightbox-close"
        id="lightbox-close"
        aria-label="Đóng phóng to ảnh"
        style="position: absolute; top: -14px; right: -14px; width: 36px; height: 36px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-primary); font-size: 1.25rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md); z-index: 10;"
        @click="close"
      >
        &times;
      </button>
      <img
        :src="currentImageUrl"
        :alt="currentAlt"
        class="lightbox-img"
        id="lightbox-img"
        style="max-width: 100%; max-height: 85vh; border-radius: var(--radius-lg); object-fit: contain; box-shadow: var(--shadow-lg);"
      />
    </div>
  </div>
</template>
