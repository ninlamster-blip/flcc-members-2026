// AVATARS — a drawing from the app's own set, on a colour. Never a photo.
//
// Kids and teens see each other's avatars on the leaderboard and in rooms, so
// an avatar is chosen, not uploaded: one of SYMBOLS on one of TONES, written
// as `draw:<symbol>:<tone>`. That string is all that travels, and the server
// (ask-proxy/next-play.js cleanAvatar) refuses anything else for these two age
// groups — a photo of a child is not something this app ever shows another
// child. `test/avatar.test.mjs` holds both halves.

import { h } from './dom.js';
import { symbol, fillFor } from './art.js';

export const SYMBOLS = ['rocket', 'star', 'heart', 'bolt', 'fire', 'plant', 'mountain', 'light', 'shield', 'flag', 'bulb', 'chicken'];
export const TONES = ['sky', 'captain', 'rose', 'poppy', 'sunshine'];

const DRAWN = /^draw:([a-z]{2,16}):([a-z]+)$/;

/** `{ symbol, tone }` for a valid avatar, or null. */
export function parse(spec) {
  const match = DRAWN.exec(String(spec || ''));
  if (!match || !SYMBOLS.includes(match[1]) || !TONES.includes(match[2])) return null;
  return { symbol: match[1], tone: match[2] };
}

export const make = (name, tone) => `draw:${name}:${tone}`;

/** A player with no avatar still gets one, picked steadily from their id so it never flickers. */
export function fallback(seed = '') {
  let n = 0;
  for (const ch of String(seed)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return make(SYMBOLS[n % SYMBOLS.length], TONES[Math.floor(n / SYMBOLS.length) % TONES.length]);
}

/** The avatar, drawn: a circle of colour with the symbol in it. */
export function avatar(spec, { size = 'sm', seed = '', label = '' } = {}) {
  const drawn = parse(spec) || parse(fallback(seed));
  const el = h('span', { class: 'avatar', dataset: { tone: drawn.tone, size }, ...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' }) });
  el.innerHTML = symbol(drawn.symbol, { fill: fillFor(drawn.tone) });
  return el;
}
