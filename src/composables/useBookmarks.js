import { ref } from 'vue';
import { StorageService } from '../services/storageService.js';

// Reactive set of bookmarked IDs
const bookmarkIds = ref(new Set(StorageService.getBookmarks()));

export function useBookmarks() {
  function refresh() {
    bookmarkIds.value = new Set(StorageService.getBookmarks());
  }

  function toggle(questionId) {
    const isNowBookmarked = StorageService.toggleBookmark(questionId);
    refresh();
    return isNowBookmarked;
  }

  function isBookmarked(questionId) {
    return bookmarkIds.value.has(Number(questionId));
  }

  return {
    bookmarkIds,
    toggle,
    isBookmarked,
    refresh
  };
}
