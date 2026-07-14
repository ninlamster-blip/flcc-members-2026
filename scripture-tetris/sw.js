// Minimal offline cache for the Scripture Tetris app shell.
const CACHE = 'scripture-tetris-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/engine.js',
  './js/tetromino.js',
  './js/ui.js',
  './js/audio.js',
  './js/verses.js',
  './js/storage.js',
  './js/achievements.js',
  './js/dailyChallenge.js',
  './data/verses.json',
  './manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
