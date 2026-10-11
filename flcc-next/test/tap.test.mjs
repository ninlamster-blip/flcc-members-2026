// TAP SOUNDS — on by default, off when switched off, quiet during a game.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../js/core/storage.js';
import * as tap from '../js/core/tap.js';

const played = { tones: 0, buzz: [] };
class FakeAudio {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  createOscillator() { played.tones += 1; return { type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (g) => g, start() {}, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({}) }; }
}
globalThis.AudioContext = FakeAudio;
Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (ms) => played.buzz.push(ms) }, configurable: true });

const reset = () => { played.tones = 0; played.buzz = []; };

test('tap sounds are on until someone turns them off', () => {
  store.wipe();
  assert.equal(tap.enabled(), true);
  reset();
  tap.feel();
  assert.equal(played.tones, 1, 'a tick');
  assert.deepEqual(played.buzz, [8], 'and a buzz short enough to feel like a tap, not an alert');
});

test('switched off, a press makes no sound and no buzz', () => {
  store.wipe();
  tap.setEnabled(false);
  reset();
  tap.feel();
  assert.equal(played.tones, 0);
  assert.deepEqual(played.buzz, []);
  tap.setEnabled(true);
  assert.equal(tap.enabled(), true);
});

test('only things a person presses make a tap, and never during an arcade game', () => {
  const el = (pressable, extra = {}) => ({ disabled: false, getAttribute: () => null, ...extra });
  const target = (hit) => ({ closest: () => hit });
  const body = (arcade) => ({ hasAttribute: (name) => arcade && name === 'data-arcade' });
  assert.equal(tap.pressable(target(el()), body(false)), true, 'a button');
  assert.equal(tap.pressable(target(null), body(false)), false, 'plain text');
  assert.equal(tap.pressable(target(el(true, { disabled: true })), body(false)), false, 'a disabled button');
  assert.equal(tap.pressable(target(el()), body(true)), false, 'Galaga and Hop Across have their own sounds');
});

test('a phone with no Web Audio and no vibration still works', () => {
  store.wipe();
  const saved = globalThis.AudioContext;
  delete globalThis.AudioContext;
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  assert.doesNotThrow(() => tap.feel());
  globalThis.AudioContext = saved;
  Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (ms) => played.buzz.push(ms) }, configurable: true });
});
