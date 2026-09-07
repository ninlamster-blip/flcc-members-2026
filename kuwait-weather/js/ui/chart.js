// The temperature curve.
//
// Two smooth lines across the next twenty-four hours — what the thermometer
// will read, and what it will feel like — because the shape of a day is
// something you read in a second and a column of numbers is not.
//
// The smoothing is a Catmull-Rom spline converted to cubic béziers, which is
// the curve that passes *through* every point rather than near it. A weather
// curve that misses its own data would be a drawing, not a chart.
//
// Everything here is pure: values in, an SVG path string out.

const round = (n) => Math.round(n * 100) / 100;

/**
 * The value range to draw against, padded so the curve has room to breathe and
 * never touches the edge of its box.
 */
export function bounds(values, { pad = 0.18 } = {}) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (max - min < 0.5) { min -= 0.5; max += 0.5; } // a flat day still gets a line
  const room = (max - min) * pad;
  return { min: min - room, max: max + room };
}

/**
 * Values → points in a `width` × `height` box.
 *
 * `padX` insets the plot from the sides. Without it the first and last points
 * sit exactly on the edge, and the round marker on the hottest hour gets
 * sliced in half whenever the peak lands at either end of the day.
 */
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
 * A Catmull-Rom spline through every point, as cubic béziers.
 *
 * The control points are clamped to the box. Without that a sharp overnight
 * drop makes the curve overshoot past the top or bottom of its own chart,
 * which reads as a temperature that never happens.
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
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = clamp(p1.y + (p2.y - p0.y) * t);
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = clamp(p2.y - (p3.y - p1.y) * t);
    d += ` C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

/** The same curve, closed along the bottom — the soft wash under the line. */
export function areaPath(points, { height, tension = 1 } = {}) {
  if (points.length < 2) return '';
  const line = smoothPath(points, { tension, height });
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L${round(last.x)} ${round(height)} L${round(first.x)} ${round(height)} Z`;
}

/**
 * The whole chart, as one <svg>. Two curves on a shared scale, so the gap
 * between them *is* the humidity: wide means the air is not letting you cool.
 *
 * @param {{actual: number[], feels?: number[], labels?: string[]}} series
 */
export function chart(series, { width = 320, height = 96, tension = 1, padX = 6 } = {}) {
  const actual = series.actual || [];
  const feels = series.feels || [];
  const scale = bounds([...actual, ...feels]);
  if (!scale || actual.length < 2) return '';

  const box = { width, height, padX, min: scale.min, max: scale.max };
  const actualPoints = project(actual, box);
  const feelsPoints = feels.length ? project(feels, box) : [];

  const peak = actualPoints.reduce((hi, p) => (p.value > hi.value ? p : hi), actualPoints[0]);

  return `<svg class="curve" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"
    role="img" aria-label="Temperature over the next 24 hours" focusable="false">
    <path class="curve-area" d="${areaPath(actualPoints, { height, tension })}"/>
    ${feelsPoints.length ? `<path class="curve-feels" d="${smoothPath(feelsPoints, { tension, height })}"/>` : ''}
    <path class="curve-line" d="${smoothPath(actualPoints, { tension, height })}"/>
    <circle class="curve-peak" cx="${round(peak.x)}" cy="${round(peak.y)}" r="3.5"/>
  </svg>`;
}
