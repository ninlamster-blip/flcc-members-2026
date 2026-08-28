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
