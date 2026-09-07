import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toneFor, toneNote, TONE_NAMES } from '../js/ui/tone.js';

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

test('a quiet day is calm', () => {
  assert.equal(toneFor([]), 'calm');
});

test('the worst thing on the page decides the colour', () => {
  const list = [
    { severity: 'info' }, { severity: 'severe' }, { severity: 'watch' },
  ];
  assert.equal(toneFor(list), 'severe');
  assert.equal(toneFor([{ severity: 'info' }, { severity: 'watch' }]), 'watch');
  assert.equal(toneFor([{ severity: 'info' }]), 'info');
});

test('every tone has a colour and a sentence', () => {
  for (const tone of TONE_NAMES) {
    assert.ok(css.includes(`--${tone}:`), `--${tone} is never defined`);
    assert.ok(toneNote(tone).length > 3, `${tone} has no note`);
  }
});

test('the tones are redefined for dark mode, where the light ones would glare', () => {
  const dark = css.slice(css.indexOf('prefers-color-scheme: dark'));
  for (const tone of TONE_NAMES.filter((t) => t !== 'calm')) {
    assert.ok(dark.includes(`--${tone}:`), `--${tone} has no dark value`);
  }
  assert.ok(dark.includes('--calm:'));
});

test('an unknown severity does not silently become the worst one', () => {
  assert.equal(toneFor([{ severity: 'catastrophic' }]), 'calm');
});

test('a tone note never promises safety it cannot check', () => {
  assert.match(toneNote('severe'), /inside/i);
  assert.ok(!/safe/i.test(toneNote('calm')), 'the app does not tell anyone they are safe');
});
