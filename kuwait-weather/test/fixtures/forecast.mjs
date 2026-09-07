// A synthetic Open-Meteo pair, shaped exactly like the real responses.
//
// The live API can't be called from a test, so the fixture is built rather
// than recorded — which also lets a test ask for a specific kind of day: a
// July afternoon in a dust storm, a mild January morning, an air-quality
// endpoint that returned nothing.

const pad = (n) => String(n).padStart(2, '0');

/** Kuwait wall-clock stamps, the way the API returns them for timezone=Asia/Kuwait. */
export function stamps(date, hours) {
  return Array.from({ length: hours }, (_, i) => {
    const d = new Date(date.getTime() + i * 3600 * 1000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`;
  });
}

/**
 * @param {object} opts
 * @param {string} opts.start   first hour, as a Kuwait wall-clock ISO string
 * @param {number} opts.hours
 * @param {(i: number, time: string) => object} opts.hour  per-hour overrides
 */
export function forecast({ start = '2026-07-15T00:00', hours = 48, hour = () => ({}), current = {} } = {}) {
  const base = new Date(`${start}:00Z`);
  const time = stamps(base, hours);

  const series = time.map((t, i) => ({
    temperature_2m: 38 + 10 * Math.sin(((i % 24) - 6) * (Math.PI / 12)),
    relative_humidity_2m: 22,
    apparent_temperature: 41,
    precipitation_probability: 0,
    precipitation: 0,
    weather_code: 0,
    cloud_cover: 0,
    visibility: 24000,
    wind_speed_10m: 18,
    wind_direction_10m: 320,
    wind_gusts_10m: 30,
    uv_index: (i % 24) >= 6 && (i % 24) <= 17 ? 9 : 0,
    is_day: (i % 24) >= 5 && (i % 24) <= 18 ? 1 : 0,
    ...hour(i, t),
  }));

  const column = (key) => series.map((row) => row[key]);
  const days = [...new Set(time.map((t) => t.slice(0, 10)))];

  return {
    latitude: 29.375, longitude: 47.9775, elevation: 10,
    timezone: 'Asia/Kuwait', timezone_abbreviation: 'GMT+3', utc_offset_seconds: 10800,
    current: {
      time: time[12],
      temperature_2m: series[12].temperature_2m,
      relative_humidity_2m: series[12].relative_humidity_2m,
      apparent_temperature: series[12].apparent_temperature,
      is_day: series[12].is_day,
      precipitation: series[12].precipitation,
      weather_code: series[12].weather_code,
      cloud_cover: series[12].cloud_cover,
      pressure_msl: 1002.4,
      wind_speed_10m: series[12].wind_speed_10m,
      wind_direction_10m: series[12].wind_direction_10m,
      wind_gusts_10m: series[12].wind_gusts_10m,
      ...current,
    },
    hourly: {
      time,
      temperature_2m: column('temperature_2m'),
      relative_humidity_2m: column('relative_humidity_2m'),
      apparent_temperature: column('apparent_temperature'),
      precipitation_probability: column('precipitation_probability'),
      precipitation: column('precipitation'),
      weather_code: column('weather_code'),
      cloud_cover: column('cloud_cover'),
      visibility: column('visibility'),
      wind_speed_10m: column('wind_speed_10m'),
      wind_direction_10m: column('wind_direction_10m'),
      wind_gusts_10m: column('wind_gusts_10m'),
      uv_index: column('uv_index'),
      is_day: column('is_day'),
    },
    daily: {
      time: days,
      weather_code: days.map(() => 0),
      temperature_2m_max: days.map(() => 48),
      temperature_2m_min: days.map(() => 32),
      apparent_temperature_max: days.map(() => 52),
      sunrise: days.map((d) => `${d}T04:55`),
      sunset: days.map((d) => `${d}T18:48`),
      uv_index_max: days.map(() => 10.2),
      precipitation_sum: days.map(() => 0),
      precipitation_probability_max: days.map(() => 0),
      wind_speed_10m_max: days.map(() => 28),
      wind_gusts_10m_max: days.map(() => 44),
      wind_direction_10m_dominant: days.map(() => 318),
    },
  };
}

/** The air-quality response, optionally offset so its hours don't line up by index. */
export function air({ start = '2026-07-15T00:00', hours = 48, offsetHours = 0, hour = () => ({}), current = {} } = {}) {
  const base = new Date(new Date(`${start}:00Z`).getTime() + offsetHours * 3600 * 1000);
  const time = stamps(base, hours);
  const series = time.map((t, i) => ({ pm10: 60, pm2_5: 18, dust: 30, ...hour(i, t) }));
  return {
    latitude: 29.375, longitude: 47.9775, timezone: 'Asia/Kuwait',
    current: { time: time[0], pm10: series[0].pm10, pm2_5: series[0].pm2_5, dust: series[0].dust, uv_index: 9.4, ...current },
    hourly: {
      time,
      pm10: series.map((r) => r.pm10),
      pm2_5: series.map((r) => r.pm2_5),
      dust: series.map((r) => r.dust),
    },
  };
}
