// WMO weather codes, as the forecast publishes them.
//
// The snow half of the table will never be seen here, but a table with holes
// in it is worse than one with unused rows. The wording leans tropical: what
// this country gets is showers and thunderstorms far more than "rain".

const CODES = {
  0:  { label: 'Clear',            icon: 'clear' },
  1:  { label: 'Mainly clear',     icon: 'clear' },
  2:  { label: 'Partly cloudy',    icon: 'partly' },
  3:  { label: 'Overcast',         icon: 'cloud' },
  45: { label: 'Fog',              icon: 'fog' },
  48: { label: 'Fog',              icon: 'fog' },
  51: { label: 'Light drizzle',    icon: 'drizzle' },
  53: { label: 'Drizzle',          icon: 'drizzle' },
  55: { label: 'Heavy drizzle',    icon: 'drizzle' },
  56: { label: 'Freezing drizzle', icon: 'drizzle' },
  57: { label: 'Freezing drizzle', icon: 'drizzle' },
  61: { label: 'Light rain',       icon: 'rain' },
  63: { label: 'Rain',             icon: 'rain' },
  65: { label: 'Heavy rain',       icon: 'rain' },
  66: { label: 'Freezing rain',    icon: 'rain' },
  67: { label: 'Freezing rain',    icon: 'rain' },
  71: { label: 'Light snow',       icon: 'snow' },
  73: { label: 'Snow',             icon: 'snow' },
  75: { label: 'Heavy snow',       icon: 'snow' },
  77: { label: 'Snow grains',      icon: 'snow' },
  80: { label: 'Showers',          icon: 'rain' },
  81: { label: 'Heavy showers',    icon: 'rain' },
  82: { label: 'Violent showers',  icon: 'downpour' },
  85: { label: 'Snow showers',     icon: 'snow' },
  86: { label: 'Snow showers',     icon: 'snow' },
  95: { label: 'Thunderstorm',     icon: 'storm' },
  96: { label: 'Thunderstorm with hail', icon: 'storm' },
  99: { label: 'Severe thunderstorm',    icon: 'storm' },
};

export function describe(code) {
  return CODES[code] || { label: 'Unsettled', icon: 'cloud' };
}

export function label(code) { return describe(code).label; }

export function icon(code, isDay = true) {
  const { icon: name } = describe(code);
  if (name === 'clear') return isDay ? 'sun' : 'moon';
  if (name === 'partly') return isDay ? 'partly' : 'partlyNight';
  return name;
}

export const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
export const STORM_CODES = new Set([95, 96, 99]);
export const HEAVY_CODES = new Set([65, 82, 96, 99]);

export function isRain(code) { return RAIN_CODES.has(code); }
export function isStorm(code) { return STORM_CODES.has(code); }
