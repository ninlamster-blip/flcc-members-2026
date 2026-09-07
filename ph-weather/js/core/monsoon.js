// The two winds that set the Philippine year.
//
//   Habagat — the southwest monsoon, roughly June to September. Warm, wet,
//   and the reason Metro Manila floods: a habagat pulled in by a typhoon
//   sitting far to the north can rain on Luzon for days without the typhoon
//   ever making landfall. That is what happened in 2012 and 2013, and it is
//   what most people mean when they say "habagat".
//
//   Amihan — the northeast monsoon, roughly October to February. Cooler and
//   drier on the western side of the country, and wet on the eastern seaboard
//   that faces it.
//
// Both are named here by wind direction and season, the same way the app's
// Kuwait sibling names a shamal.

export const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

export function compass(deg) {
  if (deg == null || !Number.isFinite(deg)) return null;
  const d = ((deg % 360) + 360) % 360;
  return COMPASS_16[Math.round(d / 22.5) % 16];
}

const BEAUFORT = [
  { force: 0, below: 1,   label: 'Calm' },
  { force: 1, below: 6,   label: 'Light air' },
  { force: 2, below: 12,  label: 'Light breeze' },
  { force: 3, below: 20,  label: 'Gentle breeze' },
  { force: 4, below: 29,  label: 'Moderate breeze' },
  { force: 5, below: 39,  label: 'Fresh breeze' },
  { force: 6, below: 50,  label: 'Strong breeze' },
  { force: 7, below: 62,  label: 'Near gale' },
  { force: 8, below: 75,  label: 'Gale' },
  { force: 9, below: 89,  label: 'Strong gale' },
  { force: 10, below: 103, label: 'Storm' },
  { force: 11, below: Infinity, label: 'Violent storm' },
];

export function beaufort(kmh) {
  if (!Number.isFinite(kmh)) return null;
  return BEAUFORT.find((b) => kmh < b.below) || BEAUFORT[BEAUFORT.length - 1];
}

// The arcs the wind blows *from*.
export const HABAGAT_ARC = { from: 190, to: 260 };
export const AMIHAN_ARC = { from: 20, to: 80 };

const inArc = (deg, arc) => {
  if (!Number.isFinite(deg)) return false;
  const d = ((deg % 360) + 360) % 360;
  return d >= arc.from && d <= arc.to;
};

/** Which monsoon a month (1–12) belongs to, if either. */
export function monsoonSeason(month) {
  if (month >= 6 && month <= 9) return 'habagat';
  if (month >= 10 || month <= 2) return 'amihan';
  return null; // March to May is the hot dry transition
}

const STEADY_KMH = 15;
const STRONG_KMH = 35;

/**
 * @returns {{id: 'habagat'|'amihan', label, detail, strength, enhanced: boolean}|null}
 */
export function monsoon({ speedKmh, directionDeg, month = null, rainMm24h = 0 }) {
  if (!Number.isFinite(speedKmh) || speedKmh < STEADY_KMH) return null;

  const isHabagat = inArc(directionDeg, HABAGAT_ARC);
  const isAmihan = inArc(directionDeg, AMIHAN_ARC);
  if (!isHabagat && !isAmihan) return null;

  const season = monsoonSeason(month);
  const id = isHabagat ? 'habagat' : 'amihan';
  // Out of its own season a monsoon wind is just a wind from that quarter.
  if (season && season !== id) return null;

  const strength = speedKmh >= STRONG_KMH ? 'strong' : 'steady';

  // A habagat carrying a great deal of rain is the enhanced kind — usually
  // being pulled in by a storm somewhere north. This app cannot see the storm,
  // only its signature, and says it that way.
  const enhanced = id === 'habagat' && rainMm24h >= 50;

  const label = enhanced ? 'Habagat, enhanced'
    : id === 'habagat' ? (strength === 'strong' ? 'Strong habagat' : 'Habagat')
    : (strength === 'strong' ? 'Strong amihan' : 'Amihan');

  const detail = id === 'habagat'
    ? enhanced
      ? `Southwesterly at ${Math.round(speedKmh)} km/h with ${Math.round(rainMm24h)} mm of rain in a day — the pattern that floods Metro Manila. Something is usually pulling it in from the north.`
      : `Southwest monsoon at ${Math.round(speedKmh)} km/h. Warm, wet air off the sea; showers can build through the afternoon.`
    : `Northeast monsoon at ${Math.round(speedKmh)} km/h. Cooler air; wet on the eastern seaboard, drier on the western side.`;

  return { id, label, detail, strength, enhanced, season };
}
