import test from 'node:test';
import assert from 'node:assert/strict';
import { modeForAge, forMode, mode, MODE, MODES } from '../js/core/profile.js';

test('the two age groups split at 12 and 13', () => {
  for (let age = 7; age <= 12; age++) assert.equal(modeForAge(age), 'kids', String(age));
  for (let age = 13; age <= 18; age++) assert.equal(modeForAge(age), 'teens', String(age));
});

test('ages outside the range still get a usable experience', () => {
  assert.ok(MODES.includes(modeForAge(4)));
  assert.ok(MODES.includes(modeForAge(25)));
  assert.ok(MODES.includes(modeForAge('nonsense')));
});

test('both groups are described for the people setting the app up', () => {
  for (const key of MODES) {
    assert.ok(MODE[key].label && MODE[key].range && MODE[key].minutes, key);
  }
});

test('content falls back rather than blanking', () => {
  assert.equal(forMode({ kids: 'a', teens: 'b' }, 'kids'), 'a');
  assert.equal(forMode({ kids: 'a', teens: 'b' }, 'teens'), 'b');
  assert.equal(forMode({ teens: 'b' }, 'kids'), 'b', 'a missing variant falls back');
  assert.equal(forMode('plain', 'kids'), 'plain');
  assert.equal(forMode(null, 'kids'), null);
});

test('a record without the derived age group still lands a child in kids mode', () => {
  // ageGroup is written by saveUser, but a record can arrive without it: an
  // older version, a partial restore, a hand-edited profile. Falling straight
  // through to "teens" would give a nine-year-old the teen content silently.
  assert.equal(mode({ name: 'Sam', age: 9 }), 'kids');
  assert.equal(mode({ name: 'Sam', age: 16 }), 'teens');
  assert.equal(mode({ name: 'Sam', age: '10' }), 'kids');
  assert.equal(mode({ name: 'Sam', ageGroup: 'kids', age: 16 }), 'kids', 'a stored group still wins');
  assert.equal(mode({ name: 'Sam' }), 'teens', 'with nothing to go on, the safer register');
  assert.equal(mode(null), 'teens');
});
