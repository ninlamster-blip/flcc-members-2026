/**
 * Network overview — a read-only, cross-church rollup for whoever holds the
 * `lead_pastor` role, not a new kind of access to any one church's data.
 *
 * Shepherd has no server: each church is its own tenant, its own encrypted
 * vault key, its own local namespace, and that has not changed. What makes
 * this honest is exactly what `Database.open()` already does for anyone —
 * without a vault key, encrypted collections (`counseling`, `journal`,
 * `transactions`, `budgets`, `projects`, `documents`) simply do not decrypt
 * and stay unreadable; only the ordinary, unencrypted operational records
 * (members, ministries, attendance, care) ever load. This module opens
 * every other church in `storage`'s registry the same way any locked-out
 * session would, and aggregates only what was actually readable.
 *
 * It can only ever see a church that already exists in THIS device's local
 * storage — there is no server, so there is no reaching a church nobody has
 * opened here before. A church the lead pastor has not yet signed into on
 * this device does not appear.
 */

import { Database } from './db.js';
import { churchHealthOverview } from './ai.js';

/** Collections this view never even attempts to read — see `NEVER_INDEXED`-style disclosure. */
export const NETWORK_LOCKED = ['counseling', 'journal', 'transactions', 'budgets', 'projects', 'documents'];

/**
 * @param {import('./storage.js').StorageAdapter} storage
 * @param {{id: string, name: string}[]} tenants every church in the local registry
 * @param {{now?: Date, openDbs?: Map<string, import('./db.js').Database>}} [opts]
 *   `openDbs` lets an already-unlocked session (the church the reader is
 *   actually signed into) contribute its real data instead of being
 *   reopened without a key.
 * @returns {Promise<object[]>} one row per church, worst health first
 */
export async function networkOverview(storage, tenants, { now = new Date(), openDbs = new Map() } = {}) {
  const rows = [];
  for (const tenant of tenants) {
    const db = openDbs.get(tenant.id) || await new Database({ tenantId: tenant.id, storage }).open();
    const activeMembers = db.where('members', (m) => !m.archived && m.status !== 'visitor');
    const ministries = db.all('ministries');
    const openCare = db.where('care', (c) => !c.completedAt);
    const overview = churchHealthOverview(db, { now });

    rows.push({
      tenantId: tenant.id,
      name: tenant.name,
      memberCount: activeMembers.length,
      ministryCount: ministries.length,
      openCareCount: openCare.length,
      healthScore: overview.score,
      healthStatus: overview.status,
      healthStatusLabel: overview.statusLabel,
      unlocked: openDbs.has(tenant.id),
    });
  }
  return rows.sort((a, b) => a.healthScore - b.healthScore);
}
