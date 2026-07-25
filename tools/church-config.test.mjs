#!/usr/bin/env node
/* ===========================================================================
 * church-config.test.mjs — does this copy publish to the right repository?
 * ===========================================================================
 *
 *   node tools/church-config.test.mjs
 *
 * Every church runs its own copy of this app, and each admin page writes back
 * to GitHub with a token. If the repo is resolved wrongly, one church's
 * "Publish" button aims at another church's data. That is the single mistake
 * in this setup with consequences that are hard to undo, so the resolver has
 * tests and the tests are cheap to run.
 *
 * church-config.js is written for a browser, so it is evaluated here with
 * `window` and `location` supplied by hand — no jsdom, no dependencies.
 * ------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(REPO_ROOT, 'church-config.js'), 'utf8');

function resolveWith(hostname, pathname, configuredRepo) {
  const window = {};
  const location = { hostname, pathname };
  new Function('window', 'location', SRC)(window, location);
  if (configuredRepo !== undefined) window.CHURCH_CONFIG.repo = configuredRepo;
  try {
    return window.resolveChurchRepo();
  } catch (e) {
    return `THROWS: ${e.message.split('\n')[0]}`;
  }
}

/* THROWS is the correct answer wherever the repo genuinely cannot be known.
 * Refusing to publish is always better than publishing somewhere unintended. */
const CASES = [
  ['project site (the normal case)',  'ninlamster-blip.github.io', '/flcc-members-2026/attendance.html', '',                          'ninlamster-blip/flcc-members-2026'],
  ['a fork, config left untouched',   'shekinah-kw.github.io',     '/flcc-shekinah/attendance.html',     '',                          'shekinah-kw/flcc-shekinah'],
  ['repo root, no trailing slash',    'agape-kw.github.io',        '/flcc-agape',                        '',                          'agape-kw/flcc-agape'],
  ['repo root, dotted repo name',     'flcc-gil.github.io',        '/flcc.app/',                         '',                          'flcc-gil/flcc.app'],
  ['user site, page at root',         'flcc-hotk.github.io',       '/attendance.html',                   '',                          'flcc-hotk/flcc-hotk.github.io'],
  ['user site, bare root',            'flcc-jaoc.github.io',       '/',                                  '',                          'flcc-jaoc/flcc-jaoc.github.io'],
  ['explicit config wins over URL',   'ninlamster-blip.github.io', '/flcc-members-2026/x.html',          'mtcc-kw/flcc-mtcc',         'mtcc-kw/flcc-mtcc'],
  ['custom domain, config set',       'flccshekinah.org',          '/attendance.html',                   'shekinah-kw/flcc-shekinah', 'shekinah-kw/flcc-shekinah'],
  ['custom domain, no config',        'flccshekinah.org',          '/attendance.html',                   '',                          'THROWS'],
  ['worker domain, no config',        'flcc.workers.dev',          '/attendance.html',                   '',                          'THROWS'],
  ['opened as a local file',          '',                          '/attendance.html',                   '',                          'THROWS'],
  ['malformed config value',          'x.github.io',               '/r/a.html',                          'not-a-repo',                'THROWS'],
];

let failed = 0;
for (const [label, host, path, cfg, expected] of CASES) {
  const got = resolveWith(host, path, cfg);
  const pass = expected === 'THROWS' ? got.startsWith('THROWS') : got === expected;
  if (!pass) failed++;
  const shown = got.startsWith('THROWS') ? 'refuses to guess' : got;
  console.log(`  ${pass ? 'pass' : 'FAIL'}  ${label.padEnd(30)} → ${shown}`);
  if (!pass) console.log(`        expected ${expected}`);
}

console.log(failed ? `\n  ${failed} failing\n` : `\n  ${CASES.length} cases pass\n`);
process.exit(failed ? 1 : 0);
