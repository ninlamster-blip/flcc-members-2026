// The design has rules. A stylesheet with nothing holding it in place drifts,
// and the rules most worth holding are the ones that were arrived at by
// arguing with the reference rather than by copying it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const light = css.slice(0, css.indexOf('prefers-color-scheme: dark'));
const dark = css.slice(css.indexOf('prefers-color-scheme: dark'));

test('nothing in this design is soft', () => {
  // The reference is flat: no gradients, no glass, no glow, no drop shadow.
  // One of those creeping in is how a flat design stops being one.
  for (const soft of ['gradient(', 'backdrop-filter', 'text-shadow', 'filter: blur']) {
    assert.ok(!css.includes(soft), `${soft} does not belong here`);
  }
  const shadows = [...css.matchAll(/box-shadow:\s*([^;]+);/g)].map((m) => m[1].trim());
  for (const value of shadows) {
    assert.match(value, /^inset|^none/, `box-shadow "${value}" is a drop shadow`);
  }
});

test('the paper is warm, and it is painted rather than inherited', () => {
  assert.match(light, /--paper:\s*#FAF6EF/i);
  assert.match(dark, /--paper:\s*#12191F/i);
  assert.match(css, /body\s*\{[^}]*background:\s*var\(--paper\)/);
});

test('the five tones exist in both themes, worst to calm', () => {
  for (const tone of ['calm', 'info', 'watch', 'warning', 'severe']) {
    assert.match(light, new RegExp(`--${tone}:\\s*#[0-9A-Fa-f]{6}`), `--${tone} missing in light`);
    assert.match(dark, new RegExp(`--${tone}:\\s*#[0-9A-Fa-f]{6}`), `--${tone} missing in dark`);
  }
  assert.match(css, /--tone:\s*var\(--calm\)/, 'the page has to start somewhere');
});

test('the tone drives the number, the curve and the disc together', () => {
  // The whole point of tinting: one variable moves the card as a piece. If
  // any of these stops reading --tone, the card starts disagreeing with itself.
  for (const rule of ['.reading-temp', '.sheet-city', '.curve-line', '.sheet-disc', '.curve-area']) {
    const block = css.slice(css.indexOf(rule));
    assert.match(block.slice(0, 260), /var\(--tone\)/, `${rule} does not follow the tone`);
  }
});

test('contrast is not traded away for the reference\'s pastel', () => {
  // The reference draws pale blue on white. This app gets read on a phone in
  // Kuwait in July, so the ink stays near-black and the tones stay dark
  // enough to sit on near-white paper.
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  const sheet = '#FFFDF9';
  assert.ok(contrast('#141C24', sheet) > 12, 'the ink has to carry body text in sunlight');
  for (const [tone, hex] of Object.entries({
    calm: '#2E7D9A', info: '#3B6FA8', watch: '#9C6506', warning: '#B25518', severe: '#A2301D',
  })) {
    assert.match(light, new RegExp(`--${tone}:\\s*${hex}`, 'i'), `--${tone} moved without this test moving`);
    assert.ok(contrast(hex, sheet) >= 4.5, `--${tone} is ${contrast(hex, sheet).toFixed(2)}:1 on the sheet`);
  }
});

test('type is in rem, so a phone\'s own text size still moves it', () => {
  const sizes = [...css.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(sizes.length > 20);
  const exceptions = new Set([
    // iOS Safari zooms the page when a control under 16px takes focus. The
    // element is invisible; this is a browser workaround, not a type size.
    '16px',
  ]);
  for (const size of sizes) {
    if (size.startsWith('clamp(') || size.endsWith('em') || size === 'inherit') continue;
    if (exceptions.has(size)) continue;
    assert.fail(`font-size: ${size} is not relative`);
  }
  assert.equal(sizes.filter((s) => exceptions.has(s)).length, 1, 'only the select carries the iOS workaround');
});

test('the numeral is the biggest thing on the page, and it is light', () => {
  const block = css.slice(css.indexOf('.reading-temp'), css.indexOf('.reading-temp') + 300);
  assert.match(block, /font-weight:\s*200/, 'the reference numeral is hairline, not bold');
  assert.match(block, /clamp\(/, 'it has to shrink on a narrow phone');
  assert.match(block, /tabular-nums/, 'a changing temperature must not shift the layout');
});

test('the corner radius is one number, used everywhere', () => {
  assert.match(css, /--radius:\s*\d+px/);
  assert.match(css, /--radius-sm:\s*\d+px/);
  const literal = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
  for (const value of literal) {
    assert.ok(/var\(--radius|50%|999px|2px|3px/.test(value), `border-radius: ${value} is off the scale`);
  }
});

test('the five dust levels each have their own colour, in one scale', () => {
  for (const level of ['clear', 'hazy', 'dusty', 'heavy', 'storm']) {
    assert.match(css, new RegExp(`--dust-${level}:\\s*#`), `--dust-${level} is missing`);
  }
});

test('motion is optional', () => {
  assert.match(css, /prefers-reduced-motion/, 'the spinner has to be able to stop');
});
