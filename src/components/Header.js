/**
 * Header Component: Top navbar with brand, mode navigation tabs, theme toggle,
 * and Mobile bottom menu sheet controller.
 */
import { StorageService } from '../services/storageService.js';
import { offlineModal } from './OfflineModal.js';
import { offlineService } from '../services/offlineService.js';
import { pwaService } from '../services/pwaService.js';
import { eventBus } from '../core/eventBus.js';
import { $, $$ } from '../utils/dom.js';

export const MODE_CONFIGS = {
  'exam': {
    title: 'Thi Thử Chuẩn (30 Câu)',
    shortTitle: 'Thi Thử (30 Câu)',
    icon: '📝'
  },
  'quick-exam': {
    title: 'Thi Nhanh Cấp Tốc (20 Câu)',
    shortTitle: 'Thi Nhanh (20 Câu)',
    icon: '⚡'
  },
  'critical': {
    title: '60 Câu Điểm Liệt',
    shortTitle: '60 Câu Điểm Liệt',
    icon: '⚠️'
  },
  'chapter': {
    title: 'Ôn Tập Theo Chương',
    shortTitle: 'Ôn Theo Chương',
    icon: '📚'
  },
  'all': {
    title: 'Tra Cứu 600 Câu',
    shortTitle: 'Tra Cứu 600 Câu',
    icon: '🔍'
  },
  'mistakes': {
    title: 'Danh Sách Câu Hay Sai',
    shortTitle: 'Câu Hay Sai',
    icon: '❌'
  },
  'bookmarks': {
    title: 'Câu Hỏi Đã Đánh Dấu',
    shortTitle: 'Câu Đã Đánh Dấu',
    icon: '⭐'
  }
};

export class Header {
  constructor() {
    this.headerEl = null;
    this.themeToggleBtn = null;
    this.themeIcon = null;
    this.navTabs = [];
    this.onModeChangeCallback = null;

    // Mobile specific elements
    this.mobileMenuBtn = null;
    this.mobileCurrentIcon = null;
    this.mobileCurrentTitle = null;
    this.mobileModeSheet = null;
    this.closeMobileSheetBtn = null;
    this.mobileModeCards = [];

    if (typeof document !== 'undefined') {
      this._queryElements();
    }
  }

  _queryElements() {
    this.headerEl = document.querySelector('.app-header');
    this.themeToggleBtn = $('#theme-toggle-btn');
    this.themeIcon = $('#theme-icon');
    this.installPwaBtn = $('#install-pwa-btn');
    this.offlineBtn = $('#offline-btn');
    this.offlineIcon = $('#offline-icon');
    this.offlineLabel = $('#offline-label');
    this.mobileSettingsBtn = $('#mobile-settings-btn');
    this.navTabs = $$('.tab-btn');
    this.mobileMenuBtn = $('#mobile-menu-btn');
    this.mobileCurrentIcon = $('#mobile-current-icon');
    this.mobileCurrentTitle = $('#mobile-current-title');
    this.mobileModeSheet = $('#mobile-mode-sheet');
    this.closeMobileSheetBtn = $('#close-mobile-sheet-btn');
    this.mobileModeCards = $$('.mobile-mode-card');

    // Mobile Settings Bottom Sheet elements
    this.mobileSettingsSheet = $('#mobile-settings-sheet');
    this.closeMobileSettingsBtn = $('#close-mobile-settings-btn');
    this.mobileSheetThemeBtn = $('#mobile-sheet-theme-btn');
    this.mobileSheetThemeIcon = $('#mobile-sheet-theme-icon');
    this.mobileSheetThemeTitle = $('#mobile-sheet-theme-title');
    this.mobileSheetThemePill = $('#mobile-sheet-theme-pill');
    this.mobileSheetOfflineBtn = $('#mobile-sheet-offline-btn');
    this.mobileSheetOfflineIcon = $('#mobile-sheet-offline-icon');
    this.mobileSheetOfflineDesc = $('#mobile-sheet-offline-desc');
    this.mobileSheetOfflinePill = $('#mobile-sheet-offline-pill');
    this.mobileSheetInstallBtn = $('#mobile-sheet-install-btn');
    this.mobileSheetInstallTitle = $('#mobile-sheet-install-title');
    this.mobileSheetInstallDesc = $('#mobile-sheet-install-desc');
    this.mobileSheetInstallPill = $('#mobile-sheet-install-pill');
  }

  init({ onModeChange } = {}) {
    if (typeof document !== 'undefined') {
      this._queryElements();
    }
    this.onModeChangeCallback = onModeChange;
    this._initTheme();
    this._bindEvents();
    this._bindMobileEvents();
    this._initOfflineListeners();
  }

