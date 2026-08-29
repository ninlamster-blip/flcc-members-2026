// A reading plan is a sequence, not a calendar. The test that matters is the
// last one: a fortnight away must not move the plan, because a plan that
// punishes an absence is a plan adults abandon.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/core/storage.js';
import * as plan from '../js/core/plan.js';

const john = { id: 'john-21', days: Array.from({ length: 21 }, (_, i) => ({ ref: `John ${i + 1}`, note: '' })) };

test('a new plan starts on day one', () => {
  store.wipe();
  const at = plan.positionIn(john);
  assert.equal(at.day, 1);
  assert.equal(at.total, 21);
  assert.equal(at.done, false);
  assert.equal(at.at.ref, 'John 1');
});

test('marking a day read advances the plan by one', () => {
  store.wipe();
  plan.markRead(john, 1);
  plan.markRead(john, 2);
  const at = plan.positionIn(john);
  assert.equal(at.day, 3);
  assert.equal(at.finished, 2);
  assert.equal(at.at.ref, 'John 3');
  assert.equal(plan.isRead(john, 1), true);
  assert.equal(plan.isRead(john, 3), false);
});

test('a finished plan says so instead of falling off the end', () => {
  store.wipe();
  for (let day = 1; day <= 21; day++) plan.markRead(john, day);
  const at = plan.positionIn(john);
  assert.equal(at.done, true);
  assert.equal(at.day, 21);
  assert.equal(at.percent, 100);
  assert.equal(at.at.ref, 'John 21');
});

test('starting and stopping a plan keeps every day already read', () => {
  store.wipe();
  plan.start('john-21');
  assert.equal(plan.state().id, 'john-21');
  plan.markRead(john, 1);
  plan.stop();
  assert.equal(plan.state().id, null);
  assert.equal(plan.positionIn(john).finished, 1, 'stopping is not erasing');
});

test('time passing does not move a plan', () => {
  store.wipe();
  plan.markRead(john, 1, new Date(2026, 0, 1));
  const before = plan.positionIn(john);
  const later = new Date();
  later.setDate(later.getDate() + 30);
  const after = plan.positionIn(john);
  assert.deepEqual(after, before, 'day 2 is the second reading, not the second day');
});
