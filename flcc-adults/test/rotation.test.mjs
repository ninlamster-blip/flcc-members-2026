import test from 'node:test';
import assert from 'node:assert/strict';
import * as rotation from '../js/core/rotation.js';

const bank = Array.from({ length: 15 }, (_, i) => `item-${i + 1}`);

// Cycles are counted from the epoch, not from whatever day the test runs on,
// so a test that wants to watch one whole cycle has to start where a cycle
// starts. Everything below is relative to `day(0)`, the first day of a cycle.
const start = (() => {
  const from = new Date(2026, 0, 1);
  while (rotation.dayIndex(from) % bank.length !== 0) from.setDate(from.getDate() + 1);
  return from;
})();
const day = (n) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + n);

test('the same day always deals the same thing', () => {
  assert.equal(rotation.pick(bank, { date: day(3) }), rotation.pick(bank, { date: day(3) }));
});

test('a full cycle deals the whole bank, and nothing repeats inside it', () => {
  const dealt = Array.from({ length: bank.length }, (_, i) => rotation.pick(bank, { date: day(i) }));
  assert.equal(new Set(dealt).size, bank.length);
});

test('the next cycle is in a different order', () => {
  const first = Array.from({ length: bank.length }, (_, i) => rotation.pick(bank, { date: day(i) }));
  const second = Array.from({ length: bank.length }, (_, i) => rotation.pick(bank, { date: day(bank.length + i) }));
  assert.notDeepEqual(first, second);
  assert.deepEqual([...second].sort(), [...first].sort(), 'a different order, not different content');
});

test('an offset moves one bank against another', () => {
  const a = Array.from({ length: 6 }, (_, i) => rotation.pick(bank, { date: day(i) }));
  const b = Array.from({ length: 6 }, (_, i) => rotation.pick(bank, { date: day(i), offset: 3 }));
  assert.notDeepEqual(a, b);
});

test('an empty bank deals nothing rather than throwing', () => {
  assert.deepEqual(rotation.deal([], { count: 3 }), []);
  assert.equal(rotation.pick(null), null);
  assert.deepEqual(rotation.cycleOf([]), { total: 0, perDay: 0, days: 0, day: 0 });
});

test('a run length is reported honestly', () => {
  const run = rotation.cycleOf(bank);
  assert.equal(run.total, 15);
  assert.equal(run.days, 15);
  assert.ok(run.day >= 1 && run.day <= 15);
});
