/**
 * The database.
 *
 * Collections are Maps in memory; reads are synchronous (a phone scrolling a
 * transcript cannot await), writes are write-behind and flushed on a short
 * debounce. `await db.flush()` forces persistence — export, sign-out and
 * every test do this.
 *
 * Deletes are real deletes. This app holds recordings of people talking; a
 * "deleted" meeting that quietly stays on disk would be a lie told to
 * someone who asked for it to be gone.
 */

import { blank, validate, COLLECTIONS } from './schema.js';
import { id as newId } from './id.js';
import { memoryStorage, memoryBlobs } from './store.js';

const KEY_PREFIX = 'col/';
const SETTINGS_KEY = 'settings';
const FLUSH_MS = 250;

export class Database extends EventTarget {
  /** @param {{storage?: any, blobs?: any, now?: () => string}} options */
  constructor({ storage = memoryStorage(), blobs = memoryBlobs(), now = () => new Date().toISOString() } = {}) {
    super();
    this.storage = storage;
    this.blobs = blobs;
    this.now = now;
    /** @type {Map<string, Map<string, any>>} */
    this.data = new Map();
    this.settings = {};
    this.dirty = new Set();
    this._timer = null;
    this._flushing = null;
    this.opened = false;
  }

  async open() {
    for (const name of Object.keys(COLLECTIONS)) {
      const raw = await this.storage.get(KEY_PREFIX + name);
      const rows = raw ? safeParse(raw, []) : [];
      this.data.set(name, new Map(rows.map((row) => [row.id, row])));
    }
    this.settings = safeParse(await this.storage.get(SETTINGS_KEY), {}) || {};
    this.opened = true;
    return this;
  }

  /* ── reads ─────────────────────────────────────────────────────────────── */

  all(collection) {
    return [...this._map(collection).values()];
  }

  get(collection, id) {
    return this._map(collection).get(id) || null;
  }

  /** `where('segments', { meetingId })` — object match, values compared by ===. */
  where(collection, match = {}) {
    const entries = Object.entries(match);
    return this.all(collection).filter((row) => entries.every(([k, v]) => row[k] === v));
  }

  count(collection, match) {
    return match ? this.where(collection, match).length : this._map(collection).size;
  }

  /* ── writes ────────────────────────────────────────────────────────────── */

  insert(collection, values = {}) {
    const record = { ...blank(collection, values) };
    if (!record.id) record.id = newId(collection.slice(0, 3));
    const errors = validate(collection, record);
    if (errors.length) throw new Error(errors.join(' '));
    this._map(collection).set(record.id, record);
    this._touch(collection, 'insert', record);
    return record;
  }

  /** Insert many at once — one flush, one event. Transcript segments arrive
   *  in bursts and should not each schedule their own write. */
  insertMany(collection, rows) {
    const out = rows.map((values) => {
      const record = { ...blank(collection, values) };
      if (!record.id) record.id = newId(collection.slice(0, 3));
      const errors = validate(collection, record);
      if (errors.length) throw new Error(errors.join(' '));
      this._map(collection).set(record.id, record);
      return record;
    });
    this._touch(collection, 'insert', out);
    return out;
  }

  update(collection, id, patch) {
    const current = this._map(collection).get(id);
    if (!current) throw new Error(`No ${collection} record ${id}`);
    const next = { ...current, ...patch, id };
    const errors = validate(collection, next);
    if (errors.length) throw new Error(errors.join(' '));
    this._map(collection).set(id, next);
    this._touch(collection, 'update', next);
    return next;
  }

  remove(collection, id) {
    const existed = this._map(collection).delete(id);
    if (existed) this._touch(collection, 'remove', { id });
    return existed;
  }

  /* ── cascades ──────────────────────────────────────────────────────────── */

  /** Everything generated from one meeting, in one call. */
  meetingChildren(meetingId) {
    return {
      segments:  this.where('segments', { meetingId }),
      speakers:  this.where('speakers', { meetingId }),
      decisions: this.where('decisions', { meetingId }),
      actions:   this.where('actions', { meetingId }),
      questions: this.where('questions', { meetingId }),
      topics:    this.where('topics', { meetingId }),
      moments:   this.where('moments', { meetingId }),
      notes:     this.where('notes', { meetingId }),
    };
  }

  /** Drop the transcript and everything derived from it, keeping the meeting
   *  and its audio. This is what "process again" starts from. */
  clearDerived(meetingId, { includeSegments = false } = {}) {
    const groups = ['decisions', 'actions', 'questions', 'topics', 'moments'];
    if (includeSegments) groups.push('segments', 'speakers');
    for (const collection of groups) {
      for (const row of this.where(collection, { meetingId })) this._map(collection).delete(row.id);
      this._touch(collection, 'remove', { meetingId });
    }
  }

