// The illustration system.
//
// One language, and it is strict: flat shapes, one navy outline weight, no
// gradient, no shadow, no detail that does not carry meaning. Every symbol is
// drawn on the same 100×100 grid with the same stroke, so a book and a church
// and an open hand look like they were drawn by the same person on the same
// afternoon.
//
// It is the SAME language as the kids and teens edition at `flcc-next/`: the
// same grid, the same 5.5 stroke in the same navy, the same helpers, and where
// a symbol exists in both apps it is the same path data. The two apps share no
// code by design, so this is a deliberate duplicate rather than an import —
// the drawings have to match by hand, and `test/art.test.mjs` pins the pieces
// that must not drift.
//
// Fills use the palette. A symbol takes one fill colour and no more.

const W = 100;

const S = {
  // The outline is navy, not black — the same #2B4C6D every letter in the app
  // is set in. It is written out rather than read from TONE_HEX because this
  // string is assembled once, at module load, before any tone is known.
  stroke: 'stroke="#2B4C6D" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"',
};

const shape = (d, fill = 'none') => `<path d="${d}" fill="${fill}" ${S.stroke}/>`;
const circle = (cx, cy, r, fill = 'none') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${S.stroke}/>`;
const line = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" ${S.stroke}/>`;
const box = (x, y, w, h, fill = 'none', r = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${S.stroke}/>`;

// Every symbol takes the poster's chosen fill so the drawing belongs to the
// block it sits on rather than fighting it.
const SYMBOLS = {
  // The Bible, open. Identical to the kids edition's `book`.
  book: (f) => [
    shape('M50 26c-9-8-20-11-34-11v56c14 0 25 3 34 11 9-8 20-11 34-11V15c-14 0-25 3-34 11Z', f),
    line(50, 26, 50, 82),
  ],

  // Identical to the kids edition's `heart`.
  heart: (f) => [
    shape('M50 84C26 68 14 56 14 42a18 18 0 0 1 36-6 18 18 0 0 1 36 6c0 14-12 26-36 42Z', f),
  ],

  // Identical to the kids edition's `mountain`.
  mountain: (f) => [
    shape('M12 80 40 32l16 26 8-12 24 34Z', f),
    line(33, 45, 47, 45),
  ],

  // Identical to the kids edition's `star`.
  star: (f) => [
    shape('M50 14 61 40l28 2-21 18 7 27-25-15-25 15 7-27-21-18 28-2Z', f),
  ],

  // Growth. The kids edition calls this `plant`; the adult content files were
  // written against the name `sprout`, so it keeps that name and the drawing.
  sprout: (f) => [
    line(50, 88, 50, 46),
    shape('M50 58C36 58 28 50 28 36c14 0 22 8 22 22Z', f),
    shape('M50 50c14 0 22-8 22-22-14 0-22 8-22 22Z', f),
    line(34, 88, 66, 88),
  ],

  // The kids edition's `sunrise`, under the name the adult content uses.
  sun: (f) => [
    circle(50, 56, 18, f),
    line(14, 80, 86, 80),
    line(50, 20, 50, 30), line(22, 32, 29, 39), line(78, 32, 71, 39),
  ],

  // ── Drawn for this edition, in the same language ─────────────────────────

  // The church: a gable, a door, a cross above the ridge.
  church: (f) => [
    shape('M18 86V44l32-22 32 22v42Z', f),
    shape('M42 86V66a8 8 0 0 1 16 0v20', 'none'),
    line(50, 6, 50, 22), line(42, 13, 58, 13),
  ],

  // A season that is not your fault.
  cloud: (f) => [
    shape('M32 72a18 18 0 0 1 1-36 24 24 0 0 1 45 6 15 15 0 0 1-3 30Z', f),
    line(36, 84, 33, 92), line(52, 84, 49, 92), line(68, 84, 65, 92),
  ],

  // Prayer as a lamp rather than as folded hands — the kids edition's `light`,
  // which the adult writing calls a flame.
  flame: (f) => [
    shape('M50 18c9 11 14 19 14 27a14 14 0 0 1-28 0c0-8 5-16 14-27Z', f),
    line(50, 60, 50, 74), line(34, 74, 66, 74), line(40, 86, 60, 86),
  ],

  // The cup on the table on a Tuesday night.
  mug: (f) => [
    shape('M22 34h48v30a24 24 0 0 1-48 0Z', f),
    shape('M70 42h8a11 11 0 0 1 0 22h-8', 'none'),
    line(36, 14, 36, 24), line(50, 12, 50, 24), line(64, 14, 64, 24),
  ],

  // What is sent home.
  parcel: (f) => [
    box(16, 34, 68, 52, f, 3),
    line(16, 52, 84, 52), line(50, 34, 50, 86),
    shape('M50 34c-6-12-14-18-20-14s-2 12 20 14Z', f),
    shape('M50 34c6-12 14-18 20-14s2 12-20 14Z', f),
  ],

  // The question a member is asked to sit with. The kids edition's `words`,
  // opened out into a speech bubble.
  blob: (f) => [
    shape('M14 26a6 6 0 0 1 6-6h60a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H40L22 84V66h-2a6 6 0 0 1-6-6Z', f),
    line(30, 36, 70, 36), line(30, 50, 58, 50),
  ],
};

/** Every symbol in the set. `test/art.test.mjs` draws all of them. */
export const ICONS = Object.keys(SYMBOLS);

export const isIcon = (name) => Object.prototype.hasOwnProperty.call(SYMBOLS, name);

/**
 * One symbol as an SVG string. `fill` is a palette colour; the outline is
 * always the same navy.
 *
 * An unknown name draws the speech bubble rather than nothing, so a typo in a
 * content file is a wrong picture and never a hole in a poster.
 */
export function symbol(name, { fill = 'none', title = '' } = {}) {
  const draw = SYMBOLS[name] || SYMBOLS.blob;
  const label = title
    ? ` role="img" aria-label="${String(title).replace(/"/g, '&quot;')}"`
    : ' aria-hidden="true"';
  return `<svg viewBox="0 0 ${W} ${W}"${label}>${draw(fill).join('')}</svg>`;
}

