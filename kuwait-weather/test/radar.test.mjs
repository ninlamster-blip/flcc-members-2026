// The radar map: the projection, the frame index, and the one honesty rule.
//
// The Philippines app has this map too, and the two apps share no code — so
// the last test in this file is the one that stops the copy quietly drifting
// from the original.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as tiles from '../js/ui/tiles.js';
import * as radar from '../js/core/radar.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

// ── the projection ─────────────────────────────────────────────────────────

test('a coordinate survives the round trip through tile space', () => {
  for (const [lat, lon] of [[29.3759, 47.9774], [29.0769, 48.0942], [30.0801, 47.6835], [0, 0]]) {
    for (const z of [4, 7, 10]) {
      const x = tiles.lonToTileX(lon, z);
      const y = tiles.latToTileY(lat, z);
      assert.ok(Math.abs(tiles.tileXToLon(x, z) - lon) < 1e-9, `lon at z${z}`);
      assert.ok(Math.abs(tiles.tileYToLat(y, z) - lat) < 1e-9, `lat at z${z}`);
    }
  }
});

test('the world is 4^z tiles, and Kuwait City is where it should be in them', () => {
  // At zoom 8 the world is 256 tiles across, so a tile index reads almost as a
  // percentage: Kuwait City at 47.98°E is 63% of the way round from the
  // anti-meridian.
  assert.equal(Math.floor(tiles.lonToTileX(47.9774, 8)), 162);
  assert.equal(Math.floor(tiles.latToTileY(29.3759, 8)), 106);
  assert.equal(tiles.lonToTileX(-180, 5), 0);
  assert.equal(tiles.lonToTileX(180, 5), 32);
});

test('Mercator cannot draw the poles, so latitude is clamped rather than made infinite', () => {
  for (const lat of [90, -90, 89.9, -95]) {
    const y = tiles.latToTileY(lat, 6);
    assert.ok(Number.isFinite(y), `${lat} produced ${y}`);
    assert.ok(y >= 0 && y <= 2 ** 6, `${lat} left the world at ${y}`);
  }
});

test('the map wraps eastward round the world and never off the top of it', () => {
  assert.equal(tiles.wrap(-1, 4), 15);
  assert.equal(tiles.wrap(16, 4), 0);
  assert.equal(tiles.wrap(3, 4), 3);

  const view = tiles.viewport({ lat: 84, lon: 179.6, zoom: 3, width: 800, height: 600 });
  for (const t of view.tiles) {
    assert.ok(t.x >= 0 && t.x < 2 ** 3, `x ${t.x} is off the world`);
    assert.ok(t.y >= 0 && t.y < 2 ** 3, `y ${t.y} is off the world`);
  }
});

test('a viewport is covered edge to edge, with no gap and nothing wildly spare', () => {
  const width = 400;
  const height = 300;
  const view = tiles.viewport({ lat: 29.3759, lon: 47.9774, zoom: 8, width, height });

  // Enough to cover: every pixel of the viewport falls inside some tile.
  const covers = (px, py) => view.tiles.some((t) =>
    px >= t.left && px < t.left + 256 && py >= t.top && py < t.top + 256);
  for (const px of [0, 1, width / 2, width - 1]) {
    for (const py of [0, 1, height / 2, height - 1]) {
      assert.ok(covers(px, py), `nothing covers ${px},${py}`);
    }
  }
  // And not extravagantly more than enough — 400×300 needs at most 3×3.
  assert.ok(view.tiles.length <= 9, `${view.tiles.length} tiles for a 400×300 box`);
});

test('the place being looked at lands in the middle of the map', () => {
  const place = { lat: 29.3759, lon: 47.9774 };
  const view = tiles.viewport({ ...place, zoom: 8, width: 400, height: 300 });
  const at = tiles.pointIn(place, { ...view, zoom: 8 });
  assert.equal(at.left, 200);
  assert.equal(at.top, 150);
});

