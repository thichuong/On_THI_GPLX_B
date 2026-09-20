/**
 * PWA Service: Handles PWA install prompts, listens for app installation,
 * and automatically triggers full offline image downloading upon install.
 */
import { eventBus } from '../core/eventBus.js';
import { offlineService } from './offlineService.js';
import { offlineModal } from '../components/OfflineModal.js';

class PWAService {
  constructor() {
    this.deferredPrompt = null;
    this.isInstallable = false;
    this.isStandalone = false;
  }

  init() {
    if (typeof window === 'undefined') return;

    // Check if running as installed standalone PWA
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        window.navigator.standalone === true;

    // Capture beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent browser's default mini-infobar
      e.preventDefault();
      this.deferredPrompt = e;
      this.isInstallable = true;
      console.log('[PWA] beforeinstallprompt captured, app is installable');
      eventBus.emit('pwa:installable', { isInstallable: true });
    });

    // Capture appinstalled event
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      this.deferredPrompt = null;
      this.isInstallable = false;
      this.isStandalone = true;
      eventBus.emit('pwa:installed');

      // Automatically trigger offline download on install!
      this._onAppInstalled();
    });

    // If running in standalone mode, check if offline images are complete
    if (this.isStandalone) {
      this._checkStandaloneAutoDownload();
    }
  }

  /**
   * Prompt user to install the PWA
   * @returns {Promise<{outcome: 'accepted'|'dismissed'}>}
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      // Fallback: If not installable via API, open offline modal
      offlineModal.open();
      return { outcome: 'dismissed' };
    }

    this.deferredPrompt.prompt();
    const choiceResult = await this.deferredPrompt.userChoice;
    console.log('[PWA] User response to install prompt:', choiceResult.outcome);

    if (choiceResult.outcome === 'accepted') {
      this.isInstallable = false;
      eventBus.emit('pwa:install-accepted');
      this._onAppInstalled();
    }

    this.deferredPrompt = null;
    return choiceResult;
  }

  /**
   * Trigger automatic offline package download when app is installed
   */
  async _onAppInstalled() {
    if (this._isHandlingInstall) return;
    this._isHandlingInstall = true;

    setTimeout(async () => {
      try {
        const status = await offlineService.getStatus();
        if (!status.isComplete && offlineService.isOnline) {
          // Immediately display the downloading interface and start downloading!
          await offlineModal.startDownloadWorkflow();
        } else {
          await offlineModal.open();
        }
      } catch (err) {
        console.warn('[PWA] Auto-download on install error:', err);
      } finally {
        this._isHandlingInstall = false;
      }
    }, 400);
  }

  /**
   * Check missing cache in standalone mode and notify
   */
  async _checkStandaloneAutoDownload() {
    setTimeout(async () => {
      try {
        const status = await offlineService.getStatus();
        if (!status.isComplete && offlineService.isOnline && !offlineService.isDownloading) {
          eventBus.emit('pwa:standalone-missing-cache', status);
        }
      } catch (err) {
        console.warn('[PWA] Standalone cache check error:', err);
      }
    }, 1800);
  }
}

export const pwaService = new PWAService();

