import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/core/storage.js';

test('every key LAMP uses is inside its own namespace', () => {
  for (const [name, key] of Object.entries(store.KEYS)) {
    assert.ok(key.startsWith('lamp/v1/'), `${name} → ${key}`);
  }
});

test('storage refuses keys belonging to the other apps in this repository', () => {
  const foreign = [
    'flcc-attendance-2026',
    'FLCC_members',
    'shepherd/v1/registry',
    'shepherd/v1/t/abundance/members',
    'anything-else',
    '',
  ];
  for (const key of foreign) {
    assert.throws(() => store.guard(key), /must start with/, key);
    assert.throws(() => store.read(key), /must start with/);
    assert.throws(() => store.write(key, 1), /must start with/);
    assert.throws(() => store.remove(key), /must start with/);
  }
});

test('read, write, wipe round-trip inside the namespace', () => {
  store.write(store.KEYS.profile, { name: 'Joshua', birthYear: 2014 });
  assert.deepEqual(store.read(store.KEYS.profile), { name: 'Joshua', birthYear: 2014 });
  assert.equal(store.read('lamp/v1/missing', 'fallback'), 'fallback');

  store.write(store.KEYS.journal, { entries: [{ id: 'j1' }] });
  assert.ok(store.keys().length >= 2);

  const removed = store.wipe();
  assert.ok(removed >= 2);
  assert.equal(store.read(store.KEYS.profile), null);
  assert.equal(store.keys().length, 0);
});

test('the shapes screens read back are the shapes they were written as', async () => {
  // Reflect once counted `prayers.length` on `{ items: [...] }`, so saved
  // prayers never appeared. These are the record shapes each screen expects.
  store.wipe();
  store.write(store.KEYS.prayers, { items: [{ id: 'p1' }] });
  store.write(store.KEYS.journal, { entries: [{ id: 'j1' }] });
  store.write(store.KEYS.memory, { verses: [{ ref: 'JHN.3.16' }] });
  store.write(store.KEYS.challenges, { log: { '2026-08-27': { type: 'live', result: 'done' } } });

  assert.equal(store.read(store.KEYS.prayers).items.length, 1);
  assert.equal(store.read(store.KEYS.journal).entries.length, 1);
  assert.equal(store.read(store.KEYS.memory).verses.length, 1);
  assert.equal(Object.keys(store.read(store.KEYS.challenges).log).length, 1);
  store.wipe();
});