  _initOfflineListeners() {
    this.updateOfflineStatus();

    // PWA Install state
    if (this.installPwaBtn && pwaService.isInstallable) {
      this.installPwaBtn.style.display = 'inline-flex';
    }

    eventBus.on('pwa:installable', ({ isInstallable }) => {
      if (this.installPwaBtn) {
        this.installPwaBtn.style.display = isInstallable ? 'inline-flex' : 'none';
      }
    });

    eventBus.on('pwa:installed', () => {
      if (this.installPwaBtn) {
        this.installPwaBtn.style.display = 'none';
      }
    });

    eventBus.on('pwa:install-accepted', () => {
      if (this.installPwaBtn) {
        this.installPwaBtn.style.display = 'none';
      }
    });

    eventBus.on('network:status-changed', ({ isOnline }) => {
      this.updateOfflineStatus(isOnline);
    });
    eventBus.on('offline:download-complete', () => {
      this.updateOfflineStatus();
    });
    eventBus.on('offline:cache-cleared', () => {
      this.updateOfflineStatus();
    });
  }

  async updateOfflineStatus(isOnline = null) {
    const online = isOnline !== null ? isOnline : offlineService.isOnline;
    const status = await offlineService.getStatus();

    if (this.offlineBtn) {
      if (!online) {
        this.offlineBtn.classList.add('is-offline');
        this.offlineBtn.title = 'Đang ở chế độ Offline (Không có mạng) - Bấm để quản lý bộ nhớ';
        if (this.offlineIcon) this.offlineIcon.textContent = '📶';
        if (this.offlineLabel) this.offlineLabel.textContent = 'Offline';
      } else if (status.isComplete) {
        this.offlineBtn.classList.remove('is-offline');
        this.offlineBtn.classList.add('is-ready');
        this.offlineBtn.title = `Đã lưu 100% hình ảnh (${status.cachedCount}/${status.totalImages}) - Sẵn sàng Offline`;
        if (this.offlineIcon) this.offlineIcon.textContent = '✅';
        if (this.offlineLabel) this.offlineLabel.textContent = '100% Offline';
      } else {
        this.offlineBtn.classList.remove('is-offline');
        this.offlineBtn.classList.remove('is-ready');
        this.offlineBtn.title = `Đã lưu ${status.cachedCount}/${status.totalImages} ảnh (${status.percent}%) - Bấm để tải trọn gói`;
        if (this.offlineIcon) this.offlineIcon.textContent = '💾';
        if (this.offlineLabel) this.offlineLabel.textContent = status.cachedCount > 0 ? `${status.percent}%` : 'Tải Offline';
      }
    }

    // Sync with Mobile Settings Bottom Sheet
    if (this.mobileSheetOfflineIcon) {
      this.mobileSheetOfflineIcon.textContent = status.isComplete ? '✅' : '💾';
    }
    if (this.mobileSheetOfflineDesc) {
      this.mobileSheetOfflineDesc.textContent = status.isComplete
        ? `Đã lưu 100% hình ảnh (${status.cachedCount}/${status.totalImages})`
        : `Đã lưu ${status.cachedCount}/${status.totalImages} ảnh (${status.percent}%)`;
    }
    if (this.mobileSheetOfflinePill) {
      this.mobileSheetOfflinePill.textContent = status.isComplete ? '100% Offline' : 'Quản lý';
    }

    if (pwaService.isStandalone) {
      if (this.mobileSheetInstallTitle) this.mobileSheetInstallTitle.textContent = 'Ứng Dụng Đã Cài Đặt';
      if (this.mobileSheetInstallDesc) this.mobileSheetInstallDesc.textContent = 'Bạn đang sử dụng phiên bản cài đặt PWA';
      if (this.mobileSheetInstallPill) this.mobileSheetInstallPill.textContent = 'Đã cài';
    }
  }