  async deleteMeeting(meetingId) {
    const meeting = this.get('meetings', meetingId);
    if (!meeting) return false;
    if (meeting.audioId) await this.blobs.remove(meeting.audioId);
    this.clearDerived(meetingId, { includeSegments: true });
    for (const note of this.where('notes', { meetingId })) this._map('notes').delete(note.id);
    for (const row of this.where('memory', { meetingId })) this._map('memory').delete(row.id);
    this._map('meetings').delete(meetingId);
    this._touch('meetings', 'remove', { id: meetingId });
    await this.flush();
    return true;
  }

  /** Delete the audio, keep the transcript. Recordings are the sensitive
   *  half and the half that fills a phone; people ask for exactly this. */
  async deleteAudio(meetingId) {
    const meeting = this.get('meetings', meetingId);
    if (!meeting || !meeting.audioId) return false;
    await this.blobs.remove(meeting.audioId);
    this.update('meetings', meetingId, { audioId: null, audioBytes: 0 });
    await this.flush();
    return true;
  }

  /* ── settings ──────────────────────────────────────────────────────────── */

  setting(key, fallback = null) {
    return key in this.settings ? this.settings[key] : fallback;
  }

  setSetting(key, value) {
    this.settings = { ...this.settings, [key]: value };
    this.dirty.add(SETTINGS_KEY);
    this._schedule();
    this.dispatchEvent(new CustomEvent('change', { detail: { collection: 'settings', action: 'update' } }));
  }

  /* ── persistence ───────────────────────────────────────────────────────── */

  _map(collection) {
    const map = this.data.get(collection);
    if (!map) throw new Error(`Unknown collection: ${collection}`);
    return map;
  }

  _touch(collection, action, record) {
    this.dirty.add(collection);
    this._schedule();
    this.dispatchEvent(new CustomEvent('change', { detail: { collection, action, record } }));
  }

  _schedule() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = null; this.flush().catch(() => {}); }, FLUSH_MS);
    if (typeof this._timer === 'object' && typeof this._timer.unref === 'function') this._timer.unref();
  }

  async flush() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    if (this._flushing) await this._flushing;
    const pending = [...this.dirty];
    if (!pending.length) return;
    this.dirty.clear();
    this._flushing = (async () => {
      for (const key of pending) {
        if (key === SETTINGS_KEY) {
          await this.storage.set(SETTINGS_KEY, JSON.stringify(this.settings));
        } else {
          await this.storage.set(KEY_PREFIX + key, JSON.stringify([...this._map(key).values()]));
        }
      }
    })();
    try { await this._flushing; } finally { this._flushing = null; }
  }

  /** Everything this device holds, as one JSON object. Audio is not included
   *  — it is exported separately as files, because a base64 blob of an hour
   *  of speech in a JSON file helps nobody. */
  async exportAll() {
    await this.flush();
    const out = { app: 'longhand', version: 1, exportedAt: this.now(), settings: redactSecrets(this.settings), data: {} };
    for (const name of Object.keys(COLLECTIONS)) out.data[name] = this.all(name);
    return out;
  }

  /** Replace everything with a previous export. */
  async importAll(snapshot) {
    if (!snapshot || snapshot.app !== 'longhand') throw new Error('That file is not a Longhand export.');
    for (const name of Object.keys(COLLECTIONS)) {
      const rows = Array.isArray(snapshot.data && snapshot.data[name]) ? snapshot.data[name] : [];
      this.data.set(name, new Map(rows.filter((r) => r && r.id).map((r) => [r.id, r])));
      this.dirty.add(name);
    }
    this._schedule();
    await this.flush();
    this.dispatchEvent(new CustomEvent('change', { detail: { collection: '*', action: 'import' } }));
  }

  /** Delete everything: records, settings and every stored recording. */
  async deleteEverything() {
    for (const meeting of this.all('meetings')) {
      if (meeting.audioId) await this.blobs.remove(meeting.audioId);
    }
    for (const name of Object.keys(COLLECTIONS)) {
      this.data.set(name, new Map());
      await this.storage.remove(KEY_PREFIX + name);
    }
    this.settings = {};
    await this.storage.remove(SETTINGS_KEY);
    this.dirty.clear();
    this.dispatchEvent(new CustomEvent('change', { detail: { collection: '*', action: 'wipe' } }));
  }
}

/** A shared secret is a credential, not a preference: it never goes into a
 *  file the user might mail to themselves. */
function redactSecrets(settings) {
  const copy = { ...settings };
  delete copy.proxySecret;
  return copy;
}

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
