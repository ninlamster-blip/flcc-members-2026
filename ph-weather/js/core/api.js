// The forecast itself.
//
// Open-Meteo, called straight from the browser: no key, no signup, no server
// of our own, and nothing in the request about the person making it beyond a
// coordinate rounded to four decimals.
//
// The one thing this app asks for that an ordinary weather app would not is
// `past_days`. A week of *history* comes back alongside the forecast, because
// how much rain has already fallen is what decides whether the next 40 mm runs
// off the road or soaks into the ground. Without it there is no flood model
// and no landslide model worth the name.

export const FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
export const AIR_ENDPOINT = 'https://air-quality-api.open-meteo.com/v1/air-quality';
export const TIME_ZONE = 'Asia/Manila';

export const FORECAST_DAYS = 7;
export const AIR_DAYS = 5;
// Seven days back: enough for a three-day antecedent total with room around it.
export const PAST_DAYS = 7;

const CURRENT_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
  'precipitation', 'rain', 'showers', 'weather_code', 'cloud_cover',
  'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
];

const HOURLY_FIELDS = [
  'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'dew_point_2m',
  'precipitation', 'precipitation_probability', 'rain', 'showers',
  'weather_code', 'cloud_cover', 'visibility', 'wind_speed_10m',
  'wind_direction_10m', 'wind_gusts_10m', 'uv_index', 'cape', 'is_day',
];

const DAILY_FIELDS = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'apparent_temperature_max', 'sunrise', 'sunset', 'uv_index_max',
  'precipitation_sum', 'precipitation_probability_max', 'precipitation_hours',
  'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
];

const AIR_CURRENT_FIELDS = ['pm10', 'pm2_5', 'ozone', 'nitrogen_dioxide', 'us_aqi', 'uv_index'];
const AIR_HOURLY_FIELDS = ['pm10', 'pm2_5', 'ozone', 'nitrogen_dioxide', 'us_aqi'];

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
    past_days: String(PAST_DAYS),
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

export function normalize(forecast, air = null, { place = null, fetchedAt = new Date() } = {}) {
  if (!forecast || !forecast.hourly || !Array.isArray(forecast.hourly.time)) {
    throw new Error('Forecast response has no hourly data');
  }

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
    dewPointC: at(h.dew_point_2m, i),
    precipMm: at(h.precipitation, i),
    precipProb: at(h.precipitation_probability, i),
    rainMm: at(h.rain, i),
    showersMm: at(h.showers, i),
    code: at(h.weather_code, i),
    cloudCover: at(h.cloud_cover, i),
    visibilityM: at(h.visibility, i),
    windKmh: at(h.wind_speed_10m, i),
    windDeg: at(h.wind_direction_10m, i),
    gustKmh: at(h.wind_gusts_10m, i),
    uvIndex: at(h.uv_index, i),
    cape: at(h.cape, i),
    isDay: at(h.is_day, i) === 1,
    pm25: airAt(time, 'pm2_5'),
    pm10: airAt(time, 'pm10'),
    usAqi: airAt(time, 'us_aqi'),
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
    precipHours: at(d.precipitation_hours, i),
    windMaxKmh: at(d.wind_speed_10m_max, i),
    gustMaxKmh: at(d.wind_gusts_10m_max, i),
    windDeg: at(d.wind_direction_10m_dominant, i),
  }));

  const c = forecast.current || {};
  const currentHour = hours.find((x) => x.time === c.time) || null;
  const ac = air?.current || {};

  const now = {
    time: c.time ?? null,
    tempC: Number.isFinite(c.temperature_2m) ? c.temperature_2m : null,
    humidity: Number.isFinite(c.relative_humidity_2m) ? c.relative_humidity_2m : null,
    apparentC: Number.isFinite(c.apparent_temperature) ? c.apparent_temperature : null,
    precipMm: Number.isFinite(c.precipitation) ? c.precipitation : null,
    rainMm: Number.isFinite(c.rain) ? c.rain : null,
    showersMm: Number.isFinite(c.showers) ? c.showers : null,
    code: Number.isFinite(c.weather_code) ? c.weather_code : null,
    isDay: c.is_day === 1,
    cloudCover: Number.isFinite(c.cloud_cover) ? c.cloud_cover : null,
    pressureHpa: Number.isFinite(c.pressure_msl) ? c.pressure_msl : null,
    windKmh: Number.isFinite(c.wind_speed_10m) ? c.wind_speed_10m : null,
    windDeg: Number.isFinite(c.wind_direction_10m) ? c.wind_direction_10m : null,
    gustKmh: Number.isFinite(c.wind_gusts_10m) ? c.wind_gusts_10m : null,
    dewPointC: currentHour?.dewPointC ?? null,
    visibilityM: currentHour?.visibilityM ?? null,
    cape: currentHour?.cape ?? null,
    uvIndex: Number.isFinite(ac.uv_index) ? ac.uv_index : (currentHour?.uvIndex ?? null),
    pm25: Number.isFinite(ac.pm2_5) ? ac.pm2_5 : (currentHour?.pm25 ?? null),
    pm10: Number.isFinite(ac.pm10) ? ac.pm10 : (currentHour?.pm10 ?? null),
    ozone: Number.isFinite(ac.ozone) ? ac.ozone : null,
    no2: Number.isFinite(ac.nitrogen_dioxide) ? ac.nitrogen_dioxide : null,
    usAqi: Number.isFinite(ac.us_aqi) ? ac.us_aqi : (currentHour?.usAqi ?? null),
  };

  return {
    place,
    fetchedAt: fetchedAt.toISOString(),
    hasAirQuality: Boolean(airTimes?.length),
    hasHistory: hours.some((x) => x.time < (c.time ?? '')),
    latitude: forecast.latitude ?? null,
    longitude: forecast.longitude ?? null,
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
 * Fetch and normalize. Air quality is allowed to fail on its own — losing the
 * particulate numbers should never cost somebody the flood warning.
 */
export async function load({ lat, lon, place = null, signal = undefined } = {}) {
  const forecast = await getJSON(forecastUrl({ lat, lon }), signal);
  let air = null;
  try {
    air = await getJSON(airUrl({ lat, lon }), signal);
  } catch { /* the air card says so; everything else still works */ }
  return normalize(forecast, air, { place, fetchedAt: new Date() });
}
