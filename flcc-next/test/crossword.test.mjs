import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build, score } from '../js/games/crossword.js';

const puzzles = JSON.parse(await readFile(new URL('../content/games/crossword.json', import.meta.url), 'utf8'));

const grid = (puzzle) => {
  const rows = Array.from({ length: puzzle.height }, () => Array(puzzle.width).fill(null));
  for (const cell of puzzle.cells) rows[cell.row][cell.col] = cell.letter;
  return rows;
};

test('every authored puzzle interlocks with nothing left over', () => {
  assert.ok(puzzles.length >= 4);
  for (const puzzle of puzzles) {
    const built = build(puzzle.words);
    assert.deepEqual(built.skipped, [], `${puzzle.id} stranded words`);
    assert.equal(built.entries.length, puzzle.words.length, puzzle.id);
    // A phone has to hold it: keep both sides inside a printable grid.
    assert.ok(built.width <= 13 && built.height <= 13, `${puzzle.id} is ${built.width}x${built.height}`);
  }
});

test('both age groups get puzzles of their own', () => {
  for (const band of ['kids', 'teens']) {
    assert.ok(puzzles.some((puzzle) => puzzle.ageGroup === band || puzzle.ageGroup === 'both'), band);
  }
  for (const puzzle of puzzles) {
    assert.ok(puzzle.id && puzzle.title, 'a puzzle needs an id and a title');
    for (const word of puzzle.words) {
      assert.match(word.answer, /^[A-Za-z]{3,}$/, `${puzzle.id}: ${word.answer}`);
      assert.ok(word.clue && word.clue.length > 8, `${puzzle.id}: ${word.answer} needs a real clue`);
    }
  }
});

test('the same word list always produces the same grid', () => {
  const words = puzzles[0].words;
  assert.deepEqual(build(words), build(words));
});

test('letters shared by two answers agree', () => {
  for (const puzzle of puzzles) {
    const built = build(puzzle.words);
    const rows = grid(built);
    for (const entry of built.entries) {
      const read = entry.cells.map((key) => {
        const [row, col] = key.split(',').map(Number);
        return rows[row][col];
      }).join('');
      assert.equal(read, entry.answer, `${puzzle.id}: ${entry.answer}`);
    }
  }
});

test('numbering runs in reading order and is shared at a crossing', () => {
  const built = build(puzzles[0].words);
  const starts = built.entries.map((entry) => ({ number: entry.number, row: entry.row, col: entry.col }));
  const seen = new Map();
  for (const start of starts) {
    const key = `${start.row},${start.col}`;
    if (seen.has(key)) assert.equal(seen.get(key), start.number, 'a shared start square shares its number');
    seen.set(key, start.number);
  }
  const order = [...new Set(starts.map((s) => s.number))];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(Math.min(...order), 1);
});

test('an answer that cannot cross anything is reported, not silently dropped', () => {
  const built = build([
    { answer: 'MOSES', clue: 'Led them out' },
    { answer: 'FIG', clue: 'Shares no letter with the other answer' },
  ]);
  assert.equal(built.entries.length, 1);
  assert.equal(built.skipped.length, 1);
  assert.deepEqual([...built.entries.map((entry) => entry.answer), ...built.skipped].sort(),
    ['FIG', 'MOSES']);
});

test('scoring counts squares, and only a full correct grid finishes', () => {
  const built = build(puzzles[0].words);
  assert.deepEqual(score(built, {}), { right: 0, total: built.cells.length, done: false });

  const filled = {};
  for (const cell of built.cells) filled[cell.key] = cell.letter;
  assert.equal(score(built, filled).done, true);

  const [first] = built.cells;
  filled[first.key] = first.letter === 'A' ? 'B' : 'A';
  const near = score(built, filled);
  assert.equal(near.done, false);
  assert.equal(near.right, built.cells.length - 1);
});
