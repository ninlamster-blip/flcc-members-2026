// OFFLINE.
//
// The service worker precaches the app shell so a phone with no signal still
// opens every screen. A module or content file missing from SHELL works fine
// online and in every test — and then a screen fails to load the first time
// somebody opens it on a bus. That happened (a prayer screen's own module, and
// the lesson files behind every journey), so this reads the list and the disk
// and fails when they disagree.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('sw.js', root), 'utf8');
const shell = [...source.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const local = new Set(shell.filter((one) => one.startsWith('./')).map((one) => one.slice(2)));

const walk = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory() ? walk(`${dir}${entry.name}/`) : [`${dir}${entry.name}`]));

test('every module the app runs is precached for offline', () => {
  const modules = walk('js/').filter((file) => file.endsWith('.js') && !file.startsWith('js/admin/'));
  const missing = modules.filter((file) => !local.has(file));
  assert.deepEqual(missing, [], `add these to SHELL in sw.js (and bump VERSION): ${missing.join(', ')}`);
});

test('every content file is precached for offline', () => {
  const missing = walk('content/').filter((file) => file.endsWith('.json') && !local.has(file));
  assert.deepEqual(missing, [], `add these to SHELL in sw.js (and bump VERSION): ${missing.join(', ')}`);
});

test('everything precached exists — one bad path and the install quietly skips it', () => {
  const gone = [...local].filter((file) => file && !existsSync(new URL(file, root)));
  assert.deepEqual(gone, []);
});
