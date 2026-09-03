/* ==========================================================================
   LAPIS — Service Worker (iOS/Safari Safari PWA Network-First - v3)
   ========================================================================== */

const CACHE_NAME = 'lapis-pwa-cache-v3';
const STATIC_ASSETS = [
  './index.html?v=3',
  './styles.css?v=3',
  './app.js?v=3',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Event: Skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching v3 App Shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Event: Delete all old caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const reqUrl = event.request.url;

  // 1. FOR HTML / NAVIGATE REQUESTS: NETWORK-FIRST to guarantee instant HTML updates on reload
  if (event.request.mode === 'navigate' || reqUrl.endsWith('.html') || reqUrl.endsWith('/') || reqUrl.includes('index.html')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseCopy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request) || caches.match('./index.html');
      })
    );
    return;
  }

  // 2. FOR MET API REQUESTS: Stale-While-Revalidate
  if (reqUrl.includes('metmuseum.org')) {
    event.respondWith(
      caches.open('met-api-cache').then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. FOR STATIC ASSETS: Network-First fallback to Cache
  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseCopy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
      }
      return networkResponse;
    }).catch(() => {
      return caches.match(event.request);
    })
  );
});
