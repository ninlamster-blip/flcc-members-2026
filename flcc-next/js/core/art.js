// The illustration system.
//
// One language, and it is strict: flat shapes, one black outline weight, no
// gradient, no shadow, no detail that does not carry meaning. Every symbol is
// drawn on the same 100×100 grid with the same stroke, so a book and a rocket
// and a pair of hands look like they were drawn by the same person on the same
// afternoon.
//
// Fills use the palette. A symbol takes one fill colour and no more.

const W = 100;

const S = {
  stroke: 'stroke="#161616" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"',
};

const shape = (d, fill = 'none') => `<path d="${d}" fill="${fill}" ${S.stroke}/>`;
const circle = (cx, cy, r, fill = 'none') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${S.stroke}/>`;
const line = (x1, y1, x2, y2) => `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" ${S.stroke}/>`;
const box = (x, y, w, h, fill = 'none', r = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${S.stroke}/>`;

// Every symbol takes the poster's chosen fill so the drawing belongs to the
// block it sits on rather than fighting it.
const SYMBOLS = {
  // The Bible, open
  book: (f) => [
    shape('M50 26c-9-8-20-11-34-11v56c14 0 25 3 34 11 9-8 20-11 34-11V15c-14 0-25 3-34 11Z', f),
    line(50, 26, 50, 82),
  ],

  // Prayer — two hands palm to palm, thumbs crossed in front, cuffs at the wrist
  hands: (f) => [
    shape('M47 79V21c0-4-3-7-7-6-3 1-5 3-6 7l-9 31c-2 8 2 16 9 21Z', f),
    shape('M53 79V21c0-4 3-7 7-6 3 1 5 3 6 7l9 31c2 8-2 16-9 21Z', f),
    shape('M25 60c5 6 12 9 20 10', 'none'),
    shape('M75 60c-5 6-12 9-20 10', 'none'),
    box(30, 79, 40, 11, f, 4),
  ],

  // Light — the lamp of Psalm 119
  light: (f) => [
    shape('M50 18c9 11 14 19 14 27a14 14 0 0 1-28 0c0-8 5-16 14-27Z', f),
    line(50, 60, 50, 74), line(34, 74, 66, 74), line(40, 86, 60, 86),
  ],

  // Growth
  plant: (f) => [
    line(50, 88, 50, 46),
    shape('M50 58C36 58 28 50 28 36c14 0 22 8 22 22Z', f),
    shape('M50 50c14 0 22-8 22-22-14 0-22 8-22 22Z', f),
    line(34, 88, 66, 88),
  ],

  // The journey
  rocket: (f) => [
    shape('M50 14c12 10 18 24 18 40l-8 14H40l-8-14c0-16 6-30 18-40Z', f),
    circle(50, 42, 8),
    shape('M40 60 26 74l14-2Z', f),
    shape('M60 60l14 14-14-2Z', f),
    line(46, 78, 44, 88), line(54, 78, 56, 88),
  ],

  // Wisdom
  bulb: (f) => [
    shape('M50 16a22 22 0 0 1 13 40l-2 10H39l-2-10a22 22 0 0 1 13-40Z', f),
    line(40, 76, 60, 76), line(43, 86, 57, 86),
  ],

  // The challenge
  flag: (f) => [
    line(30, 88, 30, 14),
    shape('M30 18h40l-9 14 9 14H30Z', f),
  ],

  // Community
  people: (f) => [
    circle(34, 34, 12, f), circle(66, 34, 12, f),
    shape('M14 84c0-13 9-22 20-22s20 9 20 22Z', f),
    shape('M46 84c0-13 9-22 20-22s20 9 20 22Z', f),
  ],

  // Courage
  mountain: (f) => [
    shape('M12 80 40 32l16 26 8-12 24 34Z', f),
    line(33, 45, 47, 45),
  ],

  shield: (f) => [
    shape('M50 14 82 24v26c0 20-14 32-32 38-18-6-32-18-32-38V24Z', f),
    line(50, 34, 50, 62), line(38, 46, 62, 46),
  ],

  cross: (f) => [
    shape('M42 14h16v22h22v16H58v34H42V52H20V36h22Z', f),
  ],

  sunrise: (f) => [
    circle(50, 56, 18, f),
    line(14, 80, 86, 80),
    line(50, 20, 50, 30), line(22, 32, 29, 39), line(78, 32, 71, 39),
  ],

  // Games
  grid: (f) => [
    box(18, 18, 64, 64, f, 3),
    line(40, 18, 40, 82), line(62, 18, 62, 82),
    line(18, 40, 82, 40), line(18, 62, 82, 62),
  ],

  question: (f) => [
    circle(50, 50, 34, f),
    shape('M40 40a10 10 0 1 1 13 10c-2 1-3 3-3 5v3'),
    line(50, 68, 50, 69),
  ],

  mask: (f) => [
    shape('M50 18c14 0 22 10 22 24s-8 24-22 24-22-10-22-24 8-24 22-24Z', f),
    shape('M20 88c0-12 13-20 30-20s30 8 30 20Z', f),
  ],

  words: (f) => [
    box(14, 30, 32, 18, f, 3), box(54, 30, 32, 18, f, 3),
    box(14, 56, 32, 18, f, 3), box(54, 56, 32, 18, f, 3),
  ],

  bolt: (f) => [
    shape('M56 12 26 56h18l-6 34 32-46H52Z', f),
  ],

  // Connect
  calendar: (f) => [
    box(16, 24, 68, 62, f, 4),
    line(16, 44, 84, 44), line(34, 14, 34, 30), line(66, 14, 66, 30),
    line(34, 60, 42, 60), line(58, 60, 66, 60), line(34, 72, 42, 72), line(58, 72, 66, 72),
  ],

  camera: (f) => [
    box(12, 30, 76, 52, f, 6),
    circle(50, 56, 16),
    shape('M36 30l6-10h16l6 10'),
  ],

  star: (f) => [
    shape('M50 14 61 40l28 2-21 18 7 27-25-15-25 15 7-27-21-18 28-2Z', f),
  ],

  heart: (f) => [
    shape('M50 84C26 68 14 56 14 42a18 18 0 0 1 36-6 18 18 0 0 1 36 6c0 14-12 26-36 42Z', f),
  ],
};

export const SYMBOL_NAMES = Object.keys(SYMBOLS);

export function hasSymbol(name) {
  return Object.prototype.hasOwnProperty.call(SYMBOLS, name);
}

/**
 * One symbol as an SVG string. `fill` is a palette colour; the outline is
 * always the same black.
 */
export function symbol(name, { fill = 'none', title = '' } = {}) {
  const draw = SYMBOLS[name];
  if (!draw) return '';
  const label = title
    ? ` role="img" aria-label="${String(title).replace(/"/g, '&quot;')}"`
    : ' aria-hidden="true"';
  return `<svg viewBox="0 0 ${W} ${W}"${label}>${draw(fill).join('')}</svg>`;
}

/** The palette, so screens choose tones by name rather than by hex. */
export const TONES = ['cream', 'pink', 'blue', 'sage'];
export const TONE_HEX = { cream: '#F4D89A', pink: '#E9A6A3', blue: '#8FC3CF', sage: '#A9C5A2', paper: '#F7F5F0', ink: '#161616' };

/**
 * A poster's fill is the paper colour, so the drawing reads as an object
 * sitting ON the block rather than a hole cut through it.
 */
export function fillFor(tone) {
  return tone === 'ink' ? TONE_HEX.ink : TONE_HEX.paper;
}

/** Rotate tones deterministically, so a list looks composed rather than random. */
export function toneFor(index, offset = 0) {
  return TONES[(Math.abs(index) + offset) % TONES.length];
}
