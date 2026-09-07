// Offline for the shell, never for the forecast.
//
// A cached rainfall figure shown as current is worse than none at all in an
// app somebody uses to decide whether to leave the house, so nothing from the
// two APIs is ever stored here. The last good reading already lives in
// localStorage, where the app can label it as old.

const CACHE = 'ph-weather-v1';

const SHELL = [
  './', './index.html', './style.css', './icon.svg', './manifest.webmanifest',
  './js/app.js',
  './js/core/advisories.js', './js/core/air.js', './js/core/api.js',
  './js/core/autolocate.js', './js/core/derive.js', './js/core/flood.js',
  './js/core/format.js', './js/core/heat.js', './js/core/landslide.js',
  './js/core/localhazard.js',
  './js/core/monsoon.js', './js/core/places.js', './js/core/rain.js',
  './js/core/saturation.js', './js/core/storage.js', './js/core/textsize.js',
  './js/core/weathercode.js',
  './js/ui/art.js', './js/ui/chart.js', './js/ui/icons.js',
  './js/ui/render.js', './js/ui/tone.js',
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
