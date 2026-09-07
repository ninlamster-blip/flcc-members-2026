// This app is a standalone project sharing a repository with several others.
// These are the tests that keep it standalone.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT).filter((f) => /\.(js|mjs|html|css|json|webmanifest)$/.test(f));
const appFiles = files.filter((f) => !relative(ROOT, f).startsWith('test'));
const read = (f) => readFileSync(f, 'utf8');
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('there are source files to check', () => {
  assert.ok(appFiles.length > 15, `only found ${appFiles.length}`);
});

test('nothing here reaches into another application in this repository', () => {
  // Including its own closest relative: the Kuwait app shares this design
  // language and no code at all, and a convenient import would end that.
  const forbidden = [
    /from\s+['"][^'"]*church\.js['"]/,
    /\bFLCC\s*\.\s*(data|key)\b/,
    /from\s+['"][^'"]*\/(kuwait-weather|shepherd|lamp|flcc-next|flcc-adults|ask-proxy)\//,
    /\.\.\/\.\.\/(kuwait-weather|shepherd|lamp|flcc-next|flcc-adults|churches|ask-proxy)\b/,
  ];
  for (const file of appFiles) {
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(read(file)), `${relative(ROOT, file)} reaches outside: ${pattern}`);
    }
  }
});

test('every relative import resolves, and stays inside this app', () => {
  for (const file of appFiles.filter((f) => f.endsWith('.js'))) {
    for (const [, spec] of read(file).matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      assert.ok(!spec.startsWith('../../'), `${relative(ROOT, file)} imports ${spec}`);
      assert.ok(existsSync(join(dirname(file), spec)), `${relative(ROOT, file)} imports ${spec}, which does not exist`);
    }
  }
});

test('no dependencies, no build step, no bundler', () => {
  assert.ok(!existsSync(join(ROOT, 'package.json')));
  assert.ok(!existsSync(join(ROOT, 'node_modules')));
  for (const file of appFiles) {
    const body = read(file).replace(/from\s+['"]\.[^'"]*['"]/g, '');
    assert.ok(!/from\s+['"][a-z@][^'".][^'"]*['"]/.test(body), `${relative(ROOT, file)} imports a package`);
  }
});

test('nothing loads from a third-party host at runtime', () => {
  const allowed = ['api.open-meteo.com', 'air-quality-api.open-meteo.com', 'open-meteo.com'];
  for (const file of appFiles) {
    for (const [, host] of read(file).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      assert.ok(allowed.includes(host) || host.endsWith('w3.org'), `${relative(ROOT, file)} references ${host}`);
    }
  }
});

test('no API key, token or secret is anywhere in the source', () => {
  for (const file of appFiles) {
    assert.ok(!/\b(api[_-]?key|apiKey|access[_-]?token|client[_-]?secret)\s*[:=]\s*['"][^'"]+['"]/i.test(read(file)),
      `${relative(ROOT, file)} looks like it carries a credential`);
  }
});

test('storage is reached only through the module that guards the namespace', () => {
  const guarded = join(ROOT, 'js/core/storage.js');
  for (const file of appFiles.filter((f) => f.endsWith('.js') && f !== guarded)) {
    assert.ok(!/\blocalStorage\b|\bsessionStorage\b/.test(code(file)),
      `${relative(ROOT, file)} bypasses the namespace guard`);
  }
});

test('the service worker caches every module, and never a forecast', () => {
  const sw = read(join(ROOT, 'sw.js'));
  for (const file of walk(join(ROOT, 'js')).filter((f) => f.endsWith('.js'))) {
    const path = `./${relative(ROOT, file)}`;
    assert.ok(sw.includes(path), `sw.js does not cache ${path}`);
  }
  assert.ok(!sw.includes('open-meteo'), 'a cached rainfall figure shown as current is worse than none');
  assert.ok(sw.includes('self.location.origin'));
});

test('every element the app reaches for exists in the page', () => {
  const html = read(join(ROOT, 'index.html'));
  const ids = [...read(join(ROOT, 'js/app.js')).matchAll(/\bel\(['"]([a-z-]+)['"]\)/g)].map((m) => m[1]);
  assert.ok(ids.length > 8);
  for (const id of new Set(ids)) {
    assert.ok(html.includes(`id="${id}"`), `app.js looks for #${id}, which index.html does not have`);
  }
});

test('every drawing the screens ask for is one that exists', async () => {
  const { ART_NAMES } = await import('../js/ui/art.js');
  const sources = ['js/ui/render.js', 'js/core/advisories.js'].map((f) => read(join(ROOT, f))).join('\n');
  const asked = [
    ...[...sources.matchAll(/\bart\(['"]([a-zA-Z]+)['"]/g)].map((m) => m[1]),
    ...[...sources.matchAll(/icon:\s*'([a-zA-Z]+)'/g)].map((m) => m[1]),
  ];
  assert.ok(asked.length > 6);
  for (const name of new Set(asked)) assert.ok(ART_NAMES.includes(name), `"${name}" is used but not drawn`);
});

test('every weather code the forecast can return has a drawing', async () => {
  const [{ ART_NAMES }, wc] = await Promise.all([import('../js/ui/art.js'), import('../js/core/weathercode.js')]);
  const codes = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
    71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
  for (const c of codes) {
    for (const isDay of [true, false]) {
      assert.ok(ART_NAMES.includes(wc.icon(c, isDay)), `code ${c} wants "${wc.icon(c, isDay)}"`);
    }
  }
});
