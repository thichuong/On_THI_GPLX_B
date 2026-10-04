<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { offlineService } from '../services/offlineService.js';
import { eventBus } from '../core/eventBus.js';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'cache-cleared']);

const status = ref({
  isOnline: navigator.onLine,
  cachedCount: 0,
  totalImages: 318,
  percent: 0,
  isComplete: false,
  usageBytes: 0
});

const isDownloading = ref(false);
const isClearing = ref(false);
const progressPercent = ref(0);
const progressDetails = ref('');

async function refreshStatus() {
  try {
    status.value = await offlineService.getStatus();
    progressPercent.value = status.value.percent;
  } catch (err) {
    console.warn('[OfflineModal.vue] refreshStatus error:', err);
  }
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    refreshStatus();
  }
});

async function handleStartDownload() {
  if (isDownloading.value) return;
  isDownloading.value = true;
  progressPercent.value = 0;
  progressDetails.value = 'Đang bắt đầu tải...';

  try {
    await offlineService.downloadAllImages((prog) => {
      progressPercent.value = prog.percent;
      progressDetails.value = `Đã tải ${prog.completed}/${prog.total} hình ảnh (${offlineService.formatBytes(prog.bytes)})`;
    });
  } catch (err) {
    if (err.name !== 'AbortError' && err.message !== 'Quá trình tải đã bị hủy.') {
      progressDetails.value = `Lỗi tải: ${err.message}`;
    }
  } finally {
    isDownloading.value = false;
    await refreshStatus();
  }
}

async function handleClearCache() {
  if (!confirm('Bạn có chắc chắn muốn xóa bộ nhớ đệm hình ảnh offline không? Các hình ảnh sẽ cần được tải lại khi có mạng.')) {
    return;
  }
  isClearing.value = true;
  try {
    await offlineService.clearCache();
    emit('cache-cleared');

    // Optimistically update local status to immediately refresh UI
    status.value = {
      ...status.value,
      cachedCount: 0,
      percent: 0,
      isComplete: false,
      usageBytes: 0
    };
    progressPercent.value = 0;

    await refreshStatus();
    eventBus.emit('toast:show', {
      message: '🗑️ Đã xóa bộ nhớ đệm hình ảnh offline thành công!',
      type: 'info'
    });
  } catch (err) {
    console.error('[OfflineModal.vue] Lỗi khi xóa cache:', err);
  } finally {
    isClearing.value = false;
  }
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && props.isOpen && !isDownloading.value) {
    emit('close');
  }
}

