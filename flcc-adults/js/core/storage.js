// The only module that touches browser storage.
//
// Everything FLCC NEXT Adults keeps lives under `adults/v1/`, and `guard()`
// throws on anything else. That is what stops this app from ever reading or
// writing the FLCC Members app's keys, Shepherd's, LAMP's, or the kids and
// teens app's — by construction rather than by good intentions.

export const NS = 'adults/v1/';

export function guard(key) {
  if (typeof key !== 'string' || !key.startsWith(NS)) {
    throw new Error(`FLCC NEXT Adults storage refuses "${key}" — keys must start with "${NS}"`);
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

// The record shapes, in one place. Each maps to a table in ARCHITECTURE.md, so
// moving any of them to a server later is a change of adapter, not of screens.
export const KEYS = {
  user:     `${NS}user`,      // members
  progress: `${NS}progress`,  // member_progress + completions
  prayers:  `${NS}prayers`,   // prayer_list (this device's own)
  journal:  `${NS}journal`,   // reflections written in a guided moment
  rsvps:    `${NS}rsvps`,     // event_rsvps
  settings: `${NS}settings`,  // this device's own configuration
  bible:    `${NS}bible`,     // translation, bookmark, verses kept
  plan:     `${NS}plan`,      // which reading plan, and how far in
};
