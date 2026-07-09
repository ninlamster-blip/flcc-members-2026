// Conformance check for webpush.js — run with: node ask-proxy/webpush.test.mjs
//
// Round-trips our RFC 8291 payload encryption against the reference decoder
// from the widely-deployed http_ece / web-push npm packages (vendored,
// unmodified, MIT-licensed, in test/vendor/http_ece.cjs — dev-only, never
// shipped), and self-verifies the RFC 8292 VAPID JWT signature. This is the
// strongest correctness check available without live delivery to a real
// push service, since it proves byte-exact agreement with the reference
// implementation the ecosystem already trusts.
import nodeCrypto from 'node:crypto';
import { createRequire } from 'node:module';
import { encryptPushPayload, generateVapidAuthHeader, bytesToBase64Url } from './webpush.js';

const require = createRequire(import.meta.url);
const ece = require('./test/vendor/http_ece.cjs');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log('FAIL:', msg); }
  else console.log('ok:', msg);
}

for (const testPayload of [
  { title: 'Bagong panalangin sa Kadena', body: 'Panalangin po para sa anak kong may sakit.', url: '/ofw-companion/' },
  { title: 'x', body: '' },
  { title: 'Unicode kapatid 🙏🕯️❤️ — ñ é ü', body: 'Salamat, kapatid! 🌼'.repeat(3) },
]) {
  const receiverCurve = nodeCrypto.createECDH('prime256v1');
  receiverCurve.generateKeys();
  const authSecret = nodeCrypto.randomBytes(16);
  const p256dh = bytesToBase64Url(new Uint8Array(receiverCurve.getPublicKey()));
  const auth = bytesToBase64Url(new Uint8Array(authSecret));

  const encrypted = await encryptPushPayload(testPayload, p256dh, auth);
  const decrypted = ece.decrypt(Buffer.from(encrypted), {
    version: 'aes128gcm',
    privateKey: receiverCurve,
    authSecret,
  });

  const expected = JSON.stringify(testPayload);
  assert(decrypted.toString('utf8') === expected, `round-trip: ${expected.slice(0, 40)}...`);
}

try {
  await encryptPushPayload(
    { body: 'x'.repeat(5000) },
    bytesToBase64Url(nodeCrypto.randomBytes(65)),
    bytesToBase64Url(nodeCrypto.randomBytes(16))
  );
  assert(false, 'oversized payload should throw');
} catch (e) {
  assert(/too large/.test(e.message), 'oversized payload rejected: ' + e.message);
}

const vapidKeyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const privateJwk = await crypto.subtle.exportKey('jwk', vapidKeyPair.privateKey);
const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', vapidKeyPair.publicKey));
const publicB64url = bytesToBase64Url(publicRaw);

const authHeader = await generateVapidAuthHeader(
  'https://fcm.googleapis.com/fcm/send/abc123', 'mailto:test@example.com', privateJwk, publicB64url
);
const m = authHeader.match(/^vapid t=([^,]+), k=(.+)$/);
assert(!!m, 'Authorization header has vapid t=..., k=... shape');

const [jwtHeaderB64, jwtClaimsB64, jwtSigB64] = m[1].split('.');
assert(!!jwtHeaderB64 && !!jwtClaimsB64 && !!jwtSigB64, 'JWT has three parts');

const header = JSON.parse(Buffer.from(jwtHeaderB64, 'base64url').toString());
const claims = JSON.parse(Buffer.from(jwtClaimsB64, 'base64url').toString());
assert(header.alg === 'ES256' && header.typ === 'JWT', 'JWT header alg/typ correct');
assert(claims.aud === 'https://fcm.googleapis.com', 'aud is the endpoint origin, not the full URL');
assert(claims.sub === 'mailto:test@example.com', 'sub carries the subject');
assert(
  claims.exp > Math.floor(Date.now() / 1000) && claims.exp <= Math.floor(Date.now() / 1000) + 12 * 3600 + 5,
  'exp is ~12h out'
);

const sigBytes = Buffer.from(jwtSigB64, 'base64url');
const publicKey = await crypto.subtle.importKey('raw', publicRaw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
const valid = await crypto.subtle.verify(
  { name: 'ECDSA', hash: 'SHA-256' }, publicKey, sigBytes, new TextEncoder().encode(`${jwtHeaderB64}.${jwtClaimsB64}`)
);
assert(valid === true, 'JWT signature verifies against the VAPID public key');
assert(sigBytes.length === 64, 'signature is raw r||s (64 bytes), not DER');

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
