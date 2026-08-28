// Hash router. Each screen is imported on demand, which is how a no-build app
// gets code splitting.

const routes = new Map();
let onNavigate = () => {};

export function define(name, loader) {
  routes.set(name, loader);
}

export function parse(hash = location.hash) {
  const raw = String(hash || '').replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query));
  return { name: parts[0] || 'today', args: parts.slice(1), params };
}

export function go(path, { replace = false } = {}) {
  const target = `#/${String(path).replace(/^#?\/?/, '')}`;
  if (location.hash === target) return handle();
  if (replace) history.replaceState(null, '', target);
  else location.hash = target;
  if (replace) handle();
}

export function back(fallback = 'today') {
  if (history.length > 1) history.back();
  else go(fallback, { replace: true });
}

let current = null;

async function handle() {
  const route = parse();
  current = route;
  const loader = routes.get(route.name) || routes.get('today');
  const module = await loader();
  if (current !== route) return; // a newer navigation won
  onNavigate(route, module);
}

export function start(handler) {
  onNavigate = handler;
  window.addEventListener('hashchange', handle);
  return handle();
}

export function currentRoute() {
  return current || parse();
}
