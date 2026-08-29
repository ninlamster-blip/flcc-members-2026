// The illustrations.
//
// One drawing style, and it is the whole personality of the app: a flat shape
// in one colour, a thick navy outline, and a face. Nothing is shaded, nothing
// has a gradient, and every character is drawn on the same 100 × 100 grid with
// the same stroke weight, so a row of them reads as one set rather than as
// clip art from four places.
//
// Faces are drawn by `face()` rather than by hand per character. That is what
// keeps twelve mascots looking related: the eyes are the same eyes, the smile
// is the same smile, and a new character gets them for free.
//
// Nothing here touches the DOM — these return markup strings, so the whole set
// can be checked in tests without a browser.

/** Every character in the set. `test/art.test.mjs` draws all of them. */
export const MASCOTS = [
  'blob', 'book', 'heart', 'mug', 'sprout', 'church',
  'sun', 'parcel', 'star', 'cloud', 'flame', 'mountain',
];

const INK = 'var(--ink)';

/**
 * The face. Two dots and an arc, plus cheeks.
 *
 * @param {number} x  centre of the face
 * @param {number} y
 * @param {number} s  scale — 1 is the default size on the 100-grid
 */
function face(x, y, s = 1, { cheeks = true } = {}) {
  const eye = 3.4 * s;
  const gap = 11 * s;
  const smile = `M${x - 7 * s} ${y + 6 * s}q${7 * s} ${8 * s} ${14 * s} 0`;
  return `
    <circle cx="${x - gap / 2}" cy="${y}" r="${eye}" fill="${INK}"/>
    <circle cx="${x + gap / 2}" cy="${y}" r="${eye}" fill="${INK}"/>
    <path d="${smile}" fill="none" stroke="${INK}" stroke-width="${3.4 * s}" stroke-linecap="round"/>
    ${cheeks ? `<circle cx="${x - gap * 1.5}" cy="${y + 5 * s}" r="${3 * s}" fill="${INK}" opacity=".18"/>
    <circle cx="${x + gap * 1.5}" cy="${y + 5 * s}" r="${3 * s}" fill="${INK}" opacity=".18"/>` : ''}`;
}

/** The body of each character: the filled shape, then anything drawn on top. */
const BODIES = {
  blob: (fill) => `
    <path d="M50 12c19 0 31 15 31 33 0 13-4 21-4 29 0 7-11 9-27 9s-27-2-27-9c0-8-4-16-4-29 0-18 12-33 31-33z"
      fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    ${face(50, 46)}`,

  book: (fill) => `
    <path d="M16 20h60a8 8 0 0 1 8 8v50a8 8 0 0 1-8 8H16a6 6 0 0 1-6-6V26a6 6 0 0 1 6-6z"
      fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M23 20v66" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <path d="M56 34v22M45 45h22" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
    ${face(52, 66, .78, { cheeks: false })}`,

  heart: (fill) => `
    <path d="M50 87C25 70 11 57 11 40c0-12 9-21 21-21 8 0 14 4 18 10 4-6 10-10 18-10 12 0 21 9 21 21 0 17-14 30-39 47z"
      fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    ${face(50, 44)}`,

  // A mug, not praying hands.
  //
  // Praying hands were drawn twice and read as a leaf both times: at the size
  // these are used, the silhouette is a pointed oval whichever way the fingers
  // are arranged. Prayer already has the flame and the heart; what the set was
  // actually missing was something for sitting still with, so the slot went to
  // the thing a person is holding while they do it.
  mug: (fill) => `
    <path d="M20 32h46v32a18 18 0 0 1-18 18H38a18 18 0 0 1-18-18z"
      fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M66 42h6a12 12 0 0 1 0 24h-6" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M34 22c0-5 6-5 6-10M50 22c0-5 6-5 6-10" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
    ${face(43, 54, .8)}`,

  sprout: (fill) => `
    <path d="M50 84V46" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M49 52C31 52 21 41 21 27c17-3 28 9 28 25z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M51 58c16 0 25-10 25-22-15-3-25 8-25 22z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M30 78h40l-5 14H35z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    ${face(50, 83, .6, { cheeks: false })}`,

  church: (fill) => `
    <path d="M50 8v14M43 14h14" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M18 88V48l32-24 32 24v40z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M42 88V70a8 8 0 0 1 16 0v18z" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>
    ${face(50, 55, .62, { cheeks: false })}`,

  sun: (fill) => `
    <path d="M50 8v10M50 82v10M8 50h10M82 50h10M20 20l7 7M73 73l7 7M20 80l7-7M73 27l7-7"
      fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="26" fill="${fill}" stroke="${INK}" stroke-width="5"/>
    ${face(50, 48, .9)}`,

  parcel: (fill) => `
    <path d="M20 36h60v48a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M14 22h72v14H14z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M50 36v52" fill="none" stroke="${INK}" stroke-width="4.5"/>
    ${face(35, 60, .62, { cheeks: false })}`,

  star: (fill) => `
    <path d="M50 10l11 24 26 3-19 18 5 26-23-13-23 13 5-26-19-18 26-3z"
      fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    ${face(50, 48, .82, { cheeks: false })}`,

  cloud: (fill) => `
    <path d="M31 80c-12 0-21-8-21-19 0-10 8-18 18-19 3-12 14-21 27-21 15 0 27 11 29 25 9 2 16 9 16 18 0 9-8 16-19 16z"
      fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    ${face(52, 55, .9)}`,

  flame: (fill) => `
    <path d="M50 8c16 16 25 27 25 40a25 25 0 1 1-50 0c0-8 3-14 8-20 2 6 6 9 10 11-2-12 1-22 7-31z"
      fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    ${face(50, 58, .82)}`,

  mountain: (fill) => `
    <path d="M6 86 36 30l15 25 11-18 32 49z" fill="${fill}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M36 30l10 17c-7 4-14 4-20 0z" fill="var(--paper)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    ${face(35, 66, .66, { cheeks: false })}`,
};

