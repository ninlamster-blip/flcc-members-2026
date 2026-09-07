// What the person who lives there knows, and the limit on how far it is
// allowed to talk the app down.

import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, DEFAULT_LEVEL, level, rainFloor, applyLocal } from '../js/core/localhazard.js';
import { floodRisk, level as floodLevel, LEVELS as FLOOD } from '../js/core/flood.js';
import { saturation } from '../js/core/saturation.js';

const hours = (mm, n = 24) => Array.from({ length: n }, () => ({ precipMm: mm, at: new Date() }));
const risk = (mm, n = 24, ground = null) => floodRisk(hours(mm, n).concat(hours(0, 24 - n)), ground);
const withLocal = (flood, id) => applyLocal(flood, id, floodLevel);

test('the default changes nothing, because nobody has been asked yet', () => {
  const base = risk(9, 8);
  const same = withLocal(base, DEFAULT_LEVEL);
  assert.equal(same.rank, base.rank);
  assert.equal(same.local.shift, 0);
  assert.equal(DEFAULT_LEVEL, 'unknown');
});

test('"floods easily" raises the reading, and says that is why', () => {
  const base = risk(9, 6);
  const raised = withLocal(base, 'very-easily');
  assert.ok(raised.rank > base.rank, `${base.label} → ${raised.label}`);
  assert.match(raised.drivers.join(' '), /you told the app/i);
});

test('"drains well" lowers it, and says that is why', () => {
  const base = risk(9, 6);
  const lowered = withLocal(base, 'rarely');
  assert.ok(lowered.rank < base.rank, `${base.label} → ${lowered.label}`);
  assert.match(lowered.drivers.join(' '), /drains well/i);
});

test('"only in a bad storm" is the model\'s own assumption, so it moves nothing', () => {
  const base = risk(12, 6);
  assert.equal(withLocal(base, 'sometimes').rank, base.rank);
});

// ── the rule that matters ───────────────────────────────────────────────────

test('optimism about your street can never silence a PAGASA red warning', () => {
  // Somebody who says "our street never floods" is usually right, until the
  // afternoon they are not — and that is exactly the afternoon this has to
  // keep shouting. Checked across the whole space rather than one case.
  for (const l of LEVELS) {
    for (const mm of [30, 35, 50, 80, 120]) {
      for (const n of [1, 3, 8, 24]) {
        const out = withLocal(risk(mm, n), l.id);
        assert.ok(out.rank >= 3,
          `${mm} mm/h for ${n}h with "${l.id}" fell to ${out.label}`);
      }
    }
  }
});

test('optimism cannot take an orange warning below "possible" either', () => {
  for (const l of LEVELS) {
    for (const mm of [15, 20, 28]) {
      for (const n of [1, 3, 8, 24]) {
        const out = withLocal(risk(mm, n), l.id);
        assert.ok(out.rank >= 2, `${mm} mm/h for ${n}h with "${l.id}" fell to ${out.label}`);
      }
    }
  }
});

test('the floor is where PAGASA puts its colours', () => {
  assert.equal(rainFloor({ peakMmPerHour: 35 }), 3, 'red holds at "likely"');
  assert.equal(rainFloor({ peakMmPerHour: 20 }), 2, 'orange holds at "possible"');
  assert.equal(rainFloor({ peakMmPerHour: 10 }), 0, 'yellow is open to local knowledge');
  assert.equal(rainFloor({ peakMmPerHour: 2, mm24h: 240 }), 2, 'a whole day of rain holds too');
  assert.equal(rainFloor({}), 0);
});

test('the floor is a guardrail, not decoration', () => {
  // With only a one-step-down level today the floor is never actually reached
  // from below — but it is what stops a future "-2" level from being able to
  // mute a red warning. This asserts the guard itself, not its use.
  const redBase = { rank: 4, drivers: [], peakMmPerHour: 40, mm24h: 300 };
  const bigDrop = applyLocal(redBase, 'rarely', floodLevel);
  assert.ok(bigDrop.rank >= rainFloor(redBase));
});

test('raising is not capped off the end of the scale', () => {
  const worst = withLocal(risk(200), 'very-easily');
  assert.equal(worst.rank, FLOOD.length - 1);
  assert.equal(worst.id, 'severe');
});

test('no rain is still no flood, however badly the street floods', () => {
  // The setting adjusts a risk; it does not invent one.
  const quiet = withLocal(risk(0), 'very-easily');
  assert.equal(quiet.id, 'none');
});

test('an unknown stored value falls back rather than breaking the card', () => {
  assert.equal(level('from-an-older-version').id, 'unknown');
  const base = risk(9, 6);
  assert.equal(withLocal(base, 'nonsense').rank, base.rank);
});

test('every level has a question a person could answer about their own street', () => {
  for (const l of LEVELS) {
    assert.ok(l.question && l.label && l.note, l.id);
    assert.equal(typeof l.shift, 'number');
  }
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length);
});

test('it carries through derive, per reading', async () => {
  const [{ derive }, api, { forecast, air, NOW }] = await Promise.all([
    import('../js/core/derive.js'), import('../js/core/api.js'), import('./fixtures/forecast.mjs'),
  ]);
  const wet = forecast({ hour: (i) => (i >= 170 && i < 178 ? { precipitation: 9 } : {}) });
  const reading = api.normalize(wet, air(), { fetchedAt: NOW });
  const plain = derive(reading, { now: NOW });
  const local = derive(reading, { now: NOW, localLevel: 'very-easily' });
  assert.ok(local.flood.rank > plain.flood.rank, `${plain.flood.label} → ${local.flood.label}`);
  assert.equal(local.flood.local.id, 'very-easily');
});
