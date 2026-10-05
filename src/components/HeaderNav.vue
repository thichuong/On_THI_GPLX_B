<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useTheme } from '../composables/useTheme.js';
import { eventBus } from '../core/eventBus.js';

const props = defineProps({
  currentMode: {
    type: String,
    required: true
  },
  isOnline: {
    type: Boolean,
    default: true
  },
  offlineReady: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'change-mode',
  'open-mobile-menu',
  'open-settings',
  'open-offline-modal'
]);

const { theme, themeIcon, themeLabel, toggleTheme } = useTheme();

const themeBtnTitle = computed(() => {
  if (theme.value === 'system') return 'Giao diện: Hệ thống (tự động theo thiết bị). Bấm để chuyển sang Sáng';
  if (theme.value === 'light') return 'Giao diện: Sáng. Bấm để chuyển sang Tối';
  return 'Giao diện: Tối. Bấm để chuyển sang Hệ thống';
});

const isReady = ref(props.offlineReady);

watch(() => props.offlineReady, (val) => {
  isReady.value = val;
});

onMounted(() => {
  eventBus.on('offline:cache-cleared', () => {
    isReady.value = false;
  });
  eventBus.on('offline:download-complete', () => {
    isReady.value = true;
  });
});

const modes = [
  { id: 'exam', icon: '📝', label: 'Thi Thử (30 Câu)' },
  { id: 'quick-exam', icon: '⚡', label: 'Thi Nhanh (20 Câu)' },
  { id: 'critical', icon: '⚠️', label: '60 Câu Điểm Liệt' },
  { id: 'chapter', icon: '📚', label: 'Ôn Theo Chương' },
  { id: 'all', icon: '🔍', label: 'Tra Cứu 600 Câu' },
  { id: 'mistakes', icon: '❌', label: 'Câu Sai' },
  { id: 'bookmarks', icon: '⭐', label: 'Đã Lưu' }
];

const currentModeInfo = computed(() => {
  return modes.find(m => m.id === props.currentMode) || modes[0];
});
</script>

<template>
  <header class="app-header">
    <!-- Brand -->
    <div class="brand-container">
      <div class="brand-logo">
        <img src="/logo.svg" alt="Logo Ôn Thi Sát Hạch 600 Câu" width="38" height="38" />
      </div>
      <div class="brand-info">
        <h1>Ôn Thi Sát Hạch 600 Câu</h1>
        <p>Bộ câu hỏi Luật TTATGTĐB 2025 (Cục CSGT)</p>
      </div>
    </div>

    <!-- Desktop Nav Tabs -->
    <nav class="nav-tabs" aria-label="Chế độ học">
      <button
        v-for="m in modes"
        :key="m.id"
        type="button"
        class="tab-btn"
        :class="{ active: currentMode === m.id }"
        :data-mode="m.id"
        @click="emit('change-mode', m.id)"
      >
        <span>{{ m.icon }} {{ m.label }}</span>
      </button>
    </nav>

    <!-- Mobile Menu Trigger -->
    <button
      type="button"
      id="mobile-menu-btn"
      class="mobile-menu-btn"
      aria-label="Mở menu chọn chế độ"
      aria-expanded="false"
      @click="emit('open-mobile-menu')"
    >
      <div class="mobile-menu-btn-content">
        <span class="mobile-menu-btn-icon">{{ currentModeInfo.icon }}</span>
        <div class="mobile-menu-btn-labels">
          <span class="mobile-menu-btn-sub">Chế độ đang chọn</span>
          <span class="mobile-menu-btn-title">{{ currentModeInfo.label }}</span>
        </div>
      </div>
      <div class="mobile-menu-btn-action">
        <span class="mobile-menu-btn-pill">Đổi</span>
        <svg class="mobile-menu-btn-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </div>
    </button>

    <!-- Header Actions (Desktop & Mobile) -->
    <div class="header-actions">
      <!-- Offline Status Pill (Lưu local) -->
      <button
        type="button"
        id="offline-status-btn"
        class="header-icon-btn offline-status-btn offline-btn"
        :class="{ 'cache-ready': isReady }"
        :title="isReady ? 'Đã lưu trọn bộ dữ liệu offline' : 'Lưu dữ liệu Offline'"
        :aria-label="isReady ? 'Đã lưu trọn bộ dữ liệu offline' : 'Lưu dữ liệu Offline'"
        @click="emit('open-offline-modal')"
      >
        <span class="offline-icon">💾</span>
        <span v-if="isReady" class="offline-check-badge" aria-label="Đã lưu offline">
          <svg viewBox="0 0 12 12" width="9" height="9" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="2.5 6.2 4.8 8.5 9.5 3.5"></polyline>
          </svg>
        </span>
      </button>

      <!-- Theme Toggle (Hệ thống / Sáng / Tối) -->
      <button
        type="button"
        id="theme-toggle-btn"
        class="header-icon-btn theme-toggle-btn"
        :title="themeBtnTitle"
        :aria-label="themeBtnTitle"
        @click="toggleTheme"
      >
        <span class="theme-icon">{{ themeIcon }}</span>
      </button>

      <!-- Settings Button (Cài đặt) -->
      <button
        type="button"
        id="settings-btn"
        class="header-icon-btn mobile-settings-btn settings-btn"
        title="Cài đặt & Trợ giúp"
        aria-label="Cài đặt & Trợ giúp"
        @click="emit('open-settings')"
      >
        <span class="settings-icon">⚙️</span>
      </button>
    </div>
  </header>
</template>
