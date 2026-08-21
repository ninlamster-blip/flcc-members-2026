/** Identifiers. Sortable by creation time, which is the only ordering the
 *  app ever needs from an id, and unique enough for a device-local store. */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function id(prefix = '') {
  const time = Date.now().toString(36).padStart(9, '0');
  let random = '';
  const bytes = randomBytes(8);
  for (const b of bytes) random += ALPHABET[b % ALPHABET.length];
  return `${prefix ? prefix + '_' : ''}${time}${random}`;
}

function randomBytes(n) {
  const out = new Uint8Array(n);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') return c.getRandomValues(out);
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

export function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
