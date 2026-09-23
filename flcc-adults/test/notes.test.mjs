// Sermon notes.
//
// Small feature, small suite — but two of these matter more than they look.
// A note has to survive being left mid-sentence (somebody locks their phone
// when the service ends), and a note nobody typed anything into has to
// disappear rather than accumulate as a list of "Untitled" to tidy up.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/core/storage.js';
import * as notes from '../js/core/notes.js';

const reset = () => store.wipe();

test('a new note is empty, and an empty note is not a note', () => {
  reset();
  const one = notes.create();
  assert.ok(one.id);
  assert.equal(notes.isEmpty(one), true);
  assert.equal(notes.isEmpty(notes.update(one.id, { body: 'He said something about verse 4.' })), false);
  // A title alone, or a passage alone, is enough to be worth keeping.
  assert.equal(notes.isEmpty({ title: 'Sunday', body: '', ref: '' }), false);
  assert.equal(notes.isEmpty({ title: '  ', body: '  ', ref: '' }), true);
});

test('a note is written to, read back, and kept', () => {
  reset();
  const one = notes.create({ title: 'The prodigal', speaker: 'Pastor Fred', ref: 'Luke 15:11-32' });
  notes.update(one.id, { body: 'The father runs. Nobody in that culture ran.' });
  const back = notes.get(one.id);
  assert.equal(back.title, 'The prodigal');
  assert.equal(back.speaker, 'Pastor Fred');
  assert.equal(back.ref, 'Luke 15:11-32');
  assert.match(back.body, /The father runs/);
});

test('updating touches the timestamp but never the id or the creation time', () => {
  reset();
  const one = notes.create({ title: 'First' });
  const after = notes.update(one.id, { title: 'Second' });
  assert.equal(after.id, one.id);
  assert.equal(after.createdAt, one.createdAt);
  assert.ok(after.updatedAt >= one.createdAt);
});

test('the newest note is the first one you see', () => {
  reset();
  const first = notes.create({ title: 'Older' });
  const second = notes.create({ title: 'Newer' });
  notes.update(first.id, { body: 'a' });
  notes.update(second.id, { body: 'b' });
  // `second` was written to last, so it sorts first.
  assert.equal(notes.list()[0].id, second.id);
});

test('tidying removes the blanks and nothing else', () => {
  reset();
  const kept = notes.create({ title: 'Kept', body: 'something' });
  notes.create();
  notes.create();
  assert.equal(notes.list().length, 3);
  notes.tidy();
  assert.equal(notes.list().length, 1);
  assert.equal(notes.list()[0].id, kept.id);
});

test('deleting one leaves the others alone', () => {
  reset();
  const a = notes.create({ title: 'A' });
  const b = notes.create({ title: 'B' });
  notes.remove(a.id);
  assert.equal(notes.get(a.id), null);
  assert.equal(notes.get(b.id).title, 'B');
});

test('a note started from a message remembers which one', () => {
  reset();
  const one = notes.create({ title: 'Rock', messageId: 'rock-04' });
  assert.equal(notes.list().find((n) => n.messageId === 'rock-04').id, one.id,
    'the message screen finds an existing note by its messageId');
});

test('a missing note is null rather than a crash', () => {
  reset();
  assert.equal(notes.get('nope'), null);
  assert.equal(notes.update('nope', { title: 'x' }), null);
  notes.remove('nope');
});

/** Notes are the most private thing in the app after a prayer. */
test('notes live in this app’s own namespace and nowhere else', () => {
  reset();
  notes.create({ title: 'Private' });
  const keys = store.keys();
  assert.ok(keys.includes(store.KEYS.notes));
  for (const key of keys) assert.ok(key.startsWith('adults/v1/'), `${key} escaped the namespace`);
});

test('a note has the shape of a message: three points, however it was stored', () => {
  reset();
  const one = notes.create({ title: 'Faith' });
  assert.deepEqual(one.points, ['', '', '']);
  assert.deepEqual(notes.pointsOf({ points: ['a'] }), ['a', '', '']);
  assert.deepEqual(notes.pointsOf({ points: ['a', 'b', 'c', 'd'] }), ['a', 'b', 'c']);
  // A note written before the sections existed has only a body.
  assert.deepEqual(notes.pointsOf({ body: 'old' }), ['', '', '']);
  // Any one section is enough to be worth keeping.
  assert.equal(notes.isEmpty({ title: '', body: '', ref: '', points: ['', 'Faith is a verb', ''] }), false);
  assert.equal(notes.isEmpty({ title: '', body: '', ref: '', about: 'Hebrews 11' }), false);
  assert.equal(notes.isEmpty({ title: '', body: '', ref: '', question: 'What am I waiting to see?' }), false);
  assert.equal(notes.isEmpty({ title: ' ', body: '', ref: '', about: ' ', question: '', points: [' ', '', ''] }), true);
});

test('a shared note reads like the message it was taken on', () => {
  const one = { title: 'Faith', speaker: 'Ptr. Justin Flores', ref: 'Hebrews 11:1',
    about: 'What faith is, and what it is not.',
    points: ['Faith is being sure of what we hope for.', 'Faith acts before it sees.', 'Faith is kept, not felt.'],
    question: 'Where am I waiting to see before I obey?',
    body: 'This is about my contract.\n\nCall home on Saturday.' };
  const text = notes.asText(one, { date: new Date('2026-09-25T16:30:00') });
  const blocks = text.trim().split('\n\n');
  const head = blocks[0].split('\n');
  assert.equal(head[0], 'Faith');
  assert.equal(head[1], 'Ptr. Justin Flores · Hebrews 11:1');
  assert.match(head[2], /2026/);
  assert.equal(blocks[1], 'WHAT IT WAS ABOUT\nWhat faith is, and what it is not.');
  assert.equal(blocks[2], 'WHAT IT SAID\n1. Faith is being sure of what we hope for.\n2. Faith acts before it sees.\n3. Faith is kept, not felt.');
  assert.equal(blocks[3], 'SIT WITH THIS\nWhere am I waiting to see before I obey?');
  assert.ok(text.includes('YOUR OWN WORDS\nThis is about my contract.\n\nCall home on Saturday.'));

  // A section left blank is left out, not printed as an empty heading, and a
  // point keeps its own number even when the one before it is blank.
  const sparse = notes.asText({ title: '', points: ['', 'Only the second'], body: 'Just this.' });
  assert.equal(sparse, 'Sermon notes\n\nWHAT IT SAID\n2. Only the second\n\nYOUR OWN WORDS\nJust this.\n');
  // A note from before the sections existed still shares its body.
  assert.equal(notes.asText({ body: 'Just this.' }), 'Sermon notes\n\nYOUR OWN WORDS\nJust this.\n');

  assert.equal(notes.fileName(one), 'faith.txt');
  assert.equal(notes.fileName({ title: '  ' }), 'sermon-notes.txt');
  assert.equal(notes.fileName({ title: 'Faith: Hebrews 11 / week 2!' }), 'faith-hebrews-11-week-2.txt');
});
