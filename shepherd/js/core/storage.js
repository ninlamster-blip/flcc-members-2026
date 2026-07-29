/**
 * Storage adapters.
 *
 * Everything the app persists goes through this interface, which is the seam
 * where a server backend slots in later (see ARCHITECTURE.md, "Adapter
 * seam"). Keys are opaque strings; values are strings. Nothing above this
 * layer knows whether it is talking to localStorage, IndexedDB or an API.
 *
 * @typedef {object} StorageAdapter
 * @property {(key: string) => Promise<string|null>} get
 * @property {(key: string, value: string) => Promise<void>} set
 * @property {(key: string) => Promise<void>} remove
 * @property {(prefix: string) => Promise<string[]>} keys
 */

/** In-memory adapter — used by the test suite and as a fallback. @returns {StorageAdapter} */
export function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async set(key, value) { map.set(key, String(value)); },
    async remove(key) { map.delete(key); },
    async keys(prefix) { return [...map.keys()].filter((k) => k.startsWith(prefix)); },
  };
}

/**
 * localStorage adapter. Synchronous underneath, async at the interface so the
 * callers already work when this becomes a network call.
 * @returns {StorageAdapter}
 */
export function localStorageAdapter(store = globalThis.localStorage) {
  if (!store) return memoryStorage();
  return {
    async get(key) {
      try { return store.getItem(key); } catch { return null; }
    },
    async set(key, value) {
      try {
        store.setItem(key, value);
      } catch (err) {
        // Quota is the realistic failure here — a vault full of scanned PDFs.
        // Surface it rather than silently losing the write.
        throw new StorageQuotaError(String(err && err.name === 'QuotaExceededError'
          ? 'This device is out of storage for Shepherd. Archive or export documents to free space.'
          : err));
      }
    },
    async remove(key) {
      try { store.removeItem(key); } catch { /* nothing to do */ }
    },
    async keys(prefix) {
      const out = [];
      try {
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key && key.startsWith(prefix)) out.push(key);
        }
      } catch { /* nothing to do */ }
      return out;
    },
  };
}

export class StorageQuotaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

/**
 * Wrap an adapter so every key is forced under `prefix`. This is how tenant
 * isolation is made structural rather than a convention someone can forget:
 * a Database is handed a namespaced adapter and physically cannot address a
 * key outside its own tenant.
 *
 * @param {StorageAdapter} adapter
 * @param {string} prefix
 * @returns {StorageAdapter}
 */
export function namespaced(adapter, prefix) {
  const full = (key) => {
    const clean = String(key);
    if (clean.includes('..')) throw new Error(`Illegal storage key: ${clean}`);
    return prefix + clean;
  };
  return {
    get: (key) => adapter.get(full(key)),
    set: (key, value) => adapter.set(full(key), value),
    remove: (key) => adapter.remove(full(key)),
    keys: async (sub = '') => (await adapter.keys(full(sub))).map((k) => k.slice(prefix.length)),
  };
}

/** Root namespace for everything Shepherd writes. Nothing else in this repo uses it. */
export const ROOT_PREFIX = 'shepherd/v1/';

/** `shepherd/v1/t/<tenantId>/` */
export function tenantPrefix(tenantId) {
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(String(tenantId))) {
    throw new Error(`Invalid tenant id: ${tenantId}`);
  }
  return `${ROOT_PREFIX}t/${tenantId}/`;
}
