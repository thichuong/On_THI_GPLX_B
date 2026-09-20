/**
 * Offline Modal Component: Inspects offline cache, triggers bulk image pre-download,
 * displays download progress, and manages local cache cleanup.
 */
import { offlineService } from '../services/offlineService.js';
import { eventBus } from '../core/eventBus.js';
import { $ } from '../utils/dom.js';

export class OfflineModal {
  constructor() {
    this.modalEl = null;
    this.status = null;
    this._isOpen = false;
    this._isDownloadWorkflowActive = false;
  }

  init() {
    this.modalEl = $('#offline-modal');
    if (!this.modalEl) return;

    this._bindEvents();
    this._listenToBus();
  }

  _bindEvents() {
    // Close modal on backdrop or close button
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl || e.target.closest('#close-offline-modal-btn')) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._isOpen) {
        this.close();
      }
    });
  }

  _listenToBus() {
    eventBus.on('network:status-changed', () => {
      if (this._isOpen) this.refresh();
    });

    eventBus.on('offline:download-start', () => {
      if (this._isOpen) {
        this._setDownloadingUI(true);
      }
    });

    eventBus.on('offline:download-progress', (data) => {
      if (this._isOpen) {
        this._updateProgress(data);
      }
    });

    eventBus.on('offline:download-complete', () => {
      this.refresh();
    });

    eventBus.on('offline:cache-cleared', () => {
      this.refresh();
    });
  }

  async open() {
    if (!this.modalEl) return;
    this._isOpen = true;
    this.modalEl.classList.add('show');
    this.modalEl.setAttribute('aria-hidden', 'false');
    await this.refresh();
  }

  close() {
    if (!this.modalEl) return;
    this._isOpen = false;
    this.modalEl.classList.remove('show');
    this.modalEl.setAttribute('aria-hidden', 'true');
  }

  async refresh() {
    if (!this.modalEl) return;
    this.status = await offlineService.getStatus();
    this._render();
  }

  /**
   * Start downloading and display downloading interface immediately
   */
  async startDownloadWorkflow() {
    this._isOpen = true;
    this._isDownloadWorkflowActive = true;
    if (this.modalEl) {
      this.modalEl.classList.add('show');
      this.modalEl.setAttribute('aria-hidden', 'false');
    }

    this.status = await offlineService.getStatus();
    this._render();

    try {
      await offlineService.downloadAllImages((prog) => {
        this._updateProgress(prog);
      });
    } catch (err) {
      if (err.name !== 'AbortError' && err.message !== 'Quá trình tải đã bị hủy.') {
        console.warn('[OfflineModal] Download workflow error:', err);
      }
    } finally {
      this._isDownloadWorkflowActive = false;
      await this.refresh();
    }
  }

  _setDownloadingUI(isDownloading) {
    if (!this.modalEl) return;

    const progContainer = $('#offline-progress-container', this.modalEl);
    const startBtn = $('#btn-start-download', this.modalEl);
    const readinessBanner = $('.offline-readiness-banner', this.modalEl);

    if (progContainer) {
      progContainer.style.display = isDownloading ? 'block' : 'none';
    }

    if (startBtn) {
      if (isDownloading) {
        startBtn.setAttribute('disabled', 'true');
        startBtn.textContent = '⏳ Đang tải dữ liệu...';
      } else {
        startBtn.removeAttribute('disabled');
      }
    }

    if (readinessBanner && isDownloading) {
      readinessBanner.className = 'offline-readiness-banner downloading';
      readinessBanner.innerHTML = `
        <span class="banner-icon">⏳</span>
        <div class="banner-text">
          <strong>Đang tự động tải dữ liệu Offline...</strong><br/>
          Vui lòng đợi giây lát để tải toàn bộ 318 hình ảnh sa hình & biển báo.
        </div>
      `;
    }
  }

  _render() {
    if (!this.modalEl || !this.status) return;

    const {
      isOnline,
      cachedCount,
      totalImages,
      percent,
      isComplete,
      usageBytes
    } = this.status;

    const isDownloading = offlineService.isDownloading || this._isDownloadWorkflowActive;

    this.modalEl.innerHTML = `
      <div class="modal-content offline-modal-content">
        <div class="offline-modal-header">
          <div class="offline-modal-title-box">
            <h2 class="offline-modal-title">💾 Dữ Liệu & Chế Độ Offline</h2>
            <p class="offline-modal-sub">Học và thi sát hạch 100% không cần kết nối mạng</p>
          </div>
          <button id="close-offline-modal-btn" class="mobile-sheet-close-btn" aria-label="Đóng">✕</button>
        </div>

        <!-- Network & Storage Status Card -->
        <div class="offline-status-card">
          <div class="status-row">
            <span class="status-lbl">Trạng thái mạng:</span>
            <span class="status-badge ${isOnline ? 'online' : 'offline'}">
              ${isOnline ? '🟢 Đang Online' : '🟠 Đang Offline'}
            </span>
          </div>

          <div class="status-row">
            <span class="status-lbl">Hình ảnh đã lưu:</span>
            <span class="status-val"><strong>${cachedCount}</strong> / ${totalImages} ảnh (${percent}%)</span>
          </div>

          <div class="status-row">
            <span class="status-lbl">Dung lượng bộ nhớ:</span>
            <span class="status-val">${offlineService.formatBytes(usageBytes)}</span>
          </div>

          <div class="offline-readiness-banner ${isDownloading ? 'downloading' : (isComplete ? 'ready' : 'not-ready')}">
            ${isDownloading ? `
              <span class="banner-icon">⏳</span>
              <div class="banner-text">
                <strong>Đang tự động tải dữ liệu Offline...</strong><br/>
                Vui lòng đợi giây lát để tải toàn bộ 318 hình ảnh sa hình & biển báo.
              </div>
            ` : (isComplete ? `
              <span class="banner-icon">✅</span>
              <div class="banner-text">
                <strong>Đã sẵn sàng 100% Offline!</strong><br/>
                Bạn có thể tắt Wi-Fi / 4G và làm bài thi bình thường.
              </div>
            ` : `
              <span class="banner-icon">⚡</span>
              <div class="banner-text">
                <strong>Chưa lưu đủ hình ảnh.</strong><br/>
                Tải toàn bộ ảnh để không bị lỗi ảnh sa hình & biển báo khi mất mạng.
              </div>
            `)}
          </div>
        </div>

        <!-- Download Progress Container (Visible during download) -->
        <div id="offline-progress-container" class="offline-progress-container" style="display: ${isDownloading ? 'block' : 'none'};">
          <div class="progress-bar-wrap">
            <div id="offline-progress-fill" class="progress-bar-fill" style="width: ${percent}%;"></div>
          </div>
          <div class="progress-info-row">
            <span id="offline-progress-text">Đang tải: ${cachedCount}/${totalImages} (${percent}%)</span>
            <button id="btn-cancel-offline-download" class="btn-cancel-download">Hủy</button>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="offline-actions">
          ${!isComplete ? `
            <button id="btn-start-download" class="btn-primary btn-offline-action" ${(!isOnline || isDownloading) ? 'disabled' : ''}>
              ${isDownloading ? '⏳ Đang tải dữ liệu...' : '📥 Tải Toàn Bộ Hình Ảnh (100% Offline)'}
            </button>
          ` : `
            <button id="btn-start-download" class="btn-nav btn-offline-action" ${(!isOnline || isDownloading) ? 'disabled' : ''}>
              ${isDownloading ? '⏳ Đang tải dữ liệu...' : '🔄 Kiểm Tra & Tải Lại Toàn Bộ Ảnh'}
            </button>
          `}

          ${cachedCount > 0 ? `
            <button id="btn-clear-cache" class="btn-danger-outline btn-offline-action" ${isDownloading ? 'disabled' : ''}>
              🗑️ Xóa Bộ Nhớ Đệm Hình Ảnh
            </button>
          ` : ''}
        </div>
      </div>
    `;

    this._bindActionButtons();
  }

  _bindActionButtons() {
    const startBtn = $('#btn-start-download', this.modalEl);
    const clearBtn = $('#btn-clear-cache', this.modalEl);
    const cancelBtn = $('#btn-cancel-offline-download', this.modalEl);

    startBtn?.addEventListener('click', () => {
      this.startDownloadWorkflow();
    });

    cancelBtn?.addEventListener('click', () => {
      offlineService.cancelDownload();
      this.refresh();
    });

    clearBtn?.addEventListener('click', async () => {
      const ok = confirm('Bạn có chắc chắn muốn xóa bộ nhớ đệm hình ảnh không? Các hình ảnh sẽ cần được tải lại khi có mạng.');
      if (ok) {
        await offlineService.clearImageCache();
        await this.refresh();
      }
    });
  }

  _updateProgress({ current, total, percent }) {
    if (!this.modalEl) return;

    this._setDownloadingUI(true);

    const fill = $('#offline-progress-fill', this.modalEl);
    const text = $('#offline-progress-text', this.modalEl);
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `Đang tải: ${current}/${total} (${percent}%)`;
  }
}

export const offlineModal = new OfflineModal();