onMounted(() => {
  refreshStatus();
  window.addEventListener('keydown', handleKeyDown);
  eventBus.on('network:status-changed', refreshStatus);
  eventBus.on('offline:download-complete', refreshStatus);
  eventBus.on('offline:cache-cleared', refreshStatus);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div
    v-if="isOpen"
    class="modal-backdrop show"
    id="offline-modal"
    role="dialog"
    aria-modal="true"
    @click.self="!isDownloading && emit('close')"
  >
    <div class="modal-content offline-modal-content" style="max-width: 520px;">
      <div class="offline-modal-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div class="offline-modal-title-box">
          <h2 class="offline-modal-title" style="font-size: 1.25rem; font-weight: 700; color: var(--text-primary); margin: 0;">💾 Dữ Liệu & Chế Độ Offline</h2>
          <p class="offline-modal-sub" style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0 0;">Học và thi sát hạch 100% không cần kết nối mạng</p>
        </div>
        <button
          type="button"
          class="mobile-sheet-close-btn"
          aria-label="Đóng"
          :disabled="isDownloading"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Network & Storage Status Card -->
      <div class="offline-status-card" style="background: rgba(0,0,0,0.15); border-radius: var(--radius-lg); padding: 1rem; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.75rem;">
        <div class="status-row" style="display: flex; justify-content: space-between; align-items: center;">
          <span class="status-lbl" style="font-size: 0.9rem; color: var(--text-secondary);">Trạng thái mạng:</span>
          <span class="status-badge" :class="status.isOnline ? 'online' : 'offline'" style="font-weight: 600; font-size: 0.85rem;">
            {{ status.isOnline ? '🟢 Đang Online' : '🟠 Đang Offline' }}
          </span>
        </div>

        <div class="status-row" style="display: flex; justify-content: space-between; align-items: center;">
          <span class="status-lbl" style="font-size: 0.9rem; color: var(--text-secondary);">Hình ảnh đã lưu:</span>
          <span class="status-val" style="font-weight: 700; color: var(--text-primary);">
            {{ status.cachedCount }} / {{ status.totalImages }} ảnh ({{ status.percent }}%)
          </span>
        </div>

        <div class="status-row" style="display: flex; justify-content: space-between; align-items: center;">
          <span class="status-lbl" style="font-size: 0.9rem; color: var(--text-secondary);">Dung lượng bộ nhớ:</span>
          <span class="status-val" style="font-weight: 700; color: var(--text-primary);">
            {{ offlineService.formatBytes(status.usageBytes) }}
          </span>
        </div>
      </div>

      <!-- Readiness Banner -->
      <div
        class="offline-readiness-banner"
        :class="{ complete: status.isComplete, partial: !status.isComplete && !isDownloading, downloading: isDownloading }"
        style="margin: 1.25rem 0; padding: 0.9rem 1rem; border-radius: var(--radius-md); display: flex; gap: 0.75rem; align-items: center; border: 1px solid var(--border-color);"
      >
        <span class="banner-icon" style="font-size: 1.5rem;">
          {{ isDownloading ? '⏳' : (status.isComplete ? '🎉' : '⚠️') }}
        </span>
        <div class="banner-text" style="font-size: 0.875rem;">
          <template v-if="isDownloading">
            <strong>Đang tải dữ liệu Offline...</strong><br />
            Vui lòng không đóng trang trong lúc đang tải 318 hình ảnh.
          </template>
          <template v-else-if="status.isComplete">
            <strong style="color: #10b981;">Đã sẵn sàng học Offline 100%!</strong><br />
            Toàn bộ 600 câu hỏi và 318 hình ảnh đã được lưu vào máy bạn.
          </template>
          <template v-else>
            <strong style="color: #f59e0b;">Chưa lưu đủ hình ảnh Offline</strong><br />
            Một số câu sa hình & biển báo có thể không hiển thị khi mất mạng.
          </template>
        </div>
      </div>

      <!-- Progress Container -->
      <div v-if="isDownloading" class="offline-progress-container" style="margin-bottom: 1.25rem;">
        <div class="offline-progress-bar-bg" style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
          <div class="offline-progress-bar-fill" :style="{ width: `${progressPercent}%` }" style="height: 100%; background: var(--accent-primary); transition: width 0.2s ease;"></div>
        </div>
        <div class="offline-progress-text" style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.4rem; text-align: center;">
          {{ progressDetails || `Đang tải ${progressPercent}%...` }}
        </div>
      </div>

      <!-- Actions -->
      <div class="offline-modal-actions" style="display: flex; gap: 0.75rem;">
        <button
          v-if="!status.isComplete"
          type="button"
          class="btn-nav btn-primary"
          id="btn-start-download"
          style="flex: 1;"
          :disabled="isDownloading"
          @click="handleStartDownload"
        >
          {{ isDownloading ? '⏳ Đang tải...' : '📥 Tải Trọn Bộ 318 Ảnh Offline' }}
        </button>

        <button
          v-if="status.cachedCount > 0 || status.isComplete"
          type="button"
          class="btn-nav"
          id="btn-clear-cache"
          :disabled="isDownloading || isClearing"
          style="color: var(--danger); border-color: rgba(239,68,68,0.4);"
          @click="handleClearCache"
        >
          {{ isClearing ? '⏳ Đang xóa...' : '🗑️ Xóa Bộ Nhớ Đệm' }}
        </button>
      </div>
    </div>
  </div>
</template>