test('dragging the map moves it under the finger, and back again', () => {
  const start = { lat: 29.3759, lon: 47.9774, zoom: 8 };
  const moved = tiles.panBy(start, -60, -40);
  // Dragging left and up moves the view east and south.
  assert.ok(moved.lon > start.lon, 'should have gone east');
  assert.ok(moved.lat < start.lat, 'should have gone south');

  const back = tiles.panBy({ ...moved, zoom: 8 }, 60, 40);
  assert.ok(Math.abs(back.lat - start.lat) < 1e-6);
  assert.ok(Math.abs(back.lon - start.lon) < 1e-6);
});

// ── the frame index ────────────────────────────────────────────────────────

const INDEX = {
  version: '2.0',
  generated: 1_757_200_800,
  host: 'https://tilecache.rainviewer.com',
  radar: {
    past: [
      { time: 1_757_199_600, path: '/v2/radar/1757199600' },
      { time: 1_757_200_200, path: '/v2/radar/1757200200' },
      { time: 1_757_200_800, path: '/v2/radar/1757200800' },
    ],
    nowcast: [
      { time: 1_757_201_400, path: '/v2/radar/nowcast_1757201400' },
      { time: 1_757_202_000, path: '/v2/radar/nowcast_1757202000' },
    ],
  },
};

test('the index becomes one run of frames, oldest first, each knowing if it happened', () => {
  const parsed = radar.parseIndex(INDEX);
  assert.equal(parsed.frames.length, 5);
  assert.deepEqual(parsed.frames.map((f) => f.forecast), [false, false, false, true, true]);
  for (let i = 1; i < parsed.frames.length; i++) {
    assert.ok(parsed.frames[i].time > parsed.frames[i - 1].time, 'frames must run forward');
  }
});

test('the tile host comes from the index, never from this app', () => {
  const parsed = radar.parseIndex(INDEX);
  assert.equal(parsed.host, 'https://tilecache.rainviewer.com');
  const source = readFileSync(new URL('../js/core/radar.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('tilecache'), 'the tile host moves; it must not be written down here');
});

test('a response that is not an index is refused rather than half-read', () => {
  for (const junk of [null, {}, { host: 'x' }, { host: 'x', radar: {} }, { host: 'x', radar: { past: [] } }]) {
    assert.equal(radar.parseIndex(junk), null, JSON.stringify(junk));
  }
  // A frame missing a path is dropped, not drawn as a broken tile.
  const parsed = radar.parseIndex({
    host: 'h', radar: { past: [{ time: 1, path: '/a' }, { time: 2 }] },
  });
  assert.equal(parsed.frames.length, 1);
});

test('the map opens on the last real sweep, not on a projection of one', () => {
  const parsed = radar.parseIndex(INDEX);
  const i = radar.latestObserved(parsed.frames);
  assert.equal(i, 2);
  assert.equal(parsed.frames[i].forecast, false);
  // With nothing observed at all it still has to land somewhere valid.
  assert.equal(radar.latestObserved([{ time: 1, path: '/a', forecast: true }]), 0);
});

test('a tile URL is the frame path, the tile, and the colour ramp', () => {
  const url = radar.tileUrl('https://tilecache.rainviewer.com', '/v2/radar/1757200800', { z: 8, x: 162, y: 106 });
  assert.equal(url, 'https://tilecache.rainviewer.com/v2/radar/1757200800/256/8/162/106/4/1_1.png');
  assert.ok(!url.includes('undefined'));
  assert.ok(!/[?&]/.test(url), 'no query string, and so nothing to smuggle into one');
});

test('the label says how old the sweep is, and says when it has not happened yet', () => {
  const now = new Date(1_757_200_800 * 1000);
  const frame = (time, forecast = false) => ({ time, path: '/p', forecast });
  assert.equal(radar.frameLabel(frame(1_757_200_800), now), 'Just now');
  assert.equal(radar.frameLabel(frame(1_757_200_200), now), '10 min ago');
  assert.equal(radar.frameLabel(frame(1_757_199_600), now), '20 min ago');
  assert.equal(radar.frameLabel(frame(1_757_201_400, true), now), 'Nowcast, 10 min ahead');
  assert.equal(radar.frameLabel(null, now), '—');
});

test('a sweep half an hour old is called stale, because the rain has moved', () => {
  const now = new Date(1_757_200_800 * 1000);
  assert.equal(radar.frameAge({ time: 1_757_200_800 - 20 * 60 }, now).stale, false);
  assert.equal(radar.frameAge({ time: 1_757_200_800 - 45 * 60 }, now).stale, true);
});

test('an index that fails to load throws rather than returning an empty sky', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    await assert.rejects(() => radar.load(), /503/);
  } finally {
    globalThis.fetch = real;
  }
});

