// Heat, in a country where the number that matters is never the temperature.
//
// Thirty-four degrees in Manila is harder on a body than forty in a desert,
// because at ninety per cent humidity sweat stops evaporating and the only
// cooling a person has left stops working. So this app leads on heat index
// and dew point, and treats the air temperature as background.
//
// The heat index is the US National Weather Service's Rothfusz regression —
// the same one behind every "feels like" — but the *bands* are PAGASA's, which
// are drawn differently from the American ones and are what Philippine
// bulletins and school suspensions are written against.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const cToF = (c) => (c * 9) / 5 + 32;
const fToC = (f) => ((f - 32) * 5) / 9;

export function heatIndexC(tempC, rh) {
  const T = cToF(tempC);
  const R = clamp(rh, 0, 100);

  const simple = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + R * 0.094);
  if ((simple + T) / 2 < 80) return fToC(simple);

  let hi = -42.379
    + 2.04901523 * T + 10.14333127 * R
    - 0.22475541 * T * R - 0.00683783 * T * T - 0.05481717 * R * R
    + 0.00122874 * T * T * R + 0.00085282 * T * R * R - 0.00000199 * T * T * R * R;

  if (R < 13 && T >= 80 && T <= 112) {
    hi -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (R > 85 && T >= 80 && T <= 87) {
    hi += ((R - 85) / 10) * ((87 - T) / 5);
  }
  return fToC(hi);
}

// PAGASA's heat index classification, which is what the country's own
// advisories use. The boundaries differ from the American ones.
export const HEAT_BANDS = [
  { id: 'safe',    below: 27, label: 'Not a concern',
    note: 'Ordinary warmth.' },
  { id: 'caution', below: 33, label: 'Caution',
    note: 'Fatigue is possible with long exposure or activity. Drink more than you think you need.' },
  { id: 'extreme-caution', below: 42, label: 'Extreme caution',
    note: 'Heat cramps and heat exhaustion are possible. Stay out of direct sun in the middle of the day.' },
  { id: 'danger',  below: 52, label: 'Danger',
    note: 'Heat cramps and heat exhaustion are likely, heat stroke possible. Limit outdoor work and check on older relatives.' },
  { id: 'extreme-danger', below: Infinity, label: 'Extreme danger',
    note: 'Heat stroke is imminent. Stay indoors, out of the sun, and keep children and the elderly cool.' },
];

export function heatBand(heatIndex) {
  return HEAT_BANDS.find((b) => heatIndex < b.below) || HEAT_BANDS[HEAT_BANDS.length - 1];
}

/** Dew point by the Magnus formula — the honest measure of stickiness. */
export function dewPointC(tempC, rh) {
  const R = clamp(rh, 1, 100);
  const a = 17.625;
  const b = 243.04;
  const g = Math.log(R / 100) + (a * tempC) / (b + tempC);
  return (b * g) / (a - g);
}

// What a dew point actually feels like. Relative humidity on its own is a poor
// guide — 80 % at 24 °C is pleasant and 80 % at 32 °C is not — because it is a
// ratio. Dew point is an amount, and it maps straight onto comfort.
export const COMFORT = [
  { below: 16, id: 'dry',        label: 'Dry',           note: 'Comfortable. Sweat evaporates freely.' },
  { below: 19, id: 'comfortable', label: 'Comfortable',  note: 'Pleasant for the Philippines.' },
  { below: 22, id: 'sticky',     label: 'Sticky',        note: 'Noticeably humid. You will feel it walking.' },
  { below: 25, id: 'humid',      label: 'Very humid',    note: 'Uncomfortable. Sweat stops doing its job well.' },
  { below: 27, id: 'oppressive', label: 'Oppressive',    note: 'Hard going. Take breaks in shade or air conditioning.' },
  { below: Infinity, id: 'extreme', label: 'Extremely humid', note: 'Dangerous with any exertion — the body can barely shed heat at all.' },
];

export function comfort(dewPoint) {
  return COMFORT.find((c) => dewPoint < c.below) || COMFORT[COMFORT.length - 1];
}

/** How much of the "feels like" is humidity rather than heat. */
export function humidityPenaltyC(tempC, rh) {
  const hi = heatIndexC(tempC, rh);
  return Math.max(0, hi - tempC);
}
