// FLCC NEXT service worker: the shell and all authored content offline.

const VERSION = 'next-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/next.css', './icons/icon.svg',
  './js/app.js',
  './js/core/dom.js', './js/core/ui.js', './js/core/art.js', './js/core/storage.js',
  './js/core/profile.js', './js/core/progress.js', './js/core/router.js',
  './js/core/content.js', './js/core/daily.js',
  './js/screens/today.js', './js/screens/devotion.js', './js/screens/explore.js',
  './js/screens/journey.js', './js/screens/lesson.js', './js/screens/topic.js',
  './js/screens/play.js', './js/screens/game.js', './js/screens/connect.js',
  './js/screens/prayer.js', './js/screens/me.js', './js/screens/ask.js',
  './content/daily.json', './content/journeys.json', './content/real-life.json',
  './content/games.json', './content/events.json', './content/achievements.json',
  './content/help-lines.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION)
    .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (!url.pathname.includes('/flcc-next/')) return;

  if (url.pathname.includes('/content/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
      return response;
    })));
    return;
  }

  event.respondWith(fetch(request)
    .then((response) => {
      const copy = response.clone();
      caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
      return response;
    })
    .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))));
});
