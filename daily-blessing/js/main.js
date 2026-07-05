/**
 * main — bootstraps the app: loads content, wires the router + bottom nav,
 * unlocks audio on first gesture, and registers the service worker.
 */
(function (global) {
  'use strict';

  async function boot() {
    const root = document.getElementById('page-root');
    const navButtons = Array.from(document.querySelectorAll('.nav-btn'));

    await global.DB_APP.init();

    if (global.DB_APP.context.season) {
      document.body.classList.add(global.DB_APP.context.season.themeClass);
    }
    if (global.DB_UTILS.prefersReducedMotion()) document.body.classList.add('reduce-motion');

    const router = new global.DB_Router(root, navButtons);
    router.register('home', global.DB_PAGES.home);
    router.register('journey', global.DB_PAGES.journey);
    router.register('collection', global.DB_PAGES.collection);
    router.register('community', global.DB_PAGES.community);
    router.register('profile', global.DB_PAGES.profile);

    navButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (global.DB_AUDIO) global.DB_AUDIO.playTap();
        router.navigate(btn.dataset.route);
      });
    });

    router.start();

    document.getElementById('app-loading').style.display = 'none';
    document.getElementById('app').removeAttribute('hidden');
  }

  document.addEventListener('pointerdown', () => { if (global.DB_AUDIO) global.DB_AUDIO.ensureUnlocked(); }, { once: true });
  document.addEventListener('keydown', () => { if (global.DB_AUDIO) global.DB_AUDIO.ensureUnlocked(); }, { once: true });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is a progressive enhancement */ });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    boot().catch((err) => {
      console.error('Daily Blessing failed to start', err);
      const loading = document.getElementById('app-loading');
      if (loading) loading.textContent = 'Something went wrong loading today’s blessing. Please refresh.';
    });
  });
})(window);
