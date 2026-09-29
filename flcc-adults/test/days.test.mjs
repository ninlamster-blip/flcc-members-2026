// WHAT DAY IT IS.
//
// Everything daily in this app — the Scripture moment, the crossword's grid —
// is dealt by the phone's own calendar day (rotation.dayIndex). A day key built
// from toISOString() is the UTC day instead, and east of Greenwich the two
// disagree every morning: until 03:00 in Kuwait and 08:00 in Manila the
// crossword loaded yesterday's answers into today's new grid and called it
// solved. Day keys come from progress.today(), which is the phone's own day.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as progress from '../js/core/progress.js';

const dir = new URL('../js/', import.meta.url);
const files = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith('.js'));

test('no day key is the UTC date', () => {
  for (const file of files) {
    const source = readFileSync(new URL(String(file), dir), 'utf8');
    assert.equal(/toISOString\(\)\.slice\(0,\s*10\)/.test(source), false,
      `js/${file} builds a day from toISOString() — use progress.today(), the phone's own day`);
  }
});

test('progress.today() is the local calendar day, even when UTC has not reached it', () => {
  // 01:30 on 30 September on this phone; in UTC it may still be the 29th.
  const early = new Date(2026, 8, 30, 1, 30);
  assert.equal(progress.today(early), '2026-09-30');
});
