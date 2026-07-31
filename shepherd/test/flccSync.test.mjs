/**
 * The FLCC attendance sync — the one place import logic actually writes to
 * the database. Matches by name against this tenant's own members, dedupes
 * by date+service so re-running a sync never doubles a session, and never
 * touches anything but the local `attendance` collection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memoryStorage } from '../js/core/storage.js';
import { Database } from '../js/core/db.js';
import { blank } from '../js/core/schema.js';
import { syncFLCCAttendance } from '../js/core/flccSync.js';

const ADMIN = { id: 'u1', name: 'Ruth', role: 'church_admin' };

async function tenantDb() {
  return new Database({ tenantId: 'grace', storage: memoryStorage(), actor: ADMIN }).open();
}

function fakeFetch(flccData) {
  return async () => ({ ok: true, json: async () => flccData });
}

test('syncFLCCAttendance creates one attendance record per session, matching present members by name', async () => {
  const db = await tenantDb();
  db.insert('members', blank('members', { fullName: 'Sample Person', status: 'member' }));
  db.insert('members', blank('members', { fullName: 'Other Person', status: 'member' }));

  const flccData = {
    sessions: [{
      date: '2026-07-05', service: 'Sunday', serviceLabel: 'Sunday Service',
      summary: { present: 2 },
      records: [
        { memberName: 'Sample Person', status: 'present' },
        { memberName: 'Other Person', status: 'present' },
      ],
    }],
  };

  const result = await syncFLCCAttendance(db, fakeFetch(flccData));
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.unmatchedNames, []);

  const records = db.all('attendance');
  assert.equal(records.length, 1);
  assert.equal(records[0].date, '2026-07-05');
  assert.equal(records[0].memberIds.length, 2);
});

test('syncFLCCAttendance never doubles a session already synced', async () => {
  const db = await tenantDb();
  const flccData = { sessions: [{ date: '2026-07-05', service: 'Sunday', records: [] }] };

  const first = await syncFLCCAttendance(db, fakeFetch(flccData));
  assert.equal(first.created, 1);

  const second = await syncFLCCAttendance(db, fakeFetch(flccData));
  assert.equal(second.created, 0);
  assert.equal(second.skipped, 1);
  assert.equal(db.all('attendance').length, 1, 'still only one record for the same date+service');
});

test('syncFLCCAttendance reports a present name it could not match, without failing the whole sync', async () => {
  const db = await tenantDb();
  db.insert('members', blank('members', { fullName: 'Known Person', status: 'member' }));

  const flccData = {
    sessions: [{
      date: '2026-07-05', service: 'Sunday',
      records: [
        { memberName: 'Known Person', status: 'present' },
        { memberName: 'Nobody On Record', status: 'present' },
      ],
    }],
  };

  const result = await syncFLCCAttendance(db, fakeFetch(flccData));
  assert.equal(result.created, 1);
  assert.deepEqual(result.unmatchedNames, ['Nobody On Record']);
  assert.equal(db.all('attendance')[0].memberIds.length, 1);
});

test('syncFLCCAttendance leaves the database untouched when there is nothing to sync', async () => {
  const db = await tenantDb();
  const result = await syncFLCCAttendance(db, fakeFetch({ sessions: [] }));
  assert.equal(result.created, 0);
  assert.equal(db.all('attendance').length, 0);
});
