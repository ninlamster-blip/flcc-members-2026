import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dayNumber, pickFor, pickIndex } from '../js/core/daily.js';
import { challengeFor, typeForDay, TYPES } from '../js/core/challenges.js';
import { bumpStreak, yesterday, today, chapterPercent } from '../js/core/progress.js';

const pools = JSON.parse(readFileSync(new URL('../content/challenges.json', import.meta.url), 'utf8'));
const daily = JSON.parse(readFileSync(new URL('../content/daily.json', import.meta.url), 'utf8'));

test('the day of the year is what selects the day content', () => {
  assert.equal(dayNumber(new Date(2026, 0, 1)), 1);
  assert.equal(dayNumber(new Date(2026, 11, 31)), 365);
  assert.equal(dayNumber(new Date(2024, 11, 31)), 366, 'leap years have a 366th day');
});

test('the same date always yields the same Word — for every child in a church', () => {
  const date = new Date(2026, 7, 26);
  const first = pickFor(daily, date);
  for (let i = 0; i < 5; i++) assert.deepEqual(pickFor(daily, new Date(2026, 7, 26)), first);
  assert.notDeepEqual(pickFor(daily, new Date(2026, 7, 27)), first, 'tomorrow is a different Word');
  assert.equal(pickIndex(0, date), -1, 'an empty pool does not crash');
});

test('a year of days uses the whole pool', () => {
  const used = new Set();
  for (let day = 0; day < 365; day++) {
    used.add(pickFor(daily, new Date(2026, 0, 1 + day)).ref);
  }
  assert.equal(used.size, daily.length, 'every entry in the pool is used within a year');
});

test('challenges rotate through all five kinds and stay stable within a day', () => {
  const kinds = new Set();
  for (let day = 0; day < 14; day++) kinds.add(typeForDay(new Date(2026, 0, 1 + day)));
  assert.deepEqual([...kinds].sort(), [...TYPES].sort());

  const date = new Date(2026, 4, 12);
  const chosen = challengeFor(pools, '11-14', date);
  assert.ok(chosen && chosen.type);
  assert.deepEqual(challengeFor(pools, '11-14', new Date(2026, 4, 12)), chosen);
});

test('every band gets a challenge every day of the year', () => {
  for (const band of ['7-10', '11-14', '15-18']) {
    for (let day = 0; day < 365; day++) {
      const chosen = challengeFor(pools, band, new Date(2026, 0, 1 + day));
      assert.ok(chosen, `no challenge for ${band} on day ${day}`);
      assert.ok(chosen.prompt[band], `challenge for ${band} on day ${day} has no text`);
    }
  }
});

test('a streak counts consecutive days and forgives nothing else', () => {
  let streak = bumpStreak(null, '2026-08-24', yesterday('2026-08-24'));
  assert.equal(streak.count, 1);
  streak = bumpStreak(streak, '2026-08-25', yesterday('2026-08-25'));
  assert.equal(streak.count, 2);
  streak = bumpStreak(streak, '2026-08-25', yesterday('2026-08-25'));
  assert.equal(streak.count, 2, 'twice in one day is still one day');
  streak = bumpStreak(streak, '2026-08-28', yesterday('2026-08-28'));
  assert.equal(streak.count, 1, 'a missed day restarts the count');
  assert.equal(streak.best, 2, 'but the best is remembered');
});

test('dates and chapter progress are computed the same way everywhere', () => {
  assert.equal(today(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(yesterday('2026-03-01'), '2026-02-28');
  assert.equal(chapterPercent({ verse: 10, total: 20 }), 50);
  assert.equal(chapterPercent({ verse: 0, total: 0 }), 0);
  assert.equal(chapterPercent(null), 0);
});
