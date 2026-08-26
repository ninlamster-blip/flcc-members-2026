// The illustration system is code, so it can be tested like code: every story
// has a picture, every picture is self-contained, and none of them can reach
// out to the network.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene, daypart, SCENE_IDS, hasScene, INK } from '../js/core/art.js';

const stories = JSON.parse(readFileSync(new URL('../content/stories/index.json', import.meta.url), 'utf8'));

test('every story has an illustration, and every illustration a story', () => {
  for (const story of stories) {
    assert.ok(hasScene(story.slug), `${story.slug} has no scene`);
  }
  assert.deepEqual([...SCENE_IDS].sort(), [...stories.map((s) => s.slug)].sort());
});

test('a scene is valid, self-contained SVG', () => {
  for (const id of SCENE_IDS) {
    const svg = scene(id, { title: id });
    assert.ok(svg.startsWith('<svg'), `${id}: not an svg`);
    assert.ok(svg.trimEnd().endsWith('</svg>'), `${id}: unclosed`);
    assert.match(svg, /viewBox="0 0 300 200"/, `${id}: no viewBox`);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${id}: broken geometry`);
    assert.ok(!/<script|href=|url\(http|xlink/i.test(svg), `${id}: must not reach outside itself`);
    assert.ok(svg.length > 400, `${id}: suspiciously empty`);
  }
});

test('scenes are labelled for a screen reader, or explicitly hidden', () => {
  assert.match(scene('jonah', { title: 'Jonah Runs Away' }), /aria-label="Jonah Runs Away"/);
  assert.match(scene('jonah'), /aria-hidden="true"/);
  assert.equal(scene('not-a-story'), '');
});

test('scenes are drawn from the one palette', () => {
  const palette = new Set(Object.values(INK).map((c) => c.toLowerCase()));
  for (const id of SCENE_IDS) {
    const colours = [...scene(id).matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase());
    for (const colour of colours) {
      assert.ok(palette.has(colour), `${id} uses ${colour}, which is not in the palette`);
    }
  }
});

test('the same scene is drawn identically every time', () => {
  assert.equal(scene('creation'), scene('creation'), 'scenes must not wander between renders');
});

test('the time of day picture covers the whole clock', () => {
  for (const hour of [0, 6, 9, 12, 15, 17, 20, 23]) {
    const svg = daypart(hour);
    assert.ok(svg.includes('<svg') && !/NaN|undefined/.test(svg), `hour ${hour}`);
  }
});
