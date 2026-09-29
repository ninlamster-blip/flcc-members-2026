// LEAVING A SCREEN.
//
// Two bugs with one shape: something a screen started kept going after the
// reader left it. The Speed quiz's sixty-second clock ran on, finished the
// round a minute later on whatever screen was open, and awarded XP for it.
// And a "Round complete" card stayed on top of every screen after Back, eating
// taps until its button was pressed — which then sent the reader elsewhere.
// These read the source, because the tests have no browser; the behaviour was
// checked in one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the quiz clock stops once the game is no longer on the page', () => {
  const game = read('../js/screens/game.js');
  const ticker = game.slice(game.indexOf('ticker = setInterval('), game.indexOf('ticker = setInterval(') + 300);
  assert.match(ticker, /if \(!block\.isConnected\) \{ stop\(\); return; \}/);
  const advances = game.match(/setTimeout\(\(\) => \{[^}]*index \+= 1; draw\(\); \}/g) || [];
  assert.ok(advances.length >= 3);
  for (const one of advances) assert.match(one, /!block\.isConnected/, 'an answer advancing a game nobody is playing');
});

test('a celebration card comes down when the reader leaves, without running its button', () => {
  const ui = read('../js/core/ui.js');
  const moment = ui.slice(ui.indexOf('export function moment('), ui.indexOf('export function moment(') + 2000);
  assert.match(moment, /addEventListener\('hashchange', left\)/);
  assert.match(moment, /const left = \(\) => dismiss\(false\)/);
  assert.match(moment, /if \(answered && onclose\) onclose\(\)/);
});