  _initTheme() {
    const savedTheme = StorageService.getTheme();
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  _bindEvents() {
    // Theme toggle
    this.themeToggleBtn?.addEventListener('click', () => {
      this.toggleTheme();
    });

    // PWA install trigger
    this.installPwaBtn?.addEventListener('click', () => {
      pwaService.promptInstall();
    });

    // Offline manager modal trigger
    this.offlineBtn?.addEventListener('click', () => {
      offlineModal.open();
    });

    // Nav tabs for desktop
    this.navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode;
        if (typeof this.onModeChangeCallback === 'function') {
          this.onModeChangeCallback(mode);
        }
      });
    });
  }

  _bindMobileEvents() {
    // Mobile menu trigger button
    this.mobileMenuBtn?.addEventListener('click', () => {
      this.toggleMobileSheet();
    });

    // Close button in bottom sheet
    this.closeMobileSheetBtn?.addEventListener('click', () => {
      this.closeMobileSheet();
    });

    // Backdrop click to close
    this.mobileModeSheet?.addEventListener('click', (e) => {
      if (e.target === this.mobileModeSheet) {
        this.closeMobileSheet();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isMobileSheetOpen()) {
        this.closeMobileSheet();
      }
    });

    // Mode cards in bottom sheet
    this.mobileModeCards.forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.dataset.mode;
        this.closeMobileSheet();
        if (typeof this.onModeChangeCallback === 'function') {
          this.onModeChangeCallback(mode);
        }
      });
    });

    // --- Mobile Settings Bottom Sheet ---
    this.mobileSettingsBtn?.addEventListener('click', () => {
      this.toggleMobileSettings();
    });

    this.closeMobileSettingsBtn?.addEventListener('click', () => {
      this.closeMobileSettings();
    });

    this.mobileSettingsSheet?.addEventListener('click', (e) => {
      if (e.target === this.mobileSettingsSheet) {
        this.closeMobileSettings();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isMobileSettingsOpen()) {
        this.closeMobileSettings();
      }
    });

    this.mobileSheetThemeBtn?.addEventListener('click', () => {
      this.toggleTheme();
    });

    this.mobileSheetOfflineBtn?.addEventListener('click', () => {
      this.closeMobileSettings();
      offlineModal.open();
    });

    this.mobileSheetInstallBtn?.addEventListener('click', () => {
      this.closeMobileSettings();
      pwaService.promptInstall();
    });
  }

  toggleMobileSheet() {
    if (this.isMobileSheetOpen()) {
      this.closeMobileSheet();
    } else {
      this.openMobileSheet();
    }
  }

  isMobileSheetOpen() {
    return this.mobileModeSheet?.classList.contains('show') || false;
  }

  openMobileSheet() {
    if (!this.mobileModeSheet) return;
    if (this.isMobileSettingsOpen()) this.closeMobileSettings();
    this.mobileModeSheet.classList.add('show');
    this.mobileModeSheet.setAttribute('aria-hidden', 'false');
    this.mobileMenuBtn?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  closeMobileSheet() {
    if (!this.mobileModeSheet) return;
    this.mobileModeSheet.classList.remove('show');
    this.mobileModeSheet.setAttribute('aria-hidden', 'true');
    this.mobileMenuBtn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  // --- Mobile Settings Methods ---

  toggleMobileSettings() {
    if (this.isMobileSettingsOpen()) {
      this.closeMobileSettings();
    } else {
      this.openMobileSettings();
    }
  }

  isMobileSettingsOpen() {
    return this.mobileSettingsSheet?.classList.contains('show') || false;
  }

  openMobileSettings() {
    if (!this.mobileSettingsSheet) return;
    if (this.isMobileSheetOpen()) this.closeMobileSheet();
    this.mobileSettingsSheet.classList.add('show');
    this.mobileSettingsSheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  closeMobileSettings() {
    if (!this.mobileSettingsSheet) return;
    this.mobileSettingsSheet.classList.remove('show');
    this.mobileSettingsSheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    StorageService.setTheme(newTheme);
    this.updateThemeIcon(newTheme);
  }

  updateThemeIcon(theme) {
    if (this.themeIcon) {
      this.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }

    if (this.mobileSheetThemeIcon) {
      this.mobileSheetThemeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
    if (this.mobileSheetThemeTitle) {
      this.mobileSheetThemeTitle.textContent = theme === 'dark' ? 'Giao diện: Tối' : 'Giao diện: Sáng';
    }
    if (this.mobileSheetThemePill) {
      this.mobileSheetThemePill.textContent = theme === 'dark' ? 'Đổi Sáng ☀️' : 'Đổi Tối 🌙';
    }
  }

  setActiveTab(mode) {
    // 1. Update Desktop Tabs
    this.navTabs.forEach(tab => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle('active', isActive);
      if (isActive) {
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    });

    // 2. Update Mobile Sheet Cards
    this.mobileModeCards.forEach(card => {
      const isActive = card.dataset.mode === mode;
      card.classList.toggle('active', isActive);
    });

    // 3. Update Mobile Menu Trigger Label & Icon
    const config = MODE_CONFIGS[mode];
    if (config) {
      if (this.mobileCurrentIcon) {
        this.mobileCurrentIcon.textContent = config.icon;
      }
      if (this.mobileCurrentTitle) {
        this.mobileCurrentTitle.textContent = config.shortTitle;
      }
    }
  }
}

export const header = new Header();


