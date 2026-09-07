// Two drawings.
//
// The rain bars are the important one. Twenty-four hours of forecast rainfall,
// each hour coloured by the band it falls in, with PAGASA's own warning
// thresholds drawn straight across as lines — so the question "is this going
// to be a problem" is answered by whether the bars cross a line, rather than
// by reading numbers.
//
// The temperature curve is the second: what the thermometer says and what it
// will feel like, on one scale, so the gap between them *is* the humidity.
//
// Everything here is pure: values in, an SVG string out.

import { INTENSITY } from '../core/rain.js';

const round = (n) => Math.round(n * 100) / 100;

// The thresholds worth drawing. These are the PAGASA warning levels.
export const THRESHOLDS = [
  { mm: 7.5, id: 'heavy',      label: 'Yellow' },
  { mm: 15,  id: 'intense',    label: 'Orange' },
  { mm: 30,  id: 'torrential', label: 'Red' },
];

/** The top of the rain scale: always high enough for the yellow line to mean something. */
export function rainCeiling(values) {
  const peak = Math.max(0, ...values.filter(Number.isFinite));
  return Math.max(10, round(peak * 1.15));
}

/**
 * Hourly rainfall as bars, with the warning thresholds across them.
 * @param {{mm: number, id: string, label: string}[]} hours
 */
export function rainBars(hours, { width = 320, height = 110, gap = 1.5 } = {}) {
  if (!hours.length) return '';
  const values = hours.map((h) => (Number.isFinite(h.mm) ? h.mm : 0));
  const ceiling = rainCeiling(values);
  const slot = width / hours.length;
  const barWidth = Math.max(1, slot - gap);
  const y = (mm) => round(height - (Math.min(mm, ceiling) / ceiling) * height);

  // The rules are drawn in the SVG; their labels are not. This viewBox is
  // stretched with preserveAspectRatio="none" so the bars fill the width, and
  // stretching squashes text with it. The legend is HTML, beside the chart.
  const lines = THRESHOLDS.filter((t) => t.mm < ceiling).map((t) => `
    <line class="bar-rule bar-rule--${t.id}" x1="0" x2="${width}" y1="${y(t.mm)}" y2="${y(t.mm)}"/>`).join('');

  const bars = hours.map((h, i) => {
    const mm = values[i];
    const top = y(mm);
    // A trace of rain still gets a sliver, so "a little" never looks like "none".
    const barHeight = mm > 0 ? Math.max(1.5, height - top) : 0;
    if (!barHeight) return '';
    return `<rect class="bar bar--${h.id}" x="${round(i * slot + gap / 2)}" y="${round(height - barHeight)}"
      width="${round(barWidth)}" height="${round(barHeight)}" rx="1.5"><title>${h.label}: ${mm.toFixed(1)} mm</title></rect>`;
  }).join('');

  return `<svg class="bars" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"
    role="img" aria-label="Rainfall over the next 24 hours" focusable="false">
    ${lines}${bars}
  </svg>`;
}

/** The key to the threshold lines, as HTML so nothing distorts it. */
export function rainLegend(values = []) {
  const ceiling = rainCeiling(values);
  const shown = THRESHOLDS.filter((t) => t.mm < ceiling);
  if (!shown.length) return '';
  return `<ul class="bar-key">${shown.map((t) => `
    <li class="bar-key--${t.id}"><i></i>${t.label} · ${t.mm} mm/h</li>`).join('')}</ul>`;
}

/** Which intensity id a millimetre figure belongs to — for colouring a bar. */
export function bandIdFor(mm) {
  if (!Number.isFinite(mm) || mm <= 0) return 'none';
  let id = 'none';
  for (const step of INTENSITY) if (mm >= step.from) id = step.id;
  return id;
}

// ── the temperature curve ───────────────────────────────────────────────────

export function bounds(values, { pad = 0.18 } = {}) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (max - min < 0.5) { min -= 0.5; max += 0.5; }
  const room = (max - min) * pad;
  return { min: min - room, max: max + room };
}

export function project(values, { width, height, min, max, padX = 0 }) {
  const span = (max - min) || 1;
  const plot = Math.max(1, width - padX * 2);
  const last = values.length - 1;
  const points = [];
  values.forEach((v, i) => {
    if (!Number.isFinite(v)) return;
    points.push({
      x: last === 0 ? width / 2 : round(padX + (i / last) * plot),
      y: round(height - ((v - min) / span) * height),
      value: v,
      index: i,
    });
  });
  return points;
}

/**
 * A Catmull-Rom spline through every point, as cubic béziers, with the control
 * points clamped to the box — unclamped, a sharp drop overshoots and draws a
 * temperature that never happens.
 */
export function smoothPath(points, { tension = 1, height = null } = {}) {
  if (!points.length) return '';
  if (points.length === 1) return `M${round(points[0].x)} ${round(points[0].y)}`;
  const t = Math.min(1, Math.max(0, tension)) / 6;
  const clamp = (y) => (height == null ? y : Math.min(height, Math.max(0, y)));

  let d = `M${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    d += ` C${round(p1.x + (p2.x - p0.x) * t)} ${round(clamp(p1.y + (p2.y - p0.y) * t))}`
      + ` ${round(p2.x - (p3.x - p1.x) * t)} ${round(clamp(p2.y - (p3.y - p1.y) * t))}`
      + ` ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

export function chart(series, { width = 320, height = 88, tension = 1, padX = 6 } = {}) {
  const actual = series.actual || [];
  const feels = series.feels || [];
  const scale = bounds([...actual, ...feels]);
  if (!scale || actual.length < 2) return '';

  const box = { width, height, padX, min: scale.min, max: scale.max };
  const actualPoints = project(actual, box);
  const feelsPoints = feels.length ? project(feels, box) : [];

  return `<svg class="curve" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"
    role="img" aria-label="Temperature and how it feels over the next 24 hours" focusable="false">
    ${feelsPoints.length ? `<path class="curve-feels" d="${smoothPath(feelsPoints, { tension, height })}"/>` : ''}
    <path class="curve-line" d="${smoothPath(actualPoints, { tension, height })}"/>
  </svg>`;
}
