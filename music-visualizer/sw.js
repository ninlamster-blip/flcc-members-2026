// Offline cache for the app shell (markup/styles/logic), so the visualizer
// opens instantly from the home-screen icon even with no signal — important
// for a venue with unreliable wifi. Three.js itself is loaded from unpkg at
// runtime and is deliberately NOT precached here: a cross-origin fetch
// failing during install would fail the whole cache.addAll() atomically, and
// an opaque no-cors response can't be verified before being stored. Without
// a network to fetch it, the app shell still loads; the 3D scene just can't
// start until Three.js is reachable.
const CACHE = 'flcc-music-visualizer-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/audio-engine.js',
  './js/ai-director.js',
  './js/id3.js',
  './js/visual-engine.js',
  './manifest.webmanifest',
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

// Network-first, same-origin only: app updates show up on the next visit
// while online; the cache only answers when the network can't. Cross-origin
// requests (Three.js CDN, Google Fonts) are left alone entirely so we never
// store an unverifiable opaque response.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
