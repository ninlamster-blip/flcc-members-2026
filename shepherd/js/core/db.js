/**
 * The tenant database.
 *
 * ISOLATION
 * ---------
 * A Database is constructed for exactly one tenant and is handed a storage
 * adapter already namespaced to `shepherd/v1/t/<tenantId>/`. It cannot form a
 * key outside that prefix, so "church A reads church B" is not a rule that
 * code has to remember — there is no expressible way to do it. `assertTenant`
 * catches the one remaining path (a stale Database held across a tenant
 * switch) and throws.
 *
 * SHAPE
 * -----
 * Collections load once on `open()` — decrypting the encrypted ones with the
 * session's vault key — and then live in memory. Reads and writes are
 * synchronous, which is what keeps the UI instant; persistence is debounced
 * write-behind. `await db.flush()` forces it (tests, sign-out, export).
 *
 * EVERY WRITE
 *   • is validated against the schema,
 *   • is permission-checked against the acting user,
 *   • stamps `updatedAt`/`updatedBy`,
 *   • appends to the append-only audit log,
 *   • notifies subscribers so open views re-render.
 */

import { uid } from './id.js';
import { namespaced, tenantPrefix } from './storage.js';
import { can, assertCan, PermissionError } from './rbac.js';
import { collectionDef, COLLECTION_NAMES, validate, docTitle } from './schema.js';
import { encryptJSON, decryptJSON, isCiphertext } from './crypto.js';

