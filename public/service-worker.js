const CACHE_NAME = 'algojects-cache-v3'; // Increment version to force cache update
const urlsToCache = [
  '/',
  '/placeholder.svg',
  '/algojects-logo.png',
  '/logo.png',
  '/flag-us.png', // Added flags
  '/flag-br.png', // Added flags
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v3...');
  // Force the waiting service worker to become the active service worker
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Opened cache');
        // Note: index.html is intentionally excluded from pre-caching here, 
        // as we want to fetch it from the network first in the fetch handler.
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] cache.addAll failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating v3...');
  // Take control of all clients immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests and ignore cross-origin requests that aren't in the cache
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHtmlRequest = event.request.mode === 'navigate' || url.pathname === '/index.html' || url.pathname === '/';

  if (isHtmlRequest) {
    // Strategy: Network First, then Cache (for offline fallback)
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If successful, cache the new version and return it
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, fall back to cache
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Final fallback for navigation requests if offline
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // For all other assets (JS, CSS, images): Cache First, then Network
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).catch(() => {
          throw new Error('Fetch failed and no cache fallback available.');
        });
      })
  );
});

const cacheWhitelist = [CACHE_NAME];