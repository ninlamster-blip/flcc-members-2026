// The only module in this app that touches browser storage.
//
// Everything lives under `kw/v1/`, and `guard()` throws on anything else.
// This app is a standalone project that happens to sit in this repository —
// the namespace is what keeps it from ever reading or writing a key belonging
// to any of the apps around it.

export const NS = 'kw/v1/';

export function guard(key) {
  if (typeof key !== 'string' || !key.startsWith(NS)) {
    throw new Error(`Kuwait Weather storage refuses "${key}" — keys must start with "${NS}"`);
  }
  return key;
}

const memory = new Map();

function backing() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = `${NS}__probe`;
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch { /* private mode, blocked storage */ }
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
    key: (i) => [...memory.keys()][i] ?? null,
    get length() { return memory.size; },
  };
}

let driver = null;
const store = () => (driver ||= backing());

export function read(key, fallback = null) {
  guard(key);
  try {
    const raw = store().getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function write(key, value) {
  guard(key);
  try { store().setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function remove(key) { guard(key); store().removeItem(key); }

export function keys() {
  const d = store();
  const found = [];
  for (let i = 0; i < d.length; i++) {
    const k = d.key(i);
    if (k && k.startsWith(NS)) found.push(k);
  }
  return found;
}

export function wipe() {
  const all = keys();
  all.forEach((k) => store().removeItem(k));
  return all.length;
}

export const KEYS = {
  place:    `${NS}place`,     // which place the app opens on
  units:    `${NS}units`,     // °C or °F
  work:     `${NS}work`,      // the outdoor-work profile the guidance is written for
  reading:  `${NS}reading`,   // the last good reading, so a cold start has something to show
};
