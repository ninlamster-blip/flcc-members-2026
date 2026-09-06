// Wind, and in particular the one wind that matters here.
//
// The shamal — شمال, "north" — is the northwesterly that blows down the Gulf
// over the Mesopotamian plain, and it is what lifts Kuwait's dust. It comes in
// two seasons: the winter shamal, which arrives in bursts behind a cold front
// between November and March, and the summer shamal, the steadier one that
// blows through June and July and takes the visibility with it.
//
// A wind is called a shamal here when it comes from the northwest arc and is
// strong enough to move sand.

export const COMPASS_16 = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

/** Meteorological degrees (the direction wind comes *from*) → a 16-point name. */
export function compass(deg) {
  if (deg == null || !Number.isFinite(deg)) return null;
  const normalised = ((deg % 360) + 360) % 360;
  return COMPASS_16[Math.round(normalised / 22.5) % 16];
}

// The Beaufort scale, abbreviated to the parts a phone screen can use.
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
  { force: 10, below: Infinity, label: 'Storm' },
];

export function beaufort(kmh) {
  if (kmh == null || !Number.isFinite(kmh)) return null;
  return BEAUFORT.find((b) => kmh < b.below) || BEAUFORT[BEAUFORT.length - 1];
}

// The northwest arc, in degrees the wind blows from. Kept wide enough to
// include the N-NW edge of a winter shamal without swallowing a plain
// westerly.
export const SHAMAL_ARC = { from: 290, to: 355 };

export function isShamalDirection(deg) {
  if (deg == null || !Number.isFinite(deg)) return false;
  const d = ((deg % 360) + 360) % 360;
  return d >= SHAMAL_ARC.from && d <= SHAMAL_ARC.to;
}

// Speeds at which a northwesterly starts being called a shamal, and at which
// it starts lifting dust in earnest.
const BLOWING_KMH = 25;
const STRONG_KMH = 40;
const SEVERE_KMH = 55;

/** Which shamal season a month (1–12) falls in. */
export function shamalSeason(month) {
  if (month >= 6 && month <= 7) return 'summer';
  if (month >= 11 || month <= 3) return 'winter';
  return null;
}

/**
 * @returns {{strength: 'blowing'|'strong'|'severe', season: string|null,
 *            label: string, detail: string}|null} `null` when this is not a shamal.
 */
export function shamal({ speedKmh, directionDeg, gustKmh = null, month = null }) {
  if (!isShamalDirection(directionDeg)) return null;
  const gust = Number.isFinite(gustKmh) ? gustKmh : speedKmh;
  if (!Number.isFinite(speedKmh) || speedKmh < BLOWING_KMH) return null;

  const strength = speedKmh >= SEVERE_KMH ? 'severe' : speedKmh >= STRONG_KMH ? 'strong' : 'blowing';
  const season = shamalSeason(month);
  const seasonWord = season === 'summer' ? 'Summer shamal' : season === 'winter' ? 'Winter shamal' : 'Shamal';

  const label = strength === 'severe' ? `Severe ${seasonWord.toLowerCase()}`
    : strength === 'strong' ? `Strong ${seasonWord.toLowerCase()}`
    : seasonWord;

  const detail = strength === 'blowing'
    ? `Northwesterly at ${Math.round(speedKmh)} km/h. Enough to raise dust off open ground.`
    : `Northwesterly at ${Math.round(speedKmh)} km/h, gusting ${Math.round(gust)}. Expect blowing dust and falling visibility.`;

  return { strength, season, label, detail };
}
