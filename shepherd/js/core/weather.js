/**
 * Current weather, based on the device's own location — the dashboard hero's
 * optional weather chip.
 *
 * Same shape as the Bible lookup: a direct client-side fetch to a free,
 * keyless public API (Open-Meteo — no signup, no proxy, no server secret to
 * configure), because this repo has no server of its own to hide a key
 * behind. Location comes from the browser's own Geolocation API, which is
 * itself the opt-in gate: the first call prompts for permission, and the
 * browser remembers a decline without Shepherd needing to track anything.
 * If geolocation or the network call fails for any reason, callers get
 * `null` back — the weather chip simply does not appear, never an error the
 * user has to dismiss.
 */

// Coarse World Meteorological Organization "weather code" buckets — see
// https://open-meteo.com/en/docs for the full table. Good enough to label
// and icon a small chip; not attempting to distinguish every code.
const WMO_LABELS = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent rain showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

const CLEAR_CODES = new Set([0]);
const CLOUDY_CODES = new Set([1, 2, 3, 45, 48]);

export function weatherLabel(code) {
  return WMO_LABELS[code] || 'Weather';
}

/** @returns {'sun'|'moon'|'cloud'|'cloudRain'} an existing icon name — see core/dom.js ICON_PATHS */
export function weatherIconName(code, isDay) {
  if (CLEAR_CODES.has(code)) return isDay ? 'sun' : 'moon';
  if (CLOUDY_CODES.has(code)) return 'cloud';
  return 'cloudRain';
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation unavailable')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 15 * 60 * 1000 });
  });
}

async function fetchCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const cw = data.current_weather;
  if (!cw) throw new Error('No current_weather in response');
  return { tempC: cw.temperature, code: cw.weathercode, isDay: cw.is_day === 1, windKph: cw.windspeed };
}

const CACHE_TTL_MS = 20 * 60 * 1000;
let cache = null;
let inFlight = null;

/**
 * @returns {Promise<{tempC: number, code: number, isDay: boolean, windKph: number}|null>}
 *          `null` on denied permission, unsupported browser, or any network failure.
 */
export async function currentWeather() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const pos = await getPosition();
      const data = await fetchCurrentWeather(pos.coords.latitude, pos.coords.longitude);
      cache = { data, fetchedAt: Date.now() };
      return data;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
