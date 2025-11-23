const CACHE_NAME = 'algojects-cache-v2'; // Increment version to force cache update
const urlsToCache = [
  '/',
  '/index.html',
  '/placeholder.svg',
  '/algojects-logo.png',
  '/logo.png',
  '/flag-us.png', // Added flags
  '/flag-br.png', // Added flags
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v2...');
  // Force the waiting service worker to become the active service worker
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('[Service Worker] cache.addAll failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating v2...');
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

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return the response
        if (response) {
          return response;
        }
        
        // Not in cache - fetch from network
        return fetch(event.request).catch(() => {
          // If fetch fails (e.g., offline), and it's a navigation request, serve the fallback index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          // Otherwise, throw the error
          throw new Error('Fetch failed and no cache fallback available.');
        });
      })
  );
});

const cacheWhitelist = [CACHE_NAME];