// Content is data, and this suite is the schema. It is what stops a story
// shipping without a band, or a reference that does not exist (SPEC.md §14).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { BANDS } from '../js/core/age.js';
import { parseRef } from '../js/core/refs.js';
import { TYPES } from '../js/core/challenges.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'));

function allBands(value, where) {
  assert.equal(typeof value, 'object', `${where} should be keyed by band`);
  assert.ok(value !== null && !Array.isArray(value), `${where} should be keyed by band`);
  for (const band of BANDS) {
    const text = value[band];
    assert.ok(text !== undefined && text !== null, `${where} is missing the ${band} band`);
    const flat = Array.isArray(text) ? text.join(' ') : text;
    assert.equal(typeof flat, 'string', `${where} (${band}) should be text`);
    assert.ok(flat.trim().length > 0, `${where} (${band}) is empty`);
  }
}

function validRef(value, where) {
  assert.ok(parseRef(value), `${where}: "${value}" is not a reference in the Bible`);
}

test('every story is written for every age band', () => {
  const index = read('stories/index.json');
  assert.ok(index.length >= 12, 'the MVP set is a dozen stories or more');

  const files = readdirSync(new URL('../content/stories/', import.meta.url))
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .map((name) => name.replace(/\.json$/, ''));
  assert.deepEqual([...files].sort(), [...index.map((s) => s.slug)].sort(), 'index and files agree');

  for (const entry of index) {
    assert.ok(['OT', 'NT'].includes(entry.testament), `${entry.slug}: testament`);
    allBands(entry.summary, `${entry.slug} summary`);

    const story = read(`stories/${entry.slug}.json`);
    assert.equal(story.slug, entry.slug);
    assert.equal(story.title, entry.title);
    validRef(String(story.reference).split(/[,-]/)[0], `${entry.slug} reference`);

    for (const field of ['story', 'whatHappened', 'whatItTeaches', 'thinkAboutIt', 'pray']) {
      allBands(story[field], `${entry.slug}.${field}`);
    }
    for (const band of BANDS) {
      assert.ok(Array.isArray(story.story[band]), `${entry.slug}.story.${band} should be paragraphs`);
      assert.ok(story.story[band].length >= 2, `${entry.slug}.story.${band} is too short`);
    }

    const challenge = story.challenge;
    assert.ok(challenge, `${entry.slug} has a challenge`);
    allBands(challenge.prompt, `${entry.slug} challenge prompt`);
    allBands(challenge.explain, `${entry.slug} challenge explanation`);
    assert.ok(Array.isArray(challenge.options) && challenge.options.length >= 2, `${entry.slug} options`);
    assert.ok(Number.isInteger(challenge.answer) && challenge.options[challenge.answer] !== undefined,
      `${entry.slug} answer points at a real option`);
  }
});

test('the daily pool is deep enough and every reference resolves', () => {
  const daily = read('daily.json');
  assert.ok(daily.length >= 40, `only ${daily.length} daily entries — the pool repeats too soon`);
  const seen = new Set();
  for (const entry of daily) {
    assert.ok(entry.title && entry.title.length < 40, `daily title: ${entry.title}`);
    validRef(entry.ref, 'daily');
    allBands(entry.note, `daily "${entry.title}" note`);
    assert.ok(!seen.has(entry.ref), `daily pool repeats ${entry.ref}`);
    seen.add(entry.ref);
  }
});

test('every challenge type has a pool, and every answer is answerable', () => {
  const pools = read('challenges.json');
  assert.deepEqual(Object.keys(pools).sort(), [...TYPES].sort());
  for (const [type, pool] of Object.entries(pools)) {
    assert.ok(pool.length >= 4, `${type} pool has only ${pool.length}`);
    for (const item of pool) {
      allBands(item.prompt, `${type} prompt`);
      if (item.ref) validRef(item.ref, `${type} ref`);
      if (type === 'know') {
        assert.ok(Array.isArray(item.options) && item.options.length >= 2, `${type} options`);
        assert.ok(Number.isInteger(item.answer) && item.options[item.answer] !== undefined, `${type} answer`);
        allBands(item.explain, `${type} explanation`);
      }
    }
  }
});

test('memory verses, prayer moods and journal prompts are complete', () => {
  const verses = read('memory-verses.json');
  assert.ok(verses.length >= 10);
  for (const verse of verses) {
    validRef(verse.ref, 'memory verse');
    allBands(verse.why, `memory verse ${verse.ref}`);
  }

  const moods = read('prayer-moods.json');
  assert.ok(moods.length >= 7, 'one for each feeling in the spec');
  for (const mood of moods) {
    assert.ok(mood.id && mood.emoji && mood.name, 'mood identity');
    assert.ok(Array.isArray(mood.verses) && mood.verses.length >= 2, `${mood.id} verses`);
    mood.verses.forEach((ref) => validRef(ref, `${mood.id} verse`));
    allBands(mood.starter, `${mood.id} starter`);
    allBands(mood.reflection, `${mood.id} reflection`);
  }

  const prompts = read('journal-prompts.json');
  for (const key of ['teaching', 'thankful', 'help']) allBands(prompts[key], `journal ${key}`);
});

test('the Bible opens somewhere for a reader who does not know where to start', () => {
  const entries = read('start-here.json');
  assert.ok(entries.length >= 5, 'a handful of ways in, not a wall of 66 books');
  for (const entry of entries) {
    validRef(entry.ref, 'start-here');
    assert.ok(entry.label['7-10'] && entry.label['11-14'], `${entry.ref}: needs a label for both younger bands`);
    assert.ok(entry.label['7-10'].length < 40, `${entry.ref}: the youngest label is too long to scan`);
  }
});

test('every region has help lines, and no line is a bare unlabelled number', () => {
  const regions = readdirSync(new URL('../content/safety/', import.meta.url)).filter((n) => n.endsWith('.json'));
  assert.ok(regions.length >= 3);
  for (const file of regions) {
    const region = read(`safety/${file}`);
    assert.ok(region.region && region.label, file);
    assert.ok(Array.isArray(region.lines) && region.lines.length >= 2, `${file} lines`);
    for (const line of region.lines) {
      assert.ok(line.name, `${file}: every line is named`);
      assert.ok(line.number || line.detail, `${file}: ${line.name} needs a number or an explanation`);
    }
    assert.ok(region.lines.some((line) => /trusted adult/i.test(line.name)),
      `${file}: a trusted adult comes before any phone number`);
  }
});
