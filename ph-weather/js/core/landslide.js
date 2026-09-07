// Whether the ground above you is likely to move.
//
// This is the most careful module in the app, because it is the hazard that
// kills the most people in the Philippines and the one a weather API knows
// least about.
//
// What makes a slope fail is the slope: how steep it is, what it is made of,
// what was cut into it and what was built on it. PHIVOLCS and the MGB publish
// the susceptibility maps that hold that information, barangay by barangay,
// and nothing here replaces them.
//
// What a forecast *can* say is the trigger half: rainfall on ground that is
// already full. Almost every rain-induced landslide in the country follows
// either a long saturating spell or an intense burst on top of one, and both
// of those are visible here. So this module reports the trigger and says
// plainly that it does not know the slope.

import { intensityFor } from './rain.js';

export const LEVELS = [
  { rank: 0, id: 'none',     label: 'Nothing indicated',
    advice: 'Neither the rainfall nor the ground suggests slope movement.' },
  { rank: 1, id: 'watch',    label: 'Worth watching',
    advice: 'The ground is wetting up. Worth knowing whether there is a slope above you.' },
  { rank: 2, id: 'elevated', label: 'Conditions building',
    advice: 'Wet ground and more rain coming — the combination that precedes most slides. Check PHIVOLCS or your barangay for whether your area is susceptible.' },
  { rank: 3, id: 'high',     label: 'Dangerous combination',
    advice: 'Saturated ground with heavy rain on top of it. If you live below a cut slope or on one, this is the situation to leave early in.' },
];

export function level(rank) {
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, rank))];
}

/**
 * @param {object|null} ground the result of `saturation()`
 * @param {object[]} ahead the hours from now on
 * @returns {{rank, id, label, advice, reason: string}|null} `null` when the
 *          past week is missing, because without it there is nothing to say.
 */
export function landslideRisk(ground, ahead = []) {
  if (!ground) return null;

  const peakMm = ahead.slice(0, 24).reduce((max, h) => Math.max(max, h.precipMm ?? 0), 0);
  const band = intensityFor(peakMm);
  const heavyComing = band.rank >= 3;      // PAGASA yellow or worse
  const intenseComing = band.rank >= 4;    // orange or worse

  let rank = 0;
  const reasons = [];

  if (ground.rank >= 2) { rank = 1; reasons.push(ground.label.toLowerCase()); }
  if (ground.rank >= 3) { rank = 2; }
  if (ground.rank >= 3 && heavyComing) { rank = 3; }
  if (ground.rank >= 2 && intenseComing) { rank = Math.max(rank, 3); }
  if (ground.rank <= 1 && intenseComing) { rank = Math.max(rank, 1); }

  if (heavyComing) reasons.push(`${band.label.toLowerCase()} forecast`);

  return {
    ...level(rank),
    reason: reasons.length ? reasons.join(', ') : 'ground is dry and no heavy rain is forecast',
    ground: ground.id,
  };
}
