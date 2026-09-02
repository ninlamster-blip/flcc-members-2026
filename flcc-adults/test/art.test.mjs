// The icons.
//
// This set replaced twelve cartoon characters with faces. The tests below are
// mostly there to stop them coming back: an icon in this app is a thin
// monoline drawing that takes the colour of the text beside it, and the
// moment one of them grows two dots and a smile the app is a toy again.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as art from '../js/core/art.js';

test('the set is complete and every icon draws', () => {
  assert.ok(art.ICONS.length >= 10, `only ${art.ICONS.length} icons`);
  for (const name of art.ICONS) {
    assert.equal(art.isIcon(name), true, `${name} is listed but not drawn`);
    const svg = art.icon(name);
    assert.match(svg, /^<svg class="icon" viewBox="0 0 48 48"/, name);
    assert.match(svg, /<\/svg>$/, name);
    assert.match(svg, /aria-hidden="true"/, `${name} must be decorative`);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name} has a broken number in it`);
    assert.ok(!/on[a-z]+=/.test(svg), `${name} carries a handler`);
  }
});

test('no icon has a face', () => {
  // A face is two small circles and an arc. None of those primitives belong in
  // this set at all, so the test is simply that they are absent.
  for (const name of art.ICONS) {
    const svg = art.icon(name);
    assert.equal(/<circle/.test(svg), false, `${name} has a circle — is that an eye?`);
    assert.equal(/<ellipse/.test(svg), false, `${name} has an ellipse`);
    assert.equal(/\bq[\d.]+ [\d.]+ [\d.-]+ 0\b/.test(svg), false, `${name} has a smile in it`);
  }
});

test('every icon is one thin stroke and no fill', () => {
  for (const name of art.ICONS) {
    const svg = art.icon(name);
    assert.match(svg, /fill="none"/, `${name} is filled`);
    assert.match(svg, /stroke="currentColor"/, `${name} carries its own colour`);
    const weights = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(([, w]) => Number(w));
    assert.deepEqual([...new Set(weights)], [1.6], `${name}: ${weights.join(", ")}`);
    assert.equal(/fill="(?!none)[^"]+"/.test(svg), false, `${name} has a filled shape`);
    assert.equal(/#[0-9a-f]{3,6}|var\(--/i.test(svg), false, `${name} hard-codes a colour`);
  }
});

test('an unknown icon draws something rather than nothing', () => {
  const svg = art.icon('not-an-icon');
  assert.match(svg, /^<svg/);
  assert.ok(svg.length > 120, 'a typo in the content must be a wrong picture, never a hole');
  assert.equal(art.isIcon('not-an-icon'), false);
});

test('an icon chosen for an item is stable, never random', () => {
  assert.equal(art.pick('foundations'), art.pick('foundations'));
  assert.ok(art.ICONS.includes(art.pick('anything at all')));
  assert.notEqual(art.pick('a'), art.pick('b'));
});
