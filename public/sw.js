/**
 * Service Worker - On Thi Sat Hach GPLX 600 Cau
 * Multi-tier offline caching, Cloudflare request minimization, and instant loading
 */

const CACHE_VERSION = 'gplx-v1.0.0';
const CACHE_SHELL = `${CACHE_VERSION}-shell`;
const CACHE_IMAGES = 'gplx-images-v1';
const CACHE_FONTS = 'gplx-fonts-v1';

// Essential App Shell static assets
const BASE_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/logo.svg',
  '/logo-standalone.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Dynamically injected build bundles from Vite post-build script
const BUILD_ASSETS = /* __BUILD_ASSETS_PLACEHOLDER__ */[];

// Combined precache list
const PRECACHE_ASSETS = Array.from(new Set([...BASE_SHELL_ASSETS, ...BUILD_ASSETS]));

// Install Event: Pre-cache core app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated shell caches
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_SHELL, CACHE_IMAGES, CACHE_FONTS];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!currentCaches.includes(key) && key.startsWith('gplx-')) {
            console.log('[SW] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Google Web Fonts: Cache-First runtime caching
  if (url.origin.includes('fonts.googleapis.com') || url.origin.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_FONTS).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          return cached || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // Ignore other external origins
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. Navigation requests (HTML / SPA): Stale-While-Revalidate with immediate cache delivery
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cachedHtml) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_SHELL).then((cache) => cache.put('/index.html', responseClone));
            }
            return networkResponse;
          })
          .catch(() => cachedHtml);

        // Instant load: return cached index.html immediately if available
        if (cachedHtml) {
          return cachedHtml;
        }
        return fetchPromise;
      })
    );
    return;
  }

  // 3. Hashed Static Assets (/assets/*): STRICT CACHE-FIRST (No background fetch to save Cloudflare requests)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_SHELL).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Question Images (/images/*): Cache-First with SVG fallback
  if (url.pathname.includes('/images/')) {
    event.respondWith(
      caches.open(CACHE_IMAGES).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // Offline fallback SVG if image not pre-cached
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="#1e293b" rx="8"/><path d="M150 70 L175 115 L125 115 Z" fill="#f59e0b"/><text x="150" y="105" dominant-baseline="middle" text-anchor="middle" fill="#000" font-weight="bold" font-size="14">!</text><text x="150" y="140" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="600">Hình ảnh chưa tải Offline</text></svg>',
            {
              headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'no-store'
              },
              status: 200
            }
          );
        }
      })
    );
    return;
  }

  // 5. Other Shell Assets (icons, manifest, logo): Cache-First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_SHELL).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});

// Message Listener for client control (SKIP_WAITING, etc.)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
