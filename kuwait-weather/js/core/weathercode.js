// WMO weather codes, as the forecast publishes them.
//
// The full table runs to snow grains and freezing drizzle. Kuwait uses maybe a
// third of it, so the labels here lean into what actually happens — and the
// codes that never will are still mapped, because a table with holes in it is
// worse than one with unused rows.

const CODES = {
  0:  { label: 'Clear',           icon: 'clear' },
  1:  { label: 'Mainly clear',    icon: 'clear' },
  2:  { label: 'Partly cloudy',   icon: 'partly' },
  3:  { label: 'Overcast',        icon: 'cloud' },
  45: { label: 'Fog',             icon: 'fog' },
  48: { label: 'Freezing fog',    icon: 'fog' },
  51: { label: 'Light drizzle',   icon: 'drizzle' },
  53: { label: 'Drizzle',         icon: 'drizzle' },
  55: { label: 'Heavy drizzle',   icon: 'drizzle' },
  56: { label: 'Freezing drizzle', icon: 'drizzle' },
  57: { label: 'Freezing drizzle', icon: 'drizzle' },
  61: { label: 'Light rain',      icon: 'rain' },
  63: { label: 'Rain',            icon: 'rain' },
  65: { label: 'Heavy rain',      icon: 'rain' },
  66: { label: 'Freezing rain',   icon: 'rain' },
  67: { label: 'Freezing rain',   icon: 'rain' },
  71: { label: 'Light snow',      icon: 'snow' },
  73: { label: 'Snow',            icon: 'snow' },
  75: { label: 'Heavy snow',      icon: 'snow' },
  77: { label: 'Snow grains',     icon: 'snow' },
  80: { label: 'Rain showers',    icon: 'rain' },
  81: { label: 'Rain showers',    icon: 'rain' },
  82: { label: 'Violent showers', icon: 'rain' },
  85: { label: 'Snow showers',    icon: 'snow' },
  86: { label: 'Snow showers',    icon: 'snow' },
  95: { label: 'Thunderstorm',    icon: 'storm' },
  96: { label: 'Thunderstorm with hail', icon: 'storm' },
  99: { label: 'Thunderstorm with hail', icon: 'storm' },
};

export function describe(code) {
  return CODES[code] || { label: 'Unsettled', icon: 'cloud' };
}

export function label(code) { return describe(code).label; }

/** The icon name, with clear skies splitting into sun and moon. */
export function icon(code, isDay = true) {
  const { icon: name } = describe(code);
  if (name === 'clear') return isDay ? 'sun' : 'moon';
  if (name === 'partly') return isDay ? 'partly' : 'partlyNight';
  return name;
}

export const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
export const HEAVY_RAIN_CODES = new Set([65, 82, 95, 96, 99]);

export function isRain(code) { return RAIN_CODES.has(code); }
