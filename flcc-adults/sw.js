// FLCC NEXT (adults) service worker.
//
// Three kinds of request, three different bargains:
//
//   the shell     network first, cache as a fallback — a code change ships on
//                 the next load, and a phone with no signal still opens.
//   content/      cache first, but ALWAYS refetch in the background. The
//                 teaching team edits this writing; a device that cached it in
//                 March must not still be showing March in June. The reader
//                 sees the cached copy instantly and the new one next time.
//   the Bible     cache first, and never refetched. Scripture does not change,
//                 the files are large, and a chapter read once should stay
//                 readable on a bus with no signal.
//
// The Bible lives at /flcc-next/bible/ — the same committed, public-domain text
// the kids and teens app reads, rather than a second 14 MB copy of it. This
// worker's scope is /flcc-adults/, so it only ever sees requests made BY this
// app's pages; caching a Scripture file here does not touch the other app's
// cache, and neither app can evict the other's.
//
// Bump VERSION when the shell changes. Bumping it is also the only way a
// corrected Bible file reaches a device that already cached the old one.

const VERSION = 'adults-v5';
const BIBLE = '/flcc-next/bible/';

const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/next.css', './icons/icon.svg',
  './js/app.js',
  './js/core/dom.js', './js/core/ui.js', './js/core/art.js', './js/core/storage.js',
  './js/core/profile.js', './js/core/progress.js', './js/core/router.js',
  './js/core/content.js', './js/core/rotation.js', './js/core/scripture.js',
  './js/core/prayers.js', './js/core/plan.js', './js/core/agenda.js',
  './js/screens/today.js', './js/screens/explore.js', './js/screens/community.js',
  './js/screens/watch.js', './js/screens/you.js',
  './js/screens/bible.js', './js/screens/pray.js', './js/screens/grow.js',
  './js/screens/moment.js', './js/screens/message.js',
  './js/screens/path.js', './js/screens/session.js', './js/screens/guide.js',
  './js/screens/plan.js',
  './content/moments.json', './content/paths.json', './content/prayer-guides.json',
  './content/prayer-categories.json', './content/reading-plans.json',
  './content/updates.json', './content/events.json', './content/ministries.json',
  './content/messages.json',
  './content/paths/foundations.json', './content/paths/bible-deep-dive.json',
  './content/paths/faith-at-work.json', './content/paths/marriage-and-relationships.json',
  // The book list, but not the books. 66 books × 3 translations is far too much
  // to precache; each one is kept the first time it is actually opened.
  '/flcc-next/bible/books.json',
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

  const isBible = url.pathname.startsWith(BIBLE);
  if (!isBible && !url.pathname.includes('/flcc-adults/')) return;

  // Scripture: cache first, and that is the end of it.
  if (isBible && !url.pathname.endsWith('books.json')) {
    event.respondWith(caches.match(request)
      .then((hit) => hit || fetch(request).then((response) => keep(request, response))));
    return;
  }

  // Authored writing and the book list: serve what is cached so the app opens
  // at once, and fetch a fresh copy in the background for next time.
  if (url.pathname.includes('/content/') || url.pathname.endsWith('books.json')) {
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
