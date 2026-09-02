// The record this app keeps — and, just as importantly, the score it refuses
// to keep. If XP, levels or badges ever appear in progress.js, the last test
// here is the one that should stop them.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/core/storage.js';
import * as progress from '../js/core/progress.js';

test('a day touched twice does not count twice', () => {
  store.wipe();
  const first = progress.complete('session', 'foundations:f1');
  const second = progress.complete('session', 'foundations:f1');
  assert.equal(first.first, true);
  assert.equal(second.first, false);
  assert.equal(progress.count('session'), 1);
  assert.equal(progress.isDone('session', 'foundations:f1'), true);
});

test('consecutive days run on, and a gap starts again without losing the best', () => {
  const monday = '2026-03-02';
  let days = progress.bumpDays({ count: 0, best: 0, lastDay: null }, monday);
  assert.deepEqual(days, { count: 1, best: 1, lastDay: monday });

  days = progress.bumpDays(days, '2026-03-03');
  days = progress.bumpDays(days, '2026-03-04');
  assert.equal(days.count, 3);

  days = progress.bumpDays(days, '2026-03-04');
  assert.equal(days.count, 3, 'the same day twice is still one day');

  const afterAGap = progress.bumpDays(days, '2026-03-20');
  assert.equal(afterAGap.count, 1, 'a gap starts the run again');
  assert.equal(afterAGap.best, 3, 'and never forgets what it was');
});

test('a run counted across a month boundary is still consecutive', () => {
  let days = progress.bumpDays(null, '2026-01-31');
  days = progress.bumpDays(days, '2026-02-01');
  assert.equal(days.count, 2);
});

test('through() reports where a path stands and what is next', () => {
  store.wipe();
  const keys = ['p:a', 'p:b', 'p:c', 'p:d'];
  assert.deepEqual(progress.through('session', keys), { finished: 0, total: 4, percent: 0, next: 'p:a' });
  progress.complete('session', 'p:a');
  progress.complete('session', 'p:b');
  const where = progress.through('session', keys);
  assert.equal(where.finished, 2);
  assert.equal(where.percent, 50);
  assert.equal(where.next, 'p:c');
});

test('the fortnight of rhythm is fourteen days ending today', () => {
  store.wipe();
  progress.complete('prayer', 'quiet-five');
  const days = progress.rhythm(14);
  assert.equal(days.length, 14);
  assert.equal(days.at(-1).day, progress.today());
  assert.equal(days.at(-1).on, true);
  assert.equal(days.filter((one) => one.on).length, 1);
});

test('nothing here keeps a score', () => {
  store.wipe();
  progress.complete('session', 'p:a');
  const state = progress.getProgress();
  for (const banned of ['xp', 'level', 'points', 'badges', 'rank', 'score']) {
    assert.equal(banned in state, false, `progress must not keep "${banned}"`);
  }
  assert.equal(typeof progress.XP, 'undefined', 'no XP table');
  assert.equal(typeof progress.level, 'undefined', 'no levels');
});
