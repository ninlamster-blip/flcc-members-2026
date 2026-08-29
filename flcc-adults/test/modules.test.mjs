// Every module the browser loads, and the two boundaries that hold this app
// apart from the other four in this repository.
//
// The screens are only ever exercised in a browser, so without the first test
// here a syntax error survives a green run and shows up as a blank screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const dirs = ['core', 'screens'];
const modules = [
  ...dirs.flatMap((dir) => readdirSync(new URL(`../js/${dir}/`, import.meta.url)).map((f) => `js/${dir}/${f}`)),
  'js/app.js', 'sw.js',
].filter((f) => f.endsWith('.js'));

const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

/**
 * The file with its comments removed.
 *
 * The boundary tests below look for forbidden paths and APIs, and these files
 * are heavily commented about exactly those things — scripture.js explains at
 * length which parts of the kids app it may not touch. Checking the prose
 * would fail the file for describing the rule it keeps. `://` is left alone so
 * a URL in a string is not mistaken for a comment.
 */
const code = (file) => source(file)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

test('every browser module parses', async () => {
  assert.ok(modules.length >= 18, `only found ${modules.length} modules`);
  for (const file of modules) {
    try {
      await import(new URL(`../${file}`, import.meta.url));
    } catch (error) {
      assert.ok(!(error instanceof SyntaxError), `${file} does not parse: ${error.message}`);
    }
  }
});

test('every screen exports a screen', async () => {
  for (const file of modules.filter((one) => one.startsWith('js/screens/'))) {
    const module = await import(new URL(`../${file}`, import.meta.url));
    assert.equal(typeof module.default, 'function', `${file} has no default export`);
  }
});

test('nothing here reaches into another app in this repository', () => {
  // The single exception is the shared, immutable text of Scripture, which
  // scripture.js reads at one fixed path and the service worker caches.
  // See the header of js/core/scripture.js for why.
  const allowed = new Set(['js/core/scripture.js', 'sw.js']);
  for (const file of modules) {
    const body = code(file);
    assert.equal(/church\.js|FLCC\.(data|key|slug)|shepherd\/|lamp\//.test(body), false,
      `${file} reaches into another app`);
    if (allowed.has(file)) {
      assert.match(body, /flcc-next\/bible\//, `${file} is allowed the shared Bible and no longer uses it`);
      assert.equal(/flcc-next\/(?!bible\/)/.test(body), false, `${file} reaches past the Bible into the kids app`);
    } else {
      assert.equal(/flcc-next/.test(body), false, `${file} must go through scripture.js for Scripture`);
    }
  }
});

test('every key written anywhere in the app is namespaced', () => {
  for (const file of modules) {
    if (file === 'js/core/storage.js') continue;
    assert.equal(/localStorage|sessionStorage/.test(code(file)), false,
      `${file} touches storage directly — everything goes through core/storage.js`);
  }
});

/**
 * The design system's one rule, enforced.
 *
 * The brief this app was built to is explicit: hierarchy comes from type,
 * space, colour blocks and rules — not from a stack of rounded rectangles. It
 * is exactly the rule that erodes first, one "just this once" card at a time,
 * so the absence of the class is a test rather than a comment.
 */
test('there is no card in the design system', () => {
  const css = readFileSync(new URL('../css/organic.css', import.meta.url), 'utf8');
  assert.equal(/^\.card\b|[\s,]\.card\b/m.test(css), false, 'a .card class appeared in organic.css');
  for (const file of modules) {
    assert.equal(/class:\s*['"`][^'"`]*\bcard\b/.test(source(file)), false, `${file} renders a card`);
  }
});

test('no screen swaps its children in a way that can print "null"', () => {
  // Element.replaceChildren() stringifies what it is given, so the conditional
  // child pattern these screens use everywhere — `condition ? thing() : null`
  // — puts the word "null" on the page. swap() in core/ui.js filters first.
  for (const file of modules.filter((one) => one.startsWith('js/screens/'))) {
    assert.equal(/\breplaceChildren\(/.test(code(file)), false,
      `${file} calls replaceChildren directly — use swap() from core/ui.js`);
  }
});

/**
 * Every screen that shows a reference should let a reader open it.
 *
 * The whole Bible ships with this app, so a reference rendered as dead text is
 * an adult retyping "Lamentations 3:22" into the Bible tab. This reads the
 * screens rather than restating a list, so a new screen that quotes Scripture
 * and forgets to link it fails here.
 */
test('a screen that shows a Scripture reference links it to the Bible', () => {
  const exempt = new Set(['bible.js']);          // bible.js IS the Bible
  const offenders = [];
  for (const file of readdirSync(new URL('../js/screens/', import.meta.url))) {
    if (!file.endsWith('.js') || exempt.has(file)) continue;
    const code = source(`js/screens/${file}`);
    for (const [line] of code.matchAll(/^.*\.ref\b.*$/gm)) {
      if (/text:\s*[a-z]+\.ref|label\([a-z]+\.ref\)/i.test(line)) offenders.push(`${file}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [],
    `these render a reference as dead text — use reference() from core/ui.js:\n${offenders.join('\n')}`);
});

test('the service worker precaches every module and every content file', () => {
  const sw = source('sw.js');
  for (const file of modules) {
    if (file === 'sw.js') continue;
    assert.ok(sw.includes(`./${file}`), `sw.js does not precache ${file}`);
  }
  const walk = (dir = '') => readdirSync(new URL(`../content/${dir}`, import.meta.url), { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? walk(`${dir}${entry.name}/`) : [`${dir}${entry.name}`]));
  for (const file of walk()) {
    assert.ok(sw.includes(`./content/${file}`), `sw.js does not precache content/${file}`);
  }
});
