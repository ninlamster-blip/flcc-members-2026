// The promise this suite holds the app to: open it every morning and you keep
// meeting new material until the bank is genuinely exhausted.

import test from 'node:test';
import assert from 'node:assert/strict';
import { dayIndex, permute, deal, pick, cycleOf } from '../js/core/rotation.js';

const bank = (n) => Array.from({ length: n }, (_, i) => `item-${i}`);
const on = (y, m, d) => new Date(y, m - 1, d);
const plus = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Cycles are counted from the epoch, not from the 1st of a month, so a test
// about "a full cycle" has to start where one actually starts.
function cycleStart(items, count, from = on(2026, 1, 1)) {
  for (let i = 0; i < 400; i++) {
    const date = plus(from, i);
    if (cycleOf(items, { count, date }).day === 1) return date;
  }
  throw new Error('no cycle boundary found');
}

test('the day index advances by one a day, across months and years', () => {
  assert.equal(dayIndex(on(2026, 3, 2)) - dayIndex(on(2026, 3, 1)), 1);
  assert.equal(dayIndex(on(2026, 4, 1)) - dayIndex(on(2026, 3, 31)), 1);
  assert.equal(dayIndex(on(2027, 1, 1)) - dayIndex(on(2026, 12, 31)), 1);
  assert.equal(dayIndex(on(2026, 3, 1)), dayIndex(on(2026, 3, 1)));
});

test('a permutation is stable for a seed and different across seeds', () => {
  assert.deepEqual(permute(bank(20), 7), permute(bank(20), 7));
  assert.notDeepEqual(permute(bank(20), 7), permute(bank(20), 8));
  assert.deepEqual([...permute(bank(20), 7)].sort(), bank(20).sort());
});

test('the same day deals the same thing, so nobody can re-roll a hard question', () => {
  const options = { date: on(2026, 5, 4), count: 5 };
  assert.deepEqual(deal(bank(40), options), deal(bank(40), options));
});

test('consecutive days never overlap inside a cycle', () => {
  const items = bank(40);
  const start = cycleStart(items, 5);
  const seen = new Set();
  for (let day = 0; day < 8; day++) {                  // 40 items, 5 a day = 8 days
    const today = deal(items, { date: plus(start, day), count: 5 });
    assert.equal(today.length, 5);
    for (const item of today) {
      assert.ok(!seen.has(item), `${item} came round again on day ${day + 1}`);
      seen.add(item);
    }
  }
  assert.equal(seen.size, 40, 'a full cycle should deal the whole bank');
});

test('the next cycle deals a different order, not the same run again', () => {
  const items = bank(40);
  const start = cycleStart(items, 5);
  assert.notDeepEqual(
    deal(items, { date: start, count: 5 }),
    deal(items, { date: plus(start, 8), count: 5 }));   // one cycle later
});

test('a bank that does not divide evenly still never repeats within a cycle', () => {
  const items = bank(23);                              // 23 items, 5 a day = 4 days
  const start = cycleStart(items, 5);
  const seen = new Set();
  for (let day = 0; day < 4; day++) {
    for (const item of deal(items, { date: plus(start, day), count: 5 })) {
      assert.ok(!seen.has(item), `${item} repeated on day ${day + 1}`);
      seen.add(item);
    }
  }
  assert.equal(seen.size, 20, 'the three left over wait for the next cycle');
});

test('asking for more than exists gives everything, once', () => {
  const today = deal(bank(3), { date: on(2026, 2, 2), count: 10 });
  assert.equal(today.length, 3);
  assert.equal(new Set(today).size, 3);
});

test('an empty or missing bank deals nothing rather than throwing', () => {
  assert.deepEqual(deal([], { count: 5 }), []);
  assert.deepEqual(deal(null, { count: 5 }), []);
  assert.equal(pick([], {}), null);
});

test('offset moves one bank against another so they do not march in step', () => {
  const items = bank(30);
  const date = on(2026, 7, 7);
  assert.notDeepEqual(deal(items, { date, count: 5 }), deal(items, { date, count: 5, offset: 3 }));
});

test('a single pick walks the whole bank before anything returns', () => {
  const items = bank(9);
  const start = cycleStart(items, 1);
  const seen = new Set();
  for (let day = 0; day < 9; day++) seen.add(pick(items, { date: plus(start, day) }));
  assert.equal(seen.size, 9);
});

test('the cycle report says how long the bank lasts and where today sits', () => {
  const report = cycleOf(bank(40), { count: 5, date: on(2026, 1, 3) });
  assert.equal(report.total, 40);
  assert.equal(report.perDay, 5);
  assert.equal(report.days, 8);
  assert.ok(report.day >= 1 && report.day <= 8);
  assert.deepEqual(cycleOf([], { count: 5 }), { total: 0, perDay: 0, days: 0, day: 0 });
});

test('the day within a cycle counts up and wraps', () => {
  const days = [];
  for (let day = 1; day <= 10; day++) days.push(cycleOf(bank(40), { count: 5, date: on(2026, 1, day) }).day);
  for (let i = 1; i < days.length; i++) {
    const step = days[i] - days[i - 1];
    assert.ok(step === 1 || step === -7, `day went ${days[i - 1]} → ${days[i]}`);
  }
});
