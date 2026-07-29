/**
 * Hash router with per-module code splitting.
 *
 * Modules are `import()`ed the first time they are visited, so opening
 * Shepherd downloads the shell and the dashboard — not the finance module, not
 * the document vault. On a phone this is the difference between a fast app and
 * a slow one, and it costs nothing but an await.
 *
 * Route shape:  `#/members/abc123?tab=care`
 *                 └ id    └ params  └ query
 */

export class Router {
  /**
   * @param {{routes: Record<string, {load: () => Promise<any>, resource?: string, title: string}>,
   *          fallback: string,
   *          canAccess?: (route: object) => boolean,
   *          onBefore?: (to: object) => void,
   *          onAfter?: (to: object, view: Node) => void,
   *          onDenied?: (route: object) => Node,
   *          container: HTMLElement,
   *          context: object}} options
   */
  constructor(options) {
    this.routes = options.routes;
    this.fallback = options.fallback;
    this.canAccess = options.canAccess || (() => true);
    this.onBefore = options.onBefore;
    this.onAfter = options.onAfter;
    this.onDenied = options.onDenied;
    this.container = options.container;
    this.context = options.context;
    /** @type {Map<string, any>} */
    this.loaded = new Map();
    this.current = null;
    this._onHash = () => this.resolve();
  }

  start() {
    window.addEventListener('hashchange', this._onHash);
    return this.resolve();
  }

  stop() {
    window.removeEventListener('hashchange', this._onHash);
  }

  /** @param {string} hash */
  static parse(hash) {
    const raw = String(hash || '').replace(/^#\/?/, '');
    const [pathPart, queryPart] = raw.split('?');
    const segments = pathPart.split('/').filter(Boolean);
    // `#/c/<tenant>/members` — the shareable church link keeps working.
    if (segments[0] === 'c' && segments[1]) segments.splice(0, 2);
    const query = {};
    for (const [key, value] of new URLSearchParams(queryPart || '')) query[key] = value;
    return { id: segments[0] || '', params: segments.slice(1), query, path: pathPart };
  }

  navigate(to, { replace = false } = {}) {
    const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? '' : '/'}${to}`;
    if (replace) window.history.replaceState(null, '', target);
    else window.location.hash = target;
    if (replace) this.resolve();
  }

  async resolve() {
    const parsed = Router.parse(window.location.hash);
    const id = this.routes[parsed.id] ? parsed.id : this.fallback;
    const route = { ...this.routes[id], id, params: parsed.params, query: parsed.query };
    this.current = route;

    if (this.onBefore) this.onBefore(route);

    if (!this.canAccess(route)) {
      const denied = this.onDenied ? this.onDenied(route) : document.createTextNode('Not permitted.');
      this._swap(denied);
      return route;
    }

    let module = this.loaded.get(id);
    if (!module) {
      this._swap(loadingView());
      try {
        module = await route.load();
        this.loaded.set(id, module);
      } catch (err) {
        console.error(`[shepherd] failed to load "${id}"`, err);
        this._swap(errorView(err));
        return route;
      }
      // The hash may have moved on while we were loading.
      if (this.current !== route) return route;
    }

    try {
      const view = await module.render(this.context, route);
      if (this.current !== route) return route;
      this._swap(view);
      if (this.onAfter) this.onAfter(route, view);
    } catch (err) {
      console.error(`[shepherd] "${id}" failed to render`, err);
      this._swap(errorView(err));
    }
    return route;
  }

  /** Re-render the current route in place (after a data change). */
  refresh() {
    return this.resolve();
  }

  _swap(view) {
    this.container.textContent = '';
    this.container.appendChild(view);
    this.container.scrollIntoView({ block: 'start', behavior: 'auto' });
    if (window.scrollY > 0) window.scrollTo({ top: 0 });
  }
}

function loadingView() {
  const wrap = document.createElement('div');
  wrap.className = 'page';
  wrap.setAttribute('aria-busy', 'true');
  wrap.innerHTML = `
    <div class="skeleton" style="height:30px;width:220px;margin-bottom:10px"></div>
    <div class="skeleton" style="height:16px;width:320px;margin-bottom:28px"></div>
    <div class="grid grid--3">
      <div class="skeleton" style="height:96px"></div>
      <div class="skeleton" style="height:96px"></div>
      <div class="skeleton" style="height:96px"></div>
    </div>
    <div class="skeleton" style="height:220px;margin-top:16px"></div>`;
  return wrap;
}

function errorView(err) {
  const wrap = document.createElement('div');
  wrap.className = 'page page--narrow';
  const message = document.createElement('p');
  message.className = 'muted';
  message.textContent = err && err.message ? err.message : String(err);
  wrap.innerHTML = '<h1>That screen did not open</h1>';
  wrap.appendChild(message);
  return wrap;
}
