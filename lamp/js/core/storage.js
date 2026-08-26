// The only module that touches browser storage.
//
// Everything LAMP stores lives under `lamp/v1/`. That is not a convention here,
// it is enforced: `guard()` throws on any other key, which is what keeps the
// promise in SPEC.md §3 mechanically true — LAMP cannot read or write FLCC's
// or Shepherd's keys even by accident.

export const NS = 'lamp/v1/';

export function guard(key) {
  if (typeof key !== 'string' || !key.startsWith(NS)) {
    throw new Error(`LAMP storage refuses "${key}" — keys must start with "${NS}"`);
  }
  return key;
}

const memory = new Map();

function backing() {
  try {
    if (typeof localStorage !== 'undefined') {
      const probe = NS + '__probe';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    }
  } catch { /* private mode, blocked storage — fall through */ }
  return {
    getItem: (k) => (memory.has(k) ? memory.get(k) : null),
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
    key: (i) => [...memory.keys()][i] ?? null,
    get length() { return memory.size; },
  };
}

let store = null;
function driver() { return (store ||= backing()); }

export function read(key, fallback = null) {
  guard(key);
  try {
    const raw = driver().getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(key, value) {
  guard(key);
  try {
    driver().setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota or blocked storage — the caller decides what to say
  }
}

export function remove(key) {
  guard(key);
  driver().removeItem(key);
}

export function keys() {
  const d = driver();
  const found = [];
  for (let i = 0; i < d.length; i++) {
    const k = d.key(i);
    if (k && k.startsWith(NS)) found.push(k);
  }
  return found;
}

/** Wipe every LAMP key. Returns how many were removed. */
export function wipe() {
  const all = keys();
  all.forEach((k) => driver().removeItem(k));
  return all.length;
}

export const KEYS = {
  profile:    NS + 'profile',
  settings:   NS + 'settings',
  progress:   NS + 'progress',
  memory:     NS + 'memory',
  journal:    NS + 'journal',
  prayers:    NS + 'prayers',
  challenges: NS + 'challenges',
  journey:    NS + 'journey',
  highlights: NS + 'highlights',
  notes:      NS + 'notes',
  ask:        NS + 'ask',
  bible:      NS + 'bible/',
};
