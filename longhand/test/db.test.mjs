/**
 * The store, and the promises it makes about deletion — the ones that matter
 * most in an app holding recordings of people.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Database } from '../js/core/db.js';
import { memoryStorage, memoryBlobs, namespaced } from '../js/core/store.js';
import { blank, validate } from '../js/core/schema.js';
import { freshDb, seedMeeting, SUPPLIER_MEETING } from './helpers.mjs';

test('a write that breaks the model is refused, not stored', async () => {
  const db = await freshDb();
  assert.throws(() => db.insert('meetings', { title: '' }), /needs a title/);
  assert.throws(() => db.insert('segments', { meetingId: '', start: 0, end: 1, text: 'x' }), /belong to a meeting/);
  assert.throws(() => db.insert('decisions', { meetingId: 'm', text: 'x', segmentIds: null }), /reference their transcript/);
  assert.equal(db.count('meetings'), 0);
});

test('records survive a reload, because that is the whole point of the store', async () => {
  const storage = memoryStorage();
  const first = await new Database({ storage, blobs: memoryBlobs() }).open();
  seedMeeting(first, SUPPLIER_MEETING);
  await first.flush();

  const second = await new Database({ storage, blobs: memoryBlobs() }).open();
  assert.equal(second.count('meetings'), 1);
  assert.equal(second.count('segments'), 6);
});

test('deleting a meeting takes the audio, the transcript and everything drawn from it', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  await db.blobs.put('aud1', new Blob(['audio']));
  db.update('meetings', meeting.id, { audioId: 'aud1' });
  db.insert('decisions', { meetingId: meeting.id, text: 'Keep the supplier', segmentIds: ['x'] });
  db.insert('actions', { meetingId: meeting.id, task: 'Call them', segmentIds: ['x'] });
  db.insert('notes', { meetingId: meeting.id, text: 'a note' });

  await db.deleteMeeting(meeting.id);

  assert.equal(db.count('meetings'), 0);
  assert.equal(db.count('segments'), 0);
  assert.equal(db.count('decisions'), 0);
  assert.equal(db.count('actions'), 0);
  assert.equal(db.count('notes'), 0);
  assert.equal(await db.blobs.get('aud1'), null, 'the recording is gone from storage, not just hidden');
});

test('deleting only the audio keeps the transcript and what was found in it', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  await db.blobs.put('aud1', new Blob(['audio']));
  db.update('meetings', meeting.id, { audioId: 'aud1', audioBytes: 5 });

  await db.deleteAudio(meeting.id);

  assert.equal(await db.blobs.get('aud1'), null);
  assert.equal(db.get('meetings', meeting.id).audioId, null);
  assert.equal(db.count('segments'), 6, 'the transcript is untouched');
});

test('clearDerived resets the findings without throwing away the transcript', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  db.insert('decisions', { meetingId: meeting.id, text: 'x', segmentIds: ['s'] });

  db.clearDerived(meeting.id);

  assert.equal(db.count('decisions'), 0);
  assert.equal(db.count('segments'), 6);
});

test('an export carries the data but never the shared secret', async () => {
  const db = await freshDb();
  seedMeeting(db, SUPPLIER_MEETING);
  db.setSetting('proxySecret', 'hunter2');
  db.setSetting('model', 'claude-sonnet-5');

  const snapshot = await db.exportAll();

  assert.equal(snapshot.app, 'longhand');
  assert.equal(snapshot.data.meetings.length, 1);
  assert.equal(snapshot.settings.model, 'claude-sonnet-5');
  assert.ok(!('proxySecret' in snapshot.settings), 'a credential never travels in an export file');
});

test('importing replaces what is there, and refuses a file from somewhere else', async () => {
  const db = await freshDb();
  seedMeeting(db, SUPPLIER_MEETING);
  const snapshot = await db.exportAll();

  const fresh = await freshDb();
  await fresh.importAll(snapshot);
  assert.equal(fresh.count('meetings'), 1);

  await assert.rejects(() => fresh.importAll({ app: 'something-else' }), /not a Longhand export/);
});

test('deleting everything leaves no record and no recording behind', async () => {
  const storage = memoryStorage();
  const db = await new Database({ storage, blobs: memoryBlobs() }).open();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  await db.blobs.put('aud1', new Blob(['audio']));
  db.update('meetings', meeting.id, { audioId: 'aud1' });
  await db.flush();

  await db.deleteEverything();

  assert.equal(db.count('meetings'), 0);
  assert.equal((await db.blobs.usage()).count, 0);
  assert.equal(await storage.get('col/meetings'), null, 'and nothing is left in storage either');
});

test('a namespaced adapter cannot be talked out of its prefix', async () => {
  const base = memoryStorage();
  const scoped = namespaced(base, 'longhand/v1/');
  await scoped.set('col/meetings', '[]');
  assert.equal(await base.get('longhand/v1/col/meetings'), '[]');
  await assert.rejects(async () => scoped.set('../../elsewhere', 'x'), /Invalid key/);
});

test('blank fills the defaults a collection promises', () => {
  const action = blank('actions', { task: 'Do the thing' });
  assert.equal(action.status, 'open');
  assert.deepEqual(action.segmentIds, []);
  assert.deepEqual(validate('actions', action), []);
});
