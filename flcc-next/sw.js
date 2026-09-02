// FLCC NEXT service worker.
//
// Three kinds of request, three different bargains:
//
//   the shell     network first, cache as a fallback — a code change ships on
//                 the next load, and a phone with no signal still opens.
//   content/      cache first, but ALWAYS refetch in the background. The
//                 ministry edits this content; a device that cached it in
//                 March must not still be showing March in June. The reader
//                 sees the cached copy instantly and the new one next time.
//   bible/        cache first, and never refetched. Scripture does not change,
//                 the files are large, and a book that has been read once
//                 should stay readable on a bus with no signal.

const VERSION = 'next-v3';

const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/next.css', './icons/icon.svg',
  './js/app.js',
  './js/core/dom.js', './js/core/ui.js', './js/core/art.js', './js/core/storage.js',
  './js/core/profile.js', './js/core/progress.js', './js/core/router.js',
  './js/core/content.js', './js/core/library.js', './js/core/rotation.js',
  './js/core/scripture.js', './js/core/safety.js', './js/core/ai.js',
  './js/games/crossword.js',
  './js/screens/today.js', './js/screens/devotion.js', './js/screens/explore.js',
  './js/screens/journey.js', './js/screens/lesson.js', './js/screens/topic.js',
  './js/screens/play.js', './js/screens/game.js', './js/screens/connect.js',
  './js/screens/prayer.js', './js/screens/me.js', './js/screens/ask.js',
  './js/screens/bible.js',
  './content/daily.json', './content/journeys.json', './content/real-life.json',
  './content/games.json', './content/events.json', './content/achievements.json',
  './content/help-lines.json', './content/bible-books.json', './content/bible-find.json',
  './content/games/quiz.json', './content/games/who-am-i.json',
  './content/games/verse-builder.json', './content/games/crossword.json',
  // The book list, but not the books. 66 books × 3 translations is far too much
  // to precache; each one is kept the first time it is actually opened.
  './bible/books.json',
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

const keep = (request, response) => {
  const copy = response.clone();
  caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
  return response;
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (!url.pathname.includes('/flcc-next/')) return;

  // Scripture: cache first, and that is the end of it.
  if (url.pathname.includes('/bible/') && !url.pathname.endsWith('/books.json')) {
    event.respondWith(caches.match(request)
      .then((hit) => hit || fetch(request).then((response) => keep(request, response))));
    return;
  }

  // Authored content and the book list: serve what is cached so the app opens
  // at once, and fetch a fresh copy in the background for next time.
  if (url.pathname.includes('/content/') || url.pathname.endsWith('/bible/books.json')) {
    event.respondWith(caches.match(request).then((hit) => {
      const fresh = fetch(request).then((response) => keep(request, response)).catch(() => hit);
      return hit || fresh;
    }));
    return;
  }

  event.respondWith(fetch(request)
    .then((response) => keep(request, response))
    .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))));
});