/** Kept under its old name so the screens did not all need editing. */
export const icon = (name) => symbol(name);

/** The palette, so screens choose tones by name rather than by hex.
 *
 *  The same six colours the kids and teens edition uses, so the two apps read
 *  as one family. `captain` is the dark one of the four poster tones — with
 *  only three light colours in the palette, one poster tone has to carry paper
 *  type, and the stylesheet inverts it the way it already inverts `ink`.
 *  `poppy` is not a poster tone: navy on poppy is about 3.5:1, which is fine
 *  behind a headline and not fine behind a paragraph. */
export const TONES = ['sunshine', 'rose', 'sky', 'captain'];
export const TONE_HEX = {
  sunshine: '#EDCE7A', rose: '#EABCB5', sky: '#C3D7EA', captain: '#4173B0',
  poppy: '#EB8861', paper: '#FBF8F0', ink: '#2B4C6D',
};

/**
 * A poster's fill is the paper colour, so the drawing reads as an object
 * sitting ON the block rather than a hole cut through it.
 */
export function fillFor(tone) {
  // On a dark poster the stylesheet flips the outline to paper, so the fill
  // stays dark and the drawing reads as a white line drawing.
  return (tone === 'ink' || tone === 'captain') ? TONE_HEX.ink : TONE_HEX.paper;
}

/** Rotate tones deterministically, so a list looks composed rather than random. */
export function toneFor(index, offset = 0) {
  return TONES[(Math.abs(index) + offset) % TONES.length];
}

/** FNV-1a — used only to give an item without a named symbol a stable one. */
export function hash(text) {
  let value = 2166136261;
  const source = String(text ?? '');
  for (let i = 0; i < source.length; i++) {
    value ^= source.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value | 0);
}

/** A symbol for something that did not name one. Stable, never random. */
export function pick(seed) {
  return ICONS[hash(seed) % ICONS.length];
}
