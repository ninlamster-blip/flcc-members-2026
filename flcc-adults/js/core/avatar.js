// AVATARS — a drawing from this app's set, or the member's own photo.
//
// Shown beside a first name on the prayer wall and a nickname in quiz rooms —
// the only two places anyone else sees it. On this phone it lives in the
// profile (`adults/v1/user` → `avatar`) and nowhere else.
//
// A drawing is `draw:<symbol>:<tone>`. A photo is shrunk here, before it is
// ever stored, to a 96×96 JPEG data URL — small enough to travel with a prayer
// request, and small enough that the full-size picture from the camera roll
// never leaves the phone. ask-proxy/next-play.js cleanAvatar holds the same
// limit on the server and refuses anything larger or of any other shape.

import { h } from './dom.js';
import { symbol, fillFor } from './art.js';

export const SYMBOLS = ['heart', 'star', 'sun', 'sprout', 'mountain', 'cloud', 'flame', 'book', 'mug', 'church'];
// Poppy is left out: it is never a whole poster here, and a circle of it is.
export const TONES = ['sky', 'captain', 'rose', 'sunshine', 'ink'];
export const PHOTO_SIZE = 96;
export const PHOTO_MAX = 16000;

const DRAWN = /^draw:([a-z]{2,16}):([a-z]+)$/;
const PHOTO = /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/]+=*$/;

export const make = (name, tone) => `draw:${name}:${tone}`;
export const isPhoto = (spec) => typeof spec === 'string' && spec.length <= PHOTO_MAX && PHOTO.test(spec);

/** `{ symbol, tone }` for a valid drawing, or null. */
export function parse(spec) {
  const match = DRAWN.exec(String(spec || ''));
  if (!match || !SYMBOLS.includes(match[1]) || !TONES.includes(match[2])) return null;
  return { symbol: match[1], tone: match[2] };
}

/** A valid avatar to send or show, or null. */
export const valid = (spec) => (parse(spec) || isPhoto(spec) ? spec : null);

/** Somebody with no avatar still gets one, picked steadily from a seed so it never flickers. */
export function fallback(seed = '') {
  let n = 0;
  for (const ch of String(seed)) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return make(SYMBOLS[n % SYMBOLS.length], TONES[Math.floor(n / SYMBOLS.length) % TONES.length]);
}

/** The avatar: a photo in a circle, or a drawing on a circle of colour. */
export function avatar(spec, { size = 'sm', seed = '', label = '' } = {}) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' };
  if (isPhoto(spec)) {
    return h('span', { class: 'avatar', dataset: { size, photo: '' }, ...a11y },
      h('img', { src: spec, alt: '', width: String(PHOTO_SIZE), height: String(PHOTO_SIZE), decoding: 'async' }));
  }
  const drawn = parse(spec) || parse(fallback(seed));
  const el = h('span', { class: 'avatar', dataset: { tone: drawn.tone, size }, ...a11y });
  el.innerHTML = symbol(drawn.symbol, { fill: fillFor(drawn.tone) });
  return el;
}

/**
 * A picked photo, cropped square from its centre and shrunk to PHOTO_SIZE, as
 * a JPEG data URL. Quality steps down until it fits PHOTO_MAX; null if the
 * file is not a picture the browser can read.
 */
export async function photoFromFile(file) {
  if (!file || !/^image\//.test(file.type || '')) return null;
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { return null; }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  canvas.getContext('2d').drawImage(bitmap,
    (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  if (bitmap.close) bitmap.close();
  for (const quality of [0.8, 0.65, 0.5, 0.35]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (isPhoto(url)) return url;
  }
  return null;
}
