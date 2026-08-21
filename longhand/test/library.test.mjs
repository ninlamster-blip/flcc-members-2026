/**
 * The list logic behind Meetings, Tasks and Search — the parts of a view
 * that decide what a person sees, lifted out of the DOM so they can be
 * checked directly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { select as selectMeetings } from '../js/views/meetings.js';
import { select as selectTasks } from '../js/views/tasks.js';
import { search } from '../js/views/search.js';
import { indexDatabase } from '../js/core/retrieval.js';
import { Router } from '../js/core/router.js';
import { segmentAt } from '../js/core/audio.js';
import { freshDb, seedMeeting, SUPPLIER_MEETING, GYM_MEETING } from './helpers.mjs';

async function library() {
  const db = await freshDb();
  const supplier = seedMeeting(db, SUPPLIER_MEETING);
  const gym = seedMeeting(db, GYM_MEETING);
  db.update('meetings', gym.meeting.id, { favorite: true });
  return { db, supplier, gym };
}

test('meetings are newest first by default, and every sort is available', async () => {
  const { db } = await library();
  assert.deepEqual(selectMeetings(db).map((m) => m.title), ['Supplier review', 'Facilities planning']);
  assert.deepEqual(selectMeetings(db, { sort: 'oldest' }).map((m) => m.title), ['Facilities planning', 'Supplier review']);
  assert.equal(selectMeetings(db, { sort: 'longest' })[0].title, 'Supplier review');
  assert.equal(selectMeetings(db, { sort: 'title' })[0].title, 'Facilities planning');
});

test('archived meetings are hidden everywhere except the archived filter', async () => {
  const { db, supplier } = await library();
  db.update('meetings', supplier.meeting.id, { archived: true });

  assert.deepEqual(selectMeetings(db).map((m) => m.title), ['Facilities planning']);
  assert.deepEqual(selectMeetings(db, { filter: 'favorite' }).map((m) => m.title), ['Facilities planning']);
  assert.deepEqual(selectMeetings(db, { filter: 'archived' }).map((m) => m.title), ['Supplier review']);
});

test('a folder narrows the list, and everything stays put when it is deleted', async () => {
  const { db, supplier } = await library();
  const folder = db.insert('folders', { name: 'Procurement' });
  db.update('meetings', supplier.meeting.id, { folderId: folder.id });

  assert.deepEqual(selectMeetings(db, { folderId: folder.id }).map((m) => m.title), ['Supplier review']);
  assert.equal(selectMeetings(db).length, 2, 'the unfiltered list is unaffected');

  // What deleteFolder does, without the confirmation dialog around it.
  for (const meeting of db.where('meetings', { folderId: folder.id })) db.update('meetings', meeting.id, { folderId: null });
  db.remove('folders', folder.id);
  assert.equal(selectMeetings(db).length, 2, 'deleting a folder never deletes a meeting');
});

test('the "needs attention" filter finds exactly the meetings that do', async () => {
  const { db, supplier } = await library();
  assert.deepEqual(selectMeetings(db, { filter: 'attention' }), []);
  db.update('meetings', supplier.meeting.id, { status: 'failed', error: 'Transcription failed.' });
  assert.deepEqual(selectMeetings(db, { filter: 'attention' }).map((m) => m.title), ['Supplier review']);
});

test('tasks are open first by due date, and filter by owner', async () => {
  const { db, supplier } = await library();
  db.insert('actions', { meetingId: supplier.meeting.id, task: 'Later thing', ownerName: 'Allen', dueDate: '2026-09-30', segmentIds: ['x'] });
  db.insert('actions', { meetingId: supplier.meeting.id, task: 'Sooner thing', ownerName: 'John', dueDate: '2026-08-24', segmentIds: ['x'] });
  db.insert('actions', { meetingId: supplier.meeting.id, task: 'Finished thing', ownerName: 'John', status: 'done', segmentIds: ['x'] });

  assert.deepEqual(selectTasks(db).map((row) => row.action.task), ['Sooner thing', 'Later thing']);
  assert.deepEqual(selectTasks(db, { filter: 'done' }).map((row) => row.action.task), ['Finished thing']);
  assert.deepEqual(selectTasks(db, { owner: 'John' }).map((row) => row.action.task), ['Sooner thing']);
  assert.deepEqual(selectTasks(db, { filter: 'all', query: 'later' }).map((row) => row.action.task), ['Later thing']);
});

test('a task keeps its meeting even after the meeting is gone', async () => {
  const { db, supplier } = await library();
  db.insert('actions', { meetingId: supplier.meeting.id, task: 'Orphan', segmentIds: ['x'] });
  db.remove('meetings', supplier.meeting.id);
  const [row] = selectTasks(db, { query: 'orphan' });
  assert.equal(row.meeting, null, 'the view is told there is no meeting rather than crashing');
});

test('search reaches transcripts, titles, tasks, decisions and people at once', async () => {
  const { db, supplier } = await library();
  db.insert('actions', { meetingId: supplier.meeting.id, task: 'Chase the quotation', ownerName: 'Allen', segmentIds: ['x'] });
  db.insert('decisions', { meetingId: supplier.meeting.id, text: 'Request a revised quotation', segmentIds: ['x'] });
  db.insert('people', { name: 'Quotation Bob' });

  const app = { db, index: indexDatabase(db) };
  const found = search(app, 'quotation');

  assert.ok(found.transcript.length, 'the words as they were said');
  assert.equal(found.actions.length, 1);
  assert.equal(found.decisions.length, 1);
  assert.equal(found.people.length, 1);
  assert.ok(found.total >= 4);
});

test('a search too short to mean anything returns nothing rather than everything', async () => {
  const { db } = await library();
  const app = { db, index: indexDatabase(db) };
  assert.equal(search(app, 'a').total, 0);
  assert.equal(search(app, '').total, 0);
});

test('routes survive the round trip through the address bar', () => {
  assert.deepEqual(Router.parse('#/meeting/abc?t=42&seg=s1'), { name: 'meeting', params: ['abc'], query: { t: '42', seg: 's1' } });
  assert.deepEqual(Router.parse(''), { name: 'home', params: [], query: {} });
  assert.equal(Router.href('meeting', ['abc'], { t: 42 }), '#/meeting/abc?t=42');
  assert.equal(Router.href('memory', [], { q: 'what did we decide?' }), '#/memory?q=what+did+we+decide%3F');
});

test('the transcript line highlighted during playback is the one being spoken', () => {
  const segments = [
    { id: 'a', start: 0, end: 10 },
    { id: 'b', start: 10, end: 20 },
    { id: 'c', start: 20, end: 30 },
  ];
  assert.equal(segmentAt(segments, 0).id, 'a');
  assert.equal(segmentAt(segments, 15).id, 'b');
  assert.equal(segmentAt(segments, 999).id, 'c', 'past the end, the last thing said stays marked');
  assert.equal(segmentAt([], 5), null);
});
