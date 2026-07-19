// Offline cache for the FLCC Kasama app shell, so the journal, comfort
// responses, verses, and support directory all work without a network —
// important for members with limited or expensive data.
const CACHE = 'flcc-kasama-v15';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/utils.js',
  './js/state.js',
  './js/ai.js',
  './js/companion.js',
  './js/companion-brain.js',
  './js/reflection-engine.js',
  './js/growth-engine.js',
  './js/relationship-engine.js',
  './js/sanctuary.js',
  './js/sanctuary-mode.js',
  './js/header.js',
  './js/prayerchain.js',
  './js/notifications.js',
  './js/journal.js',
  './js/faith.js',
  './js/community.js',
  './js/support.js',
  './data/comfort.json',
  './data/verses.json',
  './data/prayers.json',
  './data/resources.json',
  './data/biblestudy.json',
  './data/audiodrops.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
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

// Network-first: schedule changes, new teachings, and app updates show up on
// the next visit while online; the cache only answers when the network can't.
// 'no-store' bypasses the browser's own HTTP cache — the app's filenames
// are stable (app.js, style.css, …), so without this a "network" fetch
// could be silently satisfied from disk cache and never see a new deploy.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return; // never intercept AI proxy calls
  if (new URL(event.request.url).pathname.startsWith('/api/')) return; // live data (prayer chain) stays live

  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached || new Response('Offline', { status: 503, statusText: 'Offline' })
        )
      )
  );
});

// ── "Bagong panalangin" push notifications (opt-in, see js/notifications.js) ──
self.addEventListener('push', (event) => {
  let data = { title: 'FLCC Kasama', body: 'May bago sa Kadena ng Panalangin.', url: './index.html' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Non-JSON or missing payload — the warm default above still shows something.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: data.url || './index.html' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || './index.html', self.location.href).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      const existing = windowClients.find((c) => 'focus' in c);
      if (existing) { existing.focus(); return existing.navigate?.(targetUrl); }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
