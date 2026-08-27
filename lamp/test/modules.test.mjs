// Every module the browser loads must at least parse. Screens are only
// exercised in a browser, so without this a syntax error in one of them can
// survive a full green test run and only show up as a blank screen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';

const files = [
  ...readdirSync(new URL('../js/core/', import.meta.url)).map((f) => `../js/core/${f}`),
  ...readdirSync(new URL('../js/screens/', import.meta.url)).map((f) => `../js/screens/${f}`),
  '../js/app.js',
  '../sw.js',
].filter((f) => f.endsWith('.js'));

test('every browser module parses', async () => {
  assert.ok(files.length >= 20, `only found ${files.length} modules`);
  for (const file of files) {
    try {
      await import(new URL(file, import.meta.url));
    } catch (error) {
      // Importing outside a browser trips over missing globals — that is fine.
      // A SyntaxError is not: it means the file cannot load anywhere.
      assert.ok(
        !(error instanceof SyntaxError),
        `${file} does not parse: ${error.message}`,
      );
    }
  }
});
