/**
 * Header Component: Top navbar with brand, mode navigation tabs, theme toggle,
 * and Mobile bottom menu sheet controller.
 */
import { StorageService } from '../services/storageService.js';
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
    this.navTabs = $$('.tab-btn');
    this.mobileMenuBtn = $('#mobile-menu-btn');
    this.mobileCurrentIcon = $('#mobile-current-icon');
    this.mobileCurrentTitle = $('#mobile-current-title');
    this.mobileModeSheet = $('#mobile-mode-sheet');
    this.closeMobileSheetBtn = $('#close-mobile-sheet-btn');
    this.mobileModeCards = $$('.mobile-mode-card');
  }

  init({ onModeChange } = {}) {
    if (typeof document !== 'undefined') {
      this._queryElements();
    }
    this.onModeChangeCallback = onModeChange;
    this._initTheme();
    this._bindEvents();
    this._bindMobileEvents();
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


