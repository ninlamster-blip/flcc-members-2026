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
