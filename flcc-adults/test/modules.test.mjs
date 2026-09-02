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
 * The design system's rules, enforced.
 *
 * This app has been drawn six times, and the rules have swung right across the
 * board in the process: it has been outlined, then hairlined, then outlined
 * again. What it is now is the kids and teens edition's poster system, and the
 * pieces that make the two editions ONE design are checked against that app
 * directly in `design.test.mjs`. What is left here are the rules that only
 * this app's own source can answer.
 */
test('the stylesheet is the poster system', () => {
  const css = readFileSync(new URL('../css/next.css', import.meta.url), 'utf8');
  assert.match(css, /^\.poster \{/m, 'the poster is gone');
  assert.match(css, /--edge:\s*3px;/, 'the one outline weight is gone');
  assert.match(css, /--paper:\s*#FBF8F0;/i, 'this edition sits on the shared cream paper');
  assert.match(css, /--ink:\s*#2B4C6D;/i, 'navy is the only ink');
});

/**
 * Type carries the hierarchy, and it does it by jumping.
 *
 * Labels are tiny; headlines are huge; there is nothing in between pretending
 * to be both. What is never allowed is a *paragraph* in capitals: a sentence
 * set in caps is measurably slower to read, and a church app is read by people
 * at the end of a shift.
 */
test('headlines shout; paragraphs never do', () => {
  const css = readFileSync(new URL('../css/next.css', import.meta.url), 'utf8');
  for (const selector of ['.body', '.lead', '.verse', '.row-note', '.note']) {
    const rule = new RegExp(`\\${selector} \\{[^}]*text-transform:\\s*uppercase`);
    assert.equal(rule.test(css), false, `${selector} is set in capitals — that is a paragraph`);
  }
  assert.match(css, /\.label \{[^}]*text-transform: uppercase/, 'the label stopped being a label');
});

/**
 * Every colour in a screen is a token.
 *
 * A hex literal in a screen is a colour that will not follow when the palette
 * moves — and the palette has now moved three times.
 */
test('no screen hard-codes a colour', () => {
  for (const file of modules.filter((one) => one.startsWith('js/screens/'))) {
    assert.equal(/#[0-9a-fA-F]{6}/.test(code(file)), false,
      `${file} hard-codes a colour — every colour in this app is a token in the stylesheet`);
  }
});

/**
 * A root screen has to say what it is.
 *
 * Each of the five tabs opens on its own name, and the shell sets it from the
 * view's title. A root screen that returned no title would show an empty
 * header.
 */
test('every root screen names itself', () => {
  const app = source('js/app.js');
  const tabs = [...app.matchAll(/\{ name: '([a-z]+)',\s+label:/g)].map(([, name]) => name);
  assert.deepEqual(tabs, ['today', 'explore', 'community', 'watch', 'you']);
  for (const tab of tabs) {
    const body = source(`js/screens/${tab}.js`);
    assert.match(body, /return \{ title: '[A-Z]/, `js/screens/${tab}.js returns no title`);
  }
});

/**
 * The tab bar, the router and the screens agree.
 *
 * Three lists in one file that have to line up, and a typo in any of them is a
 * tab that lights nothing or a screen that can never be reached.
 */
test('every tab has a screen, and every sub-screen sits under a real tab', () => {
  const app = source('js/app.js');
  const tabs = new Set([...app.matchAll(/\{ name: '([a-z]+)',\s+label:/g)].map(([, name]) => name));
  const screens = new Set([...app.matchAll(/^\s{2}([a-z]+):\s+\(\) => import\('\.\/screens\/([a-z]+)\.js'\)/gm)]
    .map(([, route, file]) => { assert.equal(route, file, `route "${route}" loads ${file}.js`); return route; }));

  for (const tab of tabs) assert.ok(screens.has(tab), `the ${tab} tab has no screen`);
  for (const route of screens) {
    assert.ok(modules.includes(`js/screens/${route}.js`), `${route} is routed but the file is gone`);
  }
  const under = [...app.matchAll(/^\s{2}([a-z]+):\s+'([a-z]+)',/gm)];
  assert.ok(under.length >= 8, 'the UNDER map has lost its entries');
  for (const [, screen, tab] of under) {
    assert.ok(screens.has(screen), `UNDER names "${screen}", which is not a screen`);
    assert.ok(tabs.has(tab), `UNDER puts ${screen} under "${tab}", which is not a tab`);
  }
});

test('the drawings can be turned off everywhere at once', () => {
  // art() in core/ui.js checks the setting itself. A screen that built a
  // drawing straight from art.js would ignore that, and turning them off in
  // You would clear some screens and not others.
  for (const file of modules.filter((one) => one.startsWith('js/screens/'))) {
    assert.equal(/from '\.\.\/core\/art\.js'/.test(code(file)), false,
      `${file} imports art.js directly — go through figure() in core/ui.js`);
  }
});

/**
 * Every colour named in code has to exist in the stylesheet.
 *
 * This is not hypothetical. When the palette was replaced, the content files
 * were remapped and a dozen `tone: 'blush'` literals in the screens were not.
 * Nothing failed: `data-tone="blush"` simply matched no rule, so those cards
 * fell back to the default colour, and a character whose fill resolved to an
 * undefined variable painted itself black. It looked like a design choice.
 */
test('every colour named in the code exists in the stylesheet', () => {
  const css = readFileSync(new URL('../css/next.css', import.meta.url), 'utf8');
  const defined = new Set([...css.matchAll(/^\s{2}--([a-z-]+):/gm)].map(([, name]) => name));
  const patterns = [
    /\btone:\s*'([a-z-]+)'/g,           // card({ tone: 'sky' })
    /\baccent:\s*'([a-z-]+)'/g,         // row({ accent: 'rose' })
    /\bthread\([^,)]+,\s*'([a-z-]+)'/g, // thread(50, 'sunshine')
    /\bfigure\([^,)]+,\s*'([a-z-]+)'/g, // figure('book', 'navy')
  ];
  const offenders = [];
  for (const file of modules) {
    const body = code(file);
    for (const pattern of patterns) {
      for (const [, name] of body.matchAll(pattern)) {
        if (!defined.has(name)) offenders.push(`${file}: "${name}"`);
      }
    }
  }
  assert.deepEqual(offenders, [], `these name a colour the stylesheet does not define:\n${offenders.join('\n')}`);
});

test('a screen builds its surfaces from the kit, not out of bare divs', () => {
  for (const file of modules.filter((one) => one.startsWith('js/screens/'))) {
    const body = code(file);
    // `class: 'poster'` written by hand means a surface that will not follow
    // the system when the system changes. The kit's poster() is the only way in.
    assert.equal(/class:\s*['"`]poster['"`]/.test(body), false,
      `${file} hand-builds a poster — use poster() from core/ui.js`);
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
