// The organic shapes — this app's visual signature.
//
// One rule governs them, and it is the rule that keeps them from looking like
// decoration sprayed at a wall: a shape is a *pure function of a name*. The
// Scripture moment on a Tuesday draws the same curve every time it is opened,
// on every phone in the church. Nothing here calls Math.random(), so nothing
// here can shimmer between reloads or make a screenshot un-reproducible.
//
// A shape is a closed loop of points around an ellipse, each pushed in or out
// by a seeded amount, then smoothed with Catmull-Rom curves. That is the whole
// of it. Five to seven points is the useful range: fewer reads as a squashed
// circle, more reads as a puddle.
//
// Where they are allowed to appear is a design decision, not a technical one,
// and it is enforced by taste rather than by code: the Scripture moment, a
// section opening, an empty state, a path cover, a prayer moment. Never behind
// body copy, never more than one field per screenful, never as a border.

/** FNV-1a. Small, stable, and the same number in every browser. */
export function hash(text) {
  let value = 2166136261;
  const source = String(text ?? '');
  for (let i = 0; i < source.length; i++) {
    value ^= source.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value | 0);
}

/** A Lehmer generator, scattered first so neighbouring seeds are unrelated. */
function stream(seed) {
  let value = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  value ^= value << 13; value >>>= 0;
  value ^= value >>> 17;
  value ^= value << 5;  value >>>= 0;
  value = (value % 2147483646) + 1;
  return () => (value = (value * 48271) % 2147483647) / 2147483647;
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * A closed organic path, in a 0–100 box.
 *
 * @param {string|number} seed    anything stable — a verse reference, a path id
 * @param {object} options
 * @param {number} options.points how many control points (5–7 reads best)
 * @param {number} options.wobble 0 is an ellipse, .5 is a puddle; .22 is the
 *                                house default and looks hand-cut
 * @returns {string} an SVG path `d`
 */
export function blob(seed, { points = 6, wobble = 0.22 } = {}) {
  const count = Math.max(3, Math.min(12, Math.trunc(points)));
  const next = stream(hash(seed));
  const spread = Math.max(0, Math.min(0.6, wobble));

  const ring = [];
  for (let i = 0; i < count; i++) {
    // The angle jitters too. Radius alone gives a flower; both gives a stone.
    const angle = (i / count) * Math.PI * 2 + (next() - 0.5) * (Math.PI / count) * 0.7;
    const radius = 50 * (1 - spread / 2 + next() * spread);
    ring.push([50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius * 0.92]);
  }
  return closedCurve(ring);
}

/** Catmull-Rom through every point, emitted as cubic beziers, closed. */
export function closedCurve(ring, tension = 1) {
  const n = ring.length;
  if (n < 3) return '';
  const at = (i) => ring[((i % n) + n) % n];
  let d = `M${round(ring[0][0])} ${round(ring[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = at(i - 1);
    const [x1, y1] = at(i);
    const [x2, y2] = at(i + 1);
    const [x3, y3] = at(i + 2);
    const c1 = [x1 + ((x2 - x0) / 6) * tension, y1 + ((y2 - y0) / 6) * tension];
    const c2 = [x2 - ((x3 - x1) / 6) * tension, y2 - ((y3 - y1) / 6) * tension];
    d += `C${round(c1[0])} ${round(c1[1])},${round(c2[0])} ${round(c2[1])},${round(x2)} ${round(y2)}`;
  }
  return `${d}Z`;
}

/**
 * How dark each colour in the palette is.
 *
 * The field below needs to know, because the rule that makes these shapes read
 * as design rather than as a smudge is: **the lighter colour is the large
 * wash, the darker colour is the small accent.** Two dark forms overlapping at
 * half opacity is a bruise. A pale wash with one saturated stone on it is a
 * composition.
 */
const WEIGHT = { paper: 0, gold: .35, peach: .38, mist: .45, olive: .45, sage: .72, coral: .78, forest: 1 };

/**
 * A field of shapes for the back of a hero.
 *
 * Up to three overlapping forms, sorted light to dark: the first is large,
 * pale and mostly bleeding off the corner; the last is small and saturated.
 * They are drawn with `preserveAspectRatio="none"` so a field stretches with
 * its block instead of leaving a gap — these are washes of colour, not
 * diagrams, and nothing in them has to stay circular.
 *
 * Returns markup rather than nodes so it can be tested without a DOM and
 * dropped in with innerHTML on a decorative element that is aria-hidden.
 */
export function field(seed, tones = ['forest', 'gold'], { corner = 'br' } = {}) {
  const list = (Array.isArray(tones) ? tones : [tones]).slice(0, 3)
    .slice()
    .sort((a, b) => (WEIGHT[a] ?? .5) - (WEIGHT[b] ?? .5));
  const next = stream(hash(`${seed}|field`));

  // x, y, size, as percentages of the block.
  //
  // Every form stays in the named corner. That is the constraint that keeps
  // these fields usable behind real text: the large wash may run under a
  // paragraph because it is the lighter colour, but the saturated accent is
  // pinned to the outside of the corner and mostly bleeds off the block, so
  // only a sliver of it lands inside — never enough to sit behind a heading
  // or the second word of an action.
  const spots = {
    br: [[38, 32, 98], [54, 52, 44], [84, 72, 28]],
    bl: [[-36, 32, 98], [2, 52, 44], [-12, 72, 28]],
    tr: [[38, -32, 98], [54, 4, 44], [84, -4, 28]],
    tl: [[-36, -32, 98], [2, 4, 44], [-12, -4, 28]],
  }[corner] || [[38, 32, 98], [54, 52, 44], [84, 72, 28]];

  // Large and light, then smaller and stronger.
  //
  // The large wash is allowed to be genuinely visible — a colour moment that
  // has to be hunted for is not a colour moment. What keeps type legible on
  // top of it is the sort above: the large form is the lighter of the two
  // colours, and a dark colour is held right back if it ever lands there
  // (which only happens when a block asks for two dark tones).
  const alphaFor = (i, tone) => {
    const held = (WEIGHT[tone] ?? .5) > .6;
    if (i === 0) return held ? 0.14 : 0.62;   // the wash, under type
    return held ? 0.92 : 1;                   // the accent, in the corner
  };

  // With two colours — which is what every block in this app asks for — the
  // second one takes the SMALL spot rather than the middle one. A wash and a
  // stone is a composition; two forms of similar size is a stain.
  const places = list.length === 2 ? [spots[0], spots[2]] : spots;

  return list.map((tone, i) => {
    const [x, y, size] = places[Math.min(i, places.length - 1)];
    const drift = (next() - 0.5) * 10;
    const d = blob(`${seed}|${tone}|${i}`, { points: 5 + Math.round(next() * 2), wobble: 0.18 + next() * 0.12 });
    // Only the wash is blurred (see organic.css). A blurred saturated accent
    // reads as a smudge; a crisp one reads as a cut shape, which is the whole
    // look this palette came from.
    return `<svg class="shape${i === 0 ? ' shape--wash' : ''}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"`
      + ` style="left:${round(x + drift)}%;top:${round(y)}%;width:${size}%;height:${size}%;`
      + `opacity:${round(alphaFor(i, tone))}">`
      + `<path d="${d}" fill="var(--${tone})"/></svg>`;
  }).join('');
}

/**
 * One shape on its own, at a stated size — a path cover, an empty state, the
 * mark beside a section opening.
 */
export function mark(seed, tone = 'sage', { points = 6, wobble = 0.24 } = {}) {
  return `<svg class="mark" viewBox="0 0 100 100" aria-hidden="true">`
    + `<path d="${blob(seed, { points, wobble })}" fill="var(--${tone})"/></svg>`;
}
