/**
 * Cryptography — passphrase hashing, at-rest encryption, and TOTP.
 *
 * WHAT THIS PROTECTS, AND WHAT IT DOES NOT
 * ----------------------------------------
 * Shepherd stores a church's data on the device that runs it. Counselling
 * notes, pastoral visits, member records, finance and the document vault are
 * encrypted before they are written, so a copied profile directory or a
 * shared browser does not hand over the contents of a pastor's counselling
 * file in plain text.
 *
 * The scheme:
 *   • Each tenant gets a random 256-bit **vault key** at creation.
 *   • For each user, the vault key is wrapped (AES-GCM) with a key derived
 *     from their passphrase (PBKDF2-SHA-256, 310 000 iterations, per-user
 *     salt — the OWASP 2023 figure for PBKDF2-HMAC-SHA256).
 *   • Signing in unwraps the vault key into memory for that session only. It
 *     is never persisted in the clear.
 *   • Removing a user removes their wrapped copy; they can no longer decrypt
 *     anything, without re-keying every record.
 *
 * It does NOT defend against malicious code running in the same page, and a
 * device with no passphrase set has nothing to derive from. Those are
 * deliberate, documented limits (see ARCHITECTURE.md, "Security model").
 */

import { webcrypto } from './id.js';

const subtle = webcrypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const PBKDF2_ITERATIONS = 310000;

/* ── base64 ─────────────────────────────────────────────────────────────── */

/** @param {ArrayBuffer|Uint8Array} buf */
export function toBase64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** @returns {Uint8Array} */
export function fromBase64(str) {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomBytes(length) {
  return webcrypto.getRandomValues(new Uint8Array(length));
}

/* ── passphrase → key ───────────────────────────────────────────────────── */

/**
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @param {KeyUsage[]} usages
 */
async function deriveKey(passphrase, salt, usages = ['encrypt', 'decrypt']) {
  const material = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usages,
  );
}

/**
 * Verifier stored against a user record. Deriving the same bits from the
 * supplied passphrase is what "sign in" checks — the passphrase itself is
 * never stored, in any form.
 *
 * @param {string} passphrase
 * @returns {Promise<{salt: string, verifier: string, iterations: number}>}
 */
export async function hashPassphrase(passphrase) {
  const salt = randomBytes(16);
  const verifier = await deriveVerifier(passphrase, salt);
  return { salt: toBase64(salt), verifier, iterations: PBKDF2_ITERATIONS };
}

async function deriveVerifier(passphrase, salt) {
  const material = await subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    256,
  );
  return toBase64(bits);
}

/**
 * @param {string} passphrase
 * @param {{salt: string, verifier: string}} stored
 */
export async function verifyPassphrase(passphrase, stored) {
  if (!stored || !stored.salt || !stored.verifier) return false;
  const candidate = await deriveVerifier(passphrase, fromBase64(stored.salt));
  return timingSafeEqual(candidate, stored.verifier);
}

/** Constant-time-ish string compare, so a wrong guess leaks no prefix length. */
export function timingSafeEqual(a, b) {
  const x = String(a);
  const y = String(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

/* ── vault key ──────────────────────────────────────────────────────────── */

/** A fresh tenant vault key, exportable so it can be wrapped per user. */
export async function generateVaultKey() {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/**
 * Wrap a vault key with a passphrase.
 * @param {CryptoKey} vaultKey
 * @param {string} passphrase
 * @returns {Promise<{salt: string, iv: string, wrapped: string, iterations: number}>}
 */
export async function wrapVaultKey(vaultKey, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wrappingKey = await deriveKey(passphrase, salt, ['wrapKey', 'unwrapKey']);
  const wrapped = await subtle.wrapKey('raw', vaultKey, wrappingKey, { name: 'AES-GCM', iv });
  return { salt: toBase64(salt), iv: toBase64(iv), wrapped: toBase64(wrapped), iterations: PBKDF2_ITERATIONS };
}

/**
 * @param {{salt: string, iv: string, wrapped: string}} envelope
 * @param {string} passphrase
 * @returns {Promise<CryptoKey>}
 */
export async function unwrapVaultKey(envelope, passphrase) {
  const wrappingKey = await deriveKey(passphrase, fromBase64(envelope.salt), ['wrapKey', 'unwrapKey']);
  return subtle.unwrapKey(
    'raw',
    fromBase64(envelope.wrapped),
    wrappingKey,
    { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/* ── record encryption ──────────────────────────────────────────────────── */

/**
 * Encrypt a JSON-serialisable value.
 * @param {CryptoKey} key
 * @param {unknown} value
 * @returns {Promise<string>} `shp1.<iv>.<ciphertext>`
 */
export async function encryptJSON(key, value) {
  const iv = randomBytes(12);
  const data = enc.encode(JSON.stringify(value));
  const cipher = await subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `shp1.${toBase64(iv)}.${toBase64(cipher)}`;
}

/**
 * @param {CryptoKey} key
 * @param {string} payload
 */
export async function decryptJSON(key, payload) {
  const parts = String(payload).split('.');
  if (parts.length !== 3 || parts[0] !== 'shp1') throw new Error('Not a Shepherd ciphertext');
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(parts[1]) },
    key,
    fromBase64(parts[2]),
  );
  return JSON.parse(dec.decode(plain));
}

export function isCiphertext(value) {
  return typeof value === 'string' && value.startsWith('shp1.');
}

/* ── TOTP (RFC 6238) ────────────────────────────────────────────────────── */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** A new 160-bit TOTP secret, base32 encoded for authenticator apps. */
export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

/**
 * @param {string} secret base32
 * @param {number} [timestamp] ms
 * @param {{step?: number, digits?: number}} [opts]
 */
export async function totpCode(secret, timestamp = Date.now(), opts = {}) {
  const step = opts.step || 30;
  const digits = opts.digits || 6;
  const counter = Math.floor(timestamp / 1000 / step);

  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);

  const key = await subtle.importKey(
    'raw', base32Decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  );
  const mac = new Uint8Array(await subtle.sign('HMAC', key, buffer));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24)
    | ((mac[offset + 1] & 0xff) << 16)
    | ((mac[offset + 2] & 0xff) << 8)
    | (mac[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * Verify a code, allowing one step of clock drift either way.
 * @param {string} secret
 * @param {string} code
 */
export async function verifyTotp(secret, code, timestamp = Date.now(), window = 1) {
  const candidate = String(code || '').replace(/\D/g, '');
  if (candidate.length !== 6) return false;
  for (let i = -window; i <= window; i++) {
    const expected = await totpCode(secret, timestamp + i * 30000);
    if (timingSafeEqual(expected, candidate)) return true;
  }
  return false;
}

/** `otpauth://` URI for an authenticator app QR code. */
export function totpUri(secret, account, issuer = 'Shepherd Kuwait') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
    + `?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Ten single-use recovery codes, for a lost authenticator. */
export function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = base32Encode(randomBytes(6)).slice(0, 10);
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

/** SHA-256 hex — used for document fingerprints and recovery-code storage. */
export async function sha256Hex(input) {
  const data = typeof input === 'string' ? enc.encode(input) : input;
  const digest = new Uint8Array(await subtle.digest('SHA-256', data));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}
