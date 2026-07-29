/**
 * Sessions — signing in, staying in, and the record of who signed in where.
 *
 * Signing in does three things: verifies the passphrase against the stored
 * PBKDF2 verifier, optionally checks a TOTP code, and unwraps the tenant
 * vault key so encrypted collections can be read for the rest of the session.
 *
 * WHERE THE SESSION LIVES
 * Session state (including the unwrapped vault key) is held in
 * `sessionStorage`, not `localStorage`. A reload keeps you signed in; closing
 * the tab does not. That is the deliberate trade: a shared church laptop must
 * not stay unlocked after the window closes, and the vault key must never sit
 * in long-lived storage.
 */

import { ROOT_PREFIX } from './storage.js';
import { webcrypto } from './id.js';
import {
  verifyPassphrase, unwrapVaultKey, wrapVaultKey, hashPassphrase,
  toBase64, fromBase64, verifyTotp, sha256Hex, generateRecoveryCodes,
} from './crypto.js';

const SESSION_KEY = `${ROOT_PREFIX}session`;
export const IDLE_TIMEOUT_MS = 45 * 60 * 1000;

export class AuthError extends Error {
  constructor(message, code = 'auth') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** A short, stable label for this browser — shown in "Devices" and login alerts. */
export function describeDevice(ua = (globalThis.navigator && navigator.userAgent) || 'unknown') {
  const os = /iPhone|iPad/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox' : 'Browser';
  return `${browser} on ${os}`;
}

/** Stable-per-device id, so the same laptop is not reported as new every time. */
export async function deviceFingerprint() {
  const nav = globalThis.navigator || {};
  const screenInfo = globalThis.screen ? `${screen.width}x${screen.height}x${screen.colorDepth}` : 'no-screen';
  const parts = [nav.userAgent, nav.language, screenInfo, Intl.DateTimeFormat().resolvedOptions().timeZone];
  return (await sha256Hex(parts.join('|'))).slice(0, 16);
}

export class SessionManager {
  /**
   * @param {{storage: import('./storage.js').StorageAdapter,
   *          sessionStore?: Storage|null}} options
   */
  constructor({ storage, sessionStore = globalThis.sessionStorage || null }) {
    this.storage = storage;
    this.sessionStore = sessionStore;
    /** @type {{tenantId: string, user: object, vaultKey: CryptoKey, startedAt: number, lastSeenAt: number}|null} */
    this.current = null;
    /** @type {Set<(session: any) => void>} */
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _emit() {
    for (const listener of this.listeners) listener(this.current);
  }

  get user() { return this.current ? this.current.user : null; }
  get tenantId() { return this.current ? this.current.tenantId : null; }
  get vaultKey() { return this.current ? this.current.vaultKey : null; }
  get signedIn() { return !!this.current; }

  /**
   * Verify credentials against a tenant database and open a session.
   *
   * @param {{db: import('./db.js').Database, tenantId: string, email: string,
   *          passphrase: string, totpCode?: string}} input
   */
  async signIn({ db, tenantId, email, passphrase, totpCode }) {
    db.assertTenant(tenantId);
    const clean = String(email || '').toLowerCase().trim();
    const user = db.all('users').find((u) => String(u.email).toLowerCase() === clean);

    // Same message and roughly the same work for "no such user" and "wrong
    // passphrase" — otherwise the form becomes an account-enumeration oracle.
    if (!user) {
      await verifyPassphrase(passphrase, { salt: toBase64(new Uint8Array(16)), verifier: toBase64(new Uint8Array(32)) });
      throw new AuthError('That email and passphrase do not match.', 'credentials');
    }
    if (user.suspended) throw new AuthError('This account is suspended. Ask your church administrator.', 'suspended');

    const ok = await verifyPassphrase(passphrase, user.auth || {});
    if (!ok) {
      db.log('auth.failed', `Failed sign-in for ${clean} from ${describeDevice()}.`, { actorName: clean });
      await db.flush();
      throw new AuthError('That email and passphrase do not match.', 'credentials');
    }

    if (user.totp && user.totp.enabled) {
      if (!totpCode) throw new AuthError('Enter the 6-digit code from your authenticator app.', 'totp-required');
      const passed = await verifyTotp(user.totp.secret, totpCode)
        || await this._consumeRecoveryCode(db, user, totpCode);
      if (!passed) throw new AuthError('That code is not valid. Codes change every 30 seconds.', 'totp');
    }

    const vaultKey = await unwrapVaultKey(user.vault, passphrase);
    const device = await this._recordDevice(db, user);

    db.setActor(user);
    db.setVaultKey(vaultKey);
    db.update('users', user.id, { lastLoginAt: new Date().toISOString() }, { skipPermission: true, skipAudit: true });
    db.log('auth.signin', `${user.name} signed in from ${device.label}.`);
    await db.flush();

    this.current = { tenantId, user: db.find('users', user.id), vaultKey, startedAt: Date.now(), lastSeenAt: Date.now() };
    await this._persist();
    this._emit();
    return this.current;
  }

  async _consumeRecoveryCode(db, user, code) {
    const codes = (user.totp && user.totp.recoveryHashes) || [];
    const hash = await sha256Hex(String(code).toUpperCase().trim());
    if (!codes.includes(hash)) return false;
    db.update('users', user.id, {
      totp: { ...user.totp, recoveryHashes: codes.filter((c) => c !== hash) },
    }, { skipPermission: true, skipAudit: true });
    db.log('auth.recovery', `${user.name} used a recovery code.`);
    return true;
  }

  async _recordDevice(db, user) {
    const id = await deviceFingerprint();
    const label = describeDevice();
    const devices = [...(user.devices || [])];
    const existing = devices.find((d) => d.id === id);
    const now = new Date().toISOString();
    let isNew = false;
    if (existing) {
      existing.lastSeenAt = now;
      existing.count = (existing.count || 1) + 1;
    } else {
      isNew = true;
      devices.push({ id, label, firstSeenAt: now, lastSeenAt: now, count: 1 });
    }
    db.update('users', user.id, { devices }, { skipPermission: true, skipAudit: true });
    if (isNew && (user.devices || []).length) {
      // A login alert, in the only channel a local-first app can guarantee.
      db.log('auth.new-device', `New device signed in to ${user.name}'s account: ${label}.`);
    }
    return { id, label, isNew };
  }

  /** Restore a session across a page reload (same tab only). */
  async restore(openDb) {
    if (!this.sessionStore) return null;
    let payload;
    try {
      payload = JSON.parse(this.sessionStore.getItem(SESSION_KEY) || 'null');
    } catch {
      payload = null;
    }
    if (!payload) return null;
    if (Date.now() - payload.lastSeenAt > IDLE_TIMEOUT_MS) {
      this.sessionStore.removeItem(SESSION_KEY);
      return null;
    }
    try {
      const vaultKey = await webcrypto.subtle.importKey(
        'raw', fromBase64(payload.vaultKey), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
      );
      const db = await openDb(payload.tenantId, vaultKey);
      const user = db.find('users', payload.userId);
      if (!user || user.suspended) throw new Error('user gone');
      db.setActor(user);
      this.current = { tenantId: payload.tenantId, user, vaultKey, startedAt: payload.startedAt, lastSeenAt: Date.now() };
      await this._persist();
      this._emit();
      return this.current;
    } catch {
      this.sessionStore.removeItem(SESSION_KEY);
      return null;
    }
  }

  async _persist() {
    if (!this.sessionStore || !this.current) return;
    const raw = await webcrypto.subtle.exportKey('raw', this.current.vaultKey);
    this.sessionStore.setItem(SESSION_KEY, JSON.stringify({
      tenantId: this.current.tenantId,
      userId: this.current.user.id,
      vaultKey: toBase64(raw),
      startedAt: this.current.startedAt,
      lastSeenAt: this.current.lastSeenAt,
    }));
  }

  /** Called on user activity; also enforces the idle timeout. */
  async touch() {
    if (!this.current) return false;
    if (Date.now() - this.current.lastSeenAt > IDLE_TIMEOUT_MS) {
      await this.signOut('idle');
      return false;
    }
    this.current.lastSeenAt = Date.now();
    await this._persist();
    return true;
  }

  async signOut(reason = 'manual', db = null) {
    if (db && this.current) {
      db.log('auth.signout', `${this.current.user.name} signed out (${reason}).`);
      await db.flush();
    }
    this.current = null;
    if (this.sessionStore) this.sessionStore.removeItem(SESSION_KEY);
    this._emit();
  }

  /* ── credential management ───────────────────────────────────────────── */

  /**
   * Change a passphrase: re-wrap the vault key so the user keeps access to
   * everything already encrypted.
   */
  async changePassphrase({ db, userId, currentPassphrase, newPassphrase }) {
    const user = db.find('users', userId);
    if (!user) throw new AuthError('No such user.');
    if (!(await verifyPassphrase(currentPassphrase, user.auth || {}))) {
      throw new AuthError('Your current passphrase is not correct.', 'credentials');
    }
    if (String(newPassphrase).length < 10) {
      throw new AuthError('Use at least 10 characters.', 'weak');
    }
    const vaultKey = await unwrapVaultKey(user.vault, currentPassphrase);
    const [auth, vault] = await Promise.all([
      hashPassphrase(newPassphrase),
      wrapVaultKey(vaultKey, newPassphrase),
    ]);
    db.update('users', userId, { auth, vault }, { skipPermission: true });
    db.log('auth.passphrase', `${user.name} changed their passphrase.`);
    await db.flush();
    return true;
  }

  /**
   * Add a user to this church. The inviter's session vault key is re-wrapped
   * with the new user's passphrase — which is why an invite needs someone who
   * is currently signed in, and why nobody can be added behind the vault's back.
   */
  async createUser({ db, actorVaultKey, name, email, role, passphrase, memberId = null }) {
    if (String(passphrase).length < 10) throw new AuthError('Use at least 10 characters.', 'weak');
    const clean = String(email).toLowerCase().trim();
    if (db.all('users').some((u) => String(u.email).toLowerCase() === clean)) {
      throw new AuthError('Someone with that email already has access.', 'duplicate');
    }
    const [auth, vault] = await Promise.all([
      hashPassphrase(passphrase),
      wrapVaultKey(actorVaultKey, passphrase),
    ]);
    const user = db.insert('users', { name, email: clean, role, memberId, auth, vault, devices: [] });
    await db.flush();
    return user;
  }

  /* ── two-factor ──────────────────────────────────────────────────────── */

  /** Turn on TOTP for a user. Returns the recovery codes ONCE — they are stored hashed. */
  async enableTotp({ db, userId, secret, code }) {
    const user = db.find('users', userId);
    if (!user) throw new AuthError('No such user.');
    if (!(await verifyTotp(secret, code))) {
      throw new AuthError('That code is not valid yet — wait for the next one and try again.', 'totp');
    }
    const recoveryCodes = generateRecoveryCodes();
    const recoveryHashes = await Promise.all(recoveryCodes.map((c) => sha256Hex(c)));
    db.update('users', userId, { totp: { enabled: true, secret, recoveryHashes, enabledAt: new Date().toISOString() } }, { skipPermission: true });
    db.log('auth.2fa-on', `${user.name} turned on two-factor authentication.`);
    await db.flush();
    if (this.current && this.current.user.id === userId) this.current.user = db.find('users', userId);
    return recoveryCodes;
  }

  async disableTotp({ db, userId, passphrase }) {
    const user = db.find('users', userId);
    if (!user) throw new AuthError('No such user.');
    if (!(await verifyPassphrase(passphrase, user.auth || {}))) {
      throw new AuthError('Confirm your passphrase to turn two-factor off.', 'credentials');
    }
    db.update('users', userId, { totp: { enabled: false } }, { skipPermission: true });
    db.log('auth.2fa-off', `${user.name} turned off two-factor authentication.`);
    await db.flush();
    if (this.current && this.current.user.id === userId) this.current.user = db.find('users', userId);
    return true;
  }
}
