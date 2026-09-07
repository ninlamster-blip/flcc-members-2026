// What the person who lives there knows, which no forecast does.
//
// The flood model reads rainfall and how wet the ground is. What it cannot
// read is the street: whether the drains were cleared this year, whether the
// road was raised, whether the subdivision sits in an old riverbed. That
// knowledge exists — it is just in somebody's head rather than in an API, and
// the maps that would hold it (Project NOAH, the MGB hazard sheets) are not
// something this app can reach.
//
// So the app asks. One question, answered once per place, kept on the device.
//
// ── The rule that matters ──────────────────────────────────────────────────
// Local knowledge can raise a reading freely. It can only lower one so far.
//
// Somebody who says "our street never floods" is usually right — until the
// afternoon they are not, and that afternoon is exactly when this app needs to
// still be shouting. So when the rainfall alone is in PAGASA's orange or red
// range, the floor holds regardless of what anyone told the app. Optimism
// about your own street must never be able to silence a red warning.

export const LEVELS = [
  { id: 'unknown', shift: 0, label: 'Not set',
    question: 'I don\'t know', note: 'Using rainfall and ground saturation only.' },
  { id: 'rarely', shift: -1, label: 'Drains well',
    question: 'Almost never floods', note: 'Your street drains well, so the same rain matters less here.' },
  { id: 'sometimes', shift: 0, label: 'Floods in a bad storm',
    question: 'Only in a bad storm', note: 'About what the model already assumes.' },
  { id: 'easily', shift: 1, label: 'Floods in heavy rain',
    question: 'Whenever it rains hard', note: 'Your street floods readily, so the bar for concern is lower here.' },
  { id: 'very-easily', shift: 2, label: 'Floods easily',
    question: 'Even ordinary heavy rain', note: 'Your street floods easily. Rain that would be routine elsewhere is not, here.' },
];

export const DEFAULT_LEVEL = 'unknown';

export function level(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

/**
 * The lowest flood rank the rainfall alone will allow, whatever anyone says
 * about their street. PAGASA orange holds at "possible"; red holds at "likely".
 */
export function rainFloor({ peakMmPerHour = 0, mm24h = 0 } = {}) {
  if (peakMmPerHour >= 30) return 3;   // PAGASA red
  if (peakMmPerHour >= 15) return 2;   // PAGASA orange
  if (mm24h >= 200) return 2;          // a day's rain that floods regardless
  return 0;
}

/**
 * @param {object} flood the result of `floodRisk()`
 * @param {string} id one of LEVELS
 * @param {(rank: number) => object} levelFor the flood scale's own lookup
 * @returns {object} the flood result, adjusted, with `local` describing why
 */
export function applyLocal(flood, id, levelFor) {
  const chosen = level(id);
  if (!flood) return flood;
  if (chosen.id === 'unknown' || chosen.shift === 0) {
    return { ...flood, local: { id: chosen.id, shift: 0, floored: false, label: chosen.label } };
  }

  // Local knowledge adjusts a risk. It does not invent one: a street that
  // floods easily is not flooding when nothing is falling on it, and saying
  // otherwise would light the card up on every dry day and be ignored by the
  // second week.
  if ((flood.mm24h ?? 0) < 1 && (flood.peakMmPerHour ?? 0) < 1) {
    return { ...flood, local: { id: chosen.id, shift: 0, floored: false, label: chosen.label } };
  }

  const floor = rainFloor(flood);
  const wanted = flood.rank + chosen.shift;
  const rank = Math.max(floor, Math.min(4, Math.max(0, wanted)));
  const floored = wanted < floor;

  const adjusted = { ...flood, ...levelFor(rank), rank };
  const drivers = [...flood.drivers];
  if (rank !== flood.rank) {
    drivers.push(chosen.shift > 0
      ? `you told the app this street ${chosen.question.toLowerCase()}`
      : 'you told the app this street drains well');
  }

  return {
    ...adjusted,
    drivers,
    local: { id: chosen.id, shift: chosen.shift, floored, label: chosen.label, note: chosen.note },
  };
}
