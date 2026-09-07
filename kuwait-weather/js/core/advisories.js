// The strip of things worth knowing before you read anything else.
//
// An advisory here is not an official warning — Kuwait's Meteorological
// Department issues those, and this app is not it. These are thresholds
// applied to a public forecast, in the order a person outdoors would want
// them: the law first, then dust, then heat, then wind, then the rare wet day
// that shuts a road.
//
// Severity runs 'info' < 'watch' < 'warning' < 'severe', and the list comes
// back sorted with the worst first.

import { isRain, HEAVY_RAIN_CODES } from './weathercode.js';
import { banStatus } from './workban.js';
import { nextDust } from './derive.js';
import { hourLabel, minutes } from './format.js';

const RANK = { info: 0, watch: 1, warning: 2, severe: 3 };

export function advisories(derived, { now = new Date() } = {}) {
  const out = [];
  const cur = derived.now;

  // 1. The midday ban, which is the only item here with the force of law.
  const ban = banStatus(now);
  if (ban.active) {
    out.push({
      id: 'work-ban',
      severity: 'warning',
      icon: 'ban',
      title: 'Midday work ban in force',
      detail: `Work in direct sun in open areas is prohibited until ${ban.toHour}:00 — ${minutes(ban.minutesUntilEnd)} from now.`,
    });
  } else if (ban.inSeason && ban.minutesUntilStart != null && ban.minutesUntilStart <= 120) {
    out.push({
      id: 'work-ban-soon',
      severity: 'info',
      icon: 'ban',
      title: `Work ban starts at ${ban.fromHour}:00`,
      detail: `${minutes(ban.minutesUntilStart)} from now, outdoor work in direct sun has to stop until ${ban.toHour}:00.`,
    });
  }

  // 2. Dust, now and next.
  if (cur.dust && cur.dust.rank >= 3) {
    out.push({
      id: 'dust-now',
      severity: cur.dust.rank >= 4 ? 'severe' : 'warning',
      icon: 'dust',
      title: cur.dust.label,
      detail: cur.dust.advice,
    });
  } else if (cur.dust && cur.dust.rank === 2) {
    out.push({ id: 'dust-now', severity: 'watch', icon: 'dust', title: cur.dust.label, detail: cur.dust.advice });
  } else {
    const coming = nextDust(derived.hours, 3, now);
    if (coming) {
      out.push({
        id: 'dust-later',
        severity: 'watch',
        icon: 'dust',
        title: `${coming.dust.label} expected`,
        detail: `Visibility drops from around ${hourLabel(coming.at)}. Get outdoor work done before then.`,
      });
    }
  }

  // 3. Heat. The WBGT band is what decides this, not the thermometer.
  if (cur.work && cur.work.id === 'stop') {
    out.push({
      id: 'heat',
      severity: 'severe',
      icon: 'heat',
      title: 'Dangerous heat for outdoor work',
      detail: 'Estimated WBGT is above the point where work/rest cycles stop being enough. Stay out of the sun.',
    });
  } else if (cur.heat && (cur.heat.id === 'danger' || cur.heat.id === 'extreme-danger')) {
    out.push({ id: 'heat', severity: 'warning', icon: 'heat', title: cur.heat.label, detail: cur.heat.note });
  } else if (cur.heat && cur.heat.id === 'extreme') {
    out.push({ id: 'heat', severity: 'watch', icon: 'heat', title: cur.heat.label, detail: cur.heat.note });
  }

  // 4. Shamal.
  if (cur.shamal) {
    out.push({
      id: 'shamal',
      severity: cur.shamal.strength === 'severe' ? 'warning' : cur.shamal.strength === 'strong' ? 'watch' : 'info',
      icon: 'wind',
      title: cur.shamal.label,
      detail: cur.shamal.detail,
    });
  } else if (Number.isFinite(cur.gustKmh) && cur.gustKmh >= 55) {
    out.push({
      id: 'gusts',
      severity: 'watch',
      icon: 'wind',
      title: 'Strong gusts',
      detail: `Gusting to ${Math.round(cur.gustKmh)} km/h. Secure anything loose on a roof or a site.`,
    });
  }

  // 5. Rain. Kuwait gets very little of it and drains for even less, so the
  // threshold for saying something is deliberately low.
  const wetHours = derived.hours
    .filter((h) => h.at && h.at > now && h.at - now < 24 * 3600 * 1000)
    .filter((h) => isRain(h.code) || (h.precipMm ?? 0) > 0.2);
  const totalMm = wetHours.reduce((sum, h) => sum + (h.precipMm ?? 0), 0);
  if (isRain(cur.code) || totalMm >= 1) {
    const heavy = wetHours.some((h) => HEAVY_RAIN_CODES.has(h.code)) || totalMm >= 10;
    out.push({
      id: 'rain',
      severity: heavy ? 'warning' : 'info',
      icon: 'rain',
      title: heavy ? 'Heavy rain expected' : 'Rain expected',
      detail: heavy
        ? `Around ${totalMm.toFixed(0)} mm in the next 24 hours. Underpasses and low roads flood quickly here.`
        : `Around ${totalMm.toFixed(1)} mm in the next 24 hours. Roads are slick after months of dust.`,
    });
  }

  // 6. Fog, which is a winter morning problem on the coast road.
  if (cur.code === 45 || cur.code === 48) {
    out.push({ id: 'fog', severity: 'watch', icon: 'fog', title: 'Fog', detail: 'Low visibility on open roads. Fog lights, not high beams.' });
  }

  // 7. UV, only when it is worth acting on.
  if (Number.isFinite(cur.uvIndex) && cur.uvIndex >= 8 && cur.isDay) {
    out.push({
      id: 'uv',
      severity: cur.uvIndex >= 11 ? 'watch' : 'info',
      icon: 'sun',
      title: `UV index ${Math.round(cur.uvIndex)}`,
      detail: cur.uvIndex >= 11 ? 'Extreme. Unprotected skin burns in minutes.' : 'Very high. Cover up, or stay in shade through the middle of the day.',
    });
  }

  return out.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

export const SEVERITY_ORDER = RANK;
