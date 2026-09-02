// The illustrations.
//
// One language, and it is the kids and teens edition's language: flat shapes
// on a 100×100 grid, one navy outline at one weight, a single fill from the
// palette. These tests are mostly here to stop a second style creeping in one
// drawing at a time.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as art from '../js/core/art.js';

test('the set is complete and every symbol draws', () => {
  assert.ok(art.ICONS.length >= 10, `only ${art.ICONS.length} symbols`);
  for (const name of art.ICONS) {
    assert.equal(art.isIcon(name), true, `${name} is listed but not drawn`);
    const svg = art.symbol(name, { fill: '#FBF8F0' });
    assert.match(svg, /^<svg viewBox="0 0 100 100"/, name);
    assert.match(svg, /<\/svg>$/, name);
    assert.match(svg, /aria-hidden="true"/, `${name} must be decorative unless titled`);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name} has a broken number in it`);
    assert.ok(!/on[a-z]+=/.test(svg), `${name} carries a handler`);
  }
});

test('every symbol is one navy outline at one weight', () => {
  for (const name of art.ICONS) {
    const svg = art.symbol(name, { fill: '#FBF8F0' });
    const strokes = [...new Set([...svg.matchAll(/stroke="([^"]+)"/g)].map(([, v]) => v))];
    assert.deepEqual(strokes, ['#2B4C6D'], `${name} draws in ${strokes.join(', ')} — the outline is always navy`);
    const widths = [...new Set([...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(([, w]) => Number(w)))];
    assert.deepEqual(widths, [5.5], `${name}: ${widths.join(', ')} — one weight, everywhere`);
  }
});

test('a symbol takes the poster’s fill, and only one', () => {
  for (const name of art.ICONS) {
    const svg = art.symbol(name, { fill: '#EDCE7A' });
    const fills = [...new Set([...svg.matchAll(/fill="([^"]+)"/g)].map(([, v]) => v))]
      .filter((one) => one !== 'none');
    assert.ok(fills.length <= 1, `${name} uses ${fills.length} fills — a symbol takes one colour and no more`);
    if (fills.length) assert.equal(fills[0], '#EDCE7A', `${name} ignores the fill it was given`);
  }
});

test('a poster’s fill is the paper, and inverts on the dark tones', () => {
  assert.equal(art.fillFor('sunshine'), '#FBF8F0');
  assert.equal(art.fillFor('paper'), '#FBF8F0');
  // On a dark poster the stylesheet flips the outline to paper, so the fill
  // stays dark and the drawing reads as a white line drawing.
  assert.equal(art.fillFor('ink'), '#2B4C6D');
  assert.equal(art.fillFor('captain'), '#2B4C6D');
});

test('an unknown symbol draws something rather than nothing', () => {
  const svg = art.symbol('not-a-symbol');
  assert.match(svg, /^<svg/);
  assert.ok(svg.length > 120, 'a typo in the content must be a wrong picture, never a hole');
  assert.equal(art.isIcon('not-a-symbol'), false);
});

test('a symbol chosen for an item is stable, never random', () => {
  assert.equal(art.pick('foundations'), art.pick('foundations'));
  assert.ok(art.ICONS.includes(art.pick('anything at all')));
  assert.notEqual(art.pick('a'), art.pick('b'));
});

test('tones rotate deterministically', () => {
  assert.deepEqual(art.TONES, ['sunshine', 'rose', 'sky', 'captain']);
  assert.equal(art.toneFor(0), art.toneFor(4));
  assert.notEqual(art.toneFor(0), art.toneFor(1));
});

/**
 * The drawings shared with the kids and teens edition are the SAME drawings.
 *
 * The two apps share no code, so the only thing keeping the two illustration
 * sets from drifting apart is this: the path data for a symbol that exists in
 * both is compared character for character. Redraw `book` in one app and this
 * fails until it is redrawn in the other.
 *
 * Reading the other app's source in a test is not the runtime boundary the
 * modules suite enforces — nothing here ships to a browser, and no module in
 * this app imports anything from `flcc-next/` except the text of Scripture.
 */
test('the symbols shared with the kids edition are identical, not merely similar', () => {
  const theirs = readFileSync(new URL('../../flcc-next/js/core/art.js', import.meta.url), 'utf8');
  const ours = readFileSync(new URL('../js/core/art.js', import.meta.url), 'utf8');

  // The stroke is the one line both files build every shape from.
  const stroke = /stroke="#2B4C6D" stroke-width="5\.5" stroke-linejoin="round" stroke-linecap="round"/;
  assert.match(theirs, stroke, 'the kids edition changed its outline');
  assert.match(ours, stroke, 'this edition changed its outline');

  const pathsIn = (source, name) => {
    const at = source.indexOf(`\n  ${name}: (f) => [`);
    assert.notEqual(at, -1, `${name} is missing`);
    const body = source.slice(at, source.indexOf('\n  ],', at));
    return [...body.matchAll(/'([^']+)'/g)].map(([, d]) => d).join('|');
  };

  // `sprout` and `sun` are this edition's names for the kids edition's `plant`
  // and `sunrise` — the adult content files were written against those names.
  for (const [mine, theirName] of [['book', 'book'], ['heart', 'heart'], ['mountain', 'mountain'],
                                   ['star', 'star'], ['sprout', 'plant'], ['sun', 'sunrise'],
                                   ['flame', 'light']]) {
    assert.equal(pathsIn(ours, mine), pathsIn(theirs, theirName),
      `${mine} has drifted from the kids edition's ${theirName}`);
  }
});
