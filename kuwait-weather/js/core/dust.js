// Dust, which is the other thing Kuwait weather does.
//
// Two independent signals say the same thing, and the app trusts whichever is
// worse:
//
//   • Visibility, in metres. This is the operational definition — the WMO
//     calls it a dust storm below 1 km and blowing dust between 1 and 10 km,
//     and it is what closes a road or grounds a flight.
//   • Particulate concentration, in µg/m³. PM10 is the measure dust actually
//     shows up in (PM2.5 barely moves in a shamal), and the model also
//     publishes a dedicated mineral-dust field, which is the part of PM10 that
//     blew in off the desert rather than out of an exhaust pipe.
//
// Either signal may be missing from a given forecast hour. A level is returned
// from whatever is present, and `signals` says what it was read from.

export const LEVELS = [
  { rank: 0, id: 'clear', label: 'Clear air',  short: 'Clear',
    advice: 'Nothing in the air worth planning around.' },
  { rank: 1, id: 'hazy',  label: 'Hazy',       short: 'Hazy',
    advice: 'Suspended dust. Noticeable if you are asthmatic or working outside all day.' },
  { rank: 2, id: 'dusty', label: 'Dusty',      short: 'Dusty',
    advice: 'Wear a mask for outdoor work. Keep windows shut and the AC on recirculate.' },
  { rank: 3, id: 'heavy', label: 'Heavy dust', short: 'Heavy',
    advice: 'Avoid outdoor exertion. Driving needs headlights and much more distance.' },
  { rank: 4, id: 'storm', label: 'Dust storm', short: 'Storm',
    advice: 'Stay indoors. Visibility on the road can drop to nothing without warning.' },
];

export function level(rank) {
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, rank))];
}

/** PM10 in µg/m³ → a rank. WHO's 24-hour guideline is 45; a shamal reaches four figures. */
export function rankFromPm10(pm10) {
  if (pm10 == null || !Number.isFinite(pm10)) return null;
  if (pm10 < 50) return 0;
  if (pm10 < 150) return 1;
  if (pm10 < 350) return 2;
  if (pm10 < 800) return 3;
  return 4;
}

/** Visibility in metres → a rank, on the WMO thresholds. */
export function rankFromVisibility(metres) {
  if (metres == null || !Number.isFinite(metres)) return null;
  if (metres > 10000) return 0;
  if (metres > 5000) return 1;
  if (metres > 2000) return 2;
  if (metres > 1000) return 3;
  return 4;
}

/**
 * @param {{pm10?: number, dust?: number, visibility?: number}} reading
 * @returns {{rank: number, id: string, label: string, short: string, advice: string,
 *            signals: string[], pm10: number|null, visibility: number|null}|null}
 *          `null` only when nothing at all was measurable.
 */
export function dustLevel({ pm10 = null, dust = null, visibility = null } = {}) {
  // The mineral-dust field and PM10 measure overlapping things; the higher of
  // the two is the honest particulate signal, and either alone will do.
  const particulate = [pm10, dust].filter((n) => Number.isFinite(n));
  const pm = particulate.length ? Math.max(...particulate) : null;

  const ranks = [];
  const signals = [];
  const fromPm = rankFromPm10(pm);
  if (fromPm != null) { ranks.push(fromPm); signals.push('particulate'); }
  const fromVis = rankFromVisibility(visibility);
  if (fromVis != null) { ranks.push(fromVis); signals.push('visibility'); }
  if (!ranks.length) return null;

  const worst = Math.max(...ranks);
  return { ...level(worst), signals, pm10: pm, visibility };
}
