// The app shell, kept so that Sermon Notes opens with no signal — a church hall
// on a phone with no data is the ordinary case, not the edge one.
//
// Only this directory is cached. The church schedule (../data.json) is
// deliberately left alone: it is fetched fresh with ?t= on every open so a
// republished schedule reaches members the same day (see CHURCHES.md), and a
// cache keyed by that ever-changing URL would only fill up. What the app needs
// from it offline is kept as a small slice in localStorage instead — see
// js/storage.js.
const CACHE = 'flcc-sermon-notes-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/notes.js',
  './js/scripture.js',
  './js/storage.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const scope = new URL('./', self.registration.scope);
  const mine = url.origin === scope.origin && url.pathname.startsWith(scope.pathname) && !url.search;
  if (!mine) return;   // church.js, data.json, fonts: straight to the network

  // Cached first so the app opens instantly, then refreshed in the background
  // so the next open has whatever was published since.
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
