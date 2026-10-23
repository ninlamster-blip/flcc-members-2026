/**
 * The anniversary timeline: a church's history projected one milestone at a
 * time. These checks exist because the file is hand-edited by whoever has the
 * history, and a mistake in it is only seen on the projector, in front of the
 * whole congregation.
 *
 * Run: node --test 'test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadChurch, readRepoFile, readRepoJSON, exists } from './lib/extract.mjs';

const FLCC = loadChurch();

/** Every church that has published a timeline. */
const STORIES = FLCC.churches
  .map(c => ({ slug: c.slug, file: FLCC.dataFor(c.slug, 'anniversary.json').replace(/^\.\//, '') }))
  .filter(s => exists(s.file));

test('Abundance has a timeline', () => {
  assert.ok(STORIES.some(s => s.slug === 'abundance'), 'anniversary.json is missing from the repo root');
});

test('the page reads the timeline through FLCC.data, never a fixed path', () => {
  const src = readRepoFile('anniversary.html');
  assert.match(src, /FLCC\.data\('anniversary\.json'\)/);
  assert.doesNotMatch(src, /['"]\.?\/?(churches\/[a-z-]+\/)?anniversary\.json['"]\s*\+/, 'build the URL with FLCC.data()');
});

test('the page names no church — it reads FLCC.name', () => {
  const src = readRepoFile('anniversary.html');
  for (const c of FLCC.churches) {
    assert.ok(!src.includes(c.name), `anniversary.html hardcodes "${c.name}"`);
  }
});

for (const { slug, file } of STORIES) {
  const story = readRepoJSON(file);

  test(`${slug}: the opening and the dates are filled in`, () => {
    assert.ok(story.title, 'needs a title for the opening slide');
    assert.ok(Number.isInteger(story.founded), 'founded must be a year');
    assert.match(story.anniversaryDate, /^\d{4}-\d{2}-\d{2}$/, 'anniversaryDate must be YYYY-MM-DD');
    assert.ok(!Number.isNaN(Date.parse(story.anniversaryDate)), 'anniversaryDate must be a real date');
    assert.ok(+story.anniversaryDate.slice(0, 4) > story.founded, 'the anniversary comes after the founding');
  });

  test(`${slug}: every milestone has a year and a title, in order, inside the church's lifetime`, () => {
    const ms = story.milestones;
    assert.ok(Array.isArray(ms) && ms.length > 0, 'needs at least one milestone');
    const end = +story.anniversaryDate.slice(0, 4);
    let prev = -Infinity;
    for (const m of ms) {
      assert.ok(Number.isInteger(m.year), `"${m.title}": year must be a whole number`);
      assert.ok(typeof m.title === 'string' && m.title.trim(), `${m.year}: needs a title`);
      assert.ok(m.year >= story.founded && m.year <= end, `${m.year} is outside ${story.founded}–${end}`);
      assert.ok(m.year >= prev, `${m.year} comes after ${prev} — keep milestones in year order`);
      prev = m.year;
    }
  });

  test(`${slug}: every photo named in the timeline exists`, () => {
    const base = FLCC.dataFor(slug, '').replace(/^\.\//, '').replace(/\/$/, '');
    for (const m of story.milestones) {
      if (!m.photo || /^(https?:)?\/\//.test(m.photo)) continue;
      const path = m.photo.startsWith('/') ? m.photo.slice(1) : (base ? base + '/' : '') + m.photo;
      assert.ok(exists(path), `${m.year}: photo ${path} is not in the repo`);
    }
  });
}
