/**
 * Persistence, in two halves.
 *
 *   RECORDS (small, structured, read constantly) live behind a
 *   StorageAdapter — localStorage today, a network API later without any
 *   caller knowing. Same seam Shepherd uses next door.
 *
 *   AUDIO (large, binary, read rarely) lives in IndexedDB. Recordings are
 *   megabytes; putting them in localStorage would blow the quota on the
 *   first meeting.
 *
 * Both are device-local. Nothing here uploads anything: audio only ever
 * leaves this device if the user has configured a transcription endpoint,
 * and then only as the chunk being transcribed.
 */

/**
 * @typedef {object} StorageAdapter
 * @property {(key: string) => Promise<string|null>} get
 * @property {(key: string, value: string) => Promise<void>} set
 * @property {(key: string) => Promise<void>} remove
 * @property {(prefix: string) => Promise<string[]>} keys
 */

export class StorageFullError extends Error {
  constructor(message) { super(message); this.name = 'StorageFullError'; }
}

/** @returns {StorageAdapter} */
export function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    async get(key) { return map.has(key) ? map.get(key) : null; },
    async set(key, value) { map.set(key, String(value)); },
    async remove(key) { map.delete(key); },
    async keys(prefix) { return [...map.keys()].filter((k) => k.startsWith(prefix)); },
  };
}

/** @returns {StorageAdapter} */
export function localStorageAdapter(store = globalThis.localStorage) {
  if (!store) return memoryStorage();
  return {
    async get(key) { try { return store.getItem(key); } catch { return null; } },
    async set(key, value) {
      try {
        store.setItem(key, String(value));
      } catch (err) {
        throw new StorageFullError(err && err.name === 'QuotaExceededError'
          ? 'This device is out of storage for Longhand. Delete or export older meetings to free space.'
          : String(err));
      }
    },
    async remove(key) { try { store.removeItem(key); } catch { /* already gone */ } },
    async keys(prefix) {
      const out = [];
      try {
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key && key.startsWith(prefix)) out.push(key);
        }
      } catch { /* nothing readable */ }
      return out;
    },
  };
}

/* ── audio ───────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} BlobStore
 * @property {(id: string, blob: Blob) => Promise<void>} put
 * @property {(id: string) => Promise<Blob|null>} get
 * @property {(id: string) => Promise<void>} remove
 * @property {() => Promise<{count: number, bytes: number}>} usage
 * @property {() => Promise<string[]>} ids
 */

/** In-memory blob store — tests, and browsers with IndexedDB blocked. */
export function memoryBlobs() {
  const map = new Map();
  return {
    async put(id, blob) { map.set(id, blob); },
    async get(id) { return map.get(id) || null; },
    async remove(id) { map.delete(id); },
    async ids() { return [...map.keys()]; },
    async usage() {
      let total = 0;
      for (const blob of map.values()) total += blob.size || 0;
      return { count: map.size, bytes: total };
    },
  };
}

const DB_NAME = 'longhand';
const STORE = 'audio';

/** @returns {BlobStore} */
export function indexedDbBlobs(factory = globalThis.indexedDB) {
  if (!factory) return memoryBlobs();
  let opening = null;

  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const req = factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return opening;
  }

  async function tx(mode, run) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  return {
    async put(id, blob) {
      try {
        await tx('readwrite', (s) => s.put(blob, id));
      } catch (err) {
        throw new StorageFullError(`This recording could not be saved to this device: ${err && err.message ? err.message : err}`);
      }
    },
    async get(id) { try { return (await tx('readonly', (s) => s.get(id))) || null; } catch { return null; } },
    async remove(id) { try { await tx('readwrite', (s) => s.delete(id)); } catch { /* already gone */ } },
    async ids() { try { return (await tx('readonly', (s) => s.getAllKeys())) || []; } catch { return []; } },
    async usage() {
      try {
        const all = (await tx('readonly', (s) => s.getAll())) || [];
        return { count: all.length, bytes: all.reduce((sum, b) => sum + (b.size || 0), 0) };
      } catch { return { count: 0, bytes: 0 }; }
    },
  };
}

/** Force every key under one prefix — the shape a multi-profile store needs. */
export function namespaced(adapter, prefix) {
  const full = (key) => {
    if (key.includes('..')) throw new Error('Invalid key');
    return prefix + key;
  };
  return {
    async get(key) { return adapter.get(full(key)); },
    async set(key, value) { return adapter.set(full(key), value); },
    async remove(key) { return adapter.remove(full(key)); },
    async keys(sub = '') {
      const keys = await adapter.keys(prefix + sub);
      return keys.map((k) => k.slice(prefix.length));
    },
  };
}
