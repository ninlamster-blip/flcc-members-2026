// The illustrations are two plates — a flat colour shape and the linework
// over it. These are the rules that keep the set one set.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { art, ART_NAMES, TONES } from '../js/ui/art.js';
import { icon as codeIcon, label } from '../js/core/weathercode.js';

const source = readFileSync(new URL('../js/ui/art.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('every illustration has both plates', () => {
  for (const name of ART_NAMES) {
    const svg = art(name);
    assert.match(svg, /class="art-flat"/, `${name} has no colour plate`);
    assert.match(svg, /class="art-ink"/, `${name} has no linework`);
    assert.ok(svg.includes('<path') || svg.includes('<circle'), name);
  }
});

test('every weather code the forecast can return has a drawing', () => {
  // The codes Open-Meteo publishes, day and night. A gap here is a blank
  // square on the hourly strip.
  const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
    71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
  for (const code of codes) {
    for (const isDay of [true, false]) {
      const name = codeIcon(code, isDay);
      assert.ok(ART_NAMES.includes(name), `code ${code} (${label(code)}) wants "${name}", which is not drawn`);
    }
  }
});

test('an unknown name falls back to a drawing rather than an empty box', () => {
  const svg = art('nonsense-that-is-not-weather');
  assert.match(svg, /class="art-ink"/);
  assert.match(svg, /<svg/);
});

test('every tone a drawing asks for has a colour defined for it', () => {
  for (const tone of TONES) {
    assert.ok(css.includes(`--flat-${tone}:`), `--flat-${tone} is used but never defined`);
  }
});

test('the flat plate is defined in both light and dark', () => {
  const dark = css.slice(css.indexOf('prefers-color-scheme: dark'));
  for (const tone of TONES) {
    assert.ok(dark.includes(`--flat-${tone}:`), `--flat-${tone} has no dark value and will glare`);
  }
});

test('the linework is one weight across the whole set', () => {
  // Different stroke weights between icons is the fastest way to make a set
  // stop looking like a set.
  const weights = new Set([...source.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => m[1]));
  assert.equal(weights.size, 1, `found stroke weights: ${[...weights].join(', ')}`);
});

test('the linework takes the page ink, and only the flat plate is coloured', () => {
  assert.match(art('sun'), /stroke="currentColor"/);
  assert.match(art('sun'), /fill="var\(--flat-sun\)"/);
  // No hardcoded colours anywhere — dark mode has to be able to move them.
  const hex = source.match(/#[0-9a-fA-F]{3,6}/g);
  assert.equal(hex, null, `hardcoded colours in the art: ${hex}`);
});

test('nothing in the set is soft — no gradient, blur, shadow or opacity drift', () => {
  for (const banned of ['linearGradient', 'radialGradient', 'filter', 'feGaussian', 'box-shadow']) {
    assert.ok(!source.includes(banned), `${banned} does not belong in flat art`);
  }
});

test('the drawings are decoration, not content, for a screen reader', () => {
  assert.match(art('rain'), /aria-hidden="true"/);
  assert.match(art('rain'), /focusable="false"/);
});

test('size is honoured, and the grid never changes', () => {
  assert.match(art('sun', { size: 30 }), /width="30" height="30"/);
  for (const name of ART_NAMES) {
    assert.match(art(name), /viewBox="0 0 64 64"/, `${name} is drawn on a different grid`);
  }
});
