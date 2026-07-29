/**
 * Security: passphrases, the vault, encryption at rest, and TOTP.
 *
 * Run: node --test shepherd/test/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  hashPassphrase, verifyPassphrase, generateVaultKey, wrapVaultKey, unwrapVaultKey,
  encryptJSON, decryptJSON, isCiphertext, totpCode, verifyTotp, base32Encode, base32Decode,
  generateTotpSecret, generateRecoveryCodes, sha256Hex, timingSafeEqual,
} from '../js/core/crypto.js';
import { memoryStorage } from '../js/core/storage.js';
import { Database } from '../js/core/db.js';
import { TenantRegistry, provisionTenant } from '../js/core/tenant.js';
import { SessionManager, AuthError, describeDevice } from '../js/core/session.js';

test('a passphrase verifies against its own hash and nothing else', async () => {
  const stored = await hashPassphrase('correct horse battery');
  assert.equal(await verifyPassphrase('correct horse battery', stored), true);
  assert.equal(await verifyPassphrase('correct horse batteru', stored), false);
  assert.equal(await verifyPassphrase('', stored), false);
  assert.ok(!JSON.stringify(stored).includes('correct'), 'the passphrase is not stored');
});

test('two identical passphrases produce different verifiers (salted)', async () => {
  const a = await hashPassphrase('same passphrase here');
  const b = await hashPassphrase('same passphrase here');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.verifier, b.verifier);
});

test('the vault key survives wrap and unwrap, and only with the right passphrase', async () => {
  const key = await generateVaultKey();
  const envelope = await wrapVaultKey(key, 'a good long passphrase');

  const unwrapped = await unwrapVaultKey(envelope, 'a good long passphrase');
  const payload = { note: 'confidential' };
  const cipher = await encryptJSON(key, payload);
  assert.deepEqual(await decryptJSON(unwrapped, cipher), payload);

  await assert.rejects(() => unwrapVaultKey(envelope, 'the wrong passphrase'));
});

test('encrypted payloads do not leak their contents', async () => {
  const key = await generateVaultKey();
  const cipher = await encryptJSON(key, { subject: 'marriage counselling', notes: 'deeply private' });
  assert.ok(isCiphertext(cipher));
  assert.ok(!cipher.includes('counselling'));
  assert.ok(!cipher.includes('private'));
  assert.equal(cipher.split('.').length, 3);
});

test('a different key cannot decrypt', async () => {
  const [a, b] = [await generateVaultKey(), await generateVaultKey()];
  const cipher = await encryptJSON(a, { x: 1 });
  await assert.rejects(() => decryptJSON(b, cipher));
});

test('base32 round-trips', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 128, 64, 32, 16, 255]);
  assert.deepEqual([...base32Decode(base32Encode(bytes))], [...bytes]);
});

test('TOTP matches the RFC 6238 SHA-1 test vector', async () => {
  // RFC 6238 uses the ASCII secret "12345678901234567890".
  const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));
  assert.equal(await totpCode(secret, 59_000), '287082');
  assert.equal(await totpCode(secret, 1111111109_000), '081804');
  assert.equal(await totpCode(secret, 1234567890_000), '005924');
});

test('TOTP accepts one step of drift and rejects a wrong code', async () => {
  const secret = generateTotpSecret();
  const now = Date.now();
  assert.equal(await verifyTotp(secret, await totpCode(secret, now), now), true);
  assert.equal(await verifyTotp(secret, await totpCode(secret, now - 30_000), now), true);
  assert.equal(await verifyTotp(secret, await totpCode(secret, now - 120_000), now), false);
  assert.equal(await verifyTotp(secret, '000', now), false);
});

test('recovery codes are unique and stored only as hashes', async () => {
  const codes = generateRecoveryCodes(10);
  assert.equal(new Set(codes).size, 10);
  const hashes = await Promise.all(codes.map(sha256Hex));
  assert.ok(hashes.every((hash) => hash.length === 64));
  assert.ok(!hashes.some((hash, i) => hash.includes(codes[i])));
});

test('timing-safe compare still compares correctly', () => {
  assert.equal(timingSafeEqual('abc', 'abc'), true);
  assert.equal(timingSafeEqual('abc', 'abd'), false);
  assert.equal(timingSafeEqual('abc', 'abcd'), false);
});

/* ── sign-in ─────────────────────────────────────────────────────────────── */

