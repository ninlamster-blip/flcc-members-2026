/**
 * Service worker — offline support.
 *
 * Shepherd's data already lives on the device; the only thing a bad connection
 * can take away is the app itself. This caches the shell and every module the
 * user has actually opened, so a pastor on a hospital corridor with one bar of
 * signal still gets to their notes.
 *
 * Strategy: network-first for our own static files, falling back to the
 * cache only when the network fails — never cache-first. This repo has no
 * build step (see README: "edit a file, reload the page"), so there is no
 * content hash or version bump to key a cache-first strategy off of; the
 * one-line VERSION string below does not change on an ordinary deploy.
 * Cache-first against a cache name that never changes means a browser that
 * already visited a page keeps serving that exact old code indefinitely —
 * every visit only refreshes the cache for *next* time, never this one.
 * Network-first costs a request on a good connection but is never wrong;
 * the cache exists purely for when there is no connection at all. Nothing
 * church-related is ever cached here — records never travel through the
 * cache API.
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
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
  );
});
