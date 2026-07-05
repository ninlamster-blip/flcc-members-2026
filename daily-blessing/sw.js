/**
 * Daily Blessing service worker — caches the app shell and content JSON so
 * today's blessing is available offline. Bump CACHE_NAME to invalidate.
 */
const CACHE_NAME = 'daily-blessing-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/DateUtils.js',
  './js/Utils.js',
  './js/SaveManager.js',
  './js/Content.js',
  './js/Season.js',
  './js/Rewards.js',
  './js/AudioManager.js',
  './js/Router.js',
  './js/App.js',
  './js/main.js',
  './js/components/GiftBox.js',
  './js/components/CharacterCard.js',
  './js/components/BlessingCard.js',
  './js/components/Streak.js',
  './js/pages/Home.js',
  './js/pages/Journey.js',
  './js/pages/Collection.js',
  './js/pages/Community.js',
  './js/pages/Profile.js',
  './data/scriptures.json',
  './data/prayers.json',
  './data/encouragements.json',
  './data/reflections.json',
  './data/challenges.json',
  './data/devotionals.json',
  './data/pastorMessages.json',
  './data/announcements.json',
  './data/worshipSongs.json',
  './data/historicalFacts.json',
  './data/characters.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
