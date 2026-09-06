// The forecast itself.
//
// Open-Meteo, called straight from the browser. No key, no signup, no server
// of our own to hide a secret behind, and no request that carries anything
// about the person making it beyond the coordinates they asked about. Two
// endpoints: the weather forecast, and the air-quality forecast that carries
// PM10 and mineral dust.
//
// Both are asked for Kuwait time, so every timestamp that comes back is a
// Kuwait wall-clock string. `format.parseLocal` is the only thing that reads
// them.

export const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const AIR_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality';
export const TIME_ZONE = 'Asia/Kuwait';

export const FORECAST_DAYS = 7;
// The air-quality model runs a shorter horizon than the weather model.
export const AIR_DAYS = 5;

const CURRENT_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
  'precipitation', 'weather_code', 'cloud_cover', 'pressure_msl',
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
];

const HOURLY_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
  'precipitation_probability', 'precipitation', 'weather_code', 'cloud_cover',
  'visibility', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'uv_index', 'is_day',
];

const DAILY_FIELDS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'apparent_temperature_max', 'sunrise', 'sunset', 'uv_index_max',
  'precipitation_sum', 'precipitation_probability_max',
  'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
];

const AIR_CURRENT_FIELDS = ['pm10', 'pm2_5', 'dust', 'uv_index'];
const AIR_HOURLY_FIELDS = ['pm10', 'pm2_5', 'dust'];

const coord = (n) => Number(n).toFixed(4);

export function forecastUrl({ lat, lon }) {
  const q = new URLSearchParams({
    latitude: coord(lat),
    longitude: coord(lon),
    current: CURRENT_FIELDS.join(','),
    hourly: HOURLY_FIELDS.join(','),
    daily: DAILY_FIELDS.join(','),
    timezone: TIME_ZONE,
    wind_speed_unit: 'kmh',
    forecast_days: String(FORECAST_DAYS),
  });
  return `${FORECAST_ENDPOINT}?${q}`;
}

export function airUrl({ lat, lon }) {
  const q = new URLSearchParams({
    latitude: coord(lat),
    longitude: coord(lon),
    current: AIR_CURRENT_FIELDS.join(','),
    hourly: AIR_HOURLY_FIELDS.join(','),
    timezone: TIME_ZONE,
    forecast_days: String(AIR_DAYS),
  });
  return `${AIR_ENDPOINT}?${q}`;
}

const at = (arr, i) => {
  const v = Array.isArray(arr) ? arr[i] : null;
  return Number.isFinite(v) ? v : null;
};

/**
 * The two responses, folded into one shape the screens can read.
 *
 * Air quality is optional throughout: it runs a shorter forecast than the
 * weather model and it is the endpoint most likely to be the one that fails.
 * When it is missing, every dust field is simply `null` and the app says so
 * rather than guessing.
 */
