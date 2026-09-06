// Offline for the shell, never for the forecast.
//
// The app itself — HTML, CSS, modules, icon — is cached on install and served
// cache-first, because none of it changes between deploys. The forecast is
// never cached here: a stale temperature presented as current is worse than no
// temperature, and the last good reading is already kept in localStorage where
// the app can label it as old.

const CACHE = 'kuwait-weather-v1';

const SHELL = [
  './',
  './index.html',
  './style.css',
  './icon.svg',
  './manifest.webmanifest',
  './js/app.js',
  './js/core/advisories.js',
  './js/core/api.js',
  './js/core/derive.js',
  './js/core/dust.js',
  './js/core/format.js',
  './js/core/heat.js',
  './js/core/places.js',
  './js/core/storage.js',
  './js/core/weathercode.js',
  './js/core/wind.js',
  './js/core/workban.js',
  './js/ui/icons.js',
  './js/ui/render.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Anything that is not this app's own shell — the two forecast APIs above
  // all — goes to the network and only to the network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
