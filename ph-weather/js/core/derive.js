// Everything the forecast does not say outright.
//
// The API returns rain, humidity, wind, particulates. What somebody in
// Marikina needs is: will the street flood, is the hillside above me wet, how
// hard will today feel, and is the air worth wearing a mask for. This module
// turns the first list into the second, and it is pure.

import { heatIndexC, dewPointC, heatBand, comfort, humidityPenaltyC } from './heat.js';
import { intensityFor, dailyBand } from './rain.js';
import { saturation, antecedent } from './saturation.js';
import { floodRisk } from './flood.js';
import { landslideRisk } from './landslide.js';
import { monsoon, compass, beaufort } from './monsoon.js';
import { aqiBand, dampness, irritants } from './air.js';
import { parseLocal, manilaParts } from './format.js';

function enrich(point, { month, rainMm24h }) {
  const { tempC, humidity } = point;
  const measurable = Number.isFinite(tempC) && Number.isFinite(humidity);

  const heatIndex = measurable ? heatIndexC(tempC, humidity) : null;
  // The forecast supplies a dew point of its own; falling back to computing it
  // keeps the comfort reading alive when that field is missing.
  const dew = Number.isFinite(point.dewPointC)
    ? point.dewPointC
    : (measurable ? dewPointC(tempC, humidity) : null);

  return {
    ...point,
    heatIndexC: heatIndex,
    heat: heatIndex == null ? null : heatBand(heatIndex),
    humidityPenaltyC: measurable ? humidityPenaltyC(tempC, humidity) : null,
    dew,
    comfort: dew == null ? null : comfort(dew),
    rain: intensityFor(point.precipMm),
    aqi: aqiBand(point.usAqi),
    compass: compass(point.windDeg),
    beaufort: beaufort(point.windKmh),
    monsoon: monsoon({
      speedKmh: point.windKmh, directionDeg: point.windDeg, month, rainMm24h,
    }),
  };
}

/**
 * @param {object} reading a normalized reading from `api.normalize`
 * @param {{now?: Date}} options
 */
export function derive(reading, { now = new Date() } = {}) {
  const month = manilaParts(now).month;

  const withTimes = reading.hours.map((h) => ({ ...h, at: parseLocal(h.time) }));
  const ahead = withTimes.filter((h) => h.at && h.at.getTime() >= now.getTime() - 30 * 60 * 1000);
  const rainMm24h = ahead.slice(0, 24)
    .reduce((sum, h) => sum + (Number.isFinite(h.precipMm) ? h.precipMm : 0), 0);

  const hours = withTimes.map((h) => enrich(h, { month, rainMm24h }));
  const future = hours.filter((h) => h.at && h.at.getTime() >= now.getTime() - 30 * 60 * 1000);

  // The past week, which is the whole reason this app asks for `past_days`.
  const mm3d = antecedent(hours, { now, days: 3 });
  const mm7d = antecedent(hours, { now, days: 7 });
  const ground = saturation({ mm3d, mm7d });

  const flood = floodRisk(future, ground);
  const landslide = landslideRisk(ground, future);

  const byDate = new Map();
  for (const h of hours) {
    const date = h.time.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(h);
  }

  const days = reading.days.map((d) => {
    const own = byDate.get(d.date) || [];
    const peakHeat = own.reduce((max, h) => (h.heatIndexC != null && h.heatIndexC > max ? h.heatIndexC : max), -Infinity);
    const peakRain = own.reduce((max, h) => Math.max(max, h.precipMm ?? 0), 0);
    return {
      ...d,
      at: parseLocal(`${d.date}T12:00`),
      peakHeatIndexC: Number.isFinite(peakHeat) ? peakHeat : null,
      peakHeat: Number.isFinite(peakHeat) ? heatBand(peakHeat) : null,
      peakRainMmPerHour: peakRain,
      rainBand: dailyBand(d.precipMm),
      rainIntensity: intensityFor(peakRain),
      // A day whose worst hour reaches PAGASA's warning range is worth
      // marking in the week, whatever its total.
      warned: intensityFor(peakRain).rank >= 3,
    };
  });

  const nowPoint = enrich({ ...reading.now, at: parseLocal(reading.now.time) }, { month, rainMm24h });

  return {
    ...reading,
    now: {
      ...nowPoint,
      damp: dampness({ humidity: nowPoint.humidity, tempC: nowPoint.tempC }),
      irritants: irritants({
        pm25: nowPoint.pm25, pm10: nowPoint.pm10, ozone: nowPoint.ozone, no2: nowPoint.no2,
      }),
    },
    hours,
    days,
    ground,
    flood,
    landslide,
    rainMm24h,
  };
}

/** The next `count` hours from now. Nothing ahead means nothing, not the start. */
export function upcoming(hours, count = 24, now = new Date()) {
  const from = hours.findIndex((h) => h.at && h.at.getTime() >= now.getTime() - 30 * 60 * 1000);
  if (from === -1) return [];
  return hours.slice(from, from + count);
}

/** The next hour whose rain reaches `rank` or worse — the "it starts at" line. */
export function nextRain(hours, rank = 3, now = new Date()) {
  return hours.find((h) => h.at && h.at > now && h.rain && h.rain.rank >= rank) || null;
}

/** The stretch of hours the rain is expected to fall hardest in. */
export function wettestWindow(hours, now = new Date(), span = 24) {
  const ahead = upcoming(hours, span, now);
  if (!ahead.length) return null;
  let best = null;
  for (let i = 0; i < ahead.length; i++) {
    const run = [];
    for (let j = i; j < ahead.length && (ahead[j].precipMm ?? 0) >= 2.5; j++) run.push(ahead[j]);
    if (run.length >= 2) {
      const mm = run.reduce((sum, h) => sum + (h.precipMm ?? 0), 0);
      if (!best || mm > best.mm) {
        best = { from: run[0].at, to: new Date(run[run.length - 1].at.getTime() + 3600 * 1000), mm, hours: run.length };
      }
      i += run.length - 1;
    }
  }
  return best;
}
