// Three bugs a phone showed and a test run did not: a headline word wider than
// its poster, a Back button with two arrows, and a service worker that kept a
// failed Bible download for good. Each is pinned here so it cannot come back.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/next.css', import.meta.url), 'utf8');
const ui = readFileSync(new URL('../js/core/ui.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('a long headline word is sized to fit its poster', () => {
  // FORGIVENESS and RELATIONSHIPS ran off the edge of a 390px phone.
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

test('Back has one arrow, not two', () => {
  assert.match(app, /class: 'go', type: 'button', dataset: \{ back: '' \}[\s\S]{0,200}'← Back'/);
  assert.match(css, /\.go\[data-back\]::after \{ content: none; \}/);
});

test('the service worker never keeps a failed response', () => {
  // Scripture is cache-first and never refetched, so a kept 404 or 5xx would
  // be what that book opened to on that phone from then on.
  assert.match(sw, /const keep = \(request, response\) => \{\s*if \(!response\.ok\) return response;/);
});
