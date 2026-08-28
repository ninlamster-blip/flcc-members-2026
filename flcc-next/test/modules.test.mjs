// Every module the browser loads must at least parse. The screens are only
// ever exercised in a browser, so without this a syntax error can survive a
// green test run and show up as a blank screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

const dirs = ['core', 'screens', 'games', 'admin'];
const files = [
  ...dirs.flatMap((dir) => readdirSync(new URL(`../js/${dir}/`, import.meta.url)).map((f) => `../js/${dir}/${f}`)),
  '../js/app.js',
  '../sw.js',
].filter((f) => f.endsWith('.js'));

test('every browser module parses', async () => {
  assert.ok(files.length >= 12, `only found ${files.length} modules`);
  for (const file of files) {
    try {
      await import(new URL(file, import.meta.url));
    } catch (error) {
      assert.ok(!(error instanceof SyntaxError), `${file} does not parse: ${error.message}`);
    }
  }
});

/**
 * Every screen that shows a reference should let a reader open it.
 *
 * The app ships all 66 books, so a reference rendered as dead text is a young
 * person retyping "Luke 2:49" into the Bible tab. This reads the screens rather
 * than restating a list, so a new screen that quotes Scripture and forgets to
 * link it fails here.
 *
 * Two deliberate exceptions:
 *
 *   game.js     the verse builder's round advances after 1.8 seconds, so a
 *               link there would disappear before it could be tapped.
 *   journey.js  its references sit inside a poster that is itself a button
 *               opening the lesson. A button inside a button is invalid, and
 *               the tap belongs to the lesson.
 */
test('a screen that shows a Scripture reference links it to the Bible', async () => {
  const { readFileSync: read } = await import('node:fs');
  const exempt = new Set(['game.js', 'journey.js', 'bible.js']);   // see above; bible.js IS the Bible
  const offenders = [];

  for (const file of readdirSync(new URL('../js/screens/', import.meta.url))) {
    if (!file.endsWith('.js') || exempt.has(file)) continue;
    const source = read(new URL(`../js/screens/${file}`, import.meta.url), 'utf8');
    // Does this screen render something's `.ref` at all?
    if (!/\.ref\b/.test(source)) continue;
    for (const [line] of source.matchAll(/^.*\.ref\b.*$/gm)) {
      const shows = /text:\s*[a-z]+\.ref|label\([a-z]+\.ref\)/i.test(line);
      if (shows) offenders.push(`${file}: ${line.trim()}`);
    }
  }
  assert.deepEqual(offenders, [],
    `these render a reference as dead text — use reference() from core/ui.js:\n${offenders.join('\n')}`);
});
