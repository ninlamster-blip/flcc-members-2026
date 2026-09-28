// Service day.
//
// The notes sheet is offered on the days FLCC meets, shows the sermon a leader
// entered for that day (or the week's most recent one), keeps one note a day,
// and the dashboard refuses a sermon it could not show.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as service from '../js/core/service.js';
import { audit } from '../js/admin/audit.js';

test('Friday and Saturday are service days, Sunday is not', () => {
  assert.equal(service.isServiceDay('2026-10-02'), true, 'a Friday');
  assert.equal(service.isServiceDay('2026-10-03'), true, 'a Saturday');
  assert.equal(service.isServiceDay('2026-10-04'), false, 'a Sunday');
});

test('the sermon shown is that day’s, or the week’s latest — never an old one or a future one', () => {
  const sermons = [
    { date: '2026-09-25', ref: 'Psalm 23' },
    { date: '2026-10-02', ref: 'Matthew 7:24-27' },
    { date: '2026-10-09', ref: 'John 15:5' },
  ];
  assert.equal(service.sermonFor(sermons, '2026-10-02').ref, 'Matthew 7:24-27');
  assert.equal(service.sermonFor(sermons, '2026-10-03').ref, 'Matthew 7:24-27', 'Saturday sees Friday’s');
  assert.equal(service.sermonFor(sermons, '2026-10-08').ref, 'Matthew 7:24-27', 'six days on, still this week’s');
  assert.equal(service.sermonFor([{ date: '2026-09-01', ref: 'x' }], '2026-10-02'), null, 'a month-old sermon is not today’s');
  assert.equal(service.sermonFor([{ date: '2026-12-25', ref: 'x' }], '2026-10-02'), null, 'a future one is not shown early');
  assert.equal(service.sermonFor([], '2026-10-02'), null);
  assert.equal(service.sermonFor([{ date: 'Friday', ref: 'x' }], '2026-10-02'), null, 'a badly written date is ignored');
});

test('one note a day, newest first, and an empty sheet is not kept', () => {
  let items = service.keep([], { date: '2026-10-02', learned: 'a' });
  items = service.keep(items, { date: '2026-10-09', learned: 'b' });
  items = service.keep(items, { date: '2026-10-09', learned: 'c' });
  assert.deepEqual(items.map((row) => row.learned), ['c', 'a'], 'saving again the same day replaces');
  assert.equal(service.worthKeeping({ passage: 'John 3:16' }), false, 'a passage alone is not notes');
  assert.equal(service.worthKeeping({ passage: '', doing: 'Pray for my sister' }), true);
  assert.ok(service.PROMPTS.every((p) => p.kids && p.teens), 'every prompt is written for both ages');
});

test('the committed sermons are valid, and the audit refuses ones that are not', () => {
  const committed = JSON.parse(readFileSync(new URL('../content/sermons.json', import.meta.url), 'utf8'));
  assert.ok(Array.isArray(committed));
  const errors = (sermons) => audit({ 'sermons.json': sermons }).problems
    .filter((p) => p.level === 'error' && p.where.startsWith('sermons.json'));
  assert.deepEqual(errors(committed), []);
  const good = { date: '2026-10-02', ref: 'Matthew 7:24-27', title: { kids: 'BUILD ON THE ROCK', teens: 'BUILT ON THE ROCK' }, idea: { kids: 'a', teens: 'b' } };
  assert.deepEqual(errors([good]), []);
  assert.ok(errors([{ ...good, date: 'Friday' }]).length, 'a date the app cannot read');
  assert.ok(errors([{ ...good, ref: '' }]).length, 'no passage');
  assert.ok(errors([{ ...good, idea: { kids: 'a' } }]).length, 'missing the teens line');
  assert.ok(errors([good, { ...good }]).length, 'two sermons on one day');
});
