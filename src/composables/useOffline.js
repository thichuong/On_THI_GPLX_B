import { ref } from 'vue';
import { OfflineService } from '../services/offlineService.js';

export function useOffline() {
  const isModalOpen = ref(false);
  const isDownloading = ref(false);
  const progressPercent = ref(0);
  const progressText = ref('');
  const statusInfo = ref({
    isFullyCached: false,
    cachedCount: 0,
    totalImages: 318,
    storageUsageBytes: 0,
    lastDownloadedAt: null
  });

  async function refreshStatus() {
    try {
      const st = await OfflineService.getStatus();
      statusInfo.value = st;
    } catch (e) {
      console.warn('Failed to get offline status:', e);
    }
  }

  function openModal() {
    isModalOpen.value = true;
    refreshStatus();
  }

  function closeModal() {
    if (isDownloading.value) return; // Prevent closing while downloading
    isModalOpen.value = false;
  }

  async function startDownload() {
    if (isDownloading.value) return;
    isDownloading.value = true;
    progressPercent.value = 0;
    progressText.value = 'Đang khởi động tiến trình tải...';

    try {
      await OfflineService.downloadAllImages((completed, total, bytes) => {
        const percent = Math.round((completed / total) * 100);
        progressPercent.value = percent;
        progressText.value = `Đã tải ${completed}/${total} hình ảnh (${OfflineService.formatBytes(bytes)})`;
      });
      await refreshStatus();
      progressText.value = '✅ Hoàn tất tải trọn gói 318 ảnh offline!';
    } catch (err) {
      progressText.value = `❌ Lỗi khi tải ảnh: ${err.message}`;
    } finally {
      isDownloading.value = false;
    }
  }

  async function clearCache() {
    await OfflineService.clearCache();
    await refreshStatus();
  }

  return {
    isModalOpen,
    isDownloading,
    progressPercent,
    progressText,
    statusInfo,
    refreshStatus,
    openModal,
    closeModal,
    startDownload,
    clearCache
  };
}
