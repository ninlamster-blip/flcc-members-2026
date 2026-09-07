// Heat, which is the whole point of a weather app in Kuwait.
//
// Three different numbers describe the same afternoon, and they are not
// interchangeable:
//
//   • Air temperature — what a thermometer in the shade reads.
//   • Heat index — what that temperature feels like once humidity stops sweat
//     evaporating. This is the US National Weather Service's Rothfusz
//     regression, the same one behind every "feels like" in the world.
//   • WBGT — wet bulb globe temperature, which is what occupational heat
//     standards are actually written against, because it accounts for
//     humidity, air movement and radiant heat from the sun.
//
// A real WBGT needs a black globe thermometer standing in the sun. What is
// computed here is the standard outdoor weighting — 70 % wet bulb, 20 % globe,
// 10 % air — over a wet bulb from Stull's regression and a globe temperature
// estimated from cloud, wind and time of day. It is an estimate, the app says
// so on screen, and it is a far better basis for "should I be out in this"
// than air temperature alone.
//
// An earlier draft used the Australian Bureau of Meteorology's shade
// approximation, which is simpler and is what most quick calculators reach
// for. It was thrown out because it has no wind term and no wet bulb in it,
// and at 48 °C and 22 % humidity — an ordinary Kuwait July noon — it returns a
// WBGT above 43 °C, a figure that has never been recorded anywhere on earth.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const cToF = (c) => (c * 9) / 5 + 32;
const fToC = (f) => ((f - 32) * 5) / 9;

// The regression was fitted against a table that stops at 112 °F (44 °C).
// Kuwait goes past that most summers, so above this the heat index is an
// extrapolation and reads high — which is why nothing in this app's guidance
// is driven by it. WBGT is.
export const HEAT_INDEX_VALID_TO_C = 44;

export function heatIndexReliable(tempC) { return tempC <= HEAT_INDEX_VALID_TO_C; }

