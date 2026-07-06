// Minimal offline cache for the Daily Blessing app shell so today's blessing
// (and the content pools it can draw from) still load without a network.
const CACHE = 'daily-blessing-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/utils.js',
  './js/state.js',
  './js/contentPool.js',
  './js/blessing.js',
  './js/streak.js',
  './js/community.js',
  './js/views.js',
  './data/scriptures.json',
  './data/prayers.json',
  './data/encouragements.json',
  './data/reflections.json',
  './data/challenges.json',
  './data/kindnessMissions.json',
  './data/devotionals.json',
  './data/historicalFacts.json',
  './data/memoryVerses.json',
  './data/characters.json',
  './data/fridaySpecials.json',
  './data/pastorMessages.json',
  './data/announcements.json',
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
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // never cache the live community counter

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
