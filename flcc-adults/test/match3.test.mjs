// Match three.
//
// The rules are pure functions precisely so this suite can exist: a board that
// deadlocks, a cascade that leaves a hole in a column, or a swap that clears
// two tiles are all things nobody would notice by playing for a minute and
// everybody would notice on a bus.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../js/games/match3.js';

const grid = (rows) => rows.map((row) => [...row].map((ch) => (ch === '.' ? null : ch)));
const next = () => game.seeded(7);

test('the pieces are tones this app can actually paint', () => {
  assert.deepEqual(game.KINDS, ['sunshine', 'rose', 'sky', 'captain', 'poppy']);
});

test('three in a row is a match, two is not', () => {
  assert.equal(game.matches(grid(['aab', 'bba', 'aba'])).size, 0);
  assert.deepEqual([...game.matches(grid(['aaa', 'bba', 'bab']))].sort(), ['0,0', '0,1', '0,2']);
  assert.deepEqual([...game.matches(grid(['abb', 'aba', 'aab']))].sort(), ['0,0', '1,0', '2,0']);
});

test('a run of five is one match, not two overlapping threes', () => {
  const found = game.matches(grid(['aaaaa', 'bcbcb', 'cbcbc', 'bcbcb', 'cbcbc']));
  assert.equal(found.size, 5);
});

test('a cross counts both arms, and the centre only once', () => {
  //  b a b     the middle row and the middle column are both runs of three,
  //  a a a     so five tiles clear and the shared centre is not double-counted.
  //  b a b
  const found = game.matches(grid(['bab', 'aaa', 'bab']));
  assert.deepEqual([...found].sort(), ['0,1', '1,0', '1,1', '1,2', '2,1']);
});

test('a column falls into the hole and is refilled from the top', () => {
  const board = grid(['abc', 'def', 'ghi']);
  const out = game.collapse(board, ['2,0'], next());
  assert.equal(out[2][0], 'd', 'the tile above did not fall');
  assert.equal(out[1][0], 'a', 'the tile above that did not fall');
  assert.ok(game.KINDS.includes(out[0][0]), 'the top was not refilled from the palette');
  // Nothing else moved.
  assert.deepEqual(out.map((row) => row.slice(1)), [['b', 'c'], ['e', 'f'], ['h', 'i']]);
});

test('a board never comes back with a hole in it', () => {
  const roll = next();
  let board = game.newBoard(8, roll);
  for (let i = 0; i < 40; i++) {
    board = game.collapse(board, [`${i % 8},${(i * 3) % 8}`], roll);
    assert.equal(board.flat().some((cell) => cell === null || cell === undefined), false,
      `a hole appeared after ${i + 1} collapses`);
  }
});

test('a new board is not already solving itself, and has a move on it', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const board = game.newBoard(8, game.seeded(seed));
    assert.equal(game.matches(board).size, 0, `seed ${seed} starts with a match already on the board`);
    assert.equal(game.hasMove(board), true, `seed ${seed} starts deadlocked`);
    assert.equal(board.length, 8);
    assert.ok(board.every((row) => row.length === 8));
  }
});

test('only neighbours can be swapped', () => {
  assert.equal(game.adjacent({ r: 1, c: 1 }, { r: 1, c: 2 }), true);
  assert.equal(game.adjacent({ r: 1, c: 1 }, { r: 2, c: 1 }), true);
  assert.equal(game.adjacent({ r: 1, c: 1 }, { r: 2, c: 2 }), false, 'a diagonal is not a neighbour');
  assert.equal(game.adjacent({ r: 1, c: 1 }, { r: 1, c: 1 }), false);
  assert.equal(game.adjacent({ r: 0, c: 0 }, { r: 0, c: 3 }), false);
});

/**
 * A swap that matches nothing is refused, not played and undone.
 *
 * The genre's convention is to animate the swap and snap it back, spending a
 * move on the player's misread. This app has no reason to do that, and the
 * board must come back untouched.
 */
test('a swap that matches nothing leaves the board exactly as it was', () => {
  const board = grid(['abcab', 'bcabc', 'cabca', 'abcab', 'bcabc']);
  const result = game.play(board, { r: 0, c: 0 }, { r: 0, c: 1 }, next());
  assert.equal(result.ok, false);
  assert.equal(result.cleared, 0);
  assert.deepEqual(result.board, board);
});

test('a swap that matches clears, cascades, and hands back every step', () => {
  //  a b a        swapping (1,0)b with (1,1)a makes column 0 read a a a
  const board = grid(['aba', 'baa', 'aba']);
  const result = game.play(board, { r: 1, c: 0 }, { r: 1, c: 1 }, next());
  assert.equal(result.ok, true);
  assert.ok(result.cleared >= 3);
  assert.ok(result.steps.length >= 1, 'the screen needs the steps to animate the fall');
  assert.equal(result.steps[0].cascade, 1);
  assert.equal(result.board.flat().every((cell) => cell !== null), true);
});

test('a played board is still a legal board', () => {
  const roll = game.seeded(99);
  let board = game.newBoard(8, roll);
  let played = 0;
  for (let turn = 0; turn < 60 && played < 30; turn++) {
    let moved = false;
    outer:
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
      if (r + dr > 7 || c + dc > 7) continue;
      const result = game.play(board, { r, c }, { r: r + dr, c: c + dc }, roll);
      if (!result.ok) continue;
      board = result.board;
      played += 1;
      moved = true;
      break outer;
    }
    if (!moved) board = game.newBoard(8, roll);
    assert.equal(game.matches(board).size, 0, 'a match was left sitting on the board after a turn');
    assert.equal(board.flat().every((cell) => game.KINDS.includes(cell)), true, 'a tile is not a real piece');
  }
  assert.ok(played >= 20, `only ${played} legal moves found in 60 turns — the board deadlocks too easily`);
});

test('the same seed replays exactly', () => {
  const a = game.newBoard(6, game.seeded(5));
  const b = game.newBoard(6, game.seeded(5));
  assert.deepEqual(a, b);
  assert.notDeepEqual(game.newBoard(6, game.seeded(6)), a);
});