/**
 * One character, at whatever size its holder gives it.
 *
 * @param {string} name  one of MASCOTS. An unknown name draws the blob rather
 *                       than nothing, so a typo in the content is a wrong
 *                       picture and never a hole in the layout.
 * @param {string} tone  a palette token — the flat fill colour
 */
export function mascot(name, tone = 'yellow') {
  const body = BODIES[name] || BODIES.blob;
  return `<svg class="mascot" viewBox="0 0 100 100" aria-hidden="true" focusable="false">`
    + body(`var(--${tone})`) + `</svg>`;
}

export const isMascot = (name) => Object.prototype.hasOwnProperty.call(BODIES, name);

/**
 * The row of five stars along the bottom of a card.
 *
 * On the printed cards this asks for a review. Here it is ornament and, on the
 * one screen that counts anything, a way of showing a small number without a
 * progress bar — `lit` of them are filled.
 */
export function stars(lit = 5, total = 5) {
  const filled = Math.max(0, Math.min(total, Math.round(lit)));
  // Which colour a filled star takes is left to the stylesheet, not decided
  // here: star yellow on a yellow band is invisible, so the fill has to know
  // what it is sitting on and only CSS does.
  const one = (on) => `<svg viewBox="0 0 24 24" class="star"${on ? ' data-on' : ''} aria-hidden="true">`
    + `<path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.7 6.1 20.8l1.2-6.6L2.5 9.6l6.6-.9z"`
    + ` stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  return `<span class="stars" role="img" aria-label="${filled} of ${total}">`
    + Array.from({ length: total }, (_, i) => one(i < filled)).join('') + '</span>';
}

/** Three little rays, for the corner of something worth noticing. */
export function sparkle() {
  return `<svg class="sparkle" viewBox="0 0 24 24" aria-hidden="true">`
    + `<path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"`
    + ` fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

/** FNV-1a — used only to give an item without a named character a stable one. */
export function hash(text) {
  let value = 2166136261;
  const source = String(text ?? '');
  for (let i = 0; i < source.length; i++) {
    value ^= source.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value | 0);
}

/** A character for something that did not name one. Stable, never random. */
export function pick(seed) {
  return MASCOTS[hash(seed) % MASCOTS.length];
}
