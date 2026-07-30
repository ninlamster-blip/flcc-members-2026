/** Identifiers, slugs and small deterministic hashes. */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Cross-environment crypto (browser `window.crypto`, Node `globalThis.crypto`). */
export const webcrypto = /** @type {Crypto} */ (globalThis.crypto);

/**
 * A short, sortable, collision-resistant id: `<base36 time>-<random>`.
 * Sortable by creation time, which keeps list ordering stable without an
 * extra index, and readable enough to quote in a support conversation.
 *
 * @param {string} [prefix]
 */
export function uid(prefix = '') {
  const time = Date.now().toString(36);
  const bytes = webcrypto.getRandomValues(new Uint8Array(8));
  let random = '';
  for (const b of bytes) random += ALPHABET[b % ALPHABET.length];
  return `${prefix ? `${prefix}_` : ''}${time}${random}`;
}

/** URL/DOM-safe slug. Non-Latin scripts fall back to a hash so ids stay stable. */
export function slugify(input) {
  const slug = String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || `x${hash32(String(input)).toString(36)}`;
}

/** FNV-1a. Not a security primitive — used for cache keys and avatar colours. */
export function hash32(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Deterministic initials for an avatar: "Maria Dela Cruz" → "MD". */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
