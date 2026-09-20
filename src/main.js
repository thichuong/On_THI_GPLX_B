/**
 * Application Entry Point
 * Initializes services, components, router, keyboard handlers, and offline synchronization.
 */
import './styles/main.css';
import { header } from './components/Header.js';
import { router } from './core/router.js';
import { keyboardManager } from './utils/keyboard.js';
import { StorageService } from './services/storageService.js';
import { offlineModal } from './components/OfflineModal.js';
import { eventBus } from './core/eventBus.js';
// Initialize lightbox listener
import './components/LightboxModal.js';
import { $ } from './utils/dom.js';

let toastTimeout = null;

function showToast(htmlContent, type = 'info', duration = 4000) {
  const toastEl = $('#app-toast');
  if (!toastEl) return;

  toastEl.innerHTML = htmlContent;
  toastEl.className = `app-toast show ${type}`;

  if (toastTimeout) clearTimeout(toastTimeout);
  if (duration > 0) {
    toastTimeout = setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }
}

function initApp() {
  const appMain = $('#app-main');
  if (!appMain) {
    console.error('Root element #app-main not found in DOM');
    return;
  }

  // Initialize persistent storage (IndexedDB + cache)
  StorageService.init();

  // Initialize offline manager modal
  offlineModal.init();

  // Initialize header navigation, theme toggle, and offline indicators
  header.init({
    onModeChange: (mode) => router.navigate(mode)
  });

  // Initialize router with main container
  router.init(appMain);

  // Initialize centralized keyboard shortcut manager
  keyboardManager.init();

  // Start with default mode (Standard Mock Exam)
  router.navigate('exam');

  // Network status toast notifications
  eventBus.on('network:status-changed', ({ isOnline }) => {
    if (!isOnline) {
      showToast('📶 Bạn đang ở chế độ Offline. Dữ liệu và đề thi vẫn hoạt động bình thường!', 'offline', 5000);
    } else {
      showToast('🟢 Đã kết nối lại Internet.', 'online', 3500);
    }
  });

  // Register PWA Service Worker for offline support & update handling
  registerServiceWorker();
}

/**
 * Register Service Worker for PWA & Offline caching
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);

          // Check if an updated worker is already waiting
          if (reg.waiting) {
            promptUpdate(reg.waiting);
          }

          // Detect new worker installing
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                promptUpdate(newWorker);
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });

      // Handle reload when new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

/**
 * Prompt user to activate new version
 */
function promptUpdate(worker) {
  showToast(
    `<span>✨ Bản cập nhật mới đã sẵn sàng!</span> <button id="btn-toast-update" style="margin-left: 0.5rem; padding: 0.25rem 0.65rem; background: var(--accent-primary); border: none; border-radius: 4px; color: #fff; font-weight: 600; cursor: pointer;">Cập nhật ngay</button>`,
    'online',
    0
  );

  $('#btn-toast-update')?.addEventListener('click', () => {
    worker.postMessage({ type: 'SKIP_WAITING' });
  });
}

// Kickstart on DOM load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