/** Rothfusz heat index, in and out in °C. */
export function heatIndexC(tempC, rh) {
  const T = cToF(tempC);
  const R = clamp(rh, 0, 100);

  // Steadman's simple form first; the full regression is only valid once the
  // two of them average out above 80 °F.
  const simple = 0.5 * (T + 61.0 + (T - 68.0) * 1.2 + R * 0.094);
  if ((simple + T) / 2 < 80) return fToC(simple);

  let hi = -42.379
    + 2.04901523 * T
    + 10.14333127 * R
    - 0.22475541 * T * R
    - 0.00683783 * T * T
    - 0.05481717 * R * R
    + 0.00122874 * T * T * R
    + 0.00085282 * T * R * R
    - 0.00000199 * T * T * R * R;

  // The two adjustments. The dry one matters here: a 48 °C day at 10 % is an
  // ordinary Kuwait afternoon, and without this the index reads too high.
  if (R < 13 && T >= 80 && T <= 112) {
    hi -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (R > 85 && T >= 80 && T <= 87) {
    hi += ((R - 85) / 10) * ((87 - T) / 5);
  }
  return fToC(hi);
}

/**
 * Wet-bulb temperature, by Stull's 2011 regression. Accurate to a few tenths
 * of a degree across the whole range this app sees, and it is the honest
 * measure of how much cooling a body can still get from sweating: Kuwait's
 * saving grace is that 48 °C at 15 % humidity has a wet bulb near 27 °C,
 * while 40 °C at 60 % on the coast is worse despite the lower number.
 */
export function wetBulbC(tempC, rh) {
  const R = clamp(rh, 0, 100);
  return tempC * Math.atan(0.151977 * Math.sqrt(R + 8.313659))
    + Math.atan(tempC + R)
    - Math.atan(R - 1.676331)
    + 0.00391838 * R ** 1.5 * Math.atan(0.023101 * R)
    - 4.686035;
}

// How much hotter a black globe reads than the air in full sun and dead calm.
// Wind carries that load away, which is why a shamal afternoon is more
// bearable than a still one at the same temperature.
const MAX_SOLAR_GAIN_C = 12;
const WIND_DAMPING_KMH = 35;

/**
 * Globe temperature, estimated. A real one is a thermometer inside a matt
 * black sphere; this is the air temperature plus a solar gain that cloud
 * thins out and wind carries away, and it is zero at night.
 */
export function globeTempC(tempC, { isDay = true, cloudCover = 0, windKmh = 0 } = {}) {
  if (!isDay) return tempC;
  const sun = 1 - clamp(cloudCover, 0, 100) / 100;
  const wind = WIND_DAMPING_KMH / (WIND_DAMPING_KMH + Math.max(0, windKmh || 0) * 10);
  return tempC + MAX_SOLAR_GAIN_C * sun * wind;
}

/** WBGT out of the sun: the standard indoor weighting, where globe ≈ air. */
export function wbgtShadeC(tempC, rh) {
  return 0.7 * wetBulbC(tempC, rh) + 0.3 * tempC;
}

/**
 * WBGT for someone standing outside, on the standard outdoor weighting —
 * 70 % wet bulb, 20 % globe, 10 % air.
 *
 * It is an estimate built from a forecast, not a measurement, and the app says
 * so wherever it shows the number. What it is good for is comparing one hour
 * of a day against another and landing in the right work/rest band; what it is
 * not is a compliance instrument.
 */
export function wbgtC(tempC, rh, { isDay = true, cloudCover = 0, windKmh = 0 } = {}) {
  const wetBulb = wetBulbC(tempC, rh);
  if (!isDay) return 0.7 * wetBulb + 0.3 * tempC;
  const globe = globeTempC(tempC, { isDay, cloudCover, windKmh });
  return 0.7 * wetBulb + 0.2 * globe + 0.1 * tempC;
}

// Heat index bands, as the US National Weather Service draws them. These
// describe risk to a person, not to a worker under load.
export const HEAT_BANDS = [
  { id: 'none',    below: 27, label: 'Comfortable',    note: 'Nothing to plan around.' },
  { id: 'caution', below: 32, label: 'Caution',        note: 'Fatigue is possible with long exposure or activity.' },
  { id: 'extreme', below: 41, label: 'Extreme caution', note: 'Heat cramps and heat exhaustion are possible. Take breaks in shade.' },
  { id: 'danger',  below: 54, label: 'Danger',         note: 'Heat exhaustion likely, heat stroke possible. Limit time outdoors.' },
  { id: 'extreme-danger', below: Infinity, label: 'Extreme danger', note: 'Heat stroke is likely. Outdoor exposure is dangerous.' },
];

export function heatBand(heatIndex) {
  return HEAT_BANDS.find((b) => heatIndex < b.below) || HEAT_BANDS[HEAT_BANDS.length - 1];
}

// Work and rest, by WBGT. The shape of this table is the widely published
// occupational one for an acclimatised person doing moderate work, and the
// lighter and heavier profiles shift the thresholds by 1 °C either way — a
// labourer carrying block is in trouble at a WBGT an office errand is not.
//
// This is guidance to plan a day around. It is not a legal standard and this
// app does not pretend it is one.
const MODERATE_BANDS = [
  { id: 'normal', below: 27.5, work: 60, rest: 0,  label: 'Normal work' },
  { id: 'light',  below: 29.5, work: 45, rest: 15, label: '45 min work · 15 min rest' },
  { id: 'half',   below: 31.0, work: 30, rest: 30, label: '30 min work · 30 min rest' },
  { id: 'mostly-rest', below: 32.0, work: 15, rest: 45, label: '15 min work · 45 min rest' },
  { id: 'stop',   below: Infinity, work: 0, rest: 60, label: 'Stop outdoor work' },
];

export const WORK_PROFILES = [
  { id: 'light',    label: 'Light work',    shift: +1, example: 'walking, driving, standing at a desk outdoors' },
  { id: 'moderate', label: 'Moderate work', shift: 0,  example: 'walking with a load, cleaning, delivery rounds' },
  { id: 'heavy',    label: 'Heavy work',    shift: -1, example: 'construction, loading, digging, scaffolding' },
];

export const DEFAULT_WORK_PROFILE = 'moderate';

export function workProfile(id) {
  return WORK_PROFILES.find((p) => p.id === id) || WORK_PROFILES[1];
}

/**
 * @returns {{id: string, work: number, rest: number, label: string}} the
 *          work/rest split for this WBGT and this kind of work.
 */
export function workRest(wbgt, profileId = DEFAULT_WORK_PROFILE) {
  const { shift } = workProfile(profileId);
  const adjusted = wbgt - shift; // heavier work → effectively a hotter day
  return MODERATE_BANDS.find((b) => adjusted < b.below) || MODERATE_BANDS[MODERATE_BANDS.length - 1];
}

/** How much water an hour of this costs, roughly — half a litre to a litre. */
export function waterPerHourMl(wbgt) {
  if (wbgt < 27.5) return 500;
  if (wbgt < 30) return 750;
  return 1000;
}
