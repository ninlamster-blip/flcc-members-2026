// This app is a standalone project that happens to share a repository with
// several others. These are the tests that keep it standalone.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

const sourceFiles = walk(ROOT).filter((f) => /\.(js|mjs|html|css|json|webmanifest)$/.test(f));
const appFiles = sourceFiles.filter((f) => !relative(ROOT, f).startsWith('test'));
const read = (f) => readFileSync(f, 'utf8');
// Comments talk about the rules; only code has to obey them.
const code = (f) => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('there are source files to check', () => {
  assert.ok(appFiles.length > 10, `only found ${appFiles.length}`);
});

test('nothing here imports another application in this repository', () => {
  const forbidden = [
    /from\s+['"][^'"]*church\.js['"]/,
    /\bFLCC\s*\.\s*(data|key)\b/,
    /from\s+['"][^'"]*\/(shepherd|lamp|flcc-next|flcc-adults|ph-weather|ask-proxy)\//,
    /\.\.\/\.\.\/(shepherd|lamp|flcc-next|flcc-adults|ph-weather|churches|ask-proxy)\b/,
  ];
  for (const file of appFiles) {
    const body = read(file);
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(body), `${relative(ROOT, file)} reaches outside this app: ${pattern}`);
    }
  }
});

test('every relative import stays inside this app', () => {
  for (const file of appFiles.filter((f) => f.endsWith('.js'))) {
    const body = read(file);
    for (const [, spec] of body.matchAll(/(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g)) {
      assert.ok(!spec.startsWith('../../'), `${relative(ROOT, file)} imports ${spec}`);
      const resolved = join(dirname(file), spec);
      assert.ok(existsSync(resolved), `${relative(ROOT, file)} imports ${spec}, which does not exist`);
    }
  }
});

test('no dependencies, no build step, no bundler', () => {
  assert.ok(!existsSync(join(ROOT, 'package.json')), 'this app installs nothing');
  assert.ok(!existsSync(join(ROOT, 'node_modules')));
  for (const file of appFiles) {
    const body = read(file);
    assert.ok(!/from\s+['"][a-z@][^'".][^'"]*['"]/.test(body.replace(/from\s+['"]\.[^'"]*['"]/g, '')),
      `${relative(ROOT, file)} imports a package`);
  }
});

test('nothing loads from a third-party host at runtime', () => {
  // The two forecast endpoints are the only outbound calls this app makes,
  // and they are data, not code.
  // This list is short on purpose, and every entry on it was a decision.
  //
  // Open-Meteo is the forecast, and for a long time it was the whole list.
  // The radar map is the deliberate loosening: Open-Meteo publishes hourly
  // model output and no radar tiles at all, so "where is the rain right now"
  // cannot be answered from it. RainViewer serves the radar sweeps, keyless,
  // and OpenStreetMap the base map underneath them — the tile host itself
  // comes from RainViewer's own index at runtime rather than being written
  // down here. Nothing is sent to either but a tile coordinate.
  //
  // The base map was CARTO first, and CARTO's tiles came back reading "API key
  // required". That is the shape of the risk in this whole list: a host that is
  // keyless today can gate tomorrow, and a static page has nowhere to keep a
  // key. Prefer a source that never wanted one.
  const allowed = [
    'api.open-meteo.com', 'air-quality-api.open-meteo.com', 'open-meteo.com',
    'api.rainviewer.com', 'www.rainviewer.com',
    'tile.openstreetmap.org', 'www.openstreetmap.org',
  ];
  for (const file of appFiles) {
    for (const [, host] of read(file).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
      assert.ok(allowed.includes(host) || host.endsWith('w3.org'),
        `${relative(ROOT, file)} references ${host}`);
    }
  }
});

test('no API key, token or secret is anywhere in the source', () => {
  for (const file of appFiles) {
    const body = read(file);
    assert.ok(!/\b(api[_-]?key|apiKey|access[_-]?token|client[_-]?secret)\s*[:=]\s*['"][^'"]+['"]/i.test(body),
      `${relative(ROOT, file)} looks like it carries a credential`);
  }
});

test('storage is reached only through the one module that guards it', () => {
  const guarded = join(ROOT, 'js/core/storage.js');
  for (const file of appFiles.filter((f) => f.endsWith('.js') && f !== guarded)) {
    assert.ok(!/\blocalStorage\b|\bsessionStorage\b/.test(code(file)),
      `${relative(ROOT, file)} touches storage directly, bypassing the namespace guard`);
  }
});

test('the service worker caches every module the app actually loads', () => {
  const sw = read(join(ROOT, 'sw.js'));
  const modules = walk(join(ROOT, 'js')).filter((f) => f.endsWith('.js'));
  for (const file of modules) {
    const path = `./${relative(ROOT, file)}`;
    assert.ok(sw.includes(path), `sw.js does not cache ${path}`);
  }
});

/** The paths listed in SHELL, minus './', which is index.html under another name. */
function shellPaths(sw) {
  const from = sw.indexOf('const SHELL = [');
  const block = sw.slice(from, sw.indexOf('];', from));
  return [...block.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean).sort();
}

/** What the cache name has to carry: the content of everything it caches. */
function fingerprint(paths) {
  const h = createHash('sha256');
  for (const path of paths) {
    h.update(path);
    h.update(readFileSync(join(ROOT, path)));
  }
  return h.digest('hex').slice(0, 8);
}

test('the cache name carries a fingerprint of the shell it caches', () => {
  // The old version of this test pinned the shape of a hand-written "v2" and
  // said in its own comment that a test cannot know when a file changed. It
  // can, if the expected content is written down — and the weaker version let
  // six changed shell files ship under an unchanged name, so every device that
  // had installed the app kept serving the old one. The fetch handler below is
  // cache-first, so that is forever, not until the next reload.
  const sw = read(join(ROOT, 'sw.js'));
  const paths = shellPaths(sw);
  assert.ok(paths.length > 20, 'SHELL moved out from under this test');

  const [, name] = sw.match(/const CACHE = '([^']+)'/) || [];
  assert.ok(name, 'the cache name moved out from under this test');

  const want = fingerprint(paths);
  assert.ok(
    name.endsWith(`-${want}`),
    `the shell changed but the cache name did not. Set CACHE to 'kuwait-weather-vN-${want}' `
    + `(bump N too), so the activate handler drops the old cache and devices get the new files. `
    + `It reads '${name}'.`,
  );

  const [, version] = name.match(/-v(\d+)-/) || [];
  assert.ok(Number(version) >= 3, 'the version only ever goes up');
  assert.match(sw, /caches\.keys\(\)[\s\S]*filter\(\(n\) => n !== CACHE\)/, 'stale caches must be deleted');
});

test('every file the shell promises to cache is a file that exists', () => {
  // addAll() rejects as a whole if any one entry 404s, which installs nothing
  // and leaves the app with no offline shell at all.
  const sw = read(join(ROOT, 'sw.js'));
  for (const path of shellPaths(sw)) {
    assert.ok(existsSync(join(ROOT, path)), `sw.js caches ./${path}, which is not in the app`);
  }
});

test('the service worker never caches a forecast', () => {
  const sw = read(join(ROOT, 'sw.js'));
  assert.ok(!sw.includes('open-meteo'), 'a cached forecast shown as current is worse than none');
  assert.ok(sw.includes('self.location.origin'), 'cross-origin requests must bypass the cache');
});

test('every element the app reaches for exists in the page', () => {
  const html = read(join(ROOT, 'index.html'));
  const app = read(join(ROOT, 'js/app.js'));
  const ids = [...app.matchAll(/\bel\(['"]([a-z-]+)['"]\)/g)].map((m) => m[1]);
  assert.ok(ids.length > 5);
  for (const id of new Set(ids)) {
    assert.ok(html.includes(`id="${id}"`), `app.js looks for #${id}, which index.html does not have`);
  }
});

test('every icon the screens ask for is one that exists', () => {
  const sources = [read(join(ROOT, 'js/ui/render.js')), read(join(ROOT, 'js/app.js'))].join('\n');
  const asked = [...sources.matchAll(/\bicon\(['"]([a-zA-Z]+)['"]/g)].map((m) => m[1]);
  const defined = [...read(join(ROOT, 'js/ui/icons.js')).matchAll(/^\s{2}([a-zA-Z]+):\s*'/gm)].map((m) => m[1]);
  assert.ok(asked.length > 3);
  for (const name of new Set(asked)) {
    assert.ok(defined.includes(name), `icon "${name}" is used but not drawn`);
  }
});

test('every advisory icon is one that exists', async () => {
  const advisories = read(join(ROOT, 'js/core/advisories.js'));
  const used = [...advisories.matchAll(/icon:\s*'([a-zA-Z]+)'/g)].map((m) => m[1]);
  const { ICON_NAMES: names } = await import('../js/ui/icons.js');
  assert.ok(used.length > 4);
  for (const name of new Set(used)) assert.ok(names.includes(name), `advisory icon "${name}" is not drawn`);
});
