/**
 * Router — minimal hash-based router switching between the five bottom-nav
 * pages. Each page module exposes `render(container)` and optional
 * `onLeave()`.
 */
(function (global) {
  'use strict';

  class Router {
    constructor(root, navButtons) {
      this.root = root;
      this.navButtons = navButtons;
      this.pages = {};
      this.current = null;
      global.addEventListener('hashchange', () => this._go(this._routeFromHash()));
    }

    register(name, page) { this.pages[name] = page; }

    _routeFromHash() {
      const hash = (global.location.hash || '#home').replace('#', '');
      return this.pages[hash] ? hash : 'home';
    }

    start() { this._go(this._routeFromHash()); }

    navigate(name) { global.location.hash = name; }

    _go(name) {
      if (this.current && this.pages[this.current] && this.pages[this.current].onLeave) {
        this.pages[this.current].onLeave();
      }
      this.current = name;
      this.root.innerHTML = '';
      this.pages[name].render(this.root);
      this.navButtons.forEach((btn) => {
        const active = btn.dataset.route === name;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-current', active ? 'page' : 'false');
      });
      this.root.focus({ preventScroll: true });
    }
  }

  global.DB_Router = Router;
})(window);
