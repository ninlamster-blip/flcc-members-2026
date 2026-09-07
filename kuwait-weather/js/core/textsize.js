// How big the text is.
//
// Two separate things had to be fixed for this to work, and the second one
// matters more than the setting does:
//
//   The stylesheet used to open with `font: 400 16px`, which *overrides* the
//   text size the person already chose in their phone or browser. Somebody who
//   had turned everything up system-wide got none of it here. The base is a
//   percentage now, so their preference is the starting point and this setting
//   multiplies it rather than replacing it.
//
//   Everything else is in rem, so one number at the root moves the whole page
//   — type, spacing that is set in em, and the gaps between cards. What does
//   not move is the radius, the illustration grid and the touch targets: those
//   are the drawing and the thumb, not the type.

export const SIZES = [
  { id: 'normal',  label: 'Normal',  scale: 100 },
  { id: 'large',   label: 'Large',   scale: 115 },
  { id: 'larger',  label: 'Larger',  scale: 130 },
  { id: 'largest', label: 'Largest', scale: 150 },
];

export const DEFAULT_SIZE = 'normal';

export function size(id) {
  return SIZES.find((s) => s.id === id) || SIZES[0];
}

/** Tapping the button steps through and wraps back round to Normal. */
export function nextSize(id) {
  const at = SIZES.findIndex((s) => s.id === id);
  return SIZES[(at + 1) % SIZES.length].id;
}

/** The CSS value for the root: a percentage of whatever the browser is set to. */
export function rootScale(id) {
  return `${size(id).scale}%`;
}

/** What the button should tell a screen reader it will do. */
export function announce(id) {
  const now = size(id);
  const then = size(nextSize(id));
  return `Text size: ${now.label}. Tap for ${then.label.toLowerCase()}.`;
}
