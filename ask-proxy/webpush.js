// Web Push (RFC 8291 message encryption + RFC 8292 VAPID) implemented with
// only the standard Web Crypto API (crypto.subtle / crypto.getRandomValues),
// so this exact file runs unmodified in the Cloudflare Worker and in Node
// (>=20) for testing — no bundler, no npm dependency, no Node-only APIs.
//
// The algorithm here mirrors the reference implementation used by the
// widely-deployed `web-push` / `http_ece` npm packages (aes128gcm content
// coding, single-record since our notification payloads are always small).
// It has been round-trip verified against that reference decoder — see
// ask-proxy/webpush.test.mjs.

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatBytes(...arrays) {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, dataBytes));
}

// RFC 5869 HKDF. Every length we need here (32, 16, 12 bytes) fits in a
// single SHA-256 block, so expand never needs more than one HMAC round.
function hkdfExtract(salt, ikm) {
  return hmacSha256(salt, ikm);
}

async function hkdfExpand(prk, infoBytes, length) {
  const input = concatBytes(infoBytes, new Uint8Array([1]));
  const t1 = await hmacSha256(prk, input);
  return t1.slice(0, length);
}

// RFC 8291 §3.4: the WebPush-specific IKM derived from the ECDH shared
// secret, salted with the subscription's auth secret.
async function computeWebPushIkm(authSecret, ecdhSharedSecret, receiverPubKey, senderPubKey) {
  const info = concatBytes(new TextEncoder().encode('WebPush: info\0'), receiverPubKey, senderPubKey);
  const prk = await hkdfExtract(authSecret, ecdhSharedSecret);
  return hkdfExpand(prk, info, 32);
}

const RECORD_SIZE = 4096;
// Content-Encoding: aes128gcm caps a single record's plaintext at
// RECORD_SIZE minus the 1-byte padding delimiter and 16-byte GCM tag.
const MAX_PLAINTEXT_BYTES = RECORD_SIZE - 1 - 16;

// Encrypts a JSON-serializable payload for one subscriber, per RFC 8291.
// Returns the complete aes128gcm body: 86-byte header (16-byte salt + 4-byte
// record size + 1-byte key-id length + 65-byte ephemeral sender public key)
// followed by the single AES-128-GCM record (ciphertext + 16-byte tag).
export async function encryptPushPayload(payloadObj, p256dhB64url, authB64url) {
  const receiverPubKey = base64UrlToBytes(p256dhB64url);
  const authSecret = base64UrlToBytes(authB64url);
  if (receiverPubKey.length !== 65) throw new Error('p256dh must decode to 65 bytes');
  if (authSecret.length < 16) throw new Error('auth secret must be at least 16 bytes');

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
  if (payloadBytes.length > MAX_PLAINTEXT_BYTES) {
    throw new Error(`push payload too large (${payloadBytes.length} > ${MAX_PLAINTEXT_BYTES} bytes)`);
  }

  const senderKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const senderPubKey = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeyPair.publicKey));

  const receiverPublicKey = await crypto.subtle.importKey(
    'raw', receiverPubKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverPublicKey }, senderKeyPair.privateKey, 256)
  );

  const ikm = await computeWebPushIkm(authSecret, sharedSecret, receiverPubKey, senderPubKey);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

  // Single record (counter 0, so the per-record nonce equals the base nonce
  // unmodified): plaintext is the payload plus the 0x02 "final record" pad.
  const plaintext = concatBytes(payloadBytes, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertextWithTag = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, plaintext)
  );

  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE, false);
  header[20] = 65;
  header.set(senderPubKey, 21);

  return concatBytes(header, ciphertextWithTag);
}

// RFC 8292 VAPID: a short-lived ES256 JWT identifying the sending
// application, plus the application server's public key.
export async function generateVapidAuthHeader(endpointUrl, subject, vapidPrivateKeyJwk, vapidPublicKeyB64url) {
  const aud = new URL(endpointUrl).origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud, exp: now + 12 * 3600, sub: subject };
  const headerB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const claimsB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${headerB64}.${claimsB64}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk', vapidPrivateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  // Web Crypto's ECDSA signatures are raw (r||s), exactly what JWS ES256 needs.
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(signingInput))
  );
  const jwt = `${signingInput}.${bytesToBase64Url(signature)}`;
  return `vapid t=${jwt}, k=${vapidPublicKeyB64url}`;
}

// Sends one push message to one subscriber. Caller should treat 404/410
// responses as "subscription is gone, delete it" per the Push API spec.
export async function sendWebPush(subscription, payloadObj, vapid) {
  const body = await encryptPushPayload(payloadObj, subscription.p256dh, subscription.auth);
  const authHeader = await generateVapidAuthHeader(
    subscription.endpoint, vapid.subject, vapid.privateKeyJwk, vapid.publicKeyB64url
  );
  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
    },
    body,
  });
}

export { bytesToBase64Url, base64UrlToBytes };
