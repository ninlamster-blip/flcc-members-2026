// The strip of things worth knowing before anything else on the screen.
//
// An advisory here is not an official warning. PAGASA issues those, and the
// local disaster office decides what to do about them. These are published
// thresholds applied to a public forecast, in the order somebody in a
// flood-prone barangay would want them: water first, then the ground, then
// the wind that brought it, then heat, then air.

import { isStorm } from './weathercode.js';
import { nextRain, wettestWindow } from './derive.js';
import { hourLabel } from './format.js';
import { WARNING_COLOUR } from './rain.js';

const RANK = { info: 0, watch: 1, warning: 2, severe: 3 };

export function advisories(d, { now = new Date() } = {}) {
  const out = [];
  const cur = d.now;

  // 1. Flooding — the reason this app exists.
  if (d.flood && d.flood.rank >= 2) {
    out.push({
      id: 'flood',
      severity: d.flood.rank >= 4 ? 'severe' : d.flood.rank === 3 ? 'warning' : 'watch',
      icon: 'flood',
      title: d.flood.label,
      detail: d.flood.advice,
    });
  }

  // 2. Rain heavy enough to carry a PAGASA colour, and when it starts.
  const coming = nextRain(d.hours, 3, now);
  if (cur.rain && cur.rain.rank >= 3) {
    const colour = WARNING_COLOUR[cur.rain.id];
    out.push({
      id: 'rain-now',
      severity: cur.rain.rank >= 5 ? 'severe' : cur.rain.rank === 4 ? 'warning' : 'watch',
      icon: cur.rain.rank >= 4 ? 'downpour' : 'rain',
      title: `${cur.rain.label} falling now`,
      detail: `${cur.rain.advice}${colour ? ` PAGASA would call this the ${colour} range.` : ''}`,
    });
  } else if (coming) {
    const window = wettestWindow(d.hours, now);
    out.push({
      id: 'rain-later',
      severity: coming.rain.rank >= 4 ? 'warning' : 'watch',
      icon: 'rain',
      title: `${coming.rain.label} expected`,
      detail: `Starting around ${hourLabel(coming.at)}${
        window ? `, heaviest ${hourLabel(window.from)} to ${hourLabel(window.to)} with about ${Math.round(window.mm)} mm` : ''}.`,
    });
  }

  // 3. The ground, and what is above you standing on it.
  if (d.landslide && d.landslide.rank >= 2) {
    out.push({
      id: 'landslide',
      severity: d.landslide.rank >= 3 ? 'warning' : 'watch',
      icon: 'landslide',
      title: d.landslide.label,
      detail: d.landslide.advice,
    });
  } else if (d.ground && d.ground.rank >= 3) {
    out.push({
      id: 'ground',
      severity: 'watch',
      icon: 'landslide',
      title: d.ground.label,
      detail: `${d.ground.note} ${d.ground.reason}.`,
    });
  }

  // 4. Thunderstorms, which arrive fast and are what catches people out.
  if (isStorm(cur.code)) {
    out.push({
      id: 'storm',
      severity: 'warning',
      icon: 'storm',
      title: 'Thunderstorm',
      detail: 'Lightning about. Get off open ground and away from water and tall isolated trees.',
    });
  }

  // 5. The monsoon that is doing all of this.
  if (cur.monsoon) {
    out.push({
      id: 'monsoon',
      severity: cur.monsoon.enhanced ? 'warning' : cur.monsoon.strength === 'strong' ? 'watch' : 'info',
      icon: 'wind',
      title: cur.monsoon.label,
      detail: cur.monsoon.detail,
    });
  }

  // 6. Heat, which here is really humidity.
  if (cur.heat && (cur.heat.id === 'danger' || cur.heat.id === 'extreme-danger')) {
    out.push({
      id: 'heat',
      severity: cur.heat.id === 'extreme-danger' ? 'severe' : 'warning',
      icon: 'heat',
      title: `${cur.heat.label} — heat index ${Math.round(cur.heatIndexC)}°`,
      detail: cur.heat.note,
    });
  } else if (cur.heat && cur.heat.id === 'extreme-caution') {
    out.push({
      id: 'heat', severity: 'watch', icon: 'heat',
      title: `${cur.heat.label} — heat index ${Math.round(cur.heatIndexC)}°`,
      detail: cur.heat.note,
    });
  }

  // 7. Air.
  if (cur.aqi && ['sensitive', 'unhealthy', 'very-unhealthy', 'hazardous'].includes(cur.aqi.id)) {
    out.push({
      id: 'air',
      severity: cur.aqi.id === 'sensitive' ? 'watch' : cur.aqi.id === 'unhealthy' ? 'warning' : 'severe',
      icon: 'air',
      title: `Air quality: ${cur.aqi.label.toLowerCase()}`,
      detail: cur.aqi.advice,
    });
  }

  return out.sort((a, b) => RANK[b.severity] - RANK[a.severity]);
}

export const SEVERITY_ORDER = RANK;
