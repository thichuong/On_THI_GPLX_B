/**
 * Application Entry Point - Vue 3 Single Page Application
 */
import { createApp } from 'vue';
import App from './App.vue';
import './styles/main.css';

// Register PWA Service Worker for offline support & automatic update handling
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);

          // Check if an updated worker is already waiting
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // Listen for new workers waiting to take over
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New version installed and ready, reloading...');
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err);
        });
    });
  }
}

registerServiceWorker();

const app = createApp(App);
app.mount('#app');
