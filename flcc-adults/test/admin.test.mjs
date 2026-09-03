// The events admin.
//
// The admin page writes `content/events.json` and `content/updates.json`
// straight to the repository through the Worker. That means the checks in this
// app's content suite — the ones that would normally catch a bad event in a
// pull request — never run on what an editor publishes. The Worker's own
// validator is what stands in their place.
//
// So the danger is drift: somebody tightens a rule here, the Worker keeps
// accepting what this suite now rejects, and the app ships a calendar its own
// tests would have failed. This suite reads the Worker's source and fails when
// the two stop agreeing about what a valid event is.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const worker = readFileSync(new URL('../../ask-proxy/worker.js', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../admin/admin.js', import.meta.url), 'utf8');

/**
 * The admin's code with its comments removed.
 *
 * Its header explains at length which of the app's things it may not touch, so
 * checking the prose would fail the file for describing the rule it keeps —
 * the same trap `modules.test.mjs` documents. `://` is left alone so a URL in
 * a string is not mistaken for a comment.
 *
 * Line comments go FIRST, and the order matters: this file's header mentions
 * `content/*.json`, and stripping block comments first makes that stray `/*`
 * swallow everything up to the next `*​/` — half the module, silently.
 */
const adminJs = adminSource
  .replace(/(^|[^:])\/\/.*$/gm, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const adminHtml = readFileSync(new URL('../admin/index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('the admin page exists and is not indexable', () => {
  assert.ok(existsSync(new URL('../admin/index.html', import.meta.url)));
  assert.match(adminHtml, /name="robots" content="noindex/,
    'a page that edits the church calendar should not turn up in a search engine');
});

/**
 * The admin is a tool that edits this app; it is not part of it.
 *
 * It borrows the stylesheet so it looks like the thing it edits, and takes
 * nothing else — no router, no storage module, no `adults/v1/` key. If it ever
 * imported one, the app's own module rules would stop applying to it while it
 * still wrote to the app's storage.
 */
test('the admin borrows the stylesheet and nothing else', () => {
  assert.match(adminHtml, /href="\.\.\/css\/next\.css"/, 'it should look like the app it edits');
  assert.equal(/from '\.\.\/js\//.test(adminJs), false, 'the admin imports one of the app’s modules');
  assert.equal(/adults\/v1\//.test(adminJs), false, 'the admin touches the app’s storage namespace');
  assert.equal(/localStorage/.test(adminJs), false,
    'the passcode belongs in sessionStorage, so closing the tab signs you out');
  assert.match(adminJs, /sessionStorage/, 'the passcode is not kept anywhere');
});

test('the app never loads the admin, and never caches it', () => {
  const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.equal(/admin/.test(app), false, 'the app links to its own admin page');
  assert.equal(/admin\//.test(sw.split('const SHELL')[1].split(']')[0]), false,
    'the admin is precached, so an editor would be handed a stale copy of it');
  // And the service worker steps aside for it entirely.
  assert.match(sw, /pathname\.includes\('\/flcc-adults\/admin\/'\)\) return;/,
    'the service worker no longer stands aside for the admin');
});

test('the admin asks for the live file, not the cached one', () => {
  assert.match(adminJs, /cache: 'no-store'/,
    'without this an editor edits the copy the service worker kept and undoes their own last change');
  assert.match(adminJs, /\?t=\$\{Date\.now\(\)\}/, 'the request is not cache-busted');
});

/**
 * Only two files, and the path never comes from the request.
 *
 * This is the whole security posture of the endpoint in one assertion: the
 * file is a key into a fixed map, so no body — however crafted — can aim the
 * commit at `index.html`, at another church's data, or at the Worker itself.
 */
test('the endpoint can only ever write the two content files', () => {
  const map = worker.match(/const ADULTS_FILES = \{[^}]+\}/);
  assert.ok(map, 'ADULTS_FILES is gone');
  assert.deepEqual(
    [...map[0].matchAll(/'([^']+\.json)'/g)].map(([, path]) => path).sort(),
    ['flcc-adults/content/events.json', 'flcc-adults/content/updates.json']);
  assert.match(worker, /const path = ADULTS_FILES\[which\];/,
    'the path is no longer looked up by key — check it cannot come from the request');
});

test('publishing is closed unless a passcode is configured', () => {
  assert.match(worker, /if \(!env\.ADULTS_ADMIN_PASSCODES \|\| !env\.GITHUB_TOKEN\)/,
    'the endpoint no longer refuses to run unconfigured');
  assert.match(worker, /timingSafeEqual\(code, passcode\)/,
    'the passcode comparison is no longer constant-time');
});

/**
 * The Worker's rules and this suite's rules are the same rules.
 *
 * `content.test.mjs` cannot run on a file published through the API, so the
 * Worker repeats its checks. These assertions fail when one side gains a rule
 * the other has not.
 */
test('the Worker enforces what the content suite enforces', () => {
  const validator = worker.slice(worker.indexOf('function validateAdultsEvents'),
    worker.indexOf('function validateAdultsUpdates'));

  for (const field of ['id', 'title', 'when', 'where', 'blurb']) {
    assert.match(validator, new RegExp(`'${field}'`), `the Worker stopped requiring ${field}`);
  }
  assert.match(validator, /weekday !== undefined \|\| one\.date \|\| Array\.isArray\(one\.dates\)/,
    'the Worker stopped requiring a day to count down from');
  assert.match(validator, /one\.recurring !== true/, 'the Worker stopped requiring recurring');
  assert.match(validator, /one\.gathering/, 'the Worker stopped requiring a gathering');
  assert.match(validator, /minutes/, 'the Worker stopped requiring a duration');

  // The tones the Worker accepts must be tones the poster system can paint,
  // and must not include poppy — white type is not safe on it at that size.
  const tones = worker.match(/const ADULTS_TONES = \[([^\]]+)\]/);
  assert.ok(tones, 'ADULTS_TONES is gone');
  const accepted = [...tones[1].matchAll(/'([a-z]+)'/g)].map(([, name]) => name);
  assert.equal(accepted.includes('poppy'), false,
    'the Worker would let an editor publish a poppy poster');
  const css = readFileSync(new URL('../css/next.css', import.meta.url), 'utf8');
  for (const tone of accepted) {
    const selector = tone === 'navy' ? 'ink' : tone;
    assert.match(css, new RegExp(`\\.poster\\[data-tone="${selector}"\\]`),
      `the Worker accepts "${tone}", which the stylesheet cannot paint`);
  }
});

test('the page checks the same things before it asks the network to', () => {
  // Not instead of the server check — that one is the real one. This exists so
  // a missing field is a sentence under the button rather than a round trip.
  assert.match(adminJs, /main gathering/, 'the page no longer warns about the gathering');
  assert.match(adminJs, /has no start time/, 'the page no longer checks the start time');
  assert.match(adminJs, /\/api\/publish\/adults/, 'the page posts somewhere else now');
  // Error messages name what is on screen, not the key in the JSON.
  assert.match(adminJs, /const FIELD_NAMES = \{/,
    'the page reports raw JSON field names to whoever runs the church calendar');
});
