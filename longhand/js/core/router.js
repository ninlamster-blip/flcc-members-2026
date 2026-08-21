/**
 * Hash routing.
 *
 * `#/meetings/abc?t=42` — path segments choose the view, the query carries
 * state a link should survive (a timestamp to jump to, a search term).
 * Views are imported on demand, which is how this app stays a few kilobytes
 * on first paint without a bundler.
 */

export class Router extends EventTarget {
  constructor(routes = {}) {
    super();
    this.routes = routes;
    this.current = null;
    this._onHash = () => this.resolve();
  }

  start() {
    globalThis.addEventListener('hashchange', this._onHash);
    this.resolve();
  }

  stop() { globalThis.removeEventListener('hashchange', this._onHash); }

  static parse(hash) {
    const raw = String(hash || '').replace(/^#\/?/, '');
    const [path, search] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {};
    for (const [key, value] of new URLSearchParams(search || '')) query[key] = value;
    return { name: parts[0] || 'home', params: parts.slice(1), query };
  }

  resolve() {
    const route = Router.parse(globalThis.location ? globalThis.location.hash : '');
    if (!this.routes[route.name]) route.name = 'home';
    this.current = route;
    this.dispatchEvent(new CustomEvent('navigate', { detail: route }));
  }

  static href(name, params = [], query = {}) {
    const path = [name, ...params.filter((p) => p != null)].join('/');
    const search = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString();
    return `#/${path}${search ? `?${search}` : ''}`;
  }

  go(name, params = [], query = {}) {
    globalThis.location.hash = Router.href(name, params, query);
  }
}
