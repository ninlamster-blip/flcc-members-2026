// Minimal offline cache for the JARVIS app shell, same pattern as
// ../daily-blessing/sw.js and ../ofw-companion/sw.js.
const CACHE = 'jarvis-v5';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/utils.js',
  './js/style.js',
  './js/memory.js',
  './js/observe.js',
  './js/understand.js',
  './js/plan.js',
  './js/act.js',
  './js/tools.js',
  './js/knowledge.js',
  './js/home.js',
  './js/ai-client.js',
  './js/reflect.js',
  './js/learn.js',
  './js/core.js',
  './js/agents/faith.js',
  './js/agents/family.js',
  './js/agents/creator.js',
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
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
