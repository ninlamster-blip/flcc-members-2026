// Offline cache for the OFW Companion app shell, so the journal, comfort
// responses, verses, and support directory all work without a network —
// important for members with limited or expensive data.
const CACHE = 'ofw-companion-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/utils.js',
  './js/state.js',
  './js/ai.js',
  './js/companion.js',
  './js/journal.js',
  './js/faith.js',
  './js/community.js',
  './js/support.js',
  './data/comfort.json',
  './data/verses.json',
  './data/prayers.json',
  './data/resources.json',
  './data/biblestudy.json',
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
  if (event.request.method !== 'GET') return; // never intercept AI proxy calls

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
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
