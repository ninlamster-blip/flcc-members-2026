// How big the text is.
//
// The root takes a percentage of whatever the browser is already set to, so
// somebody who has turned text up on their phone keeps that and this setting
// multiplies it rather than replacing it. Everything else is in rem, so one
// number moves the whole page. What does not move is the corner radius, the
// illustration grid and the touch targets: those are the drawing and the
// thumb, not the type.

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

export function nextSize(id) {
  const at = SIZES.findIndex((s) => s.id === id);
  return SIZES[(at + 1) % SIZES.length].id;
}

export function rootScale(id) {
  return `${size(id).scale}%`;
}

export function announce(id) {
  const now = size(id);
  const then = size(nextSize(id));
  return `Text size: ${now.label}. Tap for ${then.label.toLowerCase()}.`;
}