async function setup() {
  const storage = memoryStorage();
  const registry = new TenantRegistry(storage);
  await registry.load();
  const provisioned = await provisionTenant({
    registry,
    storage,
    tenant: { name: 'Grace Community Church', city: 'Kuwait City', country: 'KW' },
    admin: { name: 'Ruth Antonio', email: 'ruth@example.com', passphrase: 'shepherd-test-pass' },
  });
  return { storage, registry, ...provisioned };
}

test('provisioning creates one tenant with one administrator who holds the vault', async () => {
  const { tenant, db, user } = await setup();
  assert.equal(tenant.settings.currency, 'KWD');
  assert.equal(tenant.settings.timeZone, 'Asia/Kuwait');
  assert.equal(user.role, 'church_admin');
  assert.equal(db.all('users').length, 1);
  assert.ok(user.vault.wrapped, 'the vault key is wrapped for this user');
  assert.ok(!('passphrase' in user));
});

test('sign-in succeeds with the right passphrase and opens the vault', async () => {
  const { storage, tenant } = await setup();
  const session = new SessionManager({ storage, sessionStore: null });
  const db = await new Database({ tenantId: tenant.id, storage }).open();

  const current = await session.signIn({
    db, tenantId: tenant.id, email: 'ruth@example.com', passphrase: 'shepherd-test-pass',
  });
  assert.equal(current.user.email, 'ruth@example.com');
  assert.ok(current.vaultKey);

  const cipher = await encryptJSON(current.vaultKey, { ok: true });
  assert.deepEqual(await decryptJSON(current.vaultKey, cipher), { ok: true });
});

test('sign-in fails identically for a wrong passphrase and an unknown email', async () => {
  const { storage, tenant } = await setup();
  const session = new SessionManager({ storage, sessionStore: null });
  const db = await new Database({ tenantId: tenant.id, storage }).open();

  const wrongPass = await session.signIn({ db, tenantId: tenant.id, email: 'ruth@example.com', passphrase: 'nope nope nope' })
    .then(() => null, (err) => err);
  const wrongUser = await session.signIn({ db, tenantId: tenant.id, email: 'nobody@example.com', passphrase: 'nope nope nope' })
    .then(() => null, (err) => err);

  assert.ok(wrongPass instanceof AuthError);
  assert.ok(wrongUser instanceof AuthError);
  assert.equal(wrongPass.message, wrongUser.message, 'no account enumeration');
});

test('a failed sign-in is written to the audit log', async () => {
  const { storage, tenant } = await setup();
  const session = new SessionManager({ storage, sessionStore: null });
  const db = await new Database({ tenantId: tenant.id, storage }).open();
  await session.signIn({ db, tenantId: tenant.id, email: 'ruth@example.com', passphrase: 'wrong one here' }).catch(() => {});
  const entries = db.all('audit').filter((e) => e.action === 'auth.failed');
  assert.equal(entries.length, 1);
});

test('two-factor blocks sign-in until the right code is given', async () => {
  const { storage, tenant, db, user } = await setup();
  const session = new SessionManager({ storage, sessionStore: null });
  const secret = generateTotpSecret();
  const recovery = await session.enableTotp({ db, userId: user.id, secret, code: await totpCode(secret) });
  assert.equal(recovery.length, 10);

  const fresh = await new Database({ tenantId: tenant.id, storage }).open();
  await assert.rejects(
    () => session.signIn({ db: fresh, tenantId: tenant.id, email: 'ruth@example.com', passphrase: 'shepherd-test-pass' }),
    (err) => err.code === 'totp-required',
  );

  const ok = await session.signIn({
    db: fresh, tenantId: tenant.id, email: 'ruth@example.com',
    passphrase: 'shepherd-test-pass', totpCode: await totpCode(secret),
  });
  assert.ok(ok.vaultKey);
});

