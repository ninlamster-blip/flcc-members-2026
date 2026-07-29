/**
 * Service worker — offline support.
 *
 * Shepherd's data already lives on the device; the only thing a bad connection
 * can take away is the app itself. This caches the shell and every module the
 * user has actually opened, so a pastor on a hospital corridor with one bar of
 * signal still gets to their notes.
 *
 * Strategy: cache-first for our own static files (they are versioned by the
 * cache name), network-only for everything else. Nothing church-related is
 * ever cached here — records never travel through the cache API.
 */

const VERSION = 'shepherd-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/shepherd.css',
  './js/app.js',
  './js/core/dom.js',
  './js/core/ui.js',
  './js/core/db.js',
  './js/core/schema.js',
  './js/core/rbac.js',
  './js/core/crypto.js',
  './js/core/storage.js',
  './js/core/session.js',
  './js/core/tenant.js',
  './js/core/router.js',
  './js/core/format.js',
  './js/core/id.js',
  './js/core/search.js',
  './js/core/ai.js',
  './js/core/exporters.js',
  './js/core/seed.js',
  './js/modules/dashboard.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      // One missing file must not fail the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
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
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;          // fonts etc. — leave to the browser
  if (!url.pathname.includes('/shepherd/')) return;          // never touch the rest of this domain

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || caches.match('./index.html'));
      // Cache first for speed; the network copy refreshes it for next time.
      return cached || network;
    }),
  );
});