export function normalize(forecast, air = null, { place = null, fetchedAt = new Date() } = {}) {
  if (!forecast || !forecast.hourly || !Array.isArray(forecast.hourly.time)) {
    throw new Error('Forecast response has no hourly data');
  }

  // Air-quality hours are matched to weather hours by their timestamp rather
  // than by index — the two models publish different horizons and can start
  // on different hours.
  const airIndex = new Map();
  const airTimes = air?.hourly?.time;
  if (Array.isArray(airTimes)) airTimes.forEach((t, i) => airIndex.set(t, i));
  const airAt = (time, field) => {
    const i = airIndex.get(time);
    return i == null ? null : at(air.hourly[field], i);
  };

  const h = forecast.hourly;
  const hours = h.time.map((time, i) => ({
    time,
    tempC: at(h.temperature_2m, i),
    humidity: at(h.relative_humidity_2m, i),
    apparentC: at(h.apparent_temperature, i),
    precipProb: at(h.precipitation_probability, i),
    precipMm: at(h.precipitation, i),
    code: at(h.weather_code, i),
    cloudCover: at(h.cloud_cover, i),
    visibilityM: at(h.visibility, i),
    windKmh: at(h.wind_speed_10m, i),
    windDeg: at(h.wind_direction_10m, i),
    gustKmh: at(h.wind_gusts_10m, i),
    uvIndex: at(h.uv_index, i),
    isDay: at(h.is_day, i) === 1,
    pm10: airAt(time, 'pm10'),
    pm25: airAt(time, 'pm2_5'),
    dust: airAt(time, 'dust'),
  }));

  const d = forecast.daily || {};
  const days = (d.time || []).map((date, i) => ({
    date,
    code: at(d.weather_code, i),
    maxC: at(d.temperature_2m_max, i),
    minC: at(d.temperature_2m_min, i),
    apparentMaxC: at(d.apparent_temperature_max, i),
    sunrise: d.sunrise?.[i] ?? null,
    sunset: d.sunset?.[i] ?? null,
    uvMax: at(d.uv_index_max, i),
    precipMm: at(d.precipitation_sum, i),
    precipProb: at(d.precipitation_probability_max, i),
    windMaxKmh: at(d.wind_speed_10m_max, i),
    gustMaxKmh: at(d.wind_gusts_10m_max, i),
    windDeg: at(d.wind_direction_10m_dominant, i),
  }));

  const c = forecast.current || {};
  // Visibility and UV have no "current" field in the forecast API, so the
  // matching hour supplies them.
  const currentHour = hours.find((x) => x.time === c.time) || null;
  const ac = air?.current || {};

  const now = {
    time: c.time ?? null,
    tempC: Number.isFinite(c.temperature_2m) ? c.temperature_2m : null,
    humidity: Number.isFinite(c.relative_humidity_2m) ? c.relative_humidity_2m : null,
    apparentC: Number.isFinite(c.apparent_temperature) ? c.apparent_temperature : null,
    code: Number.isFinite(c.weather_code) ? c.weather_code : null,
    isDay: c.is_day === 1,
    cloudCover: Number.isFinite(c.cloud_cover) ? c.cloud_cover : null,
    pressureHpa: Number.isFinite(c.pressure_msl) ? c.pressure_msl : null,
    precipMm: Number.isFinite(c.precipitation) ? c.precipitation : null,
    windKmh: Number.isFinite(c.wind_speed_10m) ? c.wind_speed_10m : null,
    windDeg: Number.isFinite(c.wind_direction_10m) ? c.wind_direction_10m : null,
    gustKmh: Number.isFinite(c.wind_gusts_10m) ? c.wind_gusts_10m : null,
    visibilityM: currentHour?.visibilityM ?? null,
    uvIndex: Number.isFinite(ac.uv_index) ? ac.uv_index : (currentHour?.uvIndex ?? null),
    pm10: Number.isFinite(ac.pm10) ? ac.pm10 : (currentHour?.pm10 ?? null),
    pm25: Number.isFinite(ac.pm2_5) ? ac.pm2_5 : (currentHour?.pm25 ?? null),
    dust: Number.isFinite(ac.dust) ? ac.dust : (currentHour?.dust ?? null),
  };

  return {
    place,
    fetchedAt: fetchedAt.toISOString(),
    hasAirQuality: Boolean(airTimes?.length),
    latitude: forecast.latitude ?? null,
    longitude: forecast.longitude ?? null,
    elevation: forecast.elevation ?? null,
    now,
    hours,
    days,
  };
}

async function getJSON(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${res.status}`);
  return res.json();
}

/**
 * Fetch and normalize. The air-quality call is allowed to fail on its own —
 * losing the dust numbers should never cost you the temperature.
 */
export async function load({ lat, lon, place = null, signal = undefined } = {}) {
  const forecast = await getJSON(forecastUrl({ lat, lon }), signal);
  let air = null;
  try {
    air = await getJSON(airUrl({ lat, lon }), signal);
  } catch { /* dust fields stay null; the app renders without them */ }
  return normalize(forecast, air, { place, fetchedAt: new Date() });
}
