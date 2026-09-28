// The memory verse.
//
// What matters: the whole ministry learns the same verse all week, kids are
// never handed a long one, and each step hides everything the step before it
// did — so practising only ever gets harder, never shuffles.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as memory from '../js/core/memory.js';

const bank = JSON.parse(readFileSync(new URL('../content/games/verse-builder.json', import.meta.url), 'utf8'));

test('a week runs Monday to Sunday', () => {
  assert.equal(memory.weekOf('2026-09-28'), '2026-09-28', 'a Monday is its own week');
  assert.equal(memory.weekOf('2026-10-04'), '2026-09-28', 'the Sunday after belongs to it');
  assert.equal(memory.weekOf('2026-10-05'), '2026-10-05');
  assert.equal(memory.weekOf('2026-01-01'), '2025-12-29', 'across a new year');
});

test('the same verse all week, and a different one the next', () => {
  for (const band of ['kids', 'teens']) {
    const days = ['2026-09-28', '2026-09-30', '2026-10-04'].map((d) => memory.verseFor(bank, band, memory.weekOf(d)));
    assert.ok(days.every((v) => v === days[0]), `${band}: the verse changed mid-week`);
    const next = memory.verseFor(bank, band, '2026-10-05');
    assert.notEqual(next, days[0], `${band}: next week is the same verse`);
  }
});

test('kids are only given short verses, and never a teens one', () => {
  const kids = memory.eligible(bank, 'kids');
  assert.ok(kids.length >= 26, `only ${kids.length} kids verses — not half a year of them`);
  for (const row of kids) {
    assert.ok(row.text.split(/\s+/).length <= memory.KIDS_MAX_WORDS, `too long for a kid: ${row.ref}`);
    assert.notEqual(row.ageGroup, 'teens', row.ref);
  }
  assert.ok(memory.eligible(bank, 'teens').length >= kids.length);
});

test('each step hides everything the last one did, ending with every word', () => {
  for (const row of bank.slice(0, 30)) {
    const words = row.text.split(/\s+/);
    let before = new Set();
    for (let step = 0; step < memory.STEPS.length; step++) {
      const now = memory.hiddenAt(words, step);
      for (const i of before) assert.ok(now.has(i), `${row.ref}: step ${step} brought a word back`);
      assert.ok(now.size >= before.size);
      before = now;
    }
    assert.equal(memory.hiddenAt(words, 0).size, 0, 'the first step shows the whole verse');
    assert.equal(before.size, words.length, 'the last step hides it all');
    assert.deepEqual([...memory.hiddenAt(words, 2)], [...memory.hiddenAt(words, 2)], 'the same step hides the same words');
  }
});

test('a kid gets the first letter, a teen a blank, and punctuation stays', () => {
  assert.equal(memory.blank('strength,', 'kids'), 's_______,');
  assert.equal(memory.blank('strength,', 'teens'), '________,');
  assert.equal(memory.blank('I', 'kids'), 'I_');
});
