// Play together, on one phone.
//
// Turns go round in order, everyone gets the same number of questions, a
// draw is shared, and a name typed twice does not become one player.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as party from '../js/core/party.js';

const questions = (n) => Array.from({ length: n }, (_, i) => ({ q: `Q${i}` }));

test('names are cleaned, short, never empty, never the same twice', () => {
  assert.deepEqual(party.names(['  Sam ', '', 'Ana', 'Sam', null]), ['Sam', 'Ana', 'Sam 2']);
  assert.equal(party.names(['A very very long name indeed'])[0].length, party.NAME_LENGTH);
  assert.equal(party.names(['a', 'b', 'c', 'd', 'e']).length, party.MAX_PLAYERS);
});

test('it needs two players to start', () => {
  assert.throws(() => party.create(['Sam'], questions(10)));
  assert.throws(() => party.create(['Sam', ''], questions(10)));
});

test('turns go round in order and everyone gets the same number of questions', () => {
  const game = party.create(['Sam', 'Ana', 'Jo'], questions(20));
  assert.equal(game.questions.length, 15, 'five each for three players');
  const order = [];
  while (party.current(game)) { order.push(party.current(game).player.name); party.answer(game, true); }
  assert.deepEqual(order.slice(0, 6), ['Sam', 'Ana', 'Jo', 'Sam', 'Ana', 'Jo']);
  assert.ok(game.players.every((p) => p.score === 5));
  assert.equal(party.current(game), null, 'the round ends');
});

test('a short bank still gives everyone an equal share', () => {
  const game = party.create(['Sam', 'Ana', 'Jo'], questions(7));
  assert.equal(game.questions.length, 6);
});

test('the winner is the top score, and a draw is shared', () => {
  const game = party.create(['Sam', 'Ana'], questions(10));
  const plan = [true, false, true, true, false, true, true, false, true, false]; // Sam 4, Ana 2
  for (const right of plan) party.answer(game, right);
  const result = party.standings(game);
  assert.deepEqual(result.winners.map((p) => p.name), ['Sam']);
  assert.equal(result.outOf, 5);

  const tie = party.create(['Sam', 'Ana'], questions(4));
  for (const right of [true, true, false, false]) party.answer(tie, right);
  assert.deepEqual(party.standings(tie).winners.map((p) => p.name), ['Sam', 'Ana']);
});
