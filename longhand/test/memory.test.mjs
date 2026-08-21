/**
 * The grounding rules, which are the product: an answer with no evidence is
 * worse than no answer, and a citation nobody can follow is not a citation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ask, verifyCitations, meetingsBehind, NOT_FOUND } from '../js/core/memory.js';
import { indexDatabase } from '../js/core/retrieval.js';
import { freshDb, seedMeeting, fakeClient, SUPPLIER_MEETING, GYM_MEETING } from './helpers.mjs';

async function library() {
  const db = await freshDb();
  seedMeeting(db, SUPPLIER_MEETING);
  seedMeeting(db, GYM_MEETING);
  return { db, index: indexDatabase(db) };
}

test('a question the recordings do not cover never reaches the model', async () => {
  const { db, index } = await library();
  const client = fakeClient({ answer: 'Something invented', citations: [], answered: true });

  const result = await ask({ db, index, question: 'What is our parental leave policy?', client });

  assert.equal(result.answer, NOT_FOUND);
  assert.equal(result.answered, false);
  assert.equal(client.calls.length, 0, 'the model is not called at all');
});

test('an answer keeps only the citations that point at a supplied excerpt', async () => {
  const { db, index } = await library();
  const client = fakeClient({
    answer: 'You agreed to keep the current supplier for Q4 and ask for a revised quotation.',
    citations: [
      { ref: 1, quote: 'request a revised quotation' },
      { ref: 99, quote: 'something nobody said' },
    ],
    answered: true,
  });

  const result = await ask({ db, index, question: 'What did we decide about the supplier?', client });

  assert.equal(result.answered, true);
  assert.equal(result.sources.length, 1, 'the out-of-range citation is dropped');
  assert.equal(result.sources[0].meetingTitle, 'Supplier review');
  assert.ok(result.sources[0].segmentIds.length, 'a source carries the segments to jump to');
  assert.equal(result.unsupported, false);
});

test('an answer the model could not support is flagged rather than dressed up', async () => {
  const { db, index } = await library();
  const client = fakeClient({ answer: 'They probably agreed something.', citations: [], answered: true });

  const result = await ask({ db, index, question: 'What about the supplier pricing?', client });

  assert.equal(result.unsupported, true, 'the caller can see it stands on nothing');
});

test('a model that says it cannot answer is taken at its word', async () => {
  const { db, index } = await library();
  const client = fakeClient({ answer: 'The excerpts do not say.', citations: [], answered: false });

  const result = await ask({ db, index, question: 'What did we decide about the supplier?', client });

  assert.equal(result.answer, NOT_FOUND);
  assert.equal(result.answered, false);
});

test('a period that matches nothing is retried across the whole library', async () => {
  const { db, index } = await library();
  const client = fakeClient({
    answer: 'The gym flooring was discussed in July.',
    citations: [{ ref: 1, quote: 'gym flooring project' }],
    answered: true,
  });

  // The gym meeting is from July; "yesterday" excludes everything.
  const result = await ask({
    db, index, client,
    question: 'What did we say about the gym flooring yesterday?',
    now: new Date('2026-08-21T10:00:00Z'),
  });

  assert.equal(result.answered, true, 'the too-narrow period did not sink the question');
  assert.ok(client.calls[0].prompt.includes('gym flooring'), 'the retried evidence reached the model');
  assert.ok(/whole library/.test(client.calls[0].prompt), 'and the model is told the period was relaxed');
});

test('the model is only ever given excerpts, and is told to use nothing else', async () => {
  const { db, index } = await library();
  const client = fakeClient({ answer: 'Yes.', citations: [{ ref: 1, quote: 'pricing' }], answered: true });

  await ask({ db, index, question: 'Was pricing discussed?', client });

  const call = client.calls[0];
  assert.match(call.system, /ONLY the numbered excerpts/);
  assert.match(call.prompt, /Excerpts from the user's recordings/);
});

test('asking one meeting cannot reach into another', async () => {
  const { db, index } = await library();
  const gym = db.all('meetings').find((m) => m.title === 'Facilities planning');
  const client = fakeClient({ answer: 'Eleven thousand.', citations: [{ ref: 1, quote: 'eleven thousand' }], answered: true });

  const result = await ask({ db, index, question: 'What did the flooring quote come to?', client, meetingId: gym.id });

  assert.ok(result.sources.every((source) => source.meetingId === gym.id));
});

test('a question scoped to one meeting falls back to that meeting as its evidence', async () => {
  const { db, index } = await library();
  const gym = db.all('meetings').find((m) => m.title === 'Facilities planning');
  const client = fakeClient({ answer: 'It was about the gym flooring budget.', citations: [{ ref: 1, quote: 'gym flooring project' }], answered: true });

  const result = await ask({ db, index, question: 'Give me the gist of this one', client, meetingId: gym.id });

  assert.equal(result.answered, true, 'pointing at a meeting is itself a pointer to evidence');
  assert.ok(client.calls[0].prompt.includes('gym flooring'));
  assert.match(client.calls[0].prompt, /simply the meeting itself/, 'and the model is told the excerpts did not match');
  assert.ok(result.sources.every((source) => source.meetingId === gym.id));
});

test('the same unmatched question across the library is still refused', async () => {
  const { db, index } = await library();
  const client = fakeClient({ answer: 'Something.', citations: [], answered: true });

  const result = await ask({ db, index, question: 'Give me the gist of this one', client });

  assert.equal(result.answer, NOT_FOUND);
  assert.equal(client.calls.length, 0);
});

test('every question is kept, so the same answer can be found again', async () => {
  const { db, index } = await library();
  const client = fakeClient({ answer: 'Yes.', citations: [{ ref: 1, quote: 'pricing' }], answered: true });

  await ask({ db, index, question: 'Was pricing discussed?', client });

  const saved = db.all('memory');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].question, 'Was pricing discussed?');
  assert.equal(saved[0].sources.length, 1);
});

test('verifyCitations refuses duplicates and non-numbers', () => {
  const hits = [{ chunk: { id: 'c1', meetingId: 'm1', meetingTitle: 'A', meetingDate: '2026-08-01', start: 10, segmentIds: ['s1'] }, snippet: 'x' }];
  const sources = verifyCitations([{ ref: 1, quote: 'one' }, { ref: 1, quote: 'again' }, { ref: 'x', quote: '' }], hits);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].ref, 1);
});

test('meetingsBehind groups sources by meeting, newest first', () => {
  const grouped = meetingsBehind([
    { meetingId: 'a', meetingTitle: 'July', meetingDate: '2026-07-14', ref: 1 },
    { meetingId: 'b', meetingTitle: 'August', meetingDate: '2026-08-18', ref: 2 },
    { meetingId: 'a', meetingTitle: 'July', meetingDate: '2026-07-14', ref: 3 },
  ]);
  assert.deepEqual(grouped.map((m) => m.title), ['August', 'July']);
  assert.deepEqual(grouped[1].refs, [1, 3]);
});