export class ValidationError extends Error {
  /** @param {{field: string, message: string}[]} errors */
  constructor(errors) {
    super(errors.map((e) => e.message).join(' '));
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class TenantMismatchError extends Error {
  constructor(expected, actual) {
    super(`Refused: this data belongs to ${expected}, not ${actual}.`);
    this.name = 'TenantMismatchError';
  }
}

const FLUSH_DELAY = 120;

export class Database {
  /**
   * @param {{tenantId: string, storage: import('./storage.js').StorageAdapter,
   *          vaultKey?: CryptoKey|null, actor?: object|null, audit?: boolean}} options
   */
  constructor({ tenantId, storage, vaultKey = null, actor = null, audit = true }) {
    this.tenantId = tenantId;
    this.store = namespaced(storage, tenantPrefix(tenantId));
    this.vaultKey = vaultKey;
    this.actor = actor;
    this.auditEnabled = audit;

    /** @type {Map<string, Map<string, any>>} */
    this.data = new Map();
    /** @type {Set<string>} */
    this.dirty = new Set();
    /** @type {Set<(collection: string, change: object) => void>} */
    this.listeners = new Set();
    this.opened = false;
    this._timer = null;
    this._flushing = null;
  }

  /** Load every collection into memory. Safe to call twice. */
  async open() {
    if (this.opened) return this;
    for (const name of COLLECTION_NAMES) {
      this.data.set(name, new Map());
    }
    const keys = await this.store.keys('c/');
    for (const key of keys) {
      const name = key.slice(2);
      if (!COLLECTION_NAMES.includes(name)) continue;
      const raw = await this.store.get(key);
      if (!raw) continue;
      let docs;
      try {
        docs = isCiphertext(raw)
          ? await this._decrypt(raw)
          : JSON.parse(raw);
      } catch (err) {
        // A record we cannot decrypt (wrong vault key) must not take the whole
        // app down — the module shows a locked state instead.
        this.data.set(name, new Map());
        this._locked = this._locked || new Set();
        this._locked.add(name);
        continue;
      }
      const map = new Map();
      for (const doc of Array.isArray(docs) ? docs : []) {
        if (doc && doc.id) map.set(doc.id, doc);
      }
      this.data.set(name, map);
    }
    this.opened = true;
    return this;
  }

  async _decrypt(raw) {
    if (!this.vaultKey) throw new Error('Locked: no vault key for this session.');
    return decryptJSON(this.vaultKey, raw);
  }

  /** True when a collection could not be decrypted with this session's key. */
  isLocked(name) {
    return !!(this._locked && this._locked.has(name));
  }

  setActor(user) {
    this.actor = user;
    return this;
  }

  setVaultKey(key) {
    this.vaultKey = key;
    return this;
  }

  /** Guard against using a Database left over from another tenant. */
  assertTenant(tenantId) {
    if (tenantId !== this.tenantId) throw new TenantMismatchError(this.tenantId, tenantId);
    return true;
  }

  /** @param {(collection: string, change: object) => void} listener */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emit(collection, change) {
    for (const listener of this.listeners) {
      try { listener(collection, change); } catch (err) { console.error('[shepherd] listener failed', err); }
    }
  }

  /* ── reads ─────────────────────────────────────────────────────────── */

  /** @returns {any[]} every live record, newest id last */
  all(collection) {
    return [...this._map(collection).values()].filter((doc) => !doc.deletedAt);
  }

  find(collection, id) {
    const doc = this._map(collection).get(id);
    return doc && !doc.deletedAt ? doc : null;
  }

  where(collection, predicate) {
    return this.all(collection).filter(predicate);
  }

  first(collection, predicate) {
    return this.all(collection).find(predicate) || null;
  }

  count(collection, predicate) {
    return predicate ? this.where(collection, predicate).length : this.all(collection).length;
  }

  _map(collection) {
    const map = this.data.get(collection);
    if (!map) throw new Error(`Unknown collection: ${collection}`);
    return map;
  }

  /**
   * The resource-level check (`${resource}:write`) is the common case. A
   * collection can additionally declare `instanceWrite(user, record, db)` in
   * its schema definition for a narrower, record-specific allowance — e.g. a
   * ministry head who does not hold blanket `leadership:write` but may still
   * write their own ministry's tasks and plan (see core/policies.js). Either
   * one is enough; neither means the write is refused, here, not just in
   * the UI that happened to ask for it.
   */
  _assertWritable(def, record) {
    if (can(this.actor, `${def.resource}:write`)) return;
    if (typeof def.instanceWrite === 'function' && def.instanceWrite(this.actor, record, this)) return;
    throw new PermissionError(`${def.resource}:write`);
  }

  /* ── writes ────────────────────────────────────────────────────────── */

  /**
   * @param {string} collection
   * @param {object} doc
   * @param {{skipPermission?: boolean, skipAudit?: boolean}} [opts]
   */
  insert(collection, doc, opts = {}) {
    const def = collectionDef(collection);
    const now = new Date().toISOString();
    const record = {
      ...doc,
      id: doc.id || uid(),
      createdAt: doc.createdAt || now,
      updatedAt: now,
      createdBy: doc.createdBy || (this.actor && this.actor.id) || null,
      updatedBy: (this.actor && this.actor.id) || null,
    };
    if (!opts.skipPermission) this._assertWritable(def, record);

    const result = validate(collection, record);
    if (!result.ok) throw new ValidationError(result.errors);

    this._map(collection).set(record.id, record);
    this._touch(collection);
    if (!opts.skipAudit) this._audit('create', collection, record);
    this._emit(collection, { type: 'insert', id: record.id, doc: record });
    return record;
  }

  update(collection, id, patch, opts = {}) {
    const def = collectionDef(collection);
    const existing = this._map(collection).get(id);
    if (!existing) throw new Error(`${def.label}: no record ${id}`);

    const record = {
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: (this.actor && this.actor.id) || null,
    };
    if (!opts.skipPermission) this._assertWritable(def, record);

    const result = validate(collection, record);
    if (!result.ok) throw new ValidationError(result.errors);

    this._map(collection).set(id, record);
    this._touch(collection);
    if (!opts.skipAudit) this._audit('update', collection, record, Object.keys(patch));
    this._emit(collection, { type: 'update', id, doc: record });
    return record;
  }

  /** Soft delete — the row stays for the audit trail, hidden from reads. */
  remove(collection, id, opts = {}) {
    const def = collectionDef(collection);
    if (!opts.skipPermission) assertCan(this.actor, `${def.resource}:delete`);

    const existing = this._map(collection).get(id);
    if (!existing) return false;
    const record = {
      ...existing,
      deletedAt: new Date().toISOString(),
      updatedBy: (this.actor && this.actor.id) || null,
    };
    this._map(collection).set(id, record);
    this._touch(collection);
    if (!opts.skipAudit) this._audit('delete', collection, existing);
    this._emit(collection, { type: 'remove', id, doc: record });
    return true;
  }

  /** Insert or update depending on whether `doc.id` already exists. */
  upsert(collection, doc, opts = {}) {
    if (doc.id && this._map(collection).has(doc.id)) {
      return this.update(collection, doc.id, doc, opts);
    }
    return this.insert(collection, doc, opts);
  }

  /* ── audit ─────────────────────────────────────────────────────────── */

  _audit(action, collection, doc, fields) {
    if (!this.auditEnabled || collection === 'audit') return;
    const entry = {
      id: uid('a'),
      at: new Date().toISOString(),
      actorId: (this.actor && this.actor.id) || null,
      actorName: (this.actor && this.actor.name) || 'system',
      action,
      collection,
      docId: doc.id,
      summary: `${action} ${collectionDef(collection).label}: ${docTitle(collection, doc)}`
        + (fields && fields.length ? ` (${fields.slice(0, 6).join(', ')})` : ''),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this._map('audit').set(entry.id, entry);
    this._touch('audit');
  }

  /** Record something that is not a collection write — sign-in, export, AI use. */
  log(action, summary, extra = {}) {
    const entry = {
      id: uid('a'),
      at: new Date().toISOString(),
      actorId: (this.actor && this.actor.id) || null,
      actorName: (this.actor && this.actor.name) || 'system',
      action,
      summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...extra,
    };
    this._map('audit').set(entry.id, entry);
    this._touch('audit');
    this._emit('audit', { type: 'insert', id: entry.id, doc: entry });
    return entry;
  }

  /* ── persistence ───────────────────────────────────────────────────── */

  _touch(collection) {
    this.dirty.add(collection);
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this.flush().catch((err) => {
        console.error('[shepherd] save failed', err);
        this._emit('__error', { type: 'save-failed', error: err });
      });
    }, FLUSH_DELAY);
    // Node's timers keep the process alive; tests call flush() explicitly.
    if (typeof this._timer === 'object' && this._timer.unref) this._timer.unref();
  }

  /** Persist every pending change. */
  async flush() {
    if (this._flushing) await this._flushing;
    if (!this.dirty.size) return;
    const pending = [...this.dirty];
    this.dirty.clear();
    this._flushing = (async () => {
      for (const name of pending) {
        const docs = [...this._map(name).values()];
        const def = collectionDef(name);
        const payload = def.encrypted && this.vaultKey
          ? await encryptJSON(this.vaultKey, docs)
          : JSON.stringify(docs);
        await this.store.set(`c/${name}`, payload);
      }
    })();
    try {
      await this._flushing;
    } finally {
      this._flushing = null;
    }
  }

  /* ── export / import ───────────────────────────────────────────────── */

  /** Full tenant snapshot — the backup and "take my data elsewhere" path. */
  exportAll({ includeEncrypted = true } = {}) {
    const out = { tenantId: this.tenantId, exportedAt: new Date().toISOString(), collections: {} };
    for (const name of COLLECTION_NAMES) {
      if (!includeEncrypted && collectionDef(name).encrypted) continue;
      out.collections[name] = [...this._map(name).values()];
    }
    return out;
  }

  /**
   * Replace collections wholesale. Used by restore and by the seeder.
   * Bypasses per-record permission checks by design; the caller must hold
   * `settings:manage` (the settings module enforces that before calling).
   */
  importAll(snapshot, { merge = false } = {}) {
    if (snapshot.tenantId && snapshot.tenantId !== this.tenantId) {
      throw new TenantMismatchError(this.tenantId, snapshot.tenantId);
    }
    for (const [name, docs] of Object.entries(snapshot.collections || {})) {
      if (!COLLECTION_NAMES.includes(name)) continue;
      const map = merge ? this._map(name) : new Map();
      for (const doc of docs) if (doc && doc.id) map.set(doc.id, doc);
      this.data.set(name, map);
      this._touch(name);
    }
    this._emit('*', { type: 'import' });
    return this;
  }

  /** Wipe this tenant's data from storage. Irreversible. */
  async destroy() {
    for (const name of COLLECTION_NAMES) {
      await this.store.remove(`c/${name}`);
      this.data.set(name, new Map());
    }
    this.dirty.clear();
    this._emit('*', { type: 'destroyed' });
  }
}

/**
 * @param {{tenantId: string, storage: import('./storage.js').StorageAdapter,
 *          vaultKey?: CryptoKey|null, actor?: object|null, audit?: boolean}} options
 */
export async function openDatabase(options) {
  return new Database(options).open();
}
