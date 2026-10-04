import { ref } from 'vue';

const isOpen = ref(false);
const currentImageUrl = ref('');
const currentAlt = ref('');

export function useLightbox() {
  function open(url, alt = 'Hình ảnh câu hỏi') {
    if (!url) return;
    currentImageUrl.value = url;
    currentAlt.value = alt;
    isOpen.value = true;
    document.body.style.overflow = 'hidden';
  }

  function close() {
    isOpen.value = false;
    currentImageUrl.value = '';
    currentAlt.value = '';
    document.body.style.overflow = '';
  }

  return {
    isOpen,
    currentImageUrl,
    currentAlt,
    open,
    close
  };
}
