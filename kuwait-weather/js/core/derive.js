// Everything the forecast does not say outright.
//
// The API returns temperature, humidity, wind, particulates. What a person
// standing in Farwaniya at two in the afternoon needs is heat index, WBGT,
// whether that northwesterly is a shamal, how far they can see, and whether
// they are allowed to be working at all. This module turns the first list into
// the second, and it is pure — same reading in, same answer out.

import { heatIndexC, wbgtC, heatBand, workRest, waterPerHourMl, DEFAULT_WORK_PROFILE } from './heat.js';
import { dustLevel } from './dust.js';
import { shamal, compass, beaufort } from './wind.js';
import { bannedHour, kuwaitParts } from './workban.js';
import { parseLocal } from './format.js';

function enrich(point, { month, profile }) {
  const { tempC, humidity, isDay, cloudCover, windKmh } = point;
  const measurable = Number.isFinite(tempC) && Number.isFinite(humidity);

  const heatIndex = measurable ? heatIndexC(tempC, humidity) : null;
  const wbgt = measurable
    ? wbgtC(tempC, humidity, { isDay, cloudCover: cloudCover ?? 0, windKmh: windKmh ?? 0 })
    : null;

  return {
    ...point,
    // The raw mineral-dust concentration, kept under its own name because
    // `dust` below is about to become the level computed from it.
    dustUgm3: Number.isFinite(point.dust) ? point.dust : null,
    heatIndexC: heatIndex,
    wbgt,
    heat: heatIndex == null ? null : heatBand(heatIndex),
    work: wbgt == null ? null : workRest(wbgt, profile),
    waterMl: wbgt == null ? null : waterPerHourMl(wbgt),
    dust: dustLevel({ pm10: point.pm10, dust: point.dust, visibility: point.visibilityM }),
    shamal: shamal({
      speedKmh: point.windKmh,
      directionDeg: point.windDeg,
      gustKmh: point.gustKmh,
      month,
    }),
    compass: compass(point.windDeg),
    beaufort: beaufort(point.windKmh),
  };
}

/**
 * @param {object} reading a normalized reading from `api.normalize`
 * @param {{profile?: string, now?: Date}} options
 */
export function derive(reading, { profile = DEFAULT_WORK_PROFILE, now = new Date() } = {}) {
  const month = kuwaitParts(now).month;

  const hours = reading.hours.map((h) => {
    const when = parseLocal(h.time);
    return {
      ...enrich(h, { month, profile }),
      at: when,
      banned: when ? bannedHour(when) : false,
    };
  });

  // The days carry no humidity of their own, so their heat figures come from
  // the hours that make them up rather than from a daily average that would
  // mean nothing.
  const byDate = new Map();
  for (const h of hours) {
    const date = h.time.slice(0, 10);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(h);
  }

  const days = reading.days.map((d) => {
    const own = byDate.get(d.date) || [];
    const peakWbgt = own.reduce((max, h) => (h.wbgt != null && h.wbgt > max ? h.wbgt : max), -Infinity);
    const peakHeat = own.reduce((max, h) => (h.heatIndexC != null && h.heatIndexC > max ? h.heatIndexC : max), -Infinity);
    const worstDust = own.reduce((worst, h) => (h.dust && h.dust.rank > (worst?.rank ?? -1) ? h.dust : worst), null);
    const windiest = own.reduce((max, h) => (h.windKmh != null && h.windKmh > max ? h.windKmh : max), -Infinity);
    return {
      ...d,
      at: parseLocal(`${d.date}T12:00`),
      peakWbgt: Number.isFinite(peakWbgt) ? peakWbgt : null,
      peakHeatIndexC: Number.isFinite(peakHeat) ? peakHeat : null,
      peakHeat: Number.isFinite(peakHeat) ? heatBand(peakHeat) : null,
      peakWork: Number.isFinite(peakWbgt) ? workRest(peakWbgt, profile) : null,
      dust: worstDust,
      shamal: own.map((h) => h.shamal).find(Boolean) || null,
      peakWindKmh: Number.isFinite(windiest) ? windiest : (d.windMaxKmh ?? null),
    };
  });

  return {
    ...reading,
    now: enrich(reading.now, { month, profile }),
    hours,
    days,
    profile,
  };
}

/** The next `count` hours from now, for the hourly strip. */
export function upcoming(hours, count = 24, now = new Date()) {
  const from = hours.findIndex((h) => h.at && h.at.getTime() >= now.getTime() - 30 * 60 * 1000);
  const start = from === -1 ? 0 : from;
  return hours.slice(start, start + count);
}

/** The next hour in which the dust rises to `rank` or worse — the "it's coming" line. */
export function nextDust(hours, rank = 2, now = new Date()) {
  return hours.find((h) => h.at && h.at > now && h.dust && h.dust.rank >= rank) || null;
}

/**
 * The longest stretch in the next 24 hours that is outside the midday ban,
 * below a work/rest threshold, and not in the dust — the answer to "when do I
 * do this?".
 *
 * Dust belongs in this and it is easy to leave out: an evening that has cooled
 * off is not a good time to be outside if the reason it cooled off is the
 * shamal that is about to arrive with it.
 *
 * Runs are measured on the hours as forecast, so the window it returns is a
 * real forecast stretch rather than a rule of thumb about mornings.
 */
export function bestOutdoorWindow(hours, { now = new Date(), maxWbgt = 29.5, maxDustRank = 2, span = 24 } = {}) {
  const ahead = upcoming(hours, span, now).filter((h) => h.at);
  let best = null;
  let run = [];

  const close = () => {
    if (run.length >= 2) {
      const candidate = { from: run[0].at, to: new Date(run[run.length - 1].at.getTime() + 3600 * 1000), hours: run.length };
      if (!best || candidate.hours > best.hours) best = candidate;
    }
    run = [];
  };

  for (const h of ahead) {
    const ok = !h.banned
      && h.wbgt != null && h.wbgt < maxWbgt
      && (!h.dust || h.dust.rank <= maxDustRank);
    if (ok) run.push(h);
    else close();
  }
  close();
  return best;
}
