// The two editions are one design.
//
// This app and `flcc-next/` are drawn in the same system on purpose: the same
// cream paper, the same navy ink, the same 3px outline, the same enormous
// headlines, the same pills and tracks. They share no code, so the two
// stylesheets are deliberate duplicates — and a duplicate with nothing holding
// it in place drifts. Somebody widens a radius here, softens a weight there,
// and six months later the two apps are cousins instead of editions.
//
// So this suite reads BOTH stylesheets and fails when the pieces that make
// them one design stop matching. It is the only test in this app that looks at
// the other one, and it is a build-time read of a stylesheet: no module here
// imports anything from `flcc-next/` except the text of Scripture, and
// `modules.test.mjs` still enforces that.
//
// If a rule below genuinely needs to change, change it in both files. That is
// the point of the test, not an obstacle to it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ours = readFileSync(new URL('../css/next.css', import.meta.url), 'utf8');
const theirs = readFileSync(new URL('../../flcc-next/css/next.css', import.meta.url), 'utf8');

/** Read a custom property out of a stylesheet's :root block. */
const token = (css, name) => {
  const found = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return found ? found[1].trim() : null;
};

test('both editions sit on the same paper and are set in the same ink', () => {
  for (const name of ['paper', 'ink', 'sunshine', 'rose', 'sky', 'captain', 'poppy']) {
    assert.equal(token(ours, name), token(theirs, name),
      `--${name} differs between the two editions`);
  }
  // Pinned outright as well, so that "both changed together" cannot silently
  // walk the family off its own palette.
  assert.equal(token(ours, 'paper'), '#FBF8F0');
  assert.equal(token(ours, 'ink'), '#2B4C6D');
  assert.equal(token(ours, 'sunshine'), '#EDCE7A');
  assert.equal(token(ours, 'rose'), '#EABCB5');
  assert.equal(token(ours, 'sky'), '#C3D7EA');
  assert.equal(token(ours, 'captain'), '#4173B0');
  assert.equal(token(ours, 'poppy'), '#EB8861');
});

test('the outline is one weight, and it is the same weight in both', () => {
  assert.equal(token(ours, 'edge'), '3px');
  assert.equal(token(ours, 'edge'), token(theirs, 'edge'));
});

test('both editions are set in the same face', () => {
  assert.match(token(ours, 'font'), /^'Inter'/);
  assert.equal(token(ours, 'font'), token(theirs, 'font'));
});

/**
 * Headlines are heavy. This is the rule the adult edition spent two redesigns
 * on either side of, so it is worth stating plainly: a headline in this system
 * is a block of colour in its own right, and 900 is what makes it one.
 */
test('headlines are set at the heaviest weight the family has', () => {
  for (const css of [ours, theirs]) {
    for (const name of ['display', 'headline', 'numeral']) {
      const rule = css.match(new RegExp(`\\.${name} \\{[^}]+\\}`));
      assert.ok(rule, `.${name} is missing`);
      assert.match(rule[0], /font-weight:\s*900/, `.${name} is no longer set at 900`);
    }
    assert.match(css.match(/\.label \{[^}]+\}/)[0], /font-weight:\s*800/, '.label is no longer 800');
  }
});

test('the poster is the layout primitive in both editions', () => {
  for (const [name, css] of [['this edition', ours], ['the kids edition', theirs]]) {
    assert.match(css, /^\.poster \{/m, `${name} has no poster`);
    assert.match(css, /\.poster\[data-tall\]/, `${name} has no tall poster`);
    assert.match(css, /\.poster-foot/, `${name} has no poster foot`);
    // The four light tones plus the two that invert to paper type.
    for (const tone of ['sunshine', 'rose', 'sky', 'captain', 'ink', 'paper']) {
      assert.match(css, new RegExp(`\\.poster\\[data-tone="${tone}"\\]`),
        `${name} cannot paint a ${tone} poster`);
    }
  }
});

test('the actions are the same two in both editions', () => {
  for (const [name, css] of [['this edition', ours], ['the kids edition', theirs]]) {
    assert.match(css, /^\.pill \{/m, `${name} has no pill`);
    assert.match(css, /\.pill\[data-quiet\]/, `${name} has no quiet pill`);
    assert.match(css, /^\.go \{/m, `${name} has no arrow word`);
    assert.match(css, /\.go::after \{\s*content: "→"/, `${name}'s arrow word lost its arrow`);
    // The progress bar is thick and outlined, never a thin grey rule.
    assert.match(css, /\.track \{[^}]*height: 14px/, `${name}'s track is not 14px`);
  }
});

/**
 * Nothing in this system is soft.
 *
 * Flat colour, navy outlines, no gradients, no glass, no glow, and — the one
 * that creeps back first — no drop shadows. `box-shadow` is used in both
 * editions only as an inset outline, which is how a 3px edge is drawn without
 * a border changing an element's size.
 */
test('there are no drop shadows, no gradients and no blur in either edition', () => {
  for (const [name, css] of [['this edition', ours], ['the kids edition', theirs]]) {
    for (const [, value] of css.matchAll(/box-shadow:\s*([^;]+);/g)) {
      if (value.trim() === 'none') continue;
      assert.match(value, /^inset /, `${name} has a drop shadow: ${value}`);
    }
    assert.equal(/gradient\(/.test(css), false, `${name} has a gradient`);
    assert.equal(/backdrop-filter|filter:\s*blur/.test(css), false, `${name} has a blur`);
  }
});
