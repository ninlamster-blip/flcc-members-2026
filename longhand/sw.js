/**
 * Service worker.
 *
 * The shell and the modules that have been visited are cached, so the app
 * opens on a phone with no signal — a meeting is often the moment the
 * signal goes. Nothing recorded is cached here: recordings live in
 * IndexedDB, which the browser keeps whether or not this worker exists.
 *
 * HTML is network-first (so a deployed change is picked up), everything
 * else is cache-first with a background refresh.
 */

const CACHE = 'longhand-v1';
const SHELL = [
  './',
  './index.html',
  './css/longhand.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;      // never cache an endpoint's replies

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))));
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request).then((response) => {
        if (response && response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
        return response;
      }).catch(() => hit);
      return hit || network;
    }));
});
