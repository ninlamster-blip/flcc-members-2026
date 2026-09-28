// Streak rewards.
//
// The promises: a reward is earned by the best streak, so nothing is ever
// taken away; the ladder only climbs; and nothing can be worn that was not
// earned — whatever a hand-edited save says.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as rewards from '../js/core/rewards.js';
import { bumpStreak } from '../js/core/progress.js';
import { HATS } from '../js/games/hopacross.js';

test('the ladder climbs, one reward per step, each with somewhere to wear it', () => {
  const days = rewards.REWARDS.map((reward) => reward.days);
  assert.deepEqual(days, [...days].sort((a, b) => a - b), 'rewards must be in the order they are reached');
  assert.equal(new Set(days).size, days.length, 'two rewards on the same day would hide one');
  assert.equal(new Set(rewards.REWARDS.map((r) => r.id)).size, rewards.REWARDS.length);
  for (const reward of rewards.REWARDS) {
    assert.ok(['hopHat', 'galagaShip'].includes(reward.slot), `${reward.id}: unknown slot`);
    if (reward.slot === 'hopHat') assert.ok(HATS.includes(reward.value), `${reward.id}: Hop Across cannot draw "${reward.value}"`);
    if (reward.slot === 'galagaShip') assert.ok(['sunshine', 'rose', 'poppy', 'sky'].includes(reward.value), `${reward.id}: not a palette tone`);
  }
  assert.equal(rewards.REWARDS[0].days, 3, 'the first reward should come within the first week');
});

test('rewards go by the best streak, so a missed day takes nothing away', () => {
  assert.deepEqual(rewards.unlocked(0), []);
  assert.deepEqual(rewards.unlocked(7).map((r) => r.id), ['hop-cap', 'galaga-sunshine', 'hop-bow']);
  // A seven-day streak broken the next day: the count resets, the best does not.
  let streak = { count: 0, best: 0, lastDay: null };
  for (const day of ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07']) streak = bumpStreak(streak, day);
  streak = bumpStreak(streak, '2026-01-20');
  assert.equal(streak.count, 1);
  assert.equal(rewards.unlocked(streak.best).length, 3, 'the rewards stay after the streak breaks');
});

test('the next reward and what a day just unlocked', () => {
  assert.equal(rewards.next(0).id, 'hop-cap');
  assert.equal(rewards.next(3).id, 'galaga-sunshine');
  assert.equal(rewards.next(999), null, 'past the top of the ladder there is nothing next');
  assert.deepEqual(rewards.newlyUnlocked(2, 3).map((r) => r.id), ['hop-cap']);
  assert.deepEqual(rewards.newlyUnlocked(3, 3), [], 'the same best twice unlocks nothing twice');
});

test('nothing can be worn that has not been earned', () => {
  assert.equal(rewards.wearing('hopHat', 'crown', 14), 'crown');
  assert.equal(rewards.wearing('hopHat', 'crown', 13), null, 'one day short');
  assert.equal(rewards.wearing('hopHat', 'rose', 99), null, 'a Galaga colour is not a hat');
  assert.equal(rewards.wearing('galagaShip', 'poppy', 21), 'poppy');
  assert.equal(rewards.wearing('hopHat', null, 99), null);
});

test('finishing something reports a reward the moment it unlocks', async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; },
  };
  const progress = await import(`../js/core/progress.js?fresh=${Date.now()}`);
  const day = (n) => new Date(2026, 0, n, 12);
  assert.deepEqual(progress.complete('devotional', 'a', day(1)).unlocked, []);
  assert.deepEqual(progress.complete('devotional', 'b', day(2)).unlocked, []);
  assert.deepEqual(progress.complete('devotional', 'c', day(3)).unlocked.map((r) => r.id), ['hop-cap']);
  assert.deepEqual(progress.complete('challenge', 'c', day(3)).unlocked, [], 'a second thing the same day unlocks nothing new');
  delete globalThis.localStorage;
});
