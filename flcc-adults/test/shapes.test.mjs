// The organic shapes are the app's visual signature, which means two things
// have to be true of them: they must be the same every time (a hero that
// re-rolls its curve on every reload is noise, and no screenshot of this app
// would ever match), and they must be well-formed SVG.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as shapes from '../js/core/shapes.js';

test('the same seed always draws the same shape', () => {
  for (const seed of ['Lamentations 3:22', 'foundations', 42, '']) {
    assert.equal(shapes.blob(seed), shapes.blob(seed), `${seed} is not stable`);
  }
});

test('neighbouring seeds draw different shapes', () => {
  const a = shapes.blob('moment-1');
  const b = shapes.blob('moment-2');
  assert.notEqual(a, b);
  assert.notEqual(shapes.blob(7), shapes.blob(8), 'counters must scatter, not run in step');
});

test('a shape is a closed path of cubic curves', () => {
  const d = shapes.blob('anything', { points: 6 });
  assert.match(d, /^M[\d.-]+ [\d.-]+C/);
  assert.match(d, /Z$/);
  assert.equal(d.match(/C/g).length, 6, 'one curve per point');
  assert.ok(!/NaN|Infinity|undefined/.test(d), d);
});

test('wobble and point count stay inside sane bounds', () => {
  assert.equal(shapes.blob('x', { points: 99 }).match(/C/g).length, 12);
  assert.equal(shapes.blob('x', { points: 1 }).match(/C/g).length, 3);
  assert.ok(shapes.blob('x', { wobble: 99 }).length > 0);
});

test('a field is markup for one layer per tone, and no more', () => {
  const markup = shapes.field('seed', ['forest', 'gold', 'peach']);
  assert.equal(markup.match(/<svg/g).length, 3);
  assert.match(markup, /var\(--forest\)/);
  assert.match(markup, /var\(--gold\)/);
  assert.equal(shapes.field('seed', ['forest', 'gold', 'peach', 'mist']).match(/<svg/g).length, 3,
    'four tones on one block would be the whole palette at once');
  assert.ok(!/on\w+=/.test(markup), 'a decorative field must never carry a handler');
});

test('a mark is one shape, aria-hidden', () => {
  const markup = shapes.mark('cover', 'sage');
  assert.equal(markup.match(/<svg/g).length, 1);
  assert.match(markup, /aria-hidden="true"/);
});
