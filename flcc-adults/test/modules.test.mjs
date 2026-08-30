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
 * The design system's rules, enforced — and they are the reverse of what this
 * app enforced a version ago.
 *
 * It was drawn as a stack of stickers: 3px outlines, hard offset shadows, star
 * ratings and cartoon faces. It read, accurately, as an app for children. The
 * hard shadow and the thick border are the two devices that did most of that,
 * so both are now failures rather than requirements.
 */
test('nothing is drawn with a hard offset shadow', () => {
  const css = readFileSync(new URL('../css/quiet.css', import.meta.url), 'utf8');
  const shadows = [...css.matchAll(/box-shadow:\s*([^;]+);/g)].map(([, value]) => value.trim());
  for (const shadow of shadows) {
    if (shadow.startsWith('inset') || shadow === 'none' || shadow.includes('var(--lift')) continue;
    // "<x>px <y>px 0 <colour>" — a zero blur radius is the sticker shadow.
    assert.equal(/^-?[\d.]+px -?[\d.]+px 0(px)? [^,]+$/.test(shadow), false,
      `hard offset shadow is back in the stylesheet: ${shadow}`);
  }
  assert.match(css, /--lift:\s*[^;]*rgba/, 'the soft lift token is gone');
});

test('nothing is drawn with a thick outline', () => {
  const css = readFileSync(new URL('../css/quiet.css', import.meta.url), 'utf8');
  const widths = [
    // Only real borders — `border-radius` is a length too, and a 20px radius
    // is the point of this design rather than a violation of it.
    ...[...css.matchAll(/border(?:-(?:top|right|bottom|left))?:\s*([\d.]+)px/g)].map(([, w]) => Number(w)),
    ...[...css.matchAll(/box-shadow:\s*inset 0 0 0 ([\d.]+)px/g)].map(([, w]) => Number(w)),
  ];
  for (const width of widths) {
    assert.ok(width <= 2, `a ${width}px border — this system separates with hairlines`);
  }
});

test('headings are set, not shouted', () => {
  const css = readFileSync(new URL('../css/quiet.css', import.meta.url), 'utf8');
  const weights = [...css.matchAll(/font-weight:\s*(\d{3})/g)].map(([, w]) => Number(w));
  assert.ok(weights.length > 0);
  assert.ok(Math.max(...weights) <= 600, `weight ${Math.max(...weights)} — nothing here is heavier than 600`);
  assert.equal(/\.display[^{]*\{[^}]*text-transform:\s*uppercase/.test(css), false, 'headings are sentence case');
});

test('the icons can be turned off everywhere at once', () => {
  // figure() checks the setting itself. A screen that builds an icon straight
  // from art.js would ignore that, and turning them off in You would clear
  // some screens and not others.
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
  const css = readFileSync(new URL('../css/quiet.css', import.meta.url), 'utf8');
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
    // `class: 'card'` written by hand means a surface that will not follow the
    // system when the system changes. The kit's card() is the only way in.
    assert.equal(/class:\s*['"`]card['"`]/.test(body), false,
      `${file} hand-builds a card — use card() from core/ui.js`);
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
