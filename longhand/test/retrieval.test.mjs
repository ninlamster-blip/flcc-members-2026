/**
 * Retrieval is the half of "AI Memory" that has to be right before the model
 * is even called: bad evidence produces a confident wrong answer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tokenize, chunkMeeting, Index, understand, snippet, indexDatabase } from '../js/core/retrieval.js';
import { freshDb, seedMeeting, SUPPLIER_MEETING, GYM_MEETING } from './helpers.mjs';

test('tokenize drops stopwords and folds plurals into their singular', () => {
  const terms = tokenize('We reviewed the supplier proposals and the deliveries');
  assert.ok(!terms.includes('the'), 'stopwords are dropped');
  assert.ok(terms.includes('supplier'), 'content words survive');
  assert.equal(tokenize('proposals')[0], tokenize('proposal')[0], 'plural and singular index the same term');
});

test('a chunk keeps the segment ids it covers, so a hit can become a citation', async () => {
  const db = await freshDb();
  const { meeting, segments } = seedMeeting(db, SUPPLIER_MEETING);
  const names = new Map(db.where('speakers', { meetingId: meeting.id }).map((s) => [s.id, s.label]));
  const chunks = chunkMeeting(meeting, segments, names);

  assert.ok(chunks.length >= 1);
  const covered = chunks.flatMap((chunk) => chunk.segmentIds);
  assert.deepEqual(new Set(covered).size, segments.length, 'every segment lands in exactly one chunk');
  assert.ok(chunks[0].text.startsWith('Allen:'), 'the speaker is part of the retrievable text');
  assert.ok(chunks[0].speakers.includes('Allen'));
});

test('a long gap in the recording starts a new chunk', async () => {
  const db = await freshDb();
  const meeting = db.insert('meetings', { title: 'Two halves', startedAt: '2026-08-01T09:00:00Z' });
  const speaker = db.insert('speakers', { meetingId: meeting.id, label: 'Allen' });
  const segments = db.insertMany('segments', [
    { meetingId: meeting.id, speakerId: speaker.id, start: 0, end: 10, text: 'First thought.' },
    { meetingId: meeting.id, speakerId: speaker.id, start: 400, end: 410, text: 'Much later thought.' },
  ]);
  const chunks = chunkMeeting(meeting, segments, new Map([[speaker.id, 'Allen']]));
  assert.equal(chunks.length, 2, 'six minutes of silence is a boundary');
});

test('search ranks the passage that actually discusses the question', async () => {
  const db = await freshDb();
  seedMeeting(db, SUPPLIER_MEETING);
  seedMeeting(db, GYM_MEETING);
  const index = indexDatabase(db);

  const hits = index.search('What did we decide about the supplier quotation?');
  assert.ok(hits.length, 'something is found');
  assert.equal(hits[0].chunk.meetingTitle, 'Supplier review');
  assert.ok(/revised quotation/i.test(hits[0].chunk.text));

  const gym = index.search('gym flooring budget');
  assert.equal(gym[0].chunk.meetingTitle, 'Facilities planning');
});

test('the question people actually ask finds the moment it is about', async () => {
  const db = await freshDb();
  seedMeeting(db, SUPPLIER_MEETING);
  const index = indexDatabase(db);

  // Nobody in the transcript says "decide". They say "let us keep… and request".
  const hits = index.search('What did we decide about the supplier?');
  assert.ok(hits.length, 'a meeting-language question is not a dead end');
  assert.match(hits[0].chunk.text, /keep the current supplier/);
});

test('an expanded match never outranks a passage that uses the words themselves', async () => {
  const db = await freshDb();
  seedMeeting(db, {
    title: 'Two candidates',
    startedAt: '2026-08-19T09:00:00Z',
    lines: [
      ['Allen', 'We agreed to keep the current arrangement for now.'],
      ['John', 'The decision on pricing is what we still have to make.'],
    ],
  });
  const index = indexDatabase(db);
  const hits = index.search('what is the decision');
  assert.match(hits[0].chunk.text, /The decision on pricing/, 'the literal word wins');
});

test('search returns nothing rather than a weak guess when the words are not there', async () => {
  const db = await freshDb();
  seedMeeting(db, SUPPLIER_MEETING);
  assert.deepEqual(indexDatabase(db).search('parental leave policy'), []);
});

test('naming a speaker promotes the passages where that speaker is talking', async () => {
  const db = await freshDb();
  seedMeeting(db, SUPPLIER_MEETING);
  const meeting = db.all('meetings')[0];
  const names = new Map(db.where('speakers', { meetingId: meeting.id }).map((s) => [s.id, s.label]));
  const chunks = chunkMeeting(meeting, db.where('segments', { meetingId: meeting.id }), names);
  const index = new Index(chunks);

  const withSpeaker = index.search('delivery schedule', { speaker: 'John', limit: 3 });
  assert.ok(withSpeaker[0].chunk.speakers.includes('John'), 'a chunk John speaks in comes first');
});

test('a date range excludes meetings outside it', async () => {
  const db = await freshDb();
  seedMeeting(db, SUPPLIER_MEETING);
  seedMeeting(db, GYM_MEETING);
  const index = indexDatabase(db);
  const august = index.search('pricing', { from: '2026-08-01T00:00:00.000Z' });
  assert.ok(august.every((hit) => hit.chunk.meetingDate >= '2026-08-01'), 'July is filtered out');
});

test('understand reads the period and the person out of the question', () => {
  const now = new Date('2026-08-21T10:00:00Z');
  const people = ['John Reyes', 'Sarah Bell'];

  assert.equal(understand('what did we agree last week?', { now, people }).period, 'the last week');
  assert.equal(understand('what commitments did I make this month?', { now, people }).period, 'the last month');

  const july = understand('which suppliers were discussed in July?', { now, people });
  assert.equal(july.from.slice(0, 7), '2026-07');
  assert.equal(july.to.slice(0, 7), '2026-08');

  assert.equal(understand('what did John say about delivery?', { now, people }).speaker, 'John Reyes');
  assert.equal(understand('what did Miriam say?', { now, people: [] }).speaker, 'Miriam',
    'a name the app has never seen is still a name');
  assert.equal(understand('what was decided?', { now, people }).speaker, null);
});

test('a snippet is taken from where the query words are densest', () => {
  const text = `${'unrelated filler. '.repeat(20)}the revised quotation should be submitted by Friday. ${'more filler. '.repeat(20)}`;
  const cut = snippet(text, tokenize('revised quotation submitted'));
  assert.ok(/revised quotation/.test(cut), cut);
});

test('archived meetings are left out of the index', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  db.update('meetings', meeting.id, { archived: true });
  assert.equal(indexDatabase(db).size, 0);
});
