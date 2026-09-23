// Galaga's sounds.
//
// The Web Audio API needs a browser, but the recipes are plain data, so the
// rules that keep the sound pleasant rather than tiring can be held here.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as chiptune from '../js/games/chiptune.js';

const loudest = (recipe) => Math.max(...recipe.map((part) => part.gain));

test('every sound is made of tones and noise the player knows how to play', () => {
  for (const [name, recipe] of Object.entries(chiptune.SOUNDS)) {
    assert.ok(recipe.length > 0, `${name} is empty`);
    for (const part of recipe) {
      assert.ok(part.at >= 0 && part.dur > 0, `${name}: bad timing`);
      assert.ok(part.gain > 0 && part.gain <= 0.25, `${name}: gain ${part.gain} is out of range`);
      if (part.noise) assert.ok(part.cutFrom > 0 && part.cutTo > 0, `${name}: noise needs a filter sweep`);
      else {
        assert.ok(['square', 'triangle', 'sawtooth', 'sine'].includes(part.type), `${name}: ${part.type}`);
        assert.ok(part.from > 0 && part.to > 0, `${name}: a frequency must be above zero to ramp`);
      }
    }
  }
});

test('firing is the quietest sound, because it plays four times a second', () => {
  const fire = loudest(chiptune.SOUNDS.fire);
  for (const [name, recipe] of Object.entries(chiptune.SOUNDS)) {
    if (name !== 'fire') assert.ok(loudest(recipe) > fire, `${name} is no louder than firing`);
  }
  assert.ok(chiptune.length(chiptune.SOUNDS.fire) < 0.26, 'one shot must end before the next is fired');
});

test('nothing lasts longer than a second', () => {
  for (const [name, recipe] of Object.entries(chiptune.SOUNDS)) {
    assert.ok(chiptune.length(recipe) <= 1, `${name} lasts ${chiptune.length(recipe)}s`);
  }
});

test('every engine event worth hearing has a sound', () => {
  for (const event of ['fire', 'dent', 'kill', 'hit', 'cleared', 'life', 'over']) {
    assert.ok(chiptune.SOUNDS[event], `no sound for "${event}"`);
  }
});

test('a frame plays each sound once, however many times it happened', () => {
  assert.deepEqual(chiptune.cue(['kill', 'kill', 'kill', 'fire']), ['fire', 'kill']);
  assert.deepEqual(chiptune.cue(['start', 'wave']), [], 'events with no sound are ignored');
});

test('with no Web Audio at all, the player stays silent rather than throwing', () => {
  const sound = chiptune.player();
  assert.equal(sound.wake(), null);
  assert.doesNotThrow(() => sound.play(['fire', 'kill', 'over']));
  sound.muted = true;
  assert.equal(sound.muted, true);
  assert.doesNotThrow(() => sound.close());
});

test('the sounds have not drifted from the kids edition’s', async () => {
  const { readFileSync } = await import('node:fs');
  const ours = readFileSync(new URL('../js/games/chiptune.js', import.meta.url), 'utf8');
  const theirs = readFileSync(new URL('../../flcc-next/js/games/chiptune.js', import.meta.url), 'utf8');
  const body = (source) => source.slice(source.indexOf('/** Each sound:'));
  assert.equal(body(ours), body(theirs), 'the two chiptune files have diverged — change both');
});
