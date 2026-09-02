// Hash router with per-screen dynamic import.

const routes = new Map();
let onNavigate = () => {};
let current = null;

export function define(name, loader) { routes.set(name, loader); }

export function parse(hash = location.hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'home', args: parts.slice(1), params: Object.fromEntries(new URLSearchParams(query)) };
}

export function go(path, { replace = false } = {}) {
  const target = `#/${String(path).replace(/^#?\/?/, '')}`;
  if (location.hash === target) return handle();
  if (replace) { history.replaceState(null, '', target); return handle(); }
  location.hash = target;
  return undefined;
}

export function back(fallback = 'home') {
  if (history.length > 1) history.back();
  else go(fallback, { replace: true });
}

async function handle() {
  const route = parse();
  current = route;
  const loader = routes.get(route.name) || routes.get('home');
  const module = await loader();
  if (current !== route) return;
  onNavigate(route, module);
}

export function start(handler) {
  onNavigate = handler;
  window.addEventListener('hashchange', handle);
  return handle();
}

export function currentRoute() { return current || parse(); }
