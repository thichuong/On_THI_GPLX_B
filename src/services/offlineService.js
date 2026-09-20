/**
 * Offline Service: Coordinates network state, offline image bulk downloading,
 * storage estimation, and Cache Storage synchronization.
 */
import { eventBus } from '../core/eventBus.js';
import { questionService } from './questionService.js';
import { dbService } from './dbService.js';

export const IMAGE_CACHE_NAME = 'gplx-images-v1';

class OfflineService {
  constructor() {
    this.isOnline = (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean')
      ? navigator.onLine
      : true;
    this.isDownloading = false;
    this._abortController = null;
    this._cachedImageUrls = null;

    if (typeof window !== 'undefined') {
      this._initNetworkListeners();
    }
  }

  _initNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[OfflineService] Network status changed: Online');
      eventBus.emit('network:status-changed', { isOnline: true });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[OfflineService] Network status changed: Offline');
      eventBus.emit('network:status-changed', { isOnline: false });
    });
  }

  /**
   * Get all distinct question image URLs from dataset
   * @returns {string[]} Normalized absolute paths e.g. ['/images/cau_36.png', ...]
   */
  getImageUrls() {
    if (this._cachedImageUrls) return this._cachedImageUrls;

    const questionsWithImages = questionService.getQuestionsWithImages();
    const urlSet = new Set();

    questionsWithImages.forEach(q => {
      if (q.image) {
        const normalized = q.image.startsWith('/') ? q.image : `/${q.image}`;
        urlSet.add(normalized);
      }
    });

    this._cachedImageUrls = Array.from(urlSet);
    return this._cachedImageUrls;
  }

  /**
   * Inspect current offline cache status for all question images
   * @returns {Promise<Object>}
   */
  async getStatus() {
    const allUrls = this.getImageUrls();
    const totalImages = allUrls.length;

    if (typeof window === 'undefined' || !window.caches) {
      return {
        isOnline: this.isOnline,
        isSupported: false,
        cachedCount: 0,
        totalImages,
        percent: 0,
        isComplete: false,
        usageBytes: 0,
        quotaBytes: 0
      };
    }

    try {
      const cache = await caches.open(IMAGE_CACHE_NAME);
      const keys = await cache.keys();
      const cachedPathSet = new Set(keys.map(req => new URL(req.url).pathname));

      let cachedCount = 0;
      allUrls.forEach(url => {
        if (cachedPathSet.has(url)) {
          cachedCount++;
        }
      });

      const isComplete = totalImages > 0 && cachedCount >= totalImages;
      const percent = totalImages > 0 ? Math.round((cachedCount / totalImages) * 100) : 0;

      // Storage quota estimation
      let usageBytes = 0;
      let quotaBytes = 0;
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        usageBytes = est.usage || 0;
        quotaBytes = est.quota || 0;
      }

      const status = {
        isOnline: this.isOnline,
        isSupported: true,
        cachedCount,
        totalImages,
        percent,
        isComplete,
        usageBytes,
        quotaBytes
      };

      // Sync to IndexedDB metadata
      dbService.setOfflineStatus({
        cachedCount,
        totalImages,
        isComplete,
        percent,
        updatedAt: new Date().toISOString()
      }).catch(() => {});

      return status;
    } catch (err) {
      console.warn('[OfflineService] Failed to check cache status:', err);
      return {
        isOnline: this.isOnline,
        isSupported: true,
        cachedCount: 0,
        totalImages,
        percent: 0,
        isComplete: false,
        usageBytes: 0,
        quotaBytes: 0
      };
    }
  }

  /**
   * Pre-download all question images into Cache Storage
   * @param {Function} [onProgress]
   * @returns {Promise<Object>} Final status
   */
  async downloadAllImages(onProgress) {
    if (this.isDownloading && this._activeDownloadPromise) {
      return this._activeDownloadPromise;
    }

    if (!this.isOnline) {
      throw new Error('Không có kết nối mạng. Vui lòng kết nối Internet để tải dữ liệu.');
    }

    if (typeof window === 'undefined' || !window.caches) {
      throw new Error('Trình duyệt không hỗ trợ Cache Storage API.');
    }

    this.isDownloading = true;
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const allUrls = this.getImageUrls();
    const total = allUrls.length;

    eventBus.emit('offline:download-start', { total });

    this._activeDownloadPromise = (async () => {
      let completed = 0;

      try {
        const cache = await caches.open(IMAGE_CACHE_NAME);
        const existingKeys = await cache.keys();
        const cachedPathSet = new Set(existingKeys.map(req => new URL(req.url).pathname));

        // Separate URLs that still need downloading
        const toDownload = allUrls.filter(url => !cachedPathSet.has(url));
        completed = allUrls.length - toDownload.length;

        if (onProgress) {
          onProgress({
            current: completed,
            total,
            percent: Math.round((completed / total) * 100),
            isDone: completed === total
          });
        }
        eventBus.emit('offline:download-progress', {
          current: completed,
          total,
          percent: Math.round((completed / total) * 100)
        });

        // Download in batches of 6 concurrent requests to optimize bandwidth
        const BATCH_SIZE = 6;
        for (let i = 0; i < toDownload.length; i += BATCH_SIZE) {
          if (signal.aborted) {
            throw new Error('Quá trình tải đã bị hủy.');
          }

          const batch = toDownload.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (url) => {
              try {
                const res = await fetch(url, { signal, cache: 'default' });
                if (res && res.status === 200) {
                  await cache.put(url, res);
                }
              } catch (fetchErr) {
                if (signal.aborted) throw fetchErr;
                console.warn(`[OfflineService] Could not cache image ${url}:`, fetchErr);
              } finally {
                completed++;
                const percent = Math.round((completed / total) * 100);
                if (onProgress) {
                  onProgress({
                    current: completed,
                    total,
                    percent,
                    isDone: completed === total
                  });
                }
                eventBus.emit('offline:download-progress', { current: completed, total, percent });
              }
            })
          );
        }

        this.isDownloading = false;
        this._activeDownloadPromise = null;
        const finalStatus = await this.getStatus();
        eventBus.emit('offline:download-complete', finalStatus);
        return finalStatus;
      } catch (err) {
        this.isDownloading = false;
        this._activeDownloadPromise = null;
        if (err.name === 'AbortError' || signal.aborted) {
          console.log('[OfflineService] Download cancelled by user');
        } else {
          console.error('[OfflineService] Download failed:', err);
        }
        throw err;
      }
    })();

    return this._activeDownloadPromise;
  }

  /**
   * Cancel active download
   */
  cancelDownload() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this.isDownloading = false;
  }

  /**
   * Delete all cached images to reclaim storage space
   */
  async clearImageCache() {
    if (typeof window === 'undefined' || !window.caches) return false;

    try {
      await caches.delete(IMAGE_CACHE_NAME);
      await dbService.setOfflineStatus({
        cachedCount: 0,
        totalImages: this.getImageUrls().length,
        isComplete: false,
        percent: 0,
        updatedAt: new Date().toISOString()
      });
      eventBus.emit('offline:cache-cleared');
      return true;
    } catch (err) {
      console.error('[OfflineService] Failed to clear image cache:', err);
      return false;
    }
  }

  /**
   * Format bytes into human readable format
   * @param {number} bytes
   * @returns {string}
   */
  formatBytes(bytes = 0) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

export const offlineService = new OfflineService();
