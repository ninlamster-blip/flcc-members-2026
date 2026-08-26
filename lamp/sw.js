// LAMP service worker.
//
// The shell and all authored content are cached on install, so the app opens
// offline. Scripture chapters are cached separately by the app itself (in
// IndexedDB), which is why they are not listed here.

const VERSION = 'lamp-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/lamp.css',
  './icons/icon.svg',
  './js/app.js',
  './js/core/dom.js',
  './js/core/ui.js',
  './js/core/storage.js',
  './js/core/age.js',
  './js/core/books.js',
  './js/core/refs.js',
  './js/core/bible.js',
  './js/core/profile.js',
  './js/core/progress.js',
  './js/core/memory.js',
  './js/core/content.js',
  './js/core/daily.js',
  './js/core/challenges.js',
  './js/core/safety.js',
  './js/core/ai.js',
  './js/core/router.js',
  './js/screens/today.js',
  './js/screens/bible.js',
  './js/screens/reader.js',
  './js/screens/stories.js',
  './js/screens/story.js',
  './js/screens/journey.js',
  './js/screens/memory.js',
  './js/screens/challenge.js',
  './js/screens/prayer.js',
  './js/screens/journal.js',
  './js/screens/ask.js',
  './js/screens/me.js',
  './content/daily.json',
  './content/challenges.json',
  './content/memory-verses.json',
  './content/prayer-moods.json',
  './content/journal-prompts.json',
  './content/stories/index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL).catch(() => Promise.all(SHELL.map((url) => cache.add(url).catch(() => null)))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;          // Scripture and the AI proxy: never cached here
  if (!url.pathname.includes('/lamp/')) return;        // leave the rest of the site alone

  // Content and stories: cache first, then network — they change rarely.
  if (url.pathname.includes('/lamp/content/')) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })),
    );
    return;
  }

  // Everything else: network first, falling back to the cached shell.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  );
});
