// The prayer list. Two rules matter more than the rest: an answered prayer is
// kept rather than deleted, and nothing here can be destroyed except by an
// explicit removal.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/core/storage.js';
import * as prayers from '../js/core/prayers.js';

test('a prayer is added, carried, answered and kept', () => {
  store.wipe();
  const item = prayers.add({ text: 'For my mother’s operation', category: 'family' });
  assert.ok(item.id);
  assert.equal(prayers.open().length, 1);
  assert.equal(prayers.answered().length, 0);

  prayers.answer(item.id, 'It went well.');
  assert.equal(prayers.open().length, 0, 'an answered prayer leaves the open list');
  assert.equal(prayers.answered().length, 1, 'and is still there');
  assert.equal(prayers.answered()[0].answered.note, 'It went well.');

  prayers.reopen(item.id);
  assert.equal(prayers.open().length, 1, 'and can be reopened');
});

test('an empty prayer is not added', () => {
  store.wipe();
  assert.equal(prayers.add({ text: '   ' }), null);
  assert.equal(prayers.add({ text: '' }), null);
  assert.equal(prayers.all().length, 0);
});

test('removal is the only thing that destroys anything', () => {
  store.wipe();
  const item = prayers.add({ text: 'For work' });
  prayers.answer(item.id);
  assert.equal(prayers.all().length, 1);
  prayers.remove(item.id);
  assert.equal(prayers.all().length, 0);
});

test('prayers group by category, and an unknown category still shows up', () => {
  store.wipe();
  prayers.add({ text: 'a', category: 'family' });
  prayers.add({ text: 'b', category: 'family' });
  prayers.add({ text: 'c', category: 'work' });
  const groups = prayers.byCategory();
  assert.equal(groups.get('family').length, 2);
  assert.equal(groups.get('work').length, 1);
  assert.equal(prayers.all().every((one) => one.category), true, 'a missing category defaults rather than blanking');
});

test('how long a prayer has been carried reads like a person said it', () => {
  const at = (days) => ({ created: new Date(Date.now() - days * 86400000).toISOString() });
  assert.equal(prayers.carriedFor(at(0)), 'Today');
  assert.equal(prayers.carriedFor(at(1)), '1 day');
  assert.equal(prayers.carriedFor(at(9)), '9 days');
  assert.equal(prayers.carriedFor(at(60)), '2 months');
  assert.equal(prayers.carriedFor(at(800)), '2 years');
  assert.equal(prayers.carriedFor({ created: 'not a date' }), '');
});

test('reflections are kept apart from the prayer list', () => {
  store.wipe();
  prayers.add({ text: 'a prayer' });
  const entry = prayers.reflect({ text: 'Something I heard', guide: 'Rest', ref: 'Matthew 11:28' });
  assert.equal(prayers.reflections().length, 1);
  assert.equal(prayers.all().length, 1, 'a reflection is not a prayer');
  prayers.unreflect(entry.id);
  assert.equal(prayers.reflections().length, 0);
  assert.equal(prayers.all().length, 1);
});
