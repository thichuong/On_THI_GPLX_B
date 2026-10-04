import { onMounted, onUnmounted } from 'vue';

export function useKeyboardShortcuts({
  onSelectOption,
  onPrev,
  onNext,
  onToggleBookmark,
  onRedo
}) {
  function handleKeyDown(e) {
    const targetTag = e.target.tagName;
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
      return;
    }

    const key = e.key;

    // Option numbers 1-4
    if (['1', '2', '3', '4'].includes(key)) {
      if (typeof onSelectOption === 'function') {
        onSelectOption(Number(key));
      }
      return;
    }

    // Arrows
    if (key === 'ArrowLeft') {
      e.preventDefault();
      if (typeof onPrev === 'function') onPrev();
      return;
    }

    if (key === 'ArrowRight' || key === 'Enter') {
      e.preventDefault();
      if (typeof onNext === 'function') onNext();
      return;
    }

    // Bookmark
    if (key.toLowerCase() === 'b') {
      e.preventDefault();
      if (typeof onToggleBookmark === 'function') onToggleBookmark();
      return;
    }

    // Redo
    if (key.toLowerCase() === 'r') {
      e.preventDefault();
      if (typeof onRedo === 'function') onRedo();
      return;
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
}
