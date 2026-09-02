// The daily crossword.
//
// Two things are being held here. That the puzzle a day produces is a real,
// solvable, fully interlocked crossword rather than a pile of words that
// happened not to collide — and that it keeps being one, every day, for years,
// without anybody authoring a grid.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as crossword from '../js/games/crossword.js';
import * as rotation from '../js/core/rotation.js';

const bank = JSON.parse(readFileSync(new URL('../content/crossword.json', import.meta.url), 'utf8'));
const PER_DAY = bank.perDay || 9;
const OFFSET = 5;

const dealFor = (date) => rotation.deal(bank.clues, { date, count: PER_DAY, offset: OFFSET });

test('the bank is big enough to be worth having', () => {
  assert.ok(bank.clues.length >= 150,
    `only ${bank.clues.length} clues — the point of dealing rather than authoring is that it does not run out`);
  const answers = bank.clues.map((one) => one.answer);
  assert.equal(new Set(answers).size, answers.length, 'the same answer is in the bank twice');
});

test('every clue is a usable crossword entry', () => {
  for (const one of bank.clues) {
    assert.match(one.answer, /^[A-Z]{3,15}$/, `${one.answer} is not a plain uppercase answer`);
    assert.ok(one.clue && one.clue.length > 12, `${one.answer} has a clue too short to be a clue`);
    // The whole promise of this feature is that it is hard. A clue that simply
    // restates the answer is the failure mode to guard against.
    assert.equal(one.clue.toUpperCase().includes(one.answer), false,
      `${one.answer}: the clue gives the answer away`);
  }
});

test('the clues are written for somebody who has read the text', () => {
  // Not a style rule that can be fully tested, but the giveaway phrasing can:
  // "Noah's ___" and "___ in the Bible" are the shapes a lazy clue takes.
  for (const one of bank.clues) {
    assert.equal(/^_+|_{3,}/.test(one.clue), false, `${one.answer}: a fill-in-the-blank clue`);
    // Trailing "…in the Bible" is the definitional crutch. The phrase itself
    // is fine where it is doing work — TRINITY's clue turns on it.
    assert.equal(/\bin the bible\s*$/i.test(one.clue), false,
      `${one.answer}: the clue leans on "in the Bible" instead of being a clue`);
  }
});

test('a day’s deal builds a real interlocked grid', () => {
  const words = dealFor(new Date(2026, 8, 2));
  assert.equal(words.length, PER_DAY);
  const puzzle = crossword.build(words);
  assert.equal(puzzle.entries.length, PER_DAY, 'a word was left out of the grid');
  assert.deepEqual(puzzle.skipped, []);
  assert.ok(puzzle.width > 0 && puzzle.height > 0);

  // Every entry's cells must actually be in the grid and hold its letters.
  const byKey = new Map(puzzle.cells.map((cell) => [cell.key, cell]));
  for (const entry of puzzle.entries) {
    assert.equal(entry.cells.length, entry.answer.length, `${entry.answer} is the wrong length in the grid`);
    entry.cells.forEach((key, i) => {
      const cell = byKey.get(key);
      assert.ok(cell, `${entry.answer} runs off the grid at ${key}`);
      assert.equal(cell.letter, entry.answer[i], `${entry.answer} disagrees with the grid at ${key}`);
    });
  }
});

test('every day for two years builds a solvable puzzle', () => {
  // The failure this is really guarding against is a day whose nine words
  // cannot interlock at all — which would ship as a blank screen on one
  // particular morning, months from now, for everybody at once.
  let widest = 0;
  let tallest = 0;
  for (let day = 0; day < 730; day++) {
    const date = new Date(2026, 0, 1 + day);
    const puzzle = crossword.build(dealFor(date));
    assert.deepEqual(puzzle.skipped, [], `${date.toDateString()} could not place every word`);
    assert.ok(puzzle.cells.length > 0, `${date.toDateString()} produced an empty grid`);
    widest = Math.max(widest, puzzle.width);
    tallest = Math.max(tallest, puzzle.height);
  }
  // A grid this side of about 24 still fits a phone with the cells scrolling.
  assert.ok(widest <= 24 && tallest <= 24, `a grid grew to ${widest}×${tallest}`);
});

test('the same day is the same puzzle on every phone', () => {
  const a = crossword.build(dealFor(new Date(2026, 8, 2)));
  const b = crossword.build(dealFor(new Date(2026, 8, 2)));
  assert.deepEqual(a.entries.map((one) => `${one.number}${one.dir}${one.answer}`),
    b.entries.map((one) => `${one.number}${one.dir}${one.answer}`));
});

test('tomorrow is a different puzzle from today', () => {
  const today = dealFor(new Date(2026, 8, 2)).map((one) => one.answer).join();
  const tomorrow = dealFor(new Date(2026, 8, 3)).map((one) => one.answer).join();
  assert.notEqual(today, tomorrow);
});

/**
 * It has to stay fresh for years, not weeks.
 *
 * `rotation.deal` re-permutes the bank on every cycle, so a clue coming round
 * again arrives in different company and therefore in a different grid. This
 * checks the thing a member would actually notice: that two mornings a few
 * weeks apart are not the same nine clues in the same shape.
 */
test('a clue that comes round again arrives in different company', () => {
  const seen = new Map();
  let repeats = 0;
  for (let day = 0; day < 400; day++) {
    const set = dealFor(new Date(2026, 0, 1 + day)).map((one) => one.answer).sort().join('|');
    if (seen.has(set)) repeats += 1;
    seen.set(set, day);
  }
  assert.equal(repeats, 0, 'the same nine clues were dealt together twice in 400 days');
});

test('scoring knows when it is finished', () => {
  const puzzle = crossword.build(dealFor(new Date(2026, 8, 2)));
  const filled = {};
  assert.equal(crossword.score(puzzle, filled).done, false);
  for (const cell of puzzle.cells) filled[cell.key] = cell.letter;
  const result = crossword.score(puzzle, filled);
  assert.equal(result.done, true);
  assert.equal(result.right, result.total);
});

/**
 * The layout engine is the kids edition's, character for character.
 *
 * The two apps share no code, so this file is a duplicate — and a duplicate
 * with nothing holding it in place drifts. A bug fixed in one grid builder has
 * to be fixed in the other, and this is what says so. Only the header comment
 * is allowed to differ.
 */
test('the layout engine has not drifted from the kids edition’s', () => {
  const ours = readFileSync(new URL('../js/games/crossword.js', import.meta.url), 'utf8');
  const theirs = readFileSync(new URL('../../flcc-next/js/games/crossword.js', import.meta.url), 'utf8');
  const body = (source) => source.slice(source.indexOf("const ACROSS = 'across';"));
  assert.equal(body(ours), body(theirs),
    'the two crossword engines have diverged — fix the bug in both files');
});
