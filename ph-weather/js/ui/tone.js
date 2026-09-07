// What colour the day is.
//
// The card takes its colour from the worst thing standing on it, so the screen
// says how the day is before a word of it has been read. In a country where
// the danger is water rather than heat, that mostly means the flood level.

const ORDER = ['calm', 'info', 'watch', 'warning', 'severe'];

export function toneFor(advisories = []) {
  let worst = 'calm';
  for (const a of advisories) {
    if (ORDER.indexOf(a.severity) > ORDER.indexOf(worst)) worst = a.severity;
  }
  return worst;
}

export const TONE_NAMES = ORDER;

export function toneNote(tone) {
  switch (tone) {
    case 'severe':  return 'Serious — act on this one';
    case 'warning': return 'Plan around this today';
    case 'watch':   return 'Worth keeping an eye on';
    case 'info':    return 'Nothing serious';
    default:        return 'A quiet day';
  }
}
