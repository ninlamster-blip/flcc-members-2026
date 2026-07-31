/**
 * Orchestrates a FLCC attendance sync — the one place that actually calls
 * `db.insert`, unlike the pure parsers in `importers.js` (which never touch
 * the database themselves; the CSV import screens do that, with a preview
 * step in between). This has no preview step by design: a sync is meant to
 * be a single click (or an automatic background check), not a form to fill
 * in, so the insert logic lives here instead of in a settings.js handler.
 *
 * See `importers.js`'s "FLCC attendance sync" section for what is and is not
 * shared between the two apps — this only ever reads attendance.json and
 * only ever writes to this tenant's own `attendance` collection.
 */

import { fetchFLCCAttendance, matchMemberByName } from './importers.js';
import { blank } from './schema.js';

/**
 * @param {import('./db.js').Database} db
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{created: number, skipped: number, unmatchedNames: string[]}>}
 */
export async function syncFLCCAttendance(db, fetchImpl = fetch) {
  const sessions = await fetchFLCCAttendance(fetchImpl);
  const members = db.all('members');
  const existingKeys = new Set(db.all('attendance').map((a) => `${a.date}|${a.service}`));
  const unmatched = new Set();
  let created = 0;
  let skipped = 0;

  for (const session of sessions) {
    const key = `${session.date}|${session.service}`;
    if (existingKeys.has(key)) { skipped += 1; continue; }

    const memberIds = [];
    for (const name of session.presentNames) {
      const match = matchMemberByName(members, name);
      if (match) memberIds.push(match.id); else unmatched.add(name);
    }

    db.insert('attendance', blank('attendance', {
      date: session.date,
      service: session.service,
      memberIds,
      total: session.total,
      notes: "Synced from the FLCC Members app's attendance.json.",
    }));
    existingKeys.add(key);
    created += 1;
  }

  if (created) await db.flush();
  return { created, skipped, unmatchedNames: [...unmatched] };
}
