// Rain, measured the way PAGASA measures it.
//
// The Philippine weather service issues rainfall warnings on hourly
// intensity, in three published colours:
//
//   Yellow   7.5 – 15 mm in an hour, expected to continue
//   Orange   15  – 30 mm in an hour
//   Red      more than 30 mm in an hour
//
// Those thresholds are the backbone of this app, because they are the numbers
// the country's own warnings are written against. What the app shows is those
// thresholds applied to a forecast — it is not PAGASA, it is not receiving
// their warnings, and it says so on screen.
//
// Accumulation is the other half. Thirty millimetres in an hour is a warning;
// thirty millimetres spread over a day is an ordinary wet afternoon.

// Each band is named by the rain rate it *starts* at, in millimetres per hour.
// Below 7.5 these are the ordinary meteorological bands; from 7.5 up they are
// PAGASA's own warning thresholds, unchanged.
export const INTENSITY = [
  { rank: 0, id: 'none',     label: 'No rain',      from: 0,
    advice: 'Nothing falling.' },
  { rank: 1, id: 'light',    label: 'Light rain',   from: 0.1,
    advice: 'Light rain. An umbrella is enough.' },
  { rank: 2, id: 'moderate', label: 'Moderate rain', from: 2.5,
    advice: 'Steady rain. Roads wet, traffic slower.' },
  { rank: 3, id: 'heavy',    label: 'Heavy rain',   from: 7.5,
    advice: 'Heavy rain — PAGASA yellow range. Low-lying and poorly drained areas can start to flood.' },
  { rank: 4, id: 'intense',  label: 'Intense rain', from: 15,
    advice: 'Intense rain — PAGASA orange range. Flooding is threatening in low-lying areas.' },
  { rank: 5, id: 'torrential', label: 'Torrential rain', from: 30,
    advice: 'Torrential rain — PAGASA red range. Serious flooding expected. Move to higher ground.' },
];

// The colour PAGASA would attach, for the three bands that have one.
export const WARNING_COLOUR = { heavy: 'yellow', intense: 'orange', torrential: 'red' };

export function intensity(rank) {
  return INTENSITY[Math.min(INTENSITY.length - 1, Math.max(0, rank))];
}

/** Millimetres in one hour → the band it falls in: the last one it reaches. */
export function intensityFor(mmPerHour) {
  if (mmPerHour == null || !Number.isFinite(mmPerHour) || mmPerHour <= 0) return INTENSITY[0];
  let band = INTENSITY[0];
  for (const step of INTENSITY) if (mmPerHour >= step.from) band = step;
  return band;
}

/**
 * Total rain across a run of hours, ignoring the ones the forecast has no
 * number for rather than counting them as dry.
 */
export function total(hours, field = 'precipMm') {
  return hours.reduce((sum, h) => sum + (Number.isFinite(h[field]) ? h[field] : 0), 0);
}

/** The wettest single hour in a run. */
export function peakHour(hours) {
  return hours.reduce((worst, h) => {
    const mm = Number.isFinite(h.precipMm) ? h.precipMm : 0;
    const best = worst && Number.isFinite(worst.precipMm) ? worst.precipMm : -1;
    return mm > best ? h : worst;
  }, null);
}

// How much rain in a day counts as a lot, for the daily summary. These follow
// the common Philippine reporting bands rather than the hourly warning ones.
const DAILY = [
  { below: 5,   id: 'trace',    label: 'A little rain' },
  { below: 20,  id: 'some',     label: 'Some rain' },
  { below: 50,  id: 'wet',      label: 'A wet day' },
  { below: 100, id: 'very-wet', label: 'A very wet day' },
  { below: 200, id: 'soaking',  label: 'A soaking day' },
  { below: Infinity, id: 'extreme', label: 'Extreme rainfall' },
];

export function dailyBand(mm) {
  if (!Number.isFinite(mm) || mm <= 0) return { id: 'dry', label: 'Dry' };
  return DAILY.find((b) => mm < b.below) || DAILY[DAILY.length - 1];
}
