/**
 * What leaves the app as a file. Exports are read by other software, so the
 * escaping matters as much as the content.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { transcriptText, meetingMarkdown, actionsCsv, fileStem } from '../js/core/exporters.js';
import { clock, duration, dueLabel, dayLabel, initials } from '../js/core/format.js';
import { freshDb, seedMeeting, SUPPLIER_MEETING } from './helpers.mjs';
import { speakerMap } from '../js/core/intelligence.js';

async function bundle() {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  db.update('meetings', meeting.id, {
    summary: 'The team reviewed the supplier proposal.',
    keyPoints: [{ text: 'Delivery is the concern', segmentIds: ['x'] }],
  });
  const decision = db.insert('decisions', { meetingId: meeting.id, text: 'Keep the current supplier for Q4', segmentIds: ['x'] });
  const action = db.insert('actions', { meetingId: meeting.id, task: 'Confirm the delivery schedule', ownerName: 'John', dueDate: '2026-08-24', segmentIds: ['x'] });
  return {
    db,
    meeting: db.get('meetings', meeting.id),
    segments: db.where('segments', { meetingId: meeting.id }).sort((a, b) => a.start - b.start),
    speakerNames: speakerMap(db, meeting.id),
    decisions: [decision],
    actions: [action],
    questions: [],
    topics: [],
  };
}

test('a plain-text transcript is timecoded and attributed', async () => {
  const text = transcriptText(await bundle());
  assert.match(text, /^Supplier review/);
  assert.match(text, /00:00 {2}Allen/);
  assert.match(text, /01:40 {2}John/);
});

test('meeting notes leave the transcript out; the full export keeps it', async () => {
  const data = await bundle();
  const notes = meetingMarkdown({ ...data, include: { transcript: false } });
  assert.match(notes, /## Decisions/);
  assert.match(notes, /- \[ \] \*\*John\*\* — Confirm the delivery schedule \(due 2026-08-24\)/);
  assert.ok(!/## Transcript/.test(notes));

  const full = meetingMarkdown(data);
  assert.match(full, /## Transcript/);
  assert.match(full, /\*\*00:00 Allen\*\*/);
});

test('a completed action exports as ticked', async () => {
  const data = await bundle();
  data.actions[0].status = 'done';
  assert.match(meetingMarkdown(data), /- \[x\]/);
});

test('CSV quotes what needs quoting and defuses a formula', async () => {
  const data = await bundle();
  const csv = actionsCsv([
    { action: { ...data.actions[0], task: 'Call the supplier, then email', context: 'He said "no"' }, meeting: data.meeting },
    { action: { ...data.actions[0], task: '=cmd|calc', status: 'open' }, meeting: data.meeting },
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'Task,Owner,Due,Status,Meeting,Date,Context');
  assert.match(lines[1], /"Call the supplier, then email"/);
  assert.match(lines[1], /"He said ""no"""/);
  assert.match(lines[2], /^'=cmd\|calc/, 'a leading = would otherwise run as a spreadsheet formula');
});

test('a file name says which meeting it came from', async () => {
  const data = await bundle();
  assert.equal(fileStem(data.meeting), '2026-08-18-supplier-review');
});

test('clocks, durations and deadlines read the way people say them', () => {
  assert.equal(clock(0), '00:00');
  assert.equal(clock(95), '01:35');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(duration(42), '42 sec');
  assert.equal(duration(2520), '42 min');
  assert.equal(duration(4380), '1 h 13 min');

  const now = new Date('2026-08-21T10:00:00');
  assert.equal(dueLabel('2026-08-21', now), 'Due today');
  assert.equal(dueLabel('2026-08-22', now), 'Due tomorrow');
  assert.equal(dueLabel('2026-08-20', now), 'Overdue');
  assert.equal(dayLabel('2026-08-21T09:00:00', now), 'Today');
  assert.equal(dayLabel('2026-08-20T09:00:00', now), 'Yesterday');
  assert.equal(initials('Sarah Bell'), 'SB');
  assert.equal(initials('Allen'), 'A');
});
