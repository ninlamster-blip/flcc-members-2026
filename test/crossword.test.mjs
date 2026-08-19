/**
 * Bible Crossword — the puzzle bank, the engine and the streak.
 *
 * The bank is the only place a Bible fact may enter this game, so most of what
 * follows is about holding it to that: every slot in every grid resolves to a
 * written, referenced record, and no grid contains a run of letters nobody
 * wrote a clue for. bible-crossword/ is plain ES modules, so unlike the
 * single-file apps these import directly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { load, readRepoFile } from './lib/extract.mjs';
import { ANSWERS } from '../bible-crossword/js/answers.js';
import { PUZZLES } from '../bible-crossword/js/puzzles.js';
import {
  SIZE, MIN_ENTRY, BLOCK, buildPuzzle, puzzleForDate, puzzleNumber,
  dayKey, dayNumber, firstOpenCell, nextCellIn, nextEntry,
  isEntryCorrect, isEntryFilled, isSolved, wrongCells,
} from '../bible-crossword/js/engine.js';

const models = PUZZLES.map(buildPuzzle);

// ── The answer bank ──────────────────────────────────────────────────────────

test('every answer is 3-6 uppercase letters', () => {
  for (const word of Object.keys(ANSWERS)) {
    assert.match(word, /^[A-Z]{3,6}$/, `${word} cannot be placed in a 6x6 grid`);
  }
});

test('every answer carries a clue, a hint, a reference and an explanation', () => {
  for (const [word, rec] of Object.entries(ANSWERS)) {
    for (const field of ['clue', 'hint', 'explanation']) {
      assert.ok(rec[field] && rec[field].trim().length > 20, `${word}.${field} is missing or too short`);
    }
    assert.ok(rec.scripture && rec.scripture.trim().length > 5, `${word}.scripture is missing`);
    assert.ok(Array.isArray(rec.tags) && rec.tags.length, `${word} needs at least one category tag`);
  }
});

test('every Scripture reference names a book, a chapter and a verse', () => {
  // "1 Kings 15:11-13", "Judges 4:19; 5:28", "Genesis 34". A reference that
  // does not parse is usually a typo, and a typo here sends a member looking
  // for a passage that is not there.
  // A one-chapter book (3 John) is cited by verse alone, so the number after
  // the book name may itself be a range.
  const ref = /^(?:[1-3]\s)?[A-Z][A-Za-z]+\s\d+(?:[-–]\d+)?(?::\d+(?:[-–]\d+)?)?(?:,\s?\d+(?:[-–]\d+)?)*$/;
  for (const [word, rec] of Object.entries(ANSWERS)) {
    for (const part of rec.scripture.split(';').map(s => s.trim())) {
      // A trailing "; 5:28" is a second passage in the same book, so it needs
      // a book name borrowed from somewhere before it can be checked.
      const testable = /^[\d:,\s\u2013-]+$/.test(part) ? `Judges ${part}` : part;
      assert.match(testable, ref, `${word}: "${rec.scripture}" does not read as a Scripture reference`);
    }
  }
});

test('the clues do not lean on the handful of names everyone already knows', () => {
  // The whole premise is "I know the Bible, but I do not remember this". A
  // grid full of Moses and David would quietly undo that.
  const tooFamous = ['MOSES', 'NOAH', 'DAVID', 'PAUL', 'PETER', 'JESUS', 'MARY', 'JONAH', 'ISAAC', 'JACOB', 'ADAM', 'ESTHER', 'SAMSON', 'ELIJAH', 'DANIEL', 'JOSEPH'];
  for (const name of tooFamous) {
    assert.equal(ANSWERS[name], undefined, `${name} should not be an answer — use it in a clue instead`);
  }
});

// ── The grids ────────────────────────────────────────────────────────────────

test('every puzzle is a 6x6 grid of letters and blocks', () => {
  for (const p of PUZZLES) {
    assert.equal(p.grid.length, SIZE, `${p.id} must have ${SIZE} rows`);
    for (const row of p.grid) {
      assert.equal(row.length, SIZE, `${p.id} row "${row}" must be ${SIZE} wide`);
      assert.match(row, new RegExp(`^[A-Z${BLOCK}]{${SIZE}}$`), `${p.id} row "${row}" has a stray character`);
    }
    assert.equal(p.difficulty, 'Hard');
    assert.ok(p.category && p.category.trim(), `${p.id} needs a category`);
  }
});

test('every run of two white squares would be unclued, so there are none', () => {
  // A pair of adjacent letters with no third is a word the player can see and
  // can never be told about. Runs are either a real entry or a single square
  // checked by the crossing word.
  for (const p of PUZZLES) {
    for (const line of [...p.grid, ...columns(p.grid)]) {
      for (const run of line.split(BLOCK)) {
        assert.notEqual(run.length, 2, `${p.id}: "${line}" contains an unclued pair "${run}"`);
      }
    }
  }
});

test('every letter square belongs to at least one clued entry', () => {
  for (const model of models) {
    for (const [r, c] of model.letterCells) {
      const owner = model.byCell[`${r},${c}`];
      assert.ok(owner && (owner.across || owner.down),
        `${model.id}: the square at row ${r + 1} column ${c + 1} is in no entry at all`);
    }
  }
});

test('the white squares of every grid form one connected shape', () => {
  for (const model of models) {
    const white = new Set(model.letterCells.map(([r, c]) => `${r},${c}`));
    const seen = new Set([[...white][0]]);
    const stack = [[...white][0]];
    while (stack.length) {
      const [r, c] = stack.pop().split(',').map(Number);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const key = `${r + dr},${c + dc}`;
        if (white.has(key) && !seen.has(key)) { seen.add(key); stack.push(key); }
      }
    }
    assert.equal(seen.size, white.size, `${model.id} has an island of squares cut off from the rest`);
  }
});

test('every entry resolves to a record in the bank, and matches it letter for letter', () => {
  for (const model of models) {
    assert.ok(model.entries.length >= 6, `${model.id} has only ${model.entries.length} entries`);
    for (const entry of model.entries) {
      assert.ok(entry.len >= MIN_ENTRY, `${model.id} ${entry.id} is too short to clue`);
      assert.ok(ANSWERS[entry.answer], `${model.id} ${entry.id}: no record for ${entry.answer}`);
      assert.equal(entry.clue, ANSWERS[entry.answer].clue);
      assert.equal(entry.answer.length, entry.len);
    }
  }
});

test('clue numbers run 1, 2, 3 in reading order with no gaps', () => {
  for (const model of models) {
    const numbers = [...new Set(model.entries.map(e => e.number))];
    assert.deepEqual(numbers, numbers.map((_, i) => i + 1), `${model.id} numbering is not sequential`);
    // Across before Down at the same number, and numbers only increase.
    const order = model.entries.map(e => e.number * 2 + (e.dir === 'down' ? 1 : 0));
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${model.id} entries are out of reading order`);
  }
});

test('no answer is reused across puzzles, beyond the short connecting words', () => {
  const counts = new Map();
  for (const model of models) {
    const seen = new Set();
    for (const e of model.entries) {
      assert.ok(!seen.has(e.answer), `${model.id} uses ${e.answer} twice in one grid`);
      seen.add(e.answer);
      counts.set(e.answer, (counts.get(e.answer) || 0) + 1);
    }
  }
  for (const [word, n] of counts) {
    const allowed = word.length === 3 ? 2 : 1;
    assert.ok(n <= allowed, `${word} appears in ${n} puzzles (at most ${allowed} allowed)`);
  }
});

test('there are ten puzzles and each has a distinct id', () => {
  assert.equal(PUZZLES.length, 10);
  assert.equal(new Set(PUZZLES.map(p => p.id)).size, 10);
  PUZZLES.forEach((p, i) => assert.equal(puzzleNumber(p), i + 1));
});

// ── The daily puzzle ─────────────────────────────────────────────────────────

test('everyone gets the same puzzle on the same day, and a new one tomorrow', () => {
  const day = new Date(2026, 7, 19, 6, 0, 0);
  const later = new Date(2026, 7, 19, 23, 30, 0);
  assert.equal(puzzleForDate(day).id, puzzleForDate(later).id, 'the puzzle must not change during the day');

  const tomorrow = new Date(2026, 7, 20, 6, 0, 0);
  assert.notEqual(puzzleForDate(day).id, puzzleForDate(tomorrow).id);

  // And it comes back round rather than running out.
  const cycle = new Date(2026, 7, 19 + PUZZLES.length, 6, 0, 0);
  assert.equal(puzzleForDate(cycle).id, puzzleForDate(day).id);
});

test('the day is the member\'s own calendar day, not UTC', () => {
  // Kuwait is UTC+3: an 11pm local Wednesday is already Thursday in UTC, and
  // members there should still be on Wednesday's puzzle.
  const lateEvening = new Date(2026, 7, 19, 23, 59, 0);
  assert.equal(dayKey(lateEvening), '2026-08-19');
  assert.equal(dayNumber(lateEvening) + 1, dayNumber(new Date(2026, 7, 20, 0, 1, 0)));
});

// ── Playing ──────────────────────────────────────────────────────────────────

test('an entry is only correct when every letter of it is right', () => {
  const model = models[0];
  const entry = model.entries[0];
  const letters = {};
  entry.cells.forEach(([r, c], i) => { letters[`${r},${c}`] = entry.answer[i]; });
  assert.ok(isEntryFilled(entry, letters));
  assert.ok(isEntryCorrect(entry, letters));

  const [r, c] = entry.cells[entry.len - 1];
  letters[`${r},${c}`] = entry.answer[entry.len - 1] === 'X' ? 'Z' : 'X';
  assert.ok(isEntryFilled(entry, letters), 'still full');
  assert.ok(!isEntryCorrect(entry, letters), 'but no longer correct');
  assert.deepEqual(wrongCells(model, letters), [[r, c]]);
});

test('typing walks straight through a word rather than skipping filled squares', () => {
  // The alternative — hopping over letters already placed by a crossing word —
  // is what makes half a typed answer land in the next clue.
  const entry = models[0].entries[0];
  assert.deepEqual(nextCellIn(entry, 0), entry.cells[1]);
  assert.equal(nextCellIn(entry, entry.len - 1), null, 'the end of a word is the end');
});

test('entering a word starts at its first empty square', () => {
  const entry = models[0].entries[0];
  const letters = {};
  const [r0, c0] = entry.cells[0];
  letters[`${r0},${c0}`] = entry.answer[0];
  assert.deepEqual(firstOpenCell(entry, letters), entry.cells[1]);
  assert.deepEqual(firstOpenCell(entry, {}), entry.cells[0]);
});

test('moving between clues wraps round instead of dead-ending', () => {
  const model = models[0];
  const last = model.entries[model.entries.length - 1];
  assert.equal(nextEntry(model, last.id, 1).id, model.entries[0].id);
  assert.equal(nextEntry(model, model.entries[0].id, -1).id, last.id);
});

test('a puzzle is solved only when the whole grid matches', () => {
  const model = models[0];
  const letters = {};
  for (const [r, c] of model.letterCells) letters[`${r},${c}`] = model.grid[r][c];
  assert.ok(isSolved(model, letters));
  const [r, c] = model.letterCells[0];
  delete letters[`${r},${c}`];
  assert.ok(!isSolved(model, letters));
});

// ── The streak ───────────────────────────────────────────────────────────────

test('the streak counts days finished, not puzzles finished', async () => {
  const store = await withLocalStorage();

  store.recordResult(result('flcc-hard-001', 900), '2026-08-19');
  assert.equal(store.currentStreak('2026-08-19').count, 1);

  // A second puzzle the same evening is not a second day.
  store.recordResult(result('flcc-hard-002', 900), '2026-08-19');
  assert.equal(store.currentStreak('2026-08-19').count, 1);

  store.recordResult(result('flcc-hard-003', 900), '2026-08-20');
  assert.equal(store.currentStreak('2026-08-20').count, 2);

  // Skipping the 21st breaks it, and the next finish starts again at one.
  assert.equal(store.currentStreak('2026-08-22').count, 0, 'a stale streak shows as zero');
  store.recordResult(result('flcc-hard-004', 900), '2026-08-22');
  assert.equal(store.currentStreak('2026-08-22').count, 1);
  assert.equal(store.currentStreak('2026-08-22').best, 2, 'the best is kept');
});

test('replaying a puzzle keeps the better score', async () => {
  const store = await withLocalStorage();
  store.recordResult(result('flcc-hard-001', 2400), '2026-08-19');
  store.recordResult(result('flcc-hard-001', 800), '2026-08-20');
  assert.equal(store.resultFor('flcc-hard-001').score, 2400);
  assert.equal(store.resultFor('flcc-hard-001').replays, 1);
});

test('progress survives a reload and is cleared when the puzzle is finished', async () => {
  const store = await withLocalStorage();
  store.saveProgress('flcc-hard-001', { letters: { '0,0': 'E' }, elapsed: 42 });
  assert.deepEqual(store.loadProgress('flcc-hard-001').letters, { '0,0': 'E' });
  store.recordResult(result('flcc-hard-001', 900), '2026-08-19');
  assert.equal(store.loadProgress('flcc-hard-001'), null);
});

// ── The card on the Home tab ─────────────────────────────────────────────────

// The card is inside index.html's single babel block, so it cannot import the
// game's storage module — it re-reads the same key. Two readers of one key is
// exactly the shape that drifts, so both are checked against the same bytes.
const { crosswordStreak, CROSSWORD_KEY } = load('index.html', ['crosswordStreak', 'CROSSWORD_KEY']);

test('the Home card reads the same storage key the game writes', () => {
  const inGame = /const KEY = '([^']+)'/.exec(readRepoFile('bible-crossword/js/storage.js'));
  assert.ok(inGame, 'storage.js must declare its key');
  assert.equal(CROSSWORD_KEY, inGame[1]);
});

test('the Home card shows the streak the game would show', async () => {
  const store = await withLocalStorage();
  const day = new Date(2026, 7, 20, 9, 0, 0);

  assert.equal(crosswordStreak(day), 0, 'nothing played yet');

  store.recordResult(result('flcc-hard-001', 900), '2026-08-19');
  store.recordResult(result('flcc-hard-002', 900), '2026-08-20');
  assert.equal(store.currentStreak('2026-08-20').count, 2);
  assert.equal(crosswordStreak(day), 2, 'the card must agree with the game');

  // Two days later the streak is over, and the card must not still be
  // congratulating anybody for it.
  assert.equal(crosswordStreak(new Date(2026, 7, 22, 9, 0, 0)), 0);
  // The day after is still live — a member who has not played yet today keeps
  // yesterday's count on screen.
  assert.equal(crosswordStreak(new Date(2026, 7, 21, 9, 0, 0)), 2);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function columns(grid) {
  return Array.from({ length: SIZE }, (_, c) => grid.map(row => row[c]).join(''));
}

function result(puzzleId, score) {
  return { puzzleId, category: 'Test', difficulty: 'Hard', score, seconds: 120, hintsUsed: 0, mistakes: 0, answers: 8, date: '2026-08-19' };
}

/** storage.js talks to localStorage directly, which is the point of it. Give
 *  it one, fresh, per test. */
let storeLoads = 0;
async function withLocalStorage() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k),
  };
  // A cache-busting query gives each test its own module instance, so state
  // cannot leak from one to the next.
  return import(`../bible-crossword/js/storage.js?t=${storeLoads++}`);
}
