// MyOrbisVoice Preview — Service Worker
// Strategy: cache-first for app shell + JSON data, network-first for everything else.
// Versioned cache name — bump SW_VERSION to invalidate on deploy.

const SW_VERSION = 'v1';
const CACHE = `myorbis-preview-${SW_VERSION}`;

const SHELL = [
  '/preview/',
  '/preview/index.html',
  '/preview/assets/css/preview.css',
  '/preview/assets/js/app.js',
  '/preview/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only intercept same-origin requests within /preview/
  if (url.origin !== location.origin || !url.pathname.startsWith('/preview/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // Cache successful GETs for next time
        if (resp.ok && event.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      }).catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});
