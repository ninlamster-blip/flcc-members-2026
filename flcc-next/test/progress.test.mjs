// XP, levels and streaks. The numbers exist to encourage consistency, so what
// matters is that they cannot be gamed and cannot punish.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as progress from '../js/core/progress.js';
import * as store from '../js/core/storage.js';

test('a streak counts consecutive days, and nothing else', () => {
  let streak = progress.bumpStreak(null, '2026-08-25');
  assert.equal(streak.count, 1);
  streak = progress.bumpStreak(streak, '2026-08-26');
  assert.equal(streak.count, 2);
  streak = progress.bumpStreak(streak, '2026-08-26');
  assert.equal(streak.count, 2, 'twice in one day is still one day');
  streak = progress.bumpStreak(streak, '2026-08-29');
  assert.equal(streak.count, 1, 'a missed day starts again');
  assert.equal(streak.best, 2, 'but the best is remembered');
});

test('the same thing cannot be finished twice for XP', () => {
  store.wipe();
  const first = progress.complete('devotional', '2026-08-27');
  const second = progress.complete('devotional', '2026-08-27');
  assert.equal(first.first, true);
  assert.equal(second.first, false);
  assert.equal(second.xp, first.xp, 'no XP the second time');
  assert.equal(progress.count('devotional'), 1);
  store.wipe();
});

test('levels are slow, and titled', () => {
  assert.equal(progress.level(0), 1);
  assert.equal(progress.level(progress.LEVEL_STEP - 1), 1);
  assert.equal(progress.level(progress.LEVEL_STEP), 2);
  assert.ok(progress.LEVEL_STEP >= 100, 'a level should take more than a single session');
  assert.equal(progress.levelTitle(0), 'First Steps');
  assert.ok(progress.levelTitle(99999), 'the last title holds rather than running out');
  assert.equal(progress.intoLevel(progress.LEVEL_STEP / 2), 50);
});

test('dates are computed the same way everywhere', () => {
  assert.equal(progress.today(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(progress.yesterday('2026-03-01'), '2026-02-28');
});
