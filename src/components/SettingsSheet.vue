<script setup>
import { useTheme } from '../composables/useTheme.js';
import { pwaService } from '../services/pwaService.js';

defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  offlineReady: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'open-offline']);

const { theme, toggleTheme } = useTheme();

function handleInstallApp() {
  pwaService.promptInstall();
  emit('close');
}

function handleOfflineClick() {
  emit('open-offline');
  emit('close');
}
</script>

<template>
  <div
    v-if="isOpen"
    id="mobile-settings-sheet"
    class="mobile-sheet-backdrop show"
    role="dialog"
    aria-modal="true"
    aria-labelledby="mobile-settings-title"
    @click.self="emit('close')"
  >
    <div class="mobile-sheet-container">
      <div class="mobile-sheet-handle-bar">
        <span class="mobile-sheet-handle"></span>
      </div>
      <div class="mobile-sheet-header">
        <div class="mobile-sheet-title-box">
          <h2 id="mobile-settings-title" class="mobile-sheet-title">⚙️ Cài Đặt & Tiện Ích</h2>
          <p class="mobile-sheet-subtitle">Tùy chỉnh giao diện, offline và cài đặt ứng dụng</p>
        </div>
        <button
          type="button"
          id="close-mobile-settings-btn"
          class="mobile-sheet-close-btn"
          aria-label="Đóng bảng cài đặt"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>
      <div class="mobile-sheet-content">
        <div class="mobile-settings-list" role="list">
          <!-- 1. Giao diện Sáng / Tối -->
          <button
            type="button"
            id="mobile-sheet-theme-btn"
            class="mobile-setting-card"
            role="listitem"
            @click="toggleTheme"
          >
            <div class="mode-card-icon" id="mobile-sheet-theme-icon">
              {{ theme === 'dark' ? '☀️' : '🌙' }}
            </div>
            <div class="mode-card-info">
              <div class="mode-card-name" id="mobile-sheet-theme-title">
                Giao diện: {{ theme === 'dark' ? 'Tối' : 'Sáng' }}
              </div>
              <div class="mode-card-desc">Chạm để chuyển đổi Sáng / Tối</div>
            </div>
            <div class="mobile-setting-action">
              <span class="mobile-setting-pill" id="mobile-sheet-theme-pill">Đổi</span>
            </div>
          </button>

          <!-- 2. Dữ liệu Offline -->
          <button
            type="button"
            id="mobile-sheet-offline-btn"
            class="mobile-setting-card"
            role="listitem"
            @click="handleOfflineClick"
          >
            <div class="mode-card-icon" id="mobile-sheet-offline-icon">💾</div>
            <div class="mode-card-info">
              <div class="mode-card-name">Dữ Liệu Học Offline</div>
              <div class="mode-card-desc" id="mobile-sheet-offline-desc">
                {{ offlineReady ? 'Đã tải trọn bộ 318 hình ảnh' : 'Tải trọn gói 318 hình ảnh để học không cần mạng' }}
              </div>
            </div>
            <div class="mobile-setting-action">
              <span class="mobile-setting-pill" id="mobile-sheet-offline-pill">Quản lý</span>
            </div>
          </button>

          <!-- 3. Cài đặt App (PWA) -->
          <button
            type="button"
            id="mobile-sheet-install-btn"
            class="mobile-setting-card"
            role="listitem"
            @click="handleInstallApp"
          >
            <div class="mode-card-icon">📲</div>
            <div class="mode-card-info">
              <div class="mode-card-name">Cài Đặt App Vào Điện Thoại</div>
              <div class="mode-card-desc">Truy cập nhanh từ màn hình chính</div>
            </div>
            <div class="mobile-setting-action">
              <span class="mobile-setting-pill">Cài đặt</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
