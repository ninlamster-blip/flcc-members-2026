import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/core/storage.js';

test('every key this app uses is inside its own namespace', () => {
  for (const [name, key] of Object.entries(store.KEYS)) {
    assert.ok(key.startsWith('adults/v1/'), `${name} → ${key}`);
  }
});

test('storage refuses every other app in this repository', () => {
  for (const key of ['flcc-attendance-2026', 'shepherd/v1/registry', 'lamp/v1/profile', 'next/v1/user', 'anything', '']) {
    assert.throws(() => store.guard(key), /must start with/, key);
    assert.throws(() => store.read(key), /must start with/);
    assert.throws(() => store.write(key, 1), /must start with/);
  }
});

test('read, write and wipe round-trip', () => {
  store.wipe();
  store.write(store.KEYS.user, { name: 'Allen', season: 'growing' });
  assert.deepEqual(store.read(store.KEYS.user), { name: 'Allen', season: 'growing' });
  assert.equal(store.read('adults/v1/missing', 'fallback'), 'fallback');
  assert.ok(store.wipe() >= 1);
  assert.equal(store.read(store.KEYS.user), null);
});

/**
 * The keys added for Ask, notes and the games are in the namespace like
 * everything else. Adding a key is the easiest way to open a hole in a
 * boundary that is otherwise enforced mechanically.
 */
test('every key the app knows about is namespaced', () => {
  for (const [name, key] of Object.entries(store.KEYS)) {
    assert.ok(key.startsWith('adults/v1/'), `KEYS.${name} is "${key}", outside the namespace`);
  }
  for (const needed of ['ask', 'notes', 'play']) {
    assert.ok(store.KEYS[needed], `KEYS.${needed} is missing`);
  }
});
