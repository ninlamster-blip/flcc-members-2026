// What is in the air, and what it will do to someone who reacts to it.
//
// ── On pollen, honestly ────────────────────────────────────────────────────
// This app cannot tell you the pollen count. The atmosphere model behind the
// air-quality data publishes pollen for Europe only; over the Philippines
// those fields come back empty. Rather than draw an empty card or, worse, a
// confident zero, the app says so.
//
// What it can do for someone with asthma or allergies is report the triggers
// it *can* see: fine particulates, ozone, nitrogen dioxide, and the humidity
// that mould and dust mites need. In a Philippine house those are usually the
// bigger problem than pollen anyway.

export const AQI_BANDS = [
  { below: 51,  id: 'good',      label: 'Good',
    advice: 'Air quality is fine for everyone.' },
  { below: 101, id: 'moderate',  label: 'Moderate',
    advice: 'Fine for most people. Unusually sensitive people may notice it.' },
  { below: 151, id: 'sensitive', label: 'Unhealthy for sensitive groups',
    advice: 'Children, older people and anyone with asthma should ease off outdoor exertion.' },
  { below: 201, id: 'unhealthy', label: 'Unhealthy',
    advice: 'Everyone may feel it. Keep outdoor exertion short, and wear a mask if you must be out.' },
  { below: 301, id: 'very-unhealthy', label: 'Very unhealthy',
    advice: 'Stay indoors with the windows shut where you can.' },
  { below: Infinity, id: 'hazardous', label: 'Hazardous',
    advice: 'Avoid going out. This is emergency-level air.' },
];

export function aqiBand(usAqi) {
  if (!Number.isFinite(usAqi)) return null;
  return AQI_BANDS.find((b) => usAqi < b.below) || AQI_BANDS[AQI_BANDS.length - 1];
}

// Humidity that mould and dust mites thrive in. Both need sustained damp, and
// both are the everyday allergy trigger in a warm wet house — far more than
// anything blowing in from outside.
export const DAMP = [
  { below: 60, id: 'low',      label: 'Low',
    note: 'Too dry indoors for mould or mites to do much.' },
  { below: 70, id: 'moderate', label: 'Moderate',
    note: 'Mould and dust mites are comfortable at this humidity. Air rooms out when you can.' },
  { below: 80, id: 'high',     label: 'High',
    note: 'Damp enough for mould to grow on walls and for mites to thrive. Keep air moving.' },
  { below: Infinity, id: 'very-high', label: 'Very high',
    note: 'Persistently damp. Bedding, curtains and bathrooms are where this gets people.' },
];

/**
 * @param {{humidity: number|null, tempC: number|null}} conditions
 * @returns {{id, label, note}|null} mould and mite pressure, or `null` when
 *          humidity is missing.
 */
export function dampness({ humidity = null, tempC = null } = {}) {
  if (!Number.isFinite(humidity)) return null;
  // Mould needs warmth as well as damp; below about 20 °C it slows right down,
  // which almost never happens here but is worth not lying about.
  if (Number.isFinite(tempC) && tempC < 20) return { ...DAMP[0], id: 'low', label: 'Low' };
  return DAMP.find((d) => humidity < d.below) || DAMP[DAMP.length - 1];
}

/**
 * The irritants worth naming, worst first — what someone with asthma would
 * want to know is in the air today.
 */
export function irritants({ pm25 = null, pm10 = null, ozone = null, no2 = null } = {}) {
  const found = [];
  // WHO 24-hour guidelines: PM2.5 15 µg/m³, PM10 45 µg/m³.
  if (Number.isFinite(pm25) && pm25 > 15) {
    found.push({ id: 'pm25', label: 'Fine particulates', value: pm25, unit: 'µg/m³',
      note: 'Small enough to reach deep into the lungs. Traffic and burning are the usual sources.' });
  }
  if (Number.isFinite(pm10) && pm10 > 45) {
    found.push({ id: 'pm10', label: 'Coarse particulates', value: pm10, unit: 'µg/m³',
      note: 'Dust and road grit. Irritating to the nose and throat.' });
  }
  // WHO 8-hour ozone guideline is 100 µg/m³.
  if (Number.isFinite(ozone) && ozone > 100) {
    found.push({ id: 'ozone', label: 'Ozone', value: ozone, unit: 'µg/m³',
      note: 'Builds on hot sunny afternoons and tightens the chest of anyone with asthma.' });
  }
  // WHO 24-hour NO2 guideline is 25 µg/m³.
  if (Number.isFinite(no2) && no2 > 25) {
    found.push({ id: 'no2', label: 'Nitrogen dioxide', value: no2, unit: 'µg/m³',
      note: 'Traffic exhaust. Worst beside busy roads at rush hour.' });
  }
  return found.sort((a, b) => b.value - a.value);
}

/** Said once, on screen, wherever allergies are mentioned. */
export const POLLEN_NOTE =
  'Pollen counts are not published for the Philippines by the model this app '
  + 'uses — those fields cover Europe only. What is shown instead are the '
  + 'triggers that can be measured here.';
