<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { StorageService } from './services/storageService.js';
import { offlineService } from './services/offlineService.js';
import { pwaService } from './services/pwaService.js';
import { eventBus } from './core/eventBus.js';

import HeaderNav from './components/HeaderNav.vue';
import MobileBottomSheet from './components/MobileBottomSheet.vue';
import SettingsSheet from './components/SettingsSheet.vue';
import OfflineModal from './components/OfflineModal.vue';
import LightboxModal from './components/LightboxModal.vue';
import ToastNotification from './components/ToastNotification.vue';

import ExamView from './views/ExamView.vue';
import ChapterView from './views/ChapterView.vue';
import PracticeView from './views/PracticeView.vue';
import SearchExplorerView from './views/SearchExplorerView.vue';

const validModes = ['exam', 'quick-exam', 'critical', 'chapter', 'all', 'mistakes', 'bookmarks'];

// Parse initial mode from URL hash
function getInitialMode() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  return validModes.includes(hash) ? hash : 'exam';
}

const currentMode = ref(getInitialMode());
const isOnline = ref(navigator.onLine);
const isOfflineReady = ref(false);

const isMobileMenuOpen = ref(false);
const isSettingsOpen = ref(false);
const isOfflineModalOpen = ref(false);

// Toast
const isToastVisible = ref(false);
const toastMessage = ref('');
const toastType = ref('info');
let toastTimeout = null;

function showToast(msg, type = 'info', duration = 4000) {
  toastMessage.value = msg;
  toastType.value = type;
  isToastVisible.value = true;

  if (toastTimeout) clearTimeout(toastTimeout);
  if (duration > 0) {
    toastTimeout = setTimeout(() => {
      isToastVisible.value = false;
    }, duration);
  }
}

function setMode(newMode) {
  if (!validModes.includes(newMode)) return;
  currentMode.value = newMode;
  window.location.hash = `#${newMode}`;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleHashChange() {
  const mode = getInitialMode();
  if (mode !== currentMode.value) {
    currentMode.value = mode;
  }
}

async function checkOfflineStatus() {
  try {
    const st = await offlineService.getStatus();
    isOfflineReady.value = st.isComplete;
  } catch (e) {
    console.warn('Failed to check offline status:', e);
  }
}

function handleNetworkChange() {
  isOnline.value = navigator.onLine;
  if (!isOnline.value) {
    showToast('📶 Bạn đang ở chế độ Offline. Dữ liệu và đề thi vẫn hoạt động bình thường!', 'offline', 5000);
  } else {
    showToast('🟢 Đã kết nối lại Internet.', 'online', 3500);
  }
}

onMounted(() => {
  StorageService.init();
  pwaService.init();
  checkOfflineStatus();

  window.addEventListener('hashchange', handleHashChange);
  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('offline', handleNetworkChange);

  eventBus.on('network:status-changed', ({ isOnline: online }) => {
    isOnline.value = online;
  });

  eventBus.on('offline:download-complete', () => {
    isOfflineReady.value = true;
    checkOfflineStatus();
  });

  eventBus.on('offline:cache-cleared', () => {
    isOfflineReady.value = false;
    checkOfflineStatus();
  });

  eventBus.on('toast:show', ({ message, type = 'info', duration = 4000 }) => {
    showToast(message, type, duration);
  });

  eventBus.on('pwa:standalone-missing-cache', () => {
    showToast(
      `<span>📲 Đang dùng App cài đặt. Bạn có muốn tải trọn gói 318 hình ảnh để học Offline không?</span>`,
      'online',
      8000
    );
  });
});

onUnmounted(() => {
  window.removeEventListener('hashchange', handleHashChange);
  window.removeEventListener('online', handleNetworkChange);
  window.removeEventListener('offline', handleNetworkChange);
});
</script>

<template>
  <div class="app-layout">
    <!-- Header -->
    <HeaderNav
      :current-mode="currentMode"
      :is-online="isOnline"
      :offline-ready="isOfflineReady"
      @change-mode="setMode"
      @open-mobile-menu="isMobileMenuOpen = true"
      @open-settings="isSettingsOpen = true"
      @open-offline-modal="isOfflineModalOpen = true"
    />

    <!-- Main View Switcher -->
    <main id="app-main" class="app-container">
      <ExamView
        v-if="currentMode === 'exam'"
        key="exam"
        exam-type="standard"
      />
      <ExamView
        v-else-if="currentMode === 'quick-exam'"
        key="quick-exam"
        exam-type="quick"
      />
      <PracticeView
        v-else-if="currentMode === 'critical'"
        key="critical"
        mode="critical"
        title="60 Câu Điểm Liệt"
        @navigate-mode="setMode"
      />
      <ChapterView
        v-else-if="currentMode === 'chapter'"
        key="chapter"
      />
      <SearchExplorerView
        v-else-if="currentMode === 'all'"
        key="all"
      />
      <PracticeView
        v-else-if="currentMode === 'mistakes'"
        key="mistakes"
        mode="mistakes"
        title="Danh Sách Câu Hay Sai"
        @navigate-mode="setMode"
      />
      <PracticeView
        v-else-if="currentMode === 'bookmarks'"
        key="bookmarks"
        mode="bookmarks"
        title="Câu Hỏi Đã Đánh Dấu"
        @navigate-mode="setMode"
      />
    </main>

    <!-- Footer -->
    <footer class="app-footer">
      <p>© 2025 Ứng dụng Ôn thi Sát hạch Lái xe 600 Câu Hỏi. Biên soạn theo tài liệu Cục Cảnh sát giao thông & Luật Trật tự, ATGT đường bộ.</p>
    </footer>

    <!-- Sheets & Modals -->
    <MobileBottomSheet
      :is-open="isMobileMenuOpen"
      :current-mode="currentMode"
      @select-mode="setMode"
      @close="isMobileMenuOpen = false"
    />

    <SettingsSheet
      :is-open="isSettingsOpen"
      :offline-ready="isOfflineReady"
      @open-offline="isOfflineModalOpen = true"
      @close="isSettingsOpen = false"
    />

    <OfflineModal
      :is-open="isOfflineModalOpen"
      @close="isOfflineModalOpen = false"
      @cache-cleared="isOfflineReady = false; checkOfflineStatus()"
    />

    <LightboxModal />

    <ToastNotification
      :is-visible="isToastVisible"
      :message="toastMessage"
      :type="toastType"
    />
  </div>
</template>
