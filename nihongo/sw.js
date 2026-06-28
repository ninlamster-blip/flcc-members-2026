// Nihongo Journey — offline cache (cache-first for app shell & data).
const CACHE = 'nihongo-v2';
const ASSETS = [
  './', './index.html', './styles.css',
  './js/app.js', './js/core.js', './js/missions.js', './js/srs.js', './js/achievements.js',
  './js/views/home.js', './js/views/kana.js', './js/views/vocab.js',
  './js/views/breakdown.js', './js/views/flash.js', './js/views/kanji.js',
  './js/views/chat.js', './js/views/speak.js', './js/views/write.js',
  './js/views/jlpt.js', './js/views/progress.js',
  './data/kana.js', './data/vocab.js', './data/sentences.js', './data/kanji.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return; // don't cache cross-origin
  e.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
