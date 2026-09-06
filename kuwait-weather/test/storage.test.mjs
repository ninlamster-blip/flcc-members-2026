import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/core/storage.js';

test('every key this app uses is inside its own namespace', () => {
  for (const [name, key] of Object.entries(store.KEYS)) {
    assert.ok(key.startsWith(store.NS), `${name} → ${key}`);
  }
  assert.equal(store.NS, 'kw/v1/');
});

test('storage refuses every key that is not this app\'s', () => {
  const notOurs = [
    'flcc-attendance-2026', 'shepherd/v1/registry', 'lamp/v1/profile',
    'next/v1/user', 'adults/v1/user', 'theme', '', 'kw/v2/place', 'kwv1/place',
  ];
  for (const key of notOurs) {
    assert.throws(() => store.guard(key), /must start with/, key);
    assert.throws(() => store.read(key), /must start with/);
    assert.throws(() => store.write(key, 1), /must start with/);
    assert.throws(() => store.remove(key), /must start with/);
  }
  assert.throws(() => store.guard(null), /must start with/);
  assert.throws(() => store.guard(undefined), /must start with/);
});

test('read, write, remove and wipe round-trip', () => {
  store.wipe();
  store.write(store.KEYS.place, { id: 'jahra', name: 'Al Jahra' });
  assert.deepEqual(store.read(store.KEYS.place), { id: 'jahra', name: 'Al Jahra' });

  assert.equal(store.read(`${store.NS}nothing-here`), null);
  assert.equal(store.read(`${store.NS}nothing-here`, 'fallback'), 'fallback');

  store.remove(store.KEYS.place);
  assert.equal(store.read(store.KEYS.place), null);

  store.write(store.KEYS.units, 'F');
  store.write(store.KEYS.work, 'heavy');
  assert.equal(store.wipe(), 2);
  assert.deepEqual(store.keys(), []);
});

test('unreadable stored values fall back rather than throwing', () => {
  store.wipe();
  store.write(store.KEYS.units, 'C');
  assert.equal(store.read(store.KEYS.units, 'C'), 'C');
});
