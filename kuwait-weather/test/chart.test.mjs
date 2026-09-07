// The temperature curve is a drawing of real numbers, so the drawing has to
// stay honest: through every point, and inside its own box.

import test from 'node:test';
import assert from 'node:assert/strict';
import { bounds, project, smoothPath, areaPath, chart } from '../js/ui/chart.js';

const coords = (d) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
const ys = (d) => coords(d).filter((_, i) => i % 2 === 1);

test('bounds pad the range so the curve never touches the edge', () => {
  const b = bounds([10, 20]);
  assert.ok(b.min < 10 && b.max > 20);
});

test('a flat day still gets a range to draw in', () => {
  const b = bounds([31, 31, 31]);
  assert.ok(b.max > b.min, 'a zero range would divide by zero or draw nothing');
});

test('nothing measurable means no bounds rather than a fake range', () => {
  assert.equal(bounds([]), null);
  assert.equal(bounds([null, undefined, NaN]), null);
});

test('the first point sits on the left edge and the last on the right', () => {
  const points = project([1, 2, 3, 4], { width: 300, height: 100, min: 0, max: 5 });
  assert.equal(points[0].x, 0);
  assert.equal(points[3].x, 300);
});

test('a higher value is drawn higher up the box', () => {
  const [cold, hot] = project([10, 40], { width: 100, height: 100, min: 0, max: 50 });
  assert.ok(hot.y < cold.y, 'SVG y grows downward, so hotter must be a smaller y');
});

test('gaps in the forecast are skipped, not drawn as zero', () => {
  const points = project([10, null, 30], { width: 100, height: 100, min: 0, max: 50 });
  assert.equal(points.length, 2);
  assert.deepEqual(points.map((p) => p.value), [10, 30]);
});

test('the curve passes through every point it was given', () => {
  const values = [32, 30, 35, 44, 48, 41, 34];
  const points = project(values, { width: 300, height: 100, min: 28, max: 52 });
  const d = smoothPath(points);
  // Each bézier ends on the next data point, so every point must appear as a
  // segment endpoint. A curve that only passes near its data is a picture.
  for (const p of points.slice(1)) {
    assert.ok(d.includes(`${p.x} ${p.y}`), `curve misses (${p.x}, ${p.y})`);
  }
  assert.ok(d.startsWith(`M${points[0].x} ${points[0].y}`));
});

test('a sharp overnight drop does not make the curve leave its own box', () => {
  // Catmull-Rom overshoots on a spike. Unclamped, that draws a temperature
  // that never happens — above the top of the chart or below the bottom.
  const values = [45, 45, 45, 12, 45, 45, 45];
  const scale = bounds(values);
  const points = project(values, { width: 300, height: 100, ...scale });
  const d = smoothPath(points, { height: 100 });
  for (const y of ys(d)) {
    assert.ok(y >= -0.01 && y <= 100.01, `control point at y=${y} escapes the box`);
  }
});

test('one point or none is a path that draws nothing rather than a crash', () => {
  assert.equal(smoothPath([]), '');
  assert.equal(smoothPath([{ x: 5, y: 5 }]), 'M5 5');
  assert.equal(areaPath([{ x: 5, y: 5 }], { height: 10 }), '');
});

test('the area closes along the bottom of the box', () => {
  const points = project([10, 20, 30], { width: 100, height: 50, min: 0, max: 40 });
  const d = areaPath(points, { height: 50 });
  assert.ok(d.endsWith('Z'), 'an unclosed area fills unpredictably');
  assert.ok(d.includes('L100 50'), 'it has to reach the bottom-right corner');
  assert.ok(d.includes('L0 50'), 'and the bottom-left');
});

test('the chart draws both lines and marks the peak', () => {
  const actual = [32, 35, 41, 46, 44, 38];
  const svg = chart({ actual, feels: actual.map((t) => t + 6) });
  assert.match(svg, /class="curve-line"/);
  assert.match(svg, /class="curve-feels"/);
  assert.match(svg, /class="curve-area"/);
  assert.match(svg, /class="curve-peak"/);
  assert.match(svg, /aria-label="Temperature over the next 24 hours"/);
});

test('the peak marker sits on the hottest hour', () => {
  const actual = [20, 20, 40, 20, 20];
  const svg = chart({ actual, feels: [] });
  const peak = svg.match(/curve-peak" cx="([\d.]+)" cy="([\d.]+)"/);
  assert.ok(peak);
  assert.equal(Number(peak[1]), 160, 'the third of five points is the middle of a 320-wide box');
});

test('a chart with nothing to draw returns nothing', () => {
  assert.equal(chart({ actual: [] }), '');
  assert.equal(chart({ actual: [30] }), '', 'one hour is not a curve');
  assert.equal(chart({ actual: [null, null] }), '');
});

test('the feels-like line is optional and its absence is not an error', () => {
  const svg = chart({ actual: [30, 35, 40] });
  assert.ok(svg);
  assert.ok(!svg.includes('curve-feels'));
});

test('both lines share one scale, so the gap between them means something', () => {
  // Drawn on separate scales the two curves would overlap even when the
  // humidity is adding ten degrees, which is the one thing they exist to show.
  const svg = chart({ actual: [30, 30, 30], feels: [45, 45, 45] });
  const line = svg.match(/curve-line" d="M[\d.]+ ([\d.]+)/);
  const feels = svg.match(/curve-feels" d="M[\d.]+ ([\d.]+)/);
  assert.ok(Number(feels[1]) < Number(line[1]), 'feels-like must be drawn above the air line');
});

test('the plot is inset, so the marker on the hottest hour is never sliced', () => {
  // The peak lands on the first hour often enough — a cool evening after a
  // hot afternoon — and a circle at x=0 renders as a half circle.
  const hotFirst = [48, 40, 35, 33];
  const svg = chart({ actual: hotFirst, feels: [] });
  const peak = svg.match(/curve-peak" cx="([\d.]+)"/);
  assert.ok(Number(peak[1]) >= 4, `peak at x=${peak[1]} is against the edge`);

  const points = project([1, 2, 3], { width: 100, height: 50, min: 0, max: 4, padX: 6 });
  assert.equal(points[0].x, 6);
  assert.equal(points[2].x, 94);
});
