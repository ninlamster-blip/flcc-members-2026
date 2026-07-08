// Offline cache for the FLCC Kasama app shell, so the journal, comfort
// responses, verses, and support directory all work without a network —
// important for members with limited or expensive data.
const CACHE = 'flcc-kasama-v7';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/utils.js',
  './js/state.js',
  './js/ai.js',
  './js/companion.js',
  './js/sanctuary.js',
  './js/prayerchain.js',
  './js/journal.js',
  './js/faith.js',
  './js/community.js',
  './js/support.js',
  './data/comfort.json',
  './data/verses.json',
  './data/prayers.json',
  './data/resources.json',
  './data/biblestudy.json',
  './data/audiodrops.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
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

// Network-first: schedule changes, new teachings, and app updates show up on
// the next visit while online; the cache only answers when the network can't.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return; // never intercept AI proxy calls
  if (new URL(event.request.url).pathname.startsWith('/api/')) return; // live data (prayer chain) stays live

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached || new Response('Offline', { status: 503, statusText: 'Offline' })
        )
      )
  );
});
