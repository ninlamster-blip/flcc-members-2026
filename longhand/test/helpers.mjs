/** Shared fixtures: a database with two meetings that were really about
 *  something, so retrieval tests can be about retrieval. */

import { Database } from '../js/core/db.js';
import { memoryStorage, memoryBlobs } from '../js/core/store.js';

export async function freshDb() {
  return new Database({ storage: memoryStorage(), blobs: memoryBlobs() }).open();
}

/**
 * @param {Database} db
 * @param {{title: string, startedAt: string, lines: Array<[string, string]>}} spec
 *        lines are [speakerLabel, text], one line every 20 seconds.
 */
export function seedMeeting(db, { title, startedAt, lines, status = 'ready' }) {
  const meeting = db.insert('meetings', { title, startedAt, status, durationSec: lines.length * 20 });
  const speakers = new Map();
  const rows = lines.map(([label, text], i) => {
    if (!speakers.has(label)) {
      speakers.set(label, db.insert('speakers', { meetingId: meeting.id, label, order: speakers.size }).id);
    }
    return {
      meetingId: meeting.id,
      speakerId: speakers.get(label),
      start: i * 20,
      end: i * 20 + 18,
      text,
    };
  });
  const segments = db.insertMany('segments', rows);
  return { meeting, segments, speakers };
}

/** A model client that returns whatever the test tells it to, and records
 *  what it was asked. */
export function fakeClient(reply, { available = true } = {}) {
  const calls = [];
  return {
    available,
    model: 'test-model',
    calls,
    async complete(request) {
      calls.push(request);
      const value = typeof reply === 'function' ? reply(request, calls.length) : reply;
      if (value instanceof Error) throw value;
      return typeof value === 'string' ? value : JSON.stringify(value);
    },
    async completeJson(request) {
      calls.push(request);
      const value = typeof reply === 'function' ? reply(request, calls.length) : reply;
      if (value instanceof Error) throw value;
      return typeof value === 'string' ? JSON.parse(value) : value;
    },
  };
}

export const SUPPLIER_MEETING = {
  title: 'Supplier review',
  startedAt: '2026-08-18T09:00:00.000Z',
  lines: [
    ['Allen', 'We need to review the supplier proposal before approving the contract.'],
    ['John', 'I agree. The delivery terms are the main concern — six weeks is too long.'],
    ['Allen', 'Their pricing went up four percent this quarter, which is hard to justify.'],
    ['Sarah', 'Should we ask for a revised quotation with better delivery terms?'],
    ['Allen', 'Yes. Let us keep the current supplier for Q4 and request a revised quotation.'],
    ['John', 'I will confirm the delivery schedule with them on Monday.'],
  ],
};

export const GYM_MEETING = {
  title: 'Facilities planning',
  startedAt: '2026-07-14T09:00:00.000Z',
  lines: [
    ['Allen', 'The gym flooring project needs a budget before the end of the year.'],
    ['Sarah', 'The quote for the rubber flooring came in at eleven thousand.'],
    ['Allen', 'We agreed to maintain the current pricing with them for six months.'],
  ],
};
