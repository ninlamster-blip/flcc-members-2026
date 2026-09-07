import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const light = css.slice(0, css.indexOf('prefers-color-scheme: dark'));
const dark = css.slice(css.indexOf('prefers-color-scheme: dark'));

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('nothing in this design is soft', () => {
  for (const soft of ['gradient(', 'backdrop-filter', 'text-shadow', 'filter: blur']) {
    assert.ok(!css.includes(soft), `${soft} does not belong here`);
  }
});

test('every tone carries text on the sheet at AA', () => {
  const sheet = '#FFFFFC';
  assert.ok(contrast('#12201F', sheet) > 12, 'the ink has to carry body text');
  for (const [tone, hex] of Object.entries({
    calm: '#217C74', info: '#2F6FA6', watch: '#9C6506', warning: '#B25518', severe: '#A2301D',
  })) {
    assert.match(light, new RegExp(`--${tone}:\\s*${hex}`, 'i'), `--${tone} moved without this test`);
    assert.ok(contrast(hex, sheet) >= 4.5, `--${tone} is ${contrast(hex, sheet).toFixed(2)}:1`);
  }
});

test('the PAGASA warning colours are legible, not just evocative', () => {
  // They have to be recognisable as yellow, orange and red *and* readable as
  // text and thin chart rules. That is why they are darkened.
  const sheet = '#FFFFFC';
  for (const [name, hex] of Object.entries({
    yellow: '#9C6D04', orange: '#C0561A', red: '#A6291C',
  })) {
    assert.match(light, new RegExp(`--pagasa-${name}:\\s*${hex}`, 'i'));
    assert.ok(contrast(hex, sheet) >= 4.0, `--pagasa-${name} is ${contrast(hex, sheet).toFixed(2)}:1`);
    assert.match(dark, new RegExp(`--pagasa-${name}:`), `--pagasa-${name} has no dark value`);
  }
});

test('the type scale has a floor, and nothing goes under it', () => {
  assert.match(css, /--t-xs:\s*0\.8rem/);
  for (const [, value] of css.matchAll(/font-size:\s*(\d*\.?\d+)rem;/g)) {
    assert.ok(Number(value) >= 0.8, `font-size: ${value}rem is under the floor`);
  }
});

test('the browser\'s own text size is respected, not overridden', () => {
  assert.match(css, /html\s*\{[^}]*font-size:\s*var\(--text-scale,\s*100%\)/);
  const body = css.slice(css.indexOf('body {'), css.indexOf('body {') + 400);
  assert.ok(!/font:[^;]*\d+px/.test(body), 'body must not hardcode a pixel type size');
});

test('type is relative, so one number moves all of it', () => {
  const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
  for (const size of sizes) {
    if (size.startsWith('clamp(') || size.startsWith('var(')) continue;
    if (size.endsWith('em') || size.endsWith('%') || size === 'inherit') continue;
    // 16px on the invisible select stops iOS zooming on focus. That is the
    // only exception; the chart's own labels are HTML on the type scale.
    if (size === '16px') continue;
    assert.fail(`font-size: ${size} is not relative`);
  }
});

test('touch targets hold still while the type grows', () => {
  assert.match(css, /--control:\s*(\d+)px/);
  assert.ok(Number(css.match(/--control:\s*(\d+)px/)[1]) >= 44);
  const round = css.slice(css.indexOf('.round {'), css.indexOf('.round {') + 300);
  assert.match(round, /width:\s*var\(--control\)/);
});

test('the big numeral cannot be scaled off the card', () => {
  const block = css.slice(css.indexOf('.reading-temp'), css.indexOf('.reading-temp') + 460);
  assert.match(block, /clamp\(\s*min\(/, 'the clamp floor must be capped against the viewport');
  assert.match(block, /tabular-nums/);
});

test('the tone drives the card as one piece', () => {
  for (const rule of ['.reading-temp', '.sheet-city', '.curve-line', '.sheet-disc']) {
    assert.match(css.slice(css.indexOf(rule)).slice(0, 260), /var\(--tone\)/, `${rule} does not follow the tone`);
  }
});

test('motion is optional', () => {
  assert.match(css, /prefers-reduced-motion/);
});
