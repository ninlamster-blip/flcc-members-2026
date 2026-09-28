// Achievements.
//
// A stamp is only worth chasing if it can be earned, and a secret one only
// works if it stays secret until it is.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as stamps from '../js/core/stamps.js';

const list = JSON.parse(readFileSync(new URL('../content/achievements.json', import.meta.url), 'utf8'));

test('every stamp counts something the app records, and ids are unique', () => {
  assert.ok(list.length >= 25, `only ${list.length} stamps`);
  assert.equal(new Set(list.map((row) => row.id)).size, list.length);
  for (const row of list) assert.ok(stamps.KINDS[row.need.kind], `${row.id}: "${row.need.kind}" is not recorded`);
});

test('the numbers come from the right place for each kind', () => {
  const facts = { best: 9, counts: { devotional: 3, memory: 2 }, arcade: { hop: 41, galaga: 1200 } };
  assert.equal(stamps.tally('streak', facts), 9);
  assert.equal(stamps.tally('devotional', facts), 3);
  assert.equal(stamps.tally('hop', facts), 41);
  assert.equal(stamps.tally('galaga', facts), 1200);
  assert.equal(stamps.tally('service', facts), 0, 'nothing recorded counts as nothing');
  assert.equal(stamps.tally('lesson', {}), 0);
});

test('a stamp is earned at its count, not before', () => {
  const row = { need: { kind: 'hop', count: 20 } };
  assert.equal(stamps.earned(row, { arcade: { hop: 19 } }), false);
  assert.equal(stamps.earned(row, { arcade: { hop: 20 } }), true);
  assert.equal(stamps.earned({ need: { kind: 'nonsense', count: 1 } }, { counts: { nonsense: 5 } }), false);
});

test('a hidden stamp keeps its secret until it is earned', () => {
  const row = { title: 'STAR PILOT', how: 'Score 5,000 in Galaga.', symbol: 'rocket', hidden: true, need: { kind: 'galaga', count: 5000 } };
  const locked = stamps.face(row, { arcade: { galaga: 10 } });
  assert.equal(locked.title, '???');
  assert.ok(!locked.how.includes('Galaga'), 'the hint must not give it away');
  assert.equal(locked.symbol, 'question');
  const open = stamps.face(row, { arcade: { galaga: 5000 } });
  assert.deepEqual([open.title, open.symbol, open.has], ['STAR PILOT', 'rocket', true]);
  assert.ok(list.filter((r) => r.hidden).length >= 4, 'a few secrets are what make kids explore');
  assert.ok(list.filter((r) => !r.hidden).length > list.filter((r) => r.hidden).length, 'most stamps say how to earn them');
});
