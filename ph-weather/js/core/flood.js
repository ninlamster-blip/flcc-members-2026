// How likely the street is to flood.
//
// ── What this is ───────────────────────────────────────────────────────────
// Three numbers, combined openly:
//
//   1. The heaviest hour of rain in the next stretch, on PAGASA's own warning
//      thresholds. This is what their yellow, orange and red mean.
//   2. How much rain falls in total across the next 24 hours, because six
//      hours of steady moderate rain floods places one violent hour does not.
//   3. How saturated the ground already is, from the past three days, because
//      rain on full ground has nowhere to go but the road.
//
// ── What this is not ───────────────────────────────────────────────────────
// It is not a flood forecast. A real one needs the shape of the land, the
// drainage, the river level and — in Marikina's case — what the Wawa dam is
// doing. None of that is in a weather API and none of it is here. Two streets
// with identical rain flood completely differently, and this app cannot tell
// them apart.
//
// So every level says which of the three drove it, and the screen says plainly
// that PAGASA and the local disaster office are the ones to act on.

import { intensityFor, total } from './rain.js';

export const LEVELS = [
  { rank: 0, id: 'none',     label: 'No flooding expected',
    advice: 'Nothing in the rainfall to suggest flooding.' },
  { rank: 1, id: 'low',      label: 'Flooding unlikely',
    advice: 'Some rain, but not enough to trouble ground that drains normally.' },
  { rank: 2, id: 'moderate', label: 'Flooding possible',
    advice: 'Enough rain to flood low-lying spots and blocked drains. Watch the street before you set out.' },
  { rank: 3, id: 'high',     label: 'Flooding likely',
    advice: 'Streets in low areas can go under. Move anything valuable up, keep documents high, and do not park in a basement.' },
  { rank: 4, id: 'severe',   label: 'Serious flooding likely',
    advice: 'Serious flooding expected. Leave low ground early rather than late, and never drive into moving water.' },
];

export function level(rank) {
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, rank))];
}

// The intensity bands, translated into a starting flood rank.
const FROM_INTENSITY = { none: 0, light: 0, moderate: 1, heavy: 2, intense: 3, torrential: 4 };

// Twenty-four-hour totals that raise the level regardless of any single hour.
const DAY_TOTAL_RAISE = 100;
const DAY_TOTAL_RAISE_MORE = 200;

/**
 * @param {object[]} ahead   the hours from now on
 * @param {object|null} ground  the result of `saturation()`
 * @returns {{rank, id, label, advice, drivers: string[], peakMmPerHour: number,
 *            mm24h: number, peakAt: Date|null}}
 */
export function floodRisk(ahead = [], ground = null) {
  const next24 = ahead.slice(0, 24);
  const peak = next24.reduce(
    (worst, h) => ((h.precipMm ?? 0) > (worst?.precipMm ?? -1) ? h : worst),
    null,
  );
  const peakMm = peak?.precipMm ?? 0;
  const mm24h = total(next24);

  const band = intensityFor(peakMm);
  let rank = FROM_INTENSITY[band.id] ?? 0;
  const drivers = [];
  if (rank > 0) drivers.push(`${band.label.toLowerCase()} at its heaviest hour (${peakMm.toFixed(1)} mm)`);

  if (mm24h >= DAY_TOTAL_RAISE_MORE) {
    rank += 2;
    drivers.push(`${Math.round(mm24h)} mm expected over 24 hours`);
  } else if (mm24h >= DAY_TOTAL_RAISE) {
    rank += 1;
    drivers.push(`${Math.round(mm24h)} mm expected over 24 hours`);
  }

  if (ground && ground.rank >= 4) {
    rank += 2;
    drivers.push(`ground already soaked — ${ground.reason}`);
  } else if (ground && ground.rank === 3) {
    rank += 1;
    drivers.push(`ground already saturated — ${ground.reason}`);
  }

  // Saturation alone is not a flood. Without rain to run off it, soaked ground
  // is just soaked ground — saying otherwise would raise a flood warning every
  // week of the habagat and teach people to ignore the app.
  if (mm24h < 1 && peakMm < 1) {
    return { ...level(0), drivers: [], peakMmPerHour: peakMm, mm24h, peakAt: peak?.at ?? null };
  }
  // A little rain on full ground is worth a mention, never more than that.
  if (peakMm < 2.5 && mm24h < 20) rank = Math.min(rank, 1);

  return {
    ...level(Math.min(LEVELS.length - 1, rank)),
    drivers,
    peakMmPerHour: peakMm,
    mm24h,
    peakAt: peak?.at ?? null,
  };
}
