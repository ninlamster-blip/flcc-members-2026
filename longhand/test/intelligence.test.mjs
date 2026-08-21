/**
 * Meeting analysis. The rule under test throughout: an item that cannot be
 * traced back to a transcript line does not reach the user.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { analyseMeeting, collect, buildWindows, parseDue, speakerMap } from '../js/core/intelligence.js';
import { freshDb, seedMeeting, fakeClient, SUPPLIER_MEETING } from './helpers.mjs';

const FULL_REPLY = {
  summary: 'The team reviewed the supplier proposal and agreed to stay with the current supplier for Q4.',
  keyPoints: [{ text: 'Delivery terms of six weeks are the main concern', lines: [2] }],
  decisions: [
    { text: 'Keep the current supplier for Q4', lines: [5] },
    { text: 'Request a revised quotation', lines: [5, 4] },
  ],
  actions: [
    { task: 'Confirm the delivery schedule', owner: 'John', due: '2026-08-24', context: 'Agreed at the end of the meeting', lines: [6] },
  ],
  questions: [{ text: 'Will the supplier accept better delivery terms?', lines: [4] }],
  topics: [{ name: 'Supplier pricing', lines: [3] }],
  moments: [{ label: 'Decision to stay with the supplier', lines: [5] }],
};

test('analysis writes decisions, actions, questions, topics and moments, each with its lines', async () => {
  const db = await freshDb();
  const { meeting, segments } = seedMeeting(db, { ...SUPPLIER_MEETING, status: 'processing' });
  const client = fakeClient(FULL_REPLY);

  await analyseMeeting({ db, meetingId: meeting.id, client });

  const saved = db.get('meetings', meeting.id);
  assert.equal(saved.status, 'ready');
  assert.match(saved.summary, /current supplier/);
  assert.equal(db.where('decisions', { meetingId: meeting.id }).length, 2);
  assert.equal(db.where('questions', { meetingId: meeting.id }).length, 1);
  assert.equal(db.where('moments', { meetingId: meeting.id }).length, 1);

  const action = db.where('actions', { meetingId: meeting.id })[0];
  assert.equal(action.ownerName, 'John');
  assert.equal(action.dueDate, '2026-08-24');
  assert.deepEqual(action.segmentIds, [segments[5].id], 'the action points at the line it was said on');
  assert.equal(action.status, 'open');
});

test('anything the model returns without a usable line reference is discarded', () => {
  const segments = [{ id: 's1' }, { id: 's2' }];
  const result = collect({
    summary: 'Fine.',
    decisions: [
      { text: 'Grounded', lines: [1] },
      { text: 'Invented', lines: [] },
      { text: 'Out of range', lines: [99] },
      { text: 'Nonsense reference', lines: ['probably somewhere'] },
    ],
    actions: [{ task: 'No lines at all' }],
  }, segments);

  assert.deepEqual(result.decisions.map((d) => d.text), ['Grounded']);
  assert.equal(result.actions.length, 0);
  assert.equal(result.dropped, 4, 'the drops are counted rather than hidden');
});

test('an item with a real line but no text is dropped too', () => {
  const result = collect({ decisions: [{ text: '   ', lines: [1] }] }, [{ id: 's1' }]);
  assert.equal(result.decisions.length, 0);
});

test('only an unambiguous date becomes a deadline', () => {
  assert.equal(parseDue('2026-08-24'), '2026-08-24');
  assert.equal(parseDue('Friday'), null, '"Friday" is not turned into a date the meeting never set');
  assert.equal(parseDue('next week'), null);
  assert.equal(parseDue(''), null);
});

test('the transcript reaches the model numbered, timecoded and attributed', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  const segments = db.where('segments', { meetingId: meeting.id }).sort((a, b) => a.start - b.start);
  const windows = buildWindows(segments, speakerMap(db, meeting.id));

  assert.equal(windows.length, 1);
  assert.match(windows[0].lines, /^\[1\] 00:00 Allen: We need to review/);
  assert.match(windows[0].lines, /\[6\] 01:40 John: I will confirm/);
});

test('a long meeting is analysed in windows and merged, never truncated', async () => {
  const db = await freshDb();
  const lines = Array.from({ length: 400 }, (_, i) => ['Allen', `Point number ${i} about the quarterly budget and the supplier relationship, at some length.`]);
  const { meeting } = seedMeeting(db, { title: 'Long one', startedAt: '2026-08-20T09:00:00Z', lines });

  const segments = db.where('segments', { meetingId: meeting.id }).sort((a, b) => a.start - b.start);
  assert.ok(buildWindows(segments, new Map()).length > 1, 'the transcript needs more than one window');

  const client = fakeClient((request, call) => {
    if (/Write the meeting's summary/.test(request.prompt)) return 'One merged summary.';
    return { summary: `Part ${call}`, decisions: [{ text: `Decision ${call}`, lines: [1] }], topics: [{ name: 'Budget', lines: [1] }] };
  });

  await analyseMeeting({ db, meetingId: meeting.id, client });

  const saved = db.get('meetings', meeting.id);
  assert.equal(saved.summary, 'One merged summary.');
  assert.ok(db.where('decisions', { meetingId: meeting.id }).length >= 2, 'every window contributed');
  assert.equal(db.where('topics', { meetingId: meeting.id }).length, 1, 'the same topic from two windows is one topic');
});

test('re-analysing replaces the previous findings instead of stacking them', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  const client = fakeClient(FULL_REPLY);

  await analyseMeeting({ db, meetingId: meeting.id, client });
  await analyseMeeting({ db, meetingId: meeting.id, client });

  assert.equal(db.where('decisions', { meetingId: meeting.id }).length, 2);
});

test('an action owner who is a known person is linked to them', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  const john = db.insert('people', { name: 'John Reyes' });
  const speaker = db.where('speakers', { meetingId: meeting.id }).find((s) => s.label === 'John');
  db.update('speakers', speaker.id, { personId: john.id });

  await analyseMeeting({ db, meetingId: meeting.id, client: fakeClient(FULL_REPLY) });

  const action = db.where('actions', { meetingId: meeting.id })[0];
  assert.equal(action.personId, john.id);
  assert.ok(db.get('meetings', meeting.id).participantIds.includes(john.id));
});

test('analysis refuses to run on a meeting with no transcript', async () => {
  const db = await freshDb();
  const meeting = db.insert('meetings', { title: 'Silent', startedAt: '2026-08-20T09:00:00Z' });
  await assert.rejects(
    () => analyseMeeting({ db, meetingId: meeting.id, client: fakeClient(FULL_REPLY) }),
    /no transcript/i);
});
