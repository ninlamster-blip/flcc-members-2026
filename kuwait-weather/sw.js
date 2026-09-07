// Offline for the shell, never for the forecast.
//
// The app itself — HTML, CSS, modules, icon — is cached on install and served
// cache-first, because none of it changes between deploys. The forecast is
// never cached here: a stale temperature presented as current is worse than no
// temperature, and the last good reading is already kept in localStorage where
// the app can label it as old.
//
// The radar tiles are cross-origin and so never reach this handler at all,
// which is the right answer for them too: a cached radar sweep is a lie about
// where the rain is.

// Bump this whenever SHELL changes. The activate handler deletes every cache
// whose name is not this one, so a new name is the only thing that guarantees
// a device holding the old shell actually gets the new files — adding an entry
// to SHELL under the old name does not, and that is how a fixed module can sit
// in the repository for a day while a phone keeps serving the broken one.
const CACHE = 'kuwait-weather-v2';

const SHELL = [
  './',
  './index.html',
  './style.css',
  './icon.svg',
  './manifest.webmanifest',
  './js/app.js',
  './js/core/advisories.js',
  './js/core/api.js',
  './js/core/autolocate.js',
  './js/core/derive.js',
  './js/core/dust.js',
  './js/core/format.js',
  './js/core/heat.js',
  './js/core/places.js',
  './js/core/radar.js',
  './js/core/storage.js',
  './js/core/textsize.js',
  './js/core/weathercode.js',
  './js/core/wind.js',
  './js/core/workban.js',
  './js/ui/art.js',
  './js/ui/chart.js',
  './js/ui/icons.js',
  './js/ui/tone.js',
  './js/ui/map.js',
  './js/ui/render.js',
  './js/ui/tiles.js',
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
