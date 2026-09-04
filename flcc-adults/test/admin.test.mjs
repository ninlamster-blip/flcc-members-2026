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

/**
 * The passcodes secret is typed into a web form by whoever runs a church,
 * often on a phone. Three things they might reasonably type used to come back
 * as "that passcode was not recognised" — an error that blames the person for
 * something they cannot see.
 */
test('the passcodes secret forgives the ways it is actually typed', () => {
  const parser = worker.slice(worker.indexOf('function passcodeMap'),
    worker.indexOf('function editorForPasscode'));
  assert.match(parser, /\u201C|\\u201C/, 'smart quotes are no longer straightened before parsing');
  assert.match(parser, /\{ admin: raw \}/, 'a bare passphrase is no longer accepted as one passcode');
  assert.match(parser, /raw\.trim\(\)|\.trim\(\)/, 'the secret is no longer trimmed');
  // But it must still be a lock. Anything that made every string open it
  // would be far worse than the problem it solves.
  assert.match(worker, /timingSafeEqual\(String\(code\)\.trim\(\), typed\)/,
    'the comparison is no longer constant-time, or no longer compares the passcode');
  assert.match(worker, /if \(!typed\) return null;/, 'an empty passcode is no longer refused');
});

test('publishing is closed unless both secrets are configured', () => {
  assert.match(worker, /!String\(env\.ADULTS_ADMIN_PASSCODES \|\| ''\)\.trim\(\) &&/,
    'the endpoint no longer checks for the passcodes secret');
  assert.match(worker, /!String\(env\.GITHUB_TOKEN \|\| ''\)\.trim\(\) &&/,
    'the endpoint no longer checks for the token');
  assert.match(worker, /if \(missing\.length\) \{/, 'the endpoint no longer refuses to run unconfigured');
  assert.match(worker, /timingSafeEqual\(code, passcode\)/,
    'the passcode comparison is no longer constant-time');
});

/**
 * Whoever sets this up cannot see which secrets Cloudflare already holds, and
 * the two come from different places — one you invent, one you generate on
 * GitHub. Both the refusal and `/ping` have to name the one that is missing,
 * and neither may ever report a value.
 */
test('an unconfigured Worker says which half it is waiting for', () => {
  const guard = worker.slice(worker.indexOf('const missing = ['),
    worker.indexOf('const raw = await request.text()', worker.indexOf('const missing = [')));
  assert.match(guard, /Variables and Secrets/, 'the refusal no longer says where to put them');
  assert.match(guard, /missing\.join/, 'the refusal no longer names the missing secrets');

  // Bounded by the handler itself: "/news" appears in a header comment near the
  // top of the file, so searching forward from zero for it slices nothing.
  const pingAt = worker.indexOf("url.pathname === '/ping'");
  const ping = worker.slice(pingAt, worker.indexOf('});', pingAt));
  for (const field of ['adultsAdmin', 'adultsPasscodes', 'githubToken']) {
    assert.match(ping, new RegExp(`${field}: !!`),
      `/ping stopped reporting ${field}, or stopped reporting it as a boolean`);
  }
  // `!!` is what keeps this a yes/no. A bare `env.ADULTS_ADMIN_PASSCODES`
  // would put every passcode in the church into a public endpoint.
  assert.equal(/adultsPasscodes: env\.|githubToken: env\./.test(ping), false,
    '/ping would return the secret itself rather than whether it exists');
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

/**
 * The door has to actually check.
 *
 * It used to take any text and open the editor, leaving the passcode
 * unchecked until Save — so a wrong one meant filling in a whole calendar
 * before finding out, and a door that opens for anything teaches people the
 * passcode does not matter.
 */
test('the door verifies the passcode before it opens', () => {
  assert.match(adminJs, /verify: true/, 'the page no longer asks the Worker to check the passcode');
  assert.match(worker, /if \(body\.verify\) \{/, 'the Worker no longer answers a bare passcode');

  // The check has to come after the passcode check and before anything is
  // written — otherwise it is either an open door or a publish.
  const handler = worker.slice(worker.indexOf('async function handleAdultsPublish'));
  const at = (needle) => handler.indexOf(needle);
  assert.ok(at('editorForPasscode') < at('if (body.verify) {'),
    'the door opens before the passcode is checked');
  assert.ok(at('if (body.verify) {') < at('const path = ADULTS_FILES[which]'),
    'verifying falls through into publishing a file');

  // The editor is only revealed once the Worker said yes.
  // Bounded by the listener registration below the function — `$('enter')`
  // alone also matches the button lookup inside it, which cuts the slice short.
  const gate = adminJs.slice(adminJs.indexOf('async function enter()'),
    adminJs.indexOf("$('enter').addEventListener"));
  assert.ok(gate.indexOf('if (!response.ok)') < gate.indexOf("$('editor').hidden = false"),
    'the editor is shown before the answer comes back');
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
