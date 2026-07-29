/**
 * Global search.
 *
 * An in-memory inverted index over every collection the signed-in user is
 * allowed to read. It is rebuilt lazily when a collection changes, so search
 * is always current without anyone remembering to reindex.
 *
 * Results are permission-filtered at query time as well as at index time —
 * the index is per-session, but roles can change mid-session.
 */

import { COLLECTIONS, COLLECTION_NAMES, searchableText, docTitle } from './schema.js';
import { can } from './rbac.js';

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'was', 'are', 'has', 'have', 'our', 'his', 'her', 'their', 'you', 'not', 'but', 'all', 'any', 'can', 'will']);

/** Split text into searchable tokens. */
export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9؀-ۿ']+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

export class SearchIndex {
  /** @param {import('./db.js').Database} db */
  constructor(db) {
    this.db = db;
    /** @type {Map<string, Map<string, number>>} token → (ref → weight) */
    this.index = new Map();
    /** @type {Map<string, {collection: string, id: string, title: string, text: string}>} */
    this.docs = new Map();
    this.stale = new Set(COLLECTION_NAMES);
    this.unsubscribe = db.subscribe((collection) => {
      if (collection === '*') this.stale = new Set(COLLECTION_NAMES);
      else this.stale.add(collection);
    });
  }

  dispose() {
    if (this.unsubscribe) this.unsubscribe();
  }

  _rebuild() {
    if (!this.stale.size) return;
    for (const collection of this.stale) {
      const def = COLLECTIONS[collection];
      if (!def || collection === 'audit') continue;

      // Drop the collection's old entries.
      for (const [ref, doc] of [...this.docs]) {
        if (doc.collection === collection) {
          this.docs.delete(ref);
          for (const postings of this.index.values()) postings.delete(ref);
        }
      }
      for (const doc of this.db.all(collection)) {
        const text = searchableText(collection, doc);
        if (!text) continue;
        const ref = `${collection}:${doc.id}`;
        const title = docTitle(collection, doc);
        this.docs.set(ref, { collection, id: doc.id, title, text });
        const titleTokens = new Set(tokenize(title));
        for (const token of tokenize(text)) {
          let postings = this.index.get(token);
          if (!postings) this.index.set(token, (postings = new Map()));
          // A hit in the title counts for more than a hit in the body.
          postings.set(ref, (postings.get(ref) || 0) + (titleTokens.has(token) ? 3 : 1));
        }
      }
    }
    this.stale.clear();
  }

  /**
   * @param {string} query
   * @param {{user?: object|null, limit?: number, collections?: string[]}} [opts]
   * @returns {{collection: string, id: string, title: string, snippet: string, score: number}[]}
   */
  search(query, opts = {}) {
    this._rebuild();
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    const limit = opts.limit || 30;
    const user = opts.user || this.db.actor;

    /** @type {Map<string, number>} */
    const scores = new Map();
    for (const token of tokens) {
      // Exact postings, plus prefix matches so "bapt" finds "baptism".
      for (const [indexed, postings] of this.index) {
        if (indexed !== token && !indexed.startsWith(token)) continue;
        const boost = indexed === token ? 1 : 0.5;
        for (const [ref, weight] of postings) {
          scores.set(ref, (scores.get(ref) || 0) + weight * boost);
        }
      }
    }

    const results = [];
    for (const [ref, score] of scores) {
      const doc = this.docs.get(ref);
      if (!doc) continue;
      if (opts.collections && !opts.collections.includes(doc.collection)) continue;
      const def = COLLECTIONS[doc.collection];
      if (!can(user, `${def.resource}:read`)) continue;
      results.push({
        collection: doc.collection,
        id: doc.id,
        title: doc.title,
        snippet: snippet(doc.text, tokens),
        score: score / Math.log2(2 + tokens.length),
      });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Grouped by collection, for the search overlay. */
  grouped(query, opts = {}) {
    const groups = new Map();
    for (const hit of this.search(query, { ...opts, limit: opts.limit || 40 })) {
      if (!groups.has(hit.collection)) groups.set(hit.collection, []);
      groups.get(hit.collection).push(hit);
    }
    return [...groups].map(([collection, hits]) => ({
      collection,
      label: COLLECTIONS[collection].label,
      hits,
    }));
  }
}

/** A ~140 character window around the first matching token. */
export function snippet(text, tokens, width = 140) {
  const lower = String(text).toLowerCase();
  let at = -1;
  for (const token of tokens) {
    at = lower.indexOf(token);
    if (at >= 0) break;
  }
  if (at < 0) return String(text).slice(0, width);
  const start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  return `${start > 0 ? '…' : ''}${String(text).slice(start, end).trim()}${end < text.length ? '…' : ''}`;
}
