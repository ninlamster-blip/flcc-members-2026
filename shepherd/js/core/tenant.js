/**
 * Tenants — the churches on the platform.
 *
 * The registry lists which churches exist and how each one is branded. It is
 * the ONLY thing stored outside a tenant's own namespace, and it deliberately
 * holds nothing pastoral: an id, a name, branding, a plan, a created date.
 * Everything else about a church lives behind `shepherd/v1/t/<id>/` and is
 * reachable only through a Database bound to that id.
 *
 * A tenant is resolved, in order:
 *   1. `#/c/<tenantId>/...`  — the link a church hands out
 *   2. `?church=<tenantId>`  — deep links from email
 *   3. the last church this device signed into
 *   4. nothing: the picker is shown
 */

import { slugify } from './id.js';
import { ROOT_PREFIX } from './storage.js';
import { generateVaultKey, wrapVaultKey, hashPassphrase } from './crypto.js';

const REGISTRY_KEY = `${ROOT_PREFIX}registry`;
const LAST_TENANT_KEY = `${ROOT_PREFIX}last-tenant`;

/** GCC markets the platform is designed to serve. */
export const COUNTRIES = [
  { code: 'KW', name: 'Kuwait', currency: 'KWD', timeZone: 'Asia/Kuwait', weekend: ['Fri', 'Sat'] },
  { code: 'BH', name: 'Bahrain', currency: 'BHD', timeZone: 'Asia/Bahrain', weekend: ['Fri', 'Sat'] },
  { code: 'QA', name: 'Qatar', currency: 'QAR', timeZone: 'Asia/Qatar', weekend: ['Fri', 'Sat'] },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', timeZone: 'Asia/Dubai', weekend: ['Sat', 'Sun'] },
  { code: 'OM', name: 'Oman', currency: 'OMR', timeZone: 'Asia/Muscat', weekend: ['Fri', 'Sat'] },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', timeZone: 'Asia/Riyadh', weekend: ['Fri', 'Sat'] },
];

export const ACCENTS = ['#2F6F5E', '#1D4ED8', '#7C3AED', '#B45309', '#A33B2A', '#0F766E', '#BE185D', '#4338CA'];

/**
 * @typedef {object} Tenant
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {string} country ISO-2
 * @property {string} city
 * @property {string} accent
 * @property {string} [logo] data URL
 * @property {string} plan
 * @property {string} createdAt
 * @property {object} settings
 */

export class TenantRegistry {
  /** @param {import('./storage.js').StorageAdapter} storage */
  constructor(storage) {
    this.storage = storage;
    /** @type {Tenant[]} */
    this.tenants = [];
  }

  async load() {
    const raw = await this.storage.get(REGISTRY_KEY);
    try {
      this.tenants = raw ? JSON.parse(raw) : [];
    } catch {
      this.tenants = [];
    }
    return this.tenants;
  }

  async save() {
    await this.storage.set(REGISTRY_KEY, JSON.stringify(this.tenants));
  }

  list() {
    return [...this.tenants].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id) {
    return this.tenants.find((t) => t.id === id) || null;
  }

  /**
   * @param {{name: string, shortName?: string, country?: string, city?: string,
   *          accent?: string, plan?: string, id?: string, settings?: object}} input
   * @returns {Promise<Tenant>}
   */
  async create(input) {
    const id = input.id || slugify(input.name);
    if (!id) throw new Error('A church needs a name.');
    if (this.get(id)) throw new Error(`A church with the id "${id}" already exists.`);

    const country = COUNTRIES.find((c) => c.code === (input.country || 'KW')) || COUNTRIES[0];
    /** @type {Tenant} */
    const tenant = {
      id,
      name: input.name.trim(),
      shortName: (input.shortName || input.name).trim(),
      country: country.code,
      city: input.city || '',
      accent: input.accent || ACCENTS[this.tenants.length % ACCENTS.length],
      logo: input.logo || '',
      plan: input.plan || 'standard',
      createdAt: new Date().toISOString(),
      settings: {
        currency: country.currency,
        timeZone: country.timeZone,
        locale: 'en-GB',
        weekend: country.weekend,
        languages: ['English'],
        services: ['Friday Worship', 'Sunday Worship'],
        followUpAfterWeeks: 3,
        aiEnabled: true,
        ...input.settings,
      },
    };
    this.tenants.push(tenant);
    await this.save();
    return tenant;
  }

  async update(id, patch) {
    const tenant = this.get(id);
    if (!tenant) throw new Error(`No church with id ${id}`);
    Object.assign(tenant, patch, { id: tenant.id });
    if (patch.settings) tenant.settings = { ...tenant.settings, ...patch.settings };
    await this.save();
    return tenant;
  }

  /** Remove from the registry. Tenant data is destroyed separately, on purpose. */
  async remove(id) {
    this.tenants = this.tenants.filter((t) => t.id !== id);
    await this.save();
  }

  async rememberLast(id) {
    await this.storage.set(LAST_TENANT_KEY, id);
  }

  async lastUsed() {
    return this.storage.get(LAST_TENANT_KEY);
  }
}

/** Read a tenant id out of the current URL. @param {string} [href] */
export function tenantFromLocation(href) {
  const url = href || (typeof location !== 'undefined' ? location.href : '');
  const hashMatch = /#\/c\/([a-z0-9][a-z0-9-]*)/i.exec(url);
  if (hashMatch) return hashMatch[1].toLowerCase();
  const queryMatch = /[?&]church=([a-z0-9][a-z0-9-]*)/i.exec(url);
  if (queryMatch) return queryMatch[1].toLowerCase();
  return null;
}

/**
 * Provision a brand-new church: a vault key, a first administrator who can
 * unwrap it, and the church's own settings. Returns everything the caller
 * needs to sign that administrator straight in.
 *
 * @param {{registry: TenantRegistry, storage: import('./storage.js').StorageAdapter,
 *          tenant: object, admin: {name: string, email: string, passphrase: string, role?: string}}} input
 */
export async function provisionTenant({ registry, storage, tenant: tenantInput, admin }) {
  if (!admin || !admin.email || !admin.passphrase) {
    throw new Error('The first administrator needs an email and a passphrase.');
  }
  if (admin.passphrase.length < 10) {
    throw new Error('Use a passphrase of at least 10 characters — it protects every counselling note and financial record in this church.');
  }

  const tenant = await registry.create(tenantInput);
  const vaultKey = await generateVaultKey();
  const [auth, vault] = await Promise.all([
    hashPassphrase(admin.passphrase),
    wrapVaultKey(vaultKey, admin.passphrase),
  ]);

  const { Database } = await import('./db.js');
  const db = await new Database({ tenantId: tenant.id, storage, vaultKey, audit: false }).open();
  const user = db.insert('users', {
    name: admin.name || admin.email,
    email: admin.email.toLowerCase().trim(),
    role: admin.role || 'church_admin',
    auth,
    vault,
    devices: [],
  }, { skipPermission: true, skipAudit: true });

  db.auditEnabled = true;
  db.setActor(user);
  db.log('tenant.create', `Created ${tenant.name} with ${user.name} as ${user.role}.`);
  await db.flush();

  return { tenant, db, user, vaultKey };
}
