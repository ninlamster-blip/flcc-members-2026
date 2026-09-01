// The icons.
//
// Monoline drawings: one weight, no fill, no outline around a fill, and — the
// point of this file — no faces.
//
// In the NEXT system an icon labels a thing; it is never the thing. They are
// drawn small, they take the colour of the text beside them, and no screen is
// built out of them — the four-tile icon grid this app used to open on is
// exactly what `.eblock` in the stylesheet replaced. An earlier version of this app gave every
// picture two eyes and a smile, which is charming at eight years old and
// patronising at forty. What an adult needs from a picture beside a heading is
// that it be quiet and legible, so these are drawn the way the signage in a
// good hospital is drawn: thin, even, and out of the way.
//
// Everything is stroked in `currentColor`, so an icon takes the colour of the
// text it sits with rather than carrying a colour of its own. Nothing here
// touches the DOM — these return markup strings, so the whole set can be
// checked in tests without a browser.

/** Every icon in the set. `test/art.test.mjs` draws all of them. */
export const ICONS = [
  'blob', 'book', 'heart', 'mug', 'sprout', 'church',
  'sun', 'parcel', 'star', 'cloud', 'flame', 'mountain',
];

/**
 * The drawings, on a 48-grid.
 *
 * One stroke weight throughout. Where a shape needs an interior detail it is
 * drawn with the same stroke rather than a fill, so nothing in the set reads
 * heavier than anything else in it.
 */
const PATHS = {
  // "blob" keeps its name from an earlier draw of this set so the content
  // files did not all have to change. It is a speech bubble now: it sits
  // beside the question a reader is asked to sit with, and beside the guide
  // written for the days when there is nothing to say.
  blob:     'M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H20l-9 8v-8a4 4 0 0 1-3-4z',
  book:     'M6 10h12a6 6 0 0 1 6 6 6 6 0 0 1 6-6h12v28H30a6 6 0 0 0-6 6 6 6 0 0 0-6-6H6zM24 16v28',
  heart:    'M24 40C13 32 7 26 7 19.5A8.5 8.5 0 0 1 15.5 11c3.6 0 6.6 1.9 8.5 4.8 1.9-2.9 4.9-4.8 8.5-4.8A8.5 8.5 0 0 1 41 19.5C41 26 35 32 24 40z',
  mug:      'M9 14h22v16a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10zM31 19h4a6 6 0 0 1 0 12h-4M16 8c0-2 3-2 3-4M25 8c0-2 3-2 3-4',
  sprout:   'M24 40V22M23 22c-8 0-13-5-13-12 8-1 13 4 13 12zM25 26c7 0 12-5 12-11-7-1-12 4-12 11z',
  church:   'M24 4v8M20 8h8M10 42V22l14-10 14 10v20zM20 42V32a4 4 0 0 1 8 0v10',
  sun:      'M24 12a12 12 0 1 0 0 24 12 12 0 0 0 0-24zM24 3v4M24 41v4M45 24h-4M7 24H3M38.8 9.2l-2.8 2.8M12 36l-2.8 2.8M38.8 38.8 36 36M12 12 9.2 9.2',
  parcel:   'M7 16h34v24a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zM5 8h38v8H5zM24 8v34',
  star:     'M24 5l5.8 12.2L43 19l-9.5 9.2L36 42l-12-6.5L12 42l2.5-13.8L5 19l13.2-1.8z',
  cloud:    'M15 38c-5.5 0-10-4.2-10-9.4S9.5 19.2 15 19.2h.6C17 13.3 22.4 9 28.8 9 36.1 9 42 14.6 42 21.5c0 .6 0 1.2-.1 1.8 2.4 1.2 4.1 3.6 4.1 6.4 0 4.6-3.9 8.3-8.7 8.3z',
  flame:    'M24 5c8 8 12 13.5 12 20a12 12 0 0 1-24 0c0-3.8 1.4-6.8 3.8-9.6 1 2.9 2.9 4.4 4.8 5.3C19.6 14.2 21 9.5 24 5z',
  mountain: 'M3 41 17 15l7.5 12.5L30 19l15 22zM17 15l4.8 8.5c-3.2 1.9-6.6 1.9-9.6 0z',
};

/**
 * One icon, at whatever size its holder gives it.
 *
 * @param {string} name  one of ICONS. An unknown name draws the blob rather
 *                       than nothing, so a typo in the content is a wrong
 *                       picture and never a hole in the layout.
 */
export function icon(name) {
  const d = PATHS[name] || PATHS.blob;
  return '<svg class="icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6"'
    + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
    + `<path d="${d}"/></svg>`;
}

export const isIcon = (name) => Object.prototype.hasOwnProperty.call(PATHS, name);

/** FNV-1a — used only to give an item without a named icon a stable one. */
export function hash(text) {
  let value = 2166136261;
  const source = String(text ?? '');
  for (let i = 0; i < source.length; i++) {
    value ^= source.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value | 0);
}

/** An icon for something that did not name one. Stable, never random. */
export function pick(seed) {
  return ICONS[hash(seed) % ICONS.length];
}
