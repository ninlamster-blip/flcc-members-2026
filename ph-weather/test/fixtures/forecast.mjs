// A synthetic Open-Meteo pair for the Philippines, shaped exactly like the
// real responses — including the week of history the flood model needs.
//
// The live API cannot be called from a test, so the fixture is built rather
// than recorded, which also lets a test ask for a specific kind of week: three
// dry days then a downpour, a saturating habagat spell, an air-quality
// endpoint that returned nothing.

const pad = (n) => String(n).padStart(2, '0');

export function stamps(date, hours) {
  return Array.from({ length: hours }, (_, i) => {
    const d = new Date(date.getTime() + i * 3600 * 1000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`;
  });
}

/**
 * @param {object} opts
 * @param {string} opts.start  first hour, Manila wall clock — this is
 *        `pastDays` before "now", because the real response leads with history
 * @param {(i: number, time: string) => object} opts.hour per-hour overrides
 */
export function forecast({
  start = '2026-08-25T00:00', hours = 336, hour = () => ({}), current = {}, currentIndex = 168,
} = {}) {
  const base = new Date(`${start}:00Z`);
  const time = stamps(base, hours);

  const series = time.map((t, i) => ({
    temperature_2m: 29 + 4 * Math.sin(((i % 24) - 8) * (Math.PI / 12)),
    relative_humidity_2m: 82,
    apparent_temperature: 36,
    dew_point_2m: 25,
    precipitation: 0,
    precipitation_probability: 20,
    rain: 0,
    showers: 0,
    weather_code: 2,
    cloud_cover: 70,
    visibility: 18000,
    wind_speed_10m: 14,
    wind_direction_10m: 225,
    wind_gusts_10m: 26,
    uv_index: (i % 24) >= 6 && (i % 24) <= 17 ? 8 : 0,
    cape: 600,
    is_day: (i % 24) >= 6 && (i % 24) <= 17 ? 1 : 0,
    ...hour(i, t),
  }));

  const column = (key) => series.map((row) => row[key]);
  const days = [...new Set(time.map((t) => t.slice(0, 10)))];
  const c = series[currentIndex];

  return {
    latitude: 14.65, longitude: 121.1, elevation: 20,
    timezone: 'Asia/Manila', utc_offset_seconds: 28800,
    current: {
      time: time[currentIndex],
      temperature_2m: c.temperature_2m,
      relative_humidity_2m: c.relative_humidity_2m,
      apparent_temperature: c.apparent_temperature,
      is_day: c.is_day,
      precipitation: c.precipitation,
      rain: c.rain,
      showers: c.showers,
      weather_code: c.weather_code,
      cloud_cover: c.cloud_cover,
      pressure_msl: 1006.2,
      wind_speed_10m: c.wind_speed_10m,
      wind_direction_10m: c.wind_direction_10m,
      wind_gusts_10m: c.wind_gusts_10m,
      ...current,
    },
    hourly: {
      time,
      temperature_2m: column('temperature_2m'),
      relative_humidity_2m: column('relative_humidity_2m'),
      apparent_temperature: column('apparent_temperature'),
      dew_point_2m: column('dew_point_2m'),
      precipitation: column('precipitation'),
      precipitation_probability: column('precipitation_probability'),
      rain: column('rain'),
      showers: column('showers'),
      weather_code: column('weather_code'),
      cloud_cover: column('cloud_cover'),
      visibility: column('visibility'),
      wind_speed_10m: column('wind_speed_10m'),
      wind_direction_10m: column('wind_direction_10m'),
      wind_gusts_10m: column('wind_gusts_10m'),
      uv_index: column('uv_index'),
      cape: column('cape'),
      is_day: column('is_day'),
    },
    daily: {
      time: days,
      weather_code: days.map(() => 80),
      temperature_2m_max: days.map(() => 33),
      temperature_2m_min: days.map(() => 25),
      apparent_temperature_max: days.map(() => 41),
      sunrise: days.map((d) => `${d}T05:42`),
      sunset: days.map((d) => `${d}T18:12`),
      uv_index_max: days.map(() => 9.4),
      precipitation_sum: days.map(() => 12),
      precipitation_probability_max: days.map(() => 70),
      precipitation_hours: days.map(() => 6),
      wind_speed_10m_max: days.map(() => 22),
      wind_gusts_10m_max: days.map(() => 38),
      wind_direction_10m_dominant: days.map(() => 228),
    },
  };
}

export function air({ start = '2026-08-25T00:00', hours = 336, offsetHours = 0, hour = () => ({}), current = {} } = {}) {
  const base = new Date(new Date(`${start}:00Z`).getTime() + offsetHours * 3600 * 1000);
  const time = stamps(base, hours);
  const series = time.map((t, i) => ({
    pm10: 32, pm2_5: 14, ozone: 60, nitrogen_dioxide: 18, us_aqi: 55, ...hour(i, t),
  }));
  return {
    latitude: 14.65, longitude: 121.1, timezone: 'Asia/Manila',
    current: {
      time: time[0], pm10: series[0].pm10, pm2_5: series[0].pm2_5,
      ozone: series[0].ozone, nitrogen_dioxide: series[0].nitrogen_dioxide,
      us_aqi: series[0].us_aqi, uv_index: 9.1, ...current,
    },
    hourly: {
      time,
      pm10: series.map((r) => r.pm10),
      pm2_5: series.map((r) => r.pm2_5),
      ozone: series.map((r) => r.ozone),
      nitrogen_dioxide: series.map((r) => r.nitrogen_dioxide),
      us_aqi: series.map((r) => r.us_aqi),
    },
  };
}

/**
 * "now" for the default fixture — the instant of hour 168, which is the hour
 * the response marks as current. It has to line up exactly, or rain meant for
 * the forecast lands in the history the flood model reads and vice versa.
 *
 * Hour 168 is the Manila wall clock "2026-09-01T00:00", which is 16:00 UTC on
 * 31 August.
 */
export const NOW = new Date('2026-08-31T16:00:00Z');
export const NOW_INDEX = 168;
