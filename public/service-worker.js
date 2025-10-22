const CACHE_NAME = 'algojects-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // Removed '/src/main.tsx' and '/src/globals.css' as they are source files
  '/placeholder.svg', // Corrected path
  'https://fonts.googleapis.com/css2?family=Raleway:ital,wght@0,100..900;1,100..900&family=Inter:wght@400;500;600;700&display=swap',
  'https://fonts.gstatic.com/s/raleway/v22/1Ptxg8zSys_Uf5vYQJycxus.woff2',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMw.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});