// How much water the ground is already holding.
//
// This is the number that turns an ordinary afternoon downpour into a flood
// and a wet hillside into a moving one. Rain falling on dry ground soaks in;
// rain falling on ground that has taken 200 mm over the past three days runs
// straight off, and it is the running off that fills a street.
//
// So the app asks the forecast for the past week as well as the week ahead —
// `past_days` on the same request — and reads the antecedent totals.
//
// The bands below are a documented heuristic, not a soil model. There is no
// soil type here, no slope, no water table. What there is, is the one thing
// that reliably distinguishes a dangerous 40 mm from a harmless one.

export const LEVELS = [
  { rank: 0, id: 'dry',       label: 'Dry ground',
    note: 'The ground can take a lot before anything runs off.' },
  { rank: 1, id: 'damp',      label: 'Damp ground',
    note: 'Some capacity left. Ordinary rain will still soak in.' },
  { rank: 2, id: 'wet',       label: 'Wet ground',
    note: 'Days of rain already. Fresh rain runs off faster than it soaks in.' },
  { rank: 3, id: 'saturated', label: 'Saturated ground',
    note: 'The ground is close to full. Any heavy rain now goes straight to the drains and the rivers.' },
  { rank: 4, id: 'soaked',    label: 'Soaked ground',
    note: 'Nothing more will soak in. Slopes are at their weakest and streets fill fast.' },
];

export function level(rank) {
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, rank))];
}

// Three-day totals, in millimetres, at which each level starts.
const THREE_DAY = [0, 25, 75, 150, 300];
// A week of steady rain saturates ground that no single three-day window would.
const SEVEN_DAY_BUMP = 350;

/**
 * @param {{mm3d: number|null, mm7d: number|null}} totals
 * @returns {{rank, id, label, note, mm3d, mm7d, reason: string}|null}
 *          `null` when the past week is not available at all.
 */
export function saturation({ mm3d = null, mm7d = null } = {}) {
  if (!Number.isFinite(mm3d)) return null;

  let rank = 0;
  THREE_DAY.forEach((threshold, i) => { if (mm3d >= threshold) rank = i; });

  // A long wet spell that never had one big three-day burst still fills the
  // ground, so a large weekly total lifts the level by one.
  const bumped = Number.isFinite(mm7d) && mm7d >= SEVEN_DAY_BUMP && rank < LEVELS.length - 1;
  if (bumped) rank += 1;

  return {
    ...level(rank),
    mm3d,
    mm7d,
    reason: bumped
      ? `${Math.round(mm7d)} mm over the past week`
      : `${Math.round(mm3d)} mm over the past three days`,
  };
}

/** Rain in the `days` days before `now`, from the hours the forecast carries. */
export function antecedent(hours, { now = new Date(), days = 3 } = {}) {
  const from = now.getTime() - days * 24 * 3600 * 1000;
  const past = hours.filter((h) => h.at && h.at.getTime() >= from && h.at.getTime() < now.getTime());
  if (!past.length) return null;
  return past.reduce((sum, h) => sum + (Number.isFinite(h.precipMm) ? h.precipMm : 0), 0);
}
