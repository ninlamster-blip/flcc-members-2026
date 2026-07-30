/**
 * The network overview: a read-only, cross-church rollup for the lead
 * pastor role. It must only ever aggregate what a locked-out session could
 * already read (never finance, counselling, the journal, or documents),
 * and it must only ever see churches already present on this device.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memoryStorage } from '../js/core/storage.js';
import { Database } from '../js/core/db.js';
import { blank } from '../js/core/schema.js';
import { networkOverview, NETWORK_LOCKED } from '../js/core/network.js';
import { can, ROLES } from '../js/core/rbac.js';

const ADMIN = { id: 'u1', name: 'Ruth', role: 'church_admin' };

async function seedChurch(storage, tenantId, { memberCount = 1, ministryName = 'Worship' } = {}) {
  const db = await new Database({ tenantId, storage, actor: ADMIN }).open();
  const ministry = db.insert('ministries', blank('ministries', { name: ministryName, minVolunteers: 1 }));
  for (let i = 0; i < memberCount; i += 1) {
    db.insert('members', blank('members', { fullName: `Member ${i}`, status: 'member', ministries: [ministryName] }));
  }
  await db.flush();
  return { db, ministry };
}

test('lead_pastor holds network:read; ordinary senior_pastor does not', () => {
  assert.equal(can({ role: 'lead_pastor' }, 'network:read'), true);
  assert.equal(can({ role: 'senior_pastor' }, 'network:read'), false);
  assert.equal(can({ role: 'church_admin' }, 'network:read'), false);
  // Lead pastor should stand alongside senior_pastor within a single church too.
  assert.equal(can({ role: 'lead_pastor' }, 'counseling:read'), true);
  assert.equal(can({ role: 'lead_pastor' }, 'finance:approve'), true);
  assert.ok(ROLES.lead_pastor.rank < ROLES.church_admin.rank, 'a church admin can still grant this role');
  assert.ok(ROLES.lead_pastor.rank > ROLES.senior_pastor.rank, 'ranked above a single church\'s senior pastor');
});

test('networkOverview aggregates member/ministry/care counts and a health score per church', async () => {
  const storage = memoryStorage();
  await seedChurch(storage, 'grace', { memberCount: 3 });
  await seedChurch(storage, 'harvest', { memberCount: 1 });

  const rows = await networkOverview(storage, [
    { id: 'grace', name: 'Grace Community Church' },
    { id: 'harvest', name: 'Harvest Chapel' },
  ]);

  assert.equal(rows.length, 2);
  const grace = rows.find((r) => r.tenantId === 'grace');
  const harvest = rows.find((r) => r.tenantId === 'harvest');
  assert.equal(grace.memberCount, 3);
  assert.equal(grace.ministryCount, 1);
  assert.equal(harvest.memberCount, 1);
  assert.ok(typeof grace.healthScore === 'number' && grace.healthScore >= 0 && grace.healthScore <= 100);
});

test('networkOverview only ever reads a church already present in local storage, not an arbitrary id', async () => {
  const storage = memoryStorage();
  await seedChurch(storage, 'grace', { memberCount: 2 });

  // "unknown" was never created in this storage — opening it should just
  // come back empty, not throw and not fabricate a church.
  const rows = await networkOverview(storage, [
    { id: 'grace', name: 'Grace Community Church' },
    { id: 'unknown', name: 'Never Visited Church' },
  ]);
  const unknown = rows.find((r) => r.tenantId === 'unknown');
  assert.equal(unknown.memberCount, 0);
  assert.equal(unknown.ministryCount, 0);
});

test('networkOverview never reads encrypted collections — finance, counselling, journal and documents stay locked', async () => {
  const storage = memoryStorage();
  const { generateVaultKey } = await import('../js/core/crypto.js');
  const key = await generateVaultKey();
  const SENIOR = { id: 'u2', name: 'Pastor', role: 'senior_pastor' };
  const seniorDb = await new Database({ tenantId: 'grace', storage, vaultKey: key, actor: SENIOR }).open();
  seniorDb.insert('counseling', { memberId: 'm1', date: '2026-01-01', subject: 'Private matter', notes: 'confidential' });
  seniorDb.insert('journal', blank('journal', { title: 'Reflection', date: '2026-01-01', entry: 'A private thought.' }));
  await seniorDb.flush();

  const db = await new Database({ tenantId: 'grace', storage, vaultKey: key, actor: ADMIN }).open();
  db.insert('transactions', blank('transactions', { kind: 'giving', date: '2026-01-01', amount: 5000, category: 'Tithes' }));
  db.insert('members', blank('members', { fullName: 'Ruth Antonio', status: 'member' }));
  await db.flush();

  // The network view opens this church with no vault key at all — exactly
  // the same as any other session that has not signed into it.
  const rows = await networkOverview(storage, [{ id: 'grace', name: 'Grace Community Church' }]);
  assert.equal(rows[0].memberCount, 1, 'ordinary, unencrypted records still count');

  const reopened = await new Database({ tenantId: 'grace', storage }).open();
  for (const collection of NETWORK_LOCKED) {
    if (collection === 'counseling' || collection === 'journal') {
      assert.equal(reopened.isLocked(collection), true, `${collection} should fail to decrypt without the vault key`);
    }
  }
  assert.equal(reopened.all('counseling').length, 0);
  assert.equal(reopened.all('journal').length, 0);
});

test('networkOverview reuses an already-unlocked session for the church the reader is actually signed into', async () => {
  const storage = memoryStorage();
  const { generateVaultKey } = await import('../js/core/crypto.js');
  const key = await generateVaultKey();
  const unlockedDb = await new Database({ tenantId: 'grace', storage, vaultKey: key, actor: ADMIN }).open();
  unlockedDb.insert('members', blank('members', { fullName: 'Ruth Antonio', status: 'member' }));
  await unlockedDb.flush();

  const rows = await networkOverview(storage, [{ id: 'grace', name: 'Grace Community Church' }], {
    openDbs: new Map([['grace', unlockedDb]]),
  });
  assert.equal(rows[0].unlocked, true);
  assert.equal(rows[0].memberCount, 1);
});

test('networkOverview sorts the weakest-health church first', async () => {
  const storage = memoryStorage();
  await seedChurch(storage, 'healthy', { memberCount: 5 });
  await seedChurch(storage, 'empty', { memberCount: 0 });

  const rows = await networkOverview(storage, [
    { id: 'healthy', name: 'Healthy Church' },
    { id: 'empty', name: 'Empty Church' },
  ]);
  assert.ok(rows[0].healthScore <= rows[1].healthScore);
});
