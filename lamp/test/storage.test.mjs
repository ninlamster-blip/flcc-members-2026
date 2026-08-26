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
