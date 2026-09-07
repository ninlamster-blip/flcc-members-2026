import test from 'node:test';
import assert from 'node:assert/strict';
import { SIZES, DEFAULT_SIZE, size, nextSize, rootScale, announce } from '../js/core/textsize.js';

test('the sizes only ever go up', () => {
  const scales = SIZES.map((s) => s.scale);
  assert.deepEqual([...scales].sort((a, b) => a - b), scales, 'the steps are out of order');
  assert.equal(scales[0], 100, 'the first step must be the browser\'s own size, untouched');
});

test('every step has a name a person could read aloud', () => {
  for (const s of SIZES) {
    assert.ok(s.id && s.label && Number.isFinite(s.scale), JSON.stringify(s));
  }
  assert.equal(new Set(SIZES.map((s) => s.id)).size, SIZES.length, 'duplicate ids');
});

test('the largest step is a real difference, not a rounding error', () => {
  // Someone who asks for bigger text and gets 4% more has been ignored
  // politely. The top step is half again as large.
  const biggest = SIZES[SIZES.length - 1].scale;
  assert.ok(biggest >= 140, `${biggest}% is not worth reaching for`);
});

test('tapping steps through and comes back round', () => {
  let id = DEFAULT_SIZE;
  const seen = [id];
  for (let i = 0; i < SIZES.length - 1; i++) {
    id = nextSize(id);
    seen.push(id);
  }
  assert.deepEqual(seen, SIZES.map((s) => s.id));
  assert.equal(nextSize(id), DEFAULT_SIZE, 'the last step wraps back to normal');
});

test('a stored value from an older version does not break the button', () => {
  assert.equal(size('enormous').id, SIZES[0].id);
  assert.equal(size(undefined).id, SIZES[0].id);
  assert.equal(nextSize('enormous'), SIZES[0].id, 'an unknown size steps somewhere real');
});

test('the root value is a percentage, so the browser\'s setting still counts', () => {
  // A pixel value here would replace the size the person chose system-wide.
  // A percentage multiplies it.
  for (const s of SIZES) {
    assert.match(rootScale(s.id), /^\d+(\.\d+)?%$/, s.id);
  }
  assert.equal(rootScale('normal'), '100%');
  assert.ok(!rootScale('largest').includes('px'));
});

test('the button says what it is and what it will do', () => {
  const said = announce('normal');
  assert.match(said, /Normal/);
  assert.match(said, /large/i, 'it has to name the size it is about to become');
  assert.match(announce('largest'), /normal/i, 'including when that is wrapping round');
});
