// What colour the day is.
//
// The reference this design borrows from tints its whole card by the weather —
// a cold city drawn in blue, a warm one in coral. That idea is worth taking,
// but tinting by temperature would be close to useless here, where every day
// from May to September is the same shade of hot.
//
// So the card takes its colour from the worst thing standing on it instead.
// A calm January morning is cool blue; dust and dangerous heat pull the whole
// screen towards rust. The number, the curve, the day row and the disc behind
// the hero all move together, which means the app has a colour before it has
// a word — you know how the day is before you have read anything.

const ORDER = ['calm', 'info', 'watch', 'warning', 'severe'];

/** The card tone for a list of advisories: the worst one present. */
export function toneFor(advisories = []) {
  let worst = 'calm';
  for (const a of advisories) {
    if (ORDER.indexOf(a.severity) > ORDER.indexOf(worst)) worst = a.severity;
  }
  return worst;
}

export const TONE_NAMES = ORDER;

/** A plain-language line under the city name, saying what the tone means. */
export function toneNote(tone) {
  switch (tone) {
    case 'severe':  return 'Stay inside if you can';
    case 'warning': return 'Plan around this one';
    case 'watch':   return 'Worth keeping an eye on';
    case 'info':    return 'Nothing serious';
    default:        return 'An ordinary day';
  }
}
