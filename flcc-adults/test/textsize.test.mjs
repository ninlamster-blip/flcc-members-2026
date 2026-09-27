// Adjustable text.
//
// A good part of this congregation is over sixty, and the poster system is set
// in a face that is beautiful and, at 16px on a phone held at arm's length,
// genuinely hard to read. This is the accessibility feature the app most
// needed, so the arithmetic behind it is worth pinning.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/storage.js';
import { TEXT_SIZES, textSize, getSettings, saveSettings, applyTextSize } from '../js/core/profile.js';

const css = readFileSync(new URL('../css/next.css', import.meta.url), 'utf8');

test('there are four sizes and they only go up', () => {
  assert.equal(TEXT_SIZES.length, 4);
  assert.equal(TEXT_SIZES[0].scale, 1, 'the first step must be the size the app was drawn at');
  for (let i = 1; i < TEXT_SIZES.length; i++) {
    assert.ok(TEXT_SIZES[i].scale > TEXT_SIZES[i - 1].scale,
      `${TEXT_SIZES[i].id} is not larger than ${TEXT_SIZES[i - 1].id}`);
  }
  // Big enough to be worth having, not so big the posters fall apart.
  assert.ok(TEXT_SIZES.at(-1).scale >= 1.4 && TEXT_SIZES.at(-1).scale <= 1.75);
  for (const size of TEXT_SIZES) {
    assert.ok(size.label && size.line, `${size.id} has no label or no explanation`);
  }
});

test('the default is the size the app was drawn at', () => {
  store.wipe();
  assert.equal(getSettings().text, 'standard');
  assert.equal(textSize().scale, 1);
});

test('a chosen size is remembered, and nonsense falls back', () => {
  store.wipe();
  saveSettings({ text: 'larger' });
  assert.equal(textSize().id, 'larger');
  saveSettings({ text: 'enormous' });
  assert.equal(textSize().id, 'standard', 'an unknown size must not leave the app unstyled');
  store.wipe();
});

/**
 * The scale multiplies the reader's own browser default rather than replacing
 * it. Somebody who has already turned text up on their phone should get that,
 * times this — `font-size: 20px` would have quietly overridden their setting
 * and made the app *smaller* for the readers who need it most.
 */
test('the stylesheet multiplies the reader’s own default rather than replacing it', () => {
  const rule = css.match(/html \{[^}]+\}/);
  assert.ok(rule, 'html has no rule');
  assert.match(rule[0], /font-size:\s*calc\(100% \* var\(--text-scale, 1\)\)/,
    'the text scale no longer builds on the browser’s own font size');
});

test('the whole type scale is in rem, so one number moves all of it', () => {
  const root = css.match(/:root \{[\s\S]*?\n\}/)[0];
  for (const token of ['--label', '--body', '--lead', '--headline', '--display', '--numeral']) {
    const line = root.match(new RegExp(`${token}:\\s*([^;]+);`));
    assert.ok(line, `${token} is missing`);
    assert.match(line[1], /rem/, `${token} is not in rem, so the text size setting cannot move it`);
    assert.equal(/\d+px/.test(line[1]), false, `${token} is pinned in px`);
  }
});

/**
 * The drawing does not scale with the type.
 *
 * A 3px outline at 150% is a 4.5px outline, and the whole system is one
 * weight. These three stay in px on purpose.
 */
test('the outline, the radius and the track do not grow with the text', () => {
  const root = css.match(/:root \{[\s\S]*?\n\}/)[0];
  assert.match(root, /--edge:\s*3px/);
  assert.match(root, /--radius:\s*10px/);
  assert.match(css, /\.track \{[^}]*height: 14px/);
});

test('applying a size is safe with no document at all', () => {
  // Node has no `document`; the function is called at boot and must not throw
  // in a test run or in any other non-browser context.
  store.wipe();
  assert.doesNotThrow(() => applyTextSize());
  assert.equal(applyTextSize({ text: 'largest' }).id, 'largest');
});

// Three things the largest setting broke on a real phone width, each pinned so
// it cannot come back: a headline word split mid-word (FOUNDATION / S, and
// even Tod / ay in a half-width figure), the fifth tab pushed off the edge, and
// a poster's actions pushed off the side.

test('a headline word is sized to fit its poster, not split mid-word', () => {
  const ui = readFileSync(new URL('../js/core/ui.js', import.meta.url), 'utf8');
  assert.match(css.match(/^\.poster \{[^}]+\}/m)[0], /container-type:\s*inline-size/,
    'the poster must be a size container, or cqi measures the window');
  for (const name of ['display', 'headline']) {
    assert.match(css.match(new RegExp(`^\\.${name} \\{[^}]+\\}`, 'm'))[0], /--fit-size/,
      `.${name} is no longer capped to fit its longest word`);
  }
  assert.match(css, /--fit-size:\s*calc\(100cqi/);
  assert.match(ui, /export function display\(text\) \{ return fit\(/);
  assert.match(ui, /export function headline\([^)]*\) \{ return fit\(/);
});

test('the tab bar keeps all five tabs on screen at every size', () => {
  assert.match(css.match(/^\.tabs \{[^}]+\}/m)[0], /grid-auto-columns:\s*minmax\(0, 1fr\)/,
    'a plain 1fr column cannot shrink below its label, so COMMUNITY pushed YOU off the edge');
  assert.match(css.match(/^\.tab \{[^}]+\}/m)[0], /font-size:\s*min\([^)]*vw\)/,
    'the tab label must be capped to what fits a fifth of the screen');
});

test('a poster foot wraps rather than pushing its actions off the side', () => {
  assert.match(css.match(/^\.poster-foot \{[^}]+\}/m)[0], /flex-wrap:\s*wrap/);
});