// ── the one thing the map must never imply ─────────────────────────────────

test('the page says a blank map is not the same as no rain', () => {
  // Radar coverage is not uniform, and an empty screen over an uncovered area
  // looks exactly like a dry one. This is the sentence that stops it lying.
  const card = html.slice(html.indexOf('id="h-map"'), html.indexOf('id="h-advisories"'));
  assert.match(card, /not the same as no rain/i);
  assert.match(card, /id="map-note"/);
  // And it is body copy in the card, not a footnote under the app.
  assert.ok(card.indexOf('not the same as no rain') < card.indexOf('</section>'));
});

test('the map is called radar, not forecast', () => {
  const card = html.slice(html.indexOf('id="h-map"'), html.indexOf('id="h-advisories"'));
  assert.match(card, /not a forecast/i);
  // And it says plainly that an empty map is the normal state here, so that a
  // dry screen in June does not read as a broken app.
  assert.match(card, /most of the year/i);
});

test('the sources under the map are credited on the page', () => {
  assert.match(html, /rainviewer\.com/);
  assert.match(html, /openstreetmap/i);
});

test('every control the map bar needs is in the page and in the stylesheet', () => {
  for (const id of ['map', 'map-play', 'map-time', 'map-when', 'map-note']) {
    assert.ok(html.includes(`id="${id}"`), `#${id} is missing from index.html`);
  }
  for (const rule of ['.map ', '.map-tile', '.map-pin', '.map-attrib', '.map-bar']) {
    assert.ok(css.includes(rule), `${rule} has no style`);
  }
  // The tile size in CSS has to be the tile size in the projection, or the
  // map tears along every seam.
  assert.match(css, new RegExp(`\\.map-tile\\s*\\{[^}]*width:\\s*${tiles.TILE_SIZE}px`));
});

// ── the copy, and what holds it in place ───────────────────────────────────

test('the projection is character for character the one the other app uses', () => {
  // `ui/tiles.js` is a pure algorithm — Web Mercator, which has not changed
  // since 2005 — and it exists twice in this repository because these two apps
  // share no code by design. A duplicate with nothing holding it in place
  // drifts, and a projection that drifts tears the map along every seam. So
  // this is a build-time read of the other app's source, on the same terms as
  // the crossword engine in flcc-adults: nothing ships to a browser across the
  // boundary, and `boundary.test.mjs` still enforces that at runtime.
  //
  // If one of them genuinely needs to change, change both. That is the point
  // of this test, not an obstacle to it.
  const here = readFileSync(new URL('../js/ui/tiles.js', import.meta.url), 'utf8');
  const there = readFileSync(new URL('../../ph-weather/js/ui/tiles.js', import.meta.url), 'utf8');
  const body = (src) => src.slice(src.indexOf('export const TILE_SIZE'));
  assert.ok(body(here).length > 1500, 'the file moved out from under this test');
  assert.equal(body(here), body(there), 'the two projections have drifted apart');
});
