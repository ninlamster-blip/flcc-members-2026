// The characters.
//
// They are the personality of this app, and they are also the thing most
// likely to rot quietly: a mascot named in content that nobody drew, a face
// that drifts off a body, a set that stops looking like a set. All of that is
// checked here rather than by opening twelve screens.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as art from '../js/core/art.js';

test('the set is complete and every character draws', () => {
  assert.ok(art.MASCOTS.length >= 10, `only ${art.MASCOTS.length} characters`);
  for (const name of art.MASCOTS) {
    assert.equal(art.isMascot(name), true, `${name} is listed but not drawn`);
    const svg = art.mascot(name, 'yellow');
    assert.match(svg, /^<svg class="mascot" viewBox="0 0 100 100"/, name);
    assert.match(svg, /<\/svg>$/, name);
    assert.match(svg, /aria-hidden="true"/, `${name} must be decorative`);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${name} has a broken number in it`);
    assert.ok(!/on[a-z]+=/.test(svg), `${name} carries a handler`);
  }
});

test('every character wears the fill it is given, and the same navy ink', () => {
  for (const name of art.MASCOTS) {
    const svg = art.mascot(name, 'sky');
    assert.match(svg, /var\(--sky\)/, `${name} ignores its fill`);
    assert.match(svg, /var\(--ink\)/, `${name} is not outlined in ink`);
    assert.ok(!/#[0-9a-f]{3,6}/i.test(svg), `${name} hard-codes a colour`);
  }
});

test('every character has a face', () => {
  for (const name of art.MASCOTS) {
    const svg = art.mascot(name, 'cream');
    const eyes = (svg.match(/<circle[^>]*r="[\d.]+" fill="var\(--ink\)"/g) || []).length;
    assert.ok(eyes >= 2, `${name} has ${eyes} eyes`);
    assert.match(svg, /q[\d.]+ [\d.]+ [\d.-]+ 0/, `${name} has no smile`);
  }
});

test('every body is outlined at the same weight', () => {
  // The body outline is 5 everywhere — that single number is most of what
  // makes twelve separate drawings read as one set. Details inside a body,
  // and the smile, are lighter and scale with the face, so the rule is a
  // floor and a ceiling rather than one value.
  for (const name of art.MASCOTS) {
    const svg = art.mascot(name, 'cream');
    const weights = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(([, w]) => Number(w));
    assert.ok(weights.includes(5), `${name} has no 5px body outline`);
    assert.ok(weights.every((w) => w >= 2 && w <= 5), `${name}: ${weights.join(', ')}`);
  }
});

test('an unknown character draws something rather than nothing', () => {
  const svg = art.mascot('not-a-mascot', 'cream');
  assert.match(svg, /^<svg/);
  assert.ok(svg.length > 200, 'a typo in the content must be a wrong picture, never a hole');
  assert.equal(art.isMascot('not-a-mascot'), false);
});

test('a character chosen for an item is stable, never random', () => {
  assert.equal(art.pick('foundations'), art.pick('foundations'));
  assert.ok(art.MASCOTS.includes(art.pick('anything at all')));
  assert.notEqual(art.pick('a'), art.pick('b'));
});

test('the star row fills what it is told to and no more', () => {
  const three = art.stars(3);
  assert.equal((three.match(/<path/g) || []).length, 5);
  assert.equal((three.match(/data-on/g) || []).length, 3);
  assert.match(three, /aria-label="3 of 5"/);
  assert.equal((art.stars(9).match(/data-on/g) || []).length, 5, 'a count over five is clamped');
  assert.equal((art.stars(-2).match(/data-on/g) || []).length, 0);
  // The fill belongs to the stylesheet: a star has to change colour depending
  // on the band it sits on, and only CSS knows what that is.
  assert.equal(/fill="var\(--star\)"/.test(three), false, 'the star fill is hard-coded again');
});