test('a recovery code works once', async () => {
  const { storage, tenant, db, user } = await setup();
  const session = new SessionManager({ storage, sessionStore: null });
  const secret = generateTotpSecret();
  const [code] = await session.enableTotp({ db, userId: user.id, secret, code: await totpCode(secret) });

  const fresh = await new Database({ tenantId: tenant.id, storage }).open();
  await session.signIn({ db: fresh, tenantId: tenant.id, email: 'ruth@example.com', passphrase: 'shepherd-test-pass', totpCode: code });

  const again = await new Database({ tenantId: tenant.id, storage }).open();
  await assert.rejects(() => session.signIn({
    db: again, tenantId: tenant.id, email: 'ruth@example.com', passphrase: 'shepherd-test-pass', totpCode: code,
  }));
});

test('changing a passphrase keeps access to already-encrypted records', async () => {
  const { storage, tenant, db, user, vaultKey } = await setup();
  const session = new SessionManager({ storage, sessionStore: null });
  // A church administrator does not hold counselling by default — the note is
  // written by someone who does.
  db.setActor({ ...user, role: 'senior_pastor' });
  db.setVaultKey(vaultKey);
  db.insert('counseling', { memberId: 'm1', date: '2026-01-01', subject: 'Marriage', notes: 'private' });
  await db.flush();
  db.setActor(user);

  await session.changePassphrase({
    db, userId: user.id, currentPassphrase: 'shepherd-test-pass', newPassphrase: 'a brand new passphrase',
  });

  const fresh = await new Database({ tenantId: tenant.id, storage }).open();
  const current = await session.signIn({
    db: fresh, tenantId: tenant.id, email: 'ruth@example.com', passphrase: 'a brand new passphrase',
  });
  const reopened = await new Database({ tenantId: tenant.id, storage, vaultKey: current.vaultKey }).open();
  assert.equal(reopened.all('counseling')[0].subject, 'Marriage');
});

test('a second user gets their own wrapping of the same vault key', async () => {
  const { storage, tenant, db, user, vaultKey } = await setup();
  const session = new SessionManager({ storage, sessionStore: null });
  db.setActor({ ...user, role: 'senior_pastor' });
  db.setVaultKey(vaultKey);
  db.insert('counseling', { memberId: 'm1', date: '2026-02-01', subject: 'Bereavement', notes: 'private' });
  await db.flush();
  db.setActor(user);

  await session.createUser({
    db, actorVaultKey: vaultKey, name: 'Peter Girgis', email: 'peter@example.com',
    role: 'senior_pastor', passphrase: 'peters-own-passphrase',
  });

  const fresh = await new Database({ tenantId: tenant.id, storage }).open();
  const current = await session.signIn({
    db: fresh, tenantId: tenant.id, email: 'peter@example.com', passphrase: 'peters-own-passphrase',
  });
  const reopened = await new Database({ tenantId: tenant.id, storage, vaultKey: current.vaultKey }).open();
  assert.equal(reopened.all('counseling')[0].subject, 'Bereavement');
});

test('a suspended account cannot sign in', async () => {
  const { storage, tenant, db, user, vaultKey } = await setup();
  db.setActor(user);
  db.setVaultKey(vaultKey);
  db.update('users', user.id, { suspended: true });
  await db.flush();

  const session = new SessionManager({ storage, sessionStore: null });
  const fresh = await new Database({ tenantId: tenant.id, storage }).open();
  await assert.rejects(
    () => session.signIn({ db: fresh, tenantId: tenant.id, email: 'ruth@example.com', passphrase: 'shepherd-test-pass' }),
    (err) => err.code === 'suspended',
  );
});

test('device descriptions are readable', () => {
  assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605.1'), 'Safari on iOS');
  assert.match(describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537'), /Chrome on Windows/);
});
