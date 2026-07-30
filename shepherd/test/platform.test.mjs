/**
 * The platform: tenant isolation, the database, permissions, search,
 * insights and exports.
 *
 * Run: node --test 'shepherd/test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memoryStorage, namespaced, tenantPrefix, ROOT_PREFIX } from '../js/core/storage.js';
import { Database, TenantMismatchError, ValidationError } from '../js/core/db.js';
import { TenantRegistry, provisionTenant, tenantFromLocation } from '../js/core/tenant.js';
import { can, assertCan, ROLES, assignableRoles, effectivePermissions, PermissionError } from '../js/core/rbac.js';
import { validate, blank, searchableText, COLLECTION_NAMES, ENCRYPTED_COLLECTIONS } from '../js/core/schema.js';
import { SearchIndex, tokenize } from '../js/core/search.js';
import {
  computeInsights, activeNotifications, absentMembers, upcomingCelebrations, attendanceTrend,
  financeSnapshot, volunteerShortages, suggestVolunteers, buildLocalDraft, Assistant,
} from '../js/core/ai.js';
import { toCSV, toExcelXml, toICS } from '../js/core/exporters.js';
import { seedTenant, clearSeedData } from '../js/core/seed.js';
import { isoDate, addDays, daysUntilAnnual, formatMoney, relativeTime } from '../js/core/format.js';
import { Router } from '../js/core/router.js';
import { slugify, initials, uid } from '../js/core/id.js';

/* ── helpers ─────────────────────────────────────────────────────────────── */

const ADMIN = { id: 'u1', name: 'Ruth', role: 'church_admin' };

async function tenantDb(tenantId = 'grace', storage = memoryStorage(), actor = ADMIN) {
  const db = await new Database({ tenantId, storage, actor }).open();
  return db;
}

/* ── isolation ───────────────────────────────────────────────────────────── */

test('a namespaced adapter writes only under its own prefix', async () => {
  const raw = memoryStorage();
  const scoped = namespaced(raw, tenantPrefix('grace'));
  await scoped.set('c/members', '[]');
  assert.deepEqual(await raw.keys(''), ['shepherd/v1/t/grace/c/members']);
  assert.deepEqual(await scoped.keys(''), ['c/members']);
});

test('a traversal attempt in a storage key is refused', () => {
  const scoped = namespaced(memoryStorage(), tenantPrefix('grace'));
  assert.throws(() => scoped.set('../harvest/c/members', 'x'), /Illegal storage key/);
  assert.throws(() => scoped.get('../../other/c/members'), /Illegal storage key/);
});

test('tenant ids are validated before they become key prefixes', () => {
  assert.equal(tenantPrefix('grace-church'), `${ROOT_PREFIX}t/grace-church/`);
  assert.throws(() => tenantPrefix('../etc'), /Invalid tenant id/);
  assert.throws(() => tenantPrefix('Grace Church'), /Invalid tenant id/);
});

test('two churches on one device cannot see each other', async () => {
  const storage = memoryStorage();
  const grace = await tenantDb('grace', storage);
  const harvest = await tenantDb('harvest', storage);

  grace.insert('members', blank('members', { fullName: 'Ruth Antonio', status: 'member' }));
  harvest.insert('members', blank('members', { fullName: 'Peter Girgis', status: 'member' }));
  await Promise.all([grace.flush(), harvest.flush()]);

  const graceReopened = await tenantDb('grace', storage);
  const harvestReopened = await tenantDb('harvest', storage);

  assert.deepEqual(graceReopened.all('members').map((m) => m.fullName), ['Ruth Antonio']);
  assert.deepEqual(harvestReopened.all('members').map((m) => m.fullName), ['Peter Girgis']);
});

test('a database refuses to act for another tenant', async () => {
  const db = await tenantDb('grace');
  assert.equal(db.assertTenant('grace'), true);
  assert.throws(() => db.assertTenant('harvest'), TenantMismatchError);
});

test('importing another church\'s snapshot is refused', async () => {
  const storage = memoryStorage();
  const grace = await tenantDb('grace', storage);
  const harvest = await tenantDb('harvest', storage);
  harvest.insert('members', blank('members', { fullName: 'Peter Girgis', status: 'member' }));
  assert.throws(() => grace.importAll(harvest.exportAll()), TenantMismatchError);
});

test('the registry holds nothing pastoral', async () => {
  const storage = memoryStorage();
  const registry = new TenantRegistry(storage);
  await registry.load();
  await provisionTenant({
    registry, storage,
    tenant: { name: 'Grace Community Church', city: 'Salmiya' },
    admin: { name: 'Ruth', email: 'ruth@example.com', passphrase: 'a-long-enough-pass' },
  });
  const raw = await storage.get(`${ROOT_PREFIX}registry`);
  assert.ok(raw.includes('Grace Community Church'));
  assert.ok(!raw.includes('ruth@example.com'), 'no user detail in the shared registry');
});

test('a church id is derived from its name and stays URL-safe', () => {
  assert.equal(slugify('FLCC - Abundance Church'), 'flcc-abundance-church');
  assert.equal(slugify('كنيسة النعمة').startsWith('x'), true);
});

test('a church can be resolved from a link', () => {
  assert.equal(tenantFromLocation('https://x.test/shepherd/#/c/grace/members'), 'grace');
  assert.equal(tenantFromLocation('https://x.test/shepherd/?church=harvest'), 'harvest');
  assert.equal(tenantFromLocation('https://x.test/shepherd/#/members'), null);
});

/* ── database ────────────────────────────────────────────────────────────── */

test('records are stamped, validated and audited', async () => {
  const db = await tenantDb();
  const member = db.insert('members', blank('members', { fullName: 'Grace Villanueva', status: 'member' }));

  assert.ok(member.id && member.createdAt && member.updatedAt);
  assert.equal(member.createdBy, ADMIN.id);
  assert.equal(db.all('audit').length, 1);
  assert.match(db.all('audit')[0].summary, /create Members: Grace Villanueva/);

  db.update('members', member.id, { area: 'Hawally' });
  assert.equal(db.find('members', member.id).area, 'Hawally');
  assert.equal(db.all('audit').length, 2);

  db.remove('members', member.id);
  assert.equal(db.find('members', member.id), null);
  assert.equal(db.all('members').length, 0);
  assert.equal(db.all('audit').length, 3, 'the deletion is on the record');
});

test('invalid records are rejected with a field-level reason', async () => {
  const db = await tenantDb();
  assert.throws(() => db.insert('members', blank('members', {})), ValidationError);
  try {
    db.insert('members', blank('members', { fullName: 'X', status: 'not-a-status' }));
    assert.fail('should have thrown');
  } catch (err) {
    assert.ok(err.errors.some((e) => e.field === 'status'));
  }
  assert.throws(() => db.insert('transactions', blank('transactions', {
    kind: 'giving', date: '2026-01-01', amount: -5, category: 'Tithes',
  })), /cannot be negative/);
});

test('data survives a reload, and encrypted collections are unreadable without the key', async () => {
  const { generateVaultKey } = await import('../js/core/crypto.js');
  const storage = memoryStorage();
  const key = await generateVaultKey();
  const db = await new Database({ tenantId: 'grace', storage, vaultKey: key, actor: { ...ADMIN, role: 'senior_pastor' } }).open();
  db.insert('counseling', { memberId: 'm1', date: '2026-03-01', subject: 'Grief', notes: 'confidential' });
  db.insert('members', blank('members', { fullName: 'Ruth Antonio', status: 'member' }));
  await db.flush();

  const onDisk = await storage.get('shepherd/v1/t/grace/c/counseling');
  assert.ok(onDisk.startsWith('shp1.'), 'stored as ciphertext');
  assert.ok(!onDisk.includes('Grief'));
  assert.ok((await storage.get('shepherd/v1/t/grace/c/members')).includes('Ruth Antonio'), 'ordinary records stay plain');

  const withKey = await new Database({ tenantId: 'grace', storage, vaultKey: key }).open();
  assert.equal(withKey.all('counseling')[0].subject, 'Grief');

  const withoutKey = await new Database({ tenantId: 'grace', storage }).open();
  assert.equal(withoutKey.all('counseling').length, 0);
  assert.equal(withoutKey.isLocked('counseling'), true, 'the module can show a locked state');
  assert.equal(withoutKey.all('members').length, 1, 'the rest of the app still works');
});

test('a snapshot round-trips', async () => {
  const storage = memoryStorage();
  const db = await tenantDb('grace', storage);
  db.insert('members', blank('members', { fullName: 'Joy Mendoza', status: 'regular' }));
  const snapshot = db.exportAll();

  const restored = await tenantDb('grace', memoryStorage());
  restored.importAll(snapshot);
  assert.equal(restored.all('members')[0].fullName, 'Joy Mendoza');
});

test('subscribers are told what changed', async () => {
  const db = await tenantDb();
  const seen = [];
  db.subscribe((collection, change) => seen.push([collection, change.type]));
  const member = db.insert('members', blank('members', { fullName: 'Ana Lucero', status: 'visitor' }));
  db.update('members', member.id, { status: 'regular' });
  assert.deepEqual(seen, [['members', 'insert'], ['members', 'update']]);
});

/* ── permissions ─────────────────────────────────────────────────────────── */

test('roles grant what they should and nothing more', () => {
  const treasurer = { role: 'treasurer' };
  assert.equal(can(treasurer, 'finance:write'), true);
  assert.equal(can(treasurer, 'finance:approve'), true);
  assert.equal(can(treasurer, 'counseling:read'), false);
  assert.equal(can(treasurer, 'members:write'), false);
  assert.equal(can(treasurer, 'members:read'), true);

  const volunteer = { role: 'volunteer' };
  assert.equal(can(volunteer, 'prayer:write'), true);
  assert.equal(can(volunteer, 'finance:read'), false);
  assert.equal(can(volunteer, 'members:read'), false);

  const pastor = { role: 'pastor' };
  assert.equal(can(pastor, 'counseling:read'), true);
  assert.equal(can(pastor, 'finance:read'), false);

  assert.equal(can({ role: 'super_admin' }, 'tenants:manage'), true);
  assert.equal(can(null, 'dashboard:read'), false);
});

test('a platform administrator supports churches without reading their records', () => {
  const platform = { role: 'platform_admin' };
  assert.equal(can(platform, 'tenants:write'), true);
  assert.equal(can(platform, 'members:read'), false);
  assert.equal(can(platform, 'finance:read'), false);
  assert.equal(can(platform, 'counseling:read'), false);
});

test('write implies read, and a revocation beats a grant', () => {
  assert.equal(can({ role: 'secretary' }, 'events:read'), true);
  const elder = { role: 'elder', grants: ['finance:read'], revocations: ['members:read'] };
  assert.equal(can(elder, 'finance:read'), true);
  assert.equal(can(elder, 'members:read'), false);
});

test('a suspended user can do nothing at all', () => {
  assert.equal(can({ role: 'church_admin', suspended: true }, 'dashboard:read'), false);
});

test('nobody can hand out a role above their own', () => {
  const roles = assignableRoles({ role: 'church_admin' });
  assert.ok(roles.includes('senior_pastor'));
  assert.ok(!roles.includes('super_admin'));
  assert.deepEqual(assignableRoles({ role: 'volunteer' }), []);
});

test('the database refuses a write the user may not make', async () => {
  const db = await tenantDb('grace', memoryStorage(), { id: 'u9', name: 'Volunteer', role: 'volunteer' });
  assert.throws(() => db.insert('members', blank('members', { fullName: 'X', status: 'member' })), PermissionError);
  assert.throws(() => assertCan({ role: 'volunteer' }, 'finance:read'), PermissionError);
  assert.equal(db.all('audit').length, 0, 'a refused write leaves no record behind');
});

test('every role description and permission target exists', () => {
  for (const [id, role] of Object.entries(ROLES)) {
    assert.ok(role.label && role.description, `${id} is described`);
    assert.ok(role.permissions.length > 0);
  }
  assert.ok(effectivePermissions({ role: 'senior_pastor' }).includes('counseling:read'));
});

/* ── schema ──────────────────────────────────────────────────────────────── */

test('every collection is well formed', () => {
  for (const name of COLLECTION_NAMES) {
    const doc = blank(name);
    assert.ok(typeof doc === 'object', `${name} has defaults`);
    const result = validate(name, doc);
    assert.ok(Array.isArray(result.errors));
  }
  assert.deepEqual(ENCRYPTED_COLLECTIONS.sort(), ['budgets', 'counseling', 'documents', 'journal', 'projects', 'transactions'].sort());
});

test('searchable text is assembled from the right fields', () => {
  const text = searchableText('members', { fullName: 'Divya Nair', ministries: ['Worship', 'Prayer'], notes: 'Sings alto' });
  assert.match(text, /Divya Nair/);
  assert.match(text, /Worship Prayer/);
});

/* ── search ──────────────────────────────────────────────────────────────── */

test('search finds people, songs and minutes, and respects permission', async () => {
  const db = await tenantDb();
  db.insert('members', blank('members', { fullName: 'Divya Nair', status: 'member', ministries: ['Worship'] }));
  db.insert('songs', blank('songs', { title: 'Great Is Thy Faithfulness', themes: ['faithfulness'] }));
  db.insert('meetings', blank('meetings', { title: 'Council', date: new Date().toISOString(), minutes: 'Agreed to move the retreat weekend.' }));

  const index = new SearchIndex(db);
  assert.equal(index.search('divya', { user: ADMIN })[0].title, 'Divya Nair');
  assert.equal(index.search('faith', { user: ADMIN })[0].collection, 'songs', 'prefix matching works');
  assert.equal(index.search('retreat', { user: ADMIN })[0].collection, 'meetings');

  const volunteer = { role: 'volunteer' };
  assert.equal(index.search('divya', { user: volunteer }).length, 0);
  assert.equal(index.search('faith', { user: volunteer }).length, 1, 'a volunteer may still find songs');
});

test('the index follows changes without being told to reindex', async () => {
  const db = await tenantDb();
  const index = new SearchIndex(db);
  assert.equal(index.search('mendoza', { user: ADMIN }).length, 0);
  db.insert('members', blank('members', { fullName: 'Joy Mendoza', status: 'member' }));
  assert.equal(index.search('mendoza', { user: ADMIN }).length, 1);
});

test('tokenising drops noise', () => {
  assert.deepEqual(tokenize('The retreat and the youth ministry'), ['retreat', 'youth', 'ministry']);
});

/* ── insights ────────────────────────────────────────────────────────────── */

test('absence is measured from attendance, not from a flag', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00Z');
  const seen = db.insert('members', blank('members', { fullName: 'Seen Recently', status: 'member' }));
  const gone = db.insert('members', blank('members', { fullName: 'Long Gone', status: 'member' }));
  db.insert('attendance', blank('attendance', { date: isoDate(addDays(now, -7)), service: 'Friday Worship', memberIds: [seen.id], total: 1 }));
  db.insert('attendance', blank('attendance', { date: isoDate(addDays(now, -80)), service: 'Friday Worship', memberIds: [gone.id], total: 1 }));

  const absent = absentMembers(db, { now, weeks: 3 });
  assert.deepEqual(absent.map((m) => m.fullName), ['Long Gone']);
});

test('birthdays roll over the year boundary', () => {
  const dec31 = new Date('2026-12-31T12:00:00');
  assert.equal(daysUntilAnnual('1990-01-01', dec31), 1);
  assert.equal(daysUntilAnnual('1990-12-31', dec31), 0);
});

test('celebrations inside the window are found', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  db.insert('members', blank('members', { fullName: 'Birthday Soon', status: 'member', birthDate: '1990-06-05' }));
  db.insert('members', blank('members', { fullName: 'Not Yet', status: 'member', birthDate: '1990-11-05' }));
  const celebrations = upcomingCelebrations(db, { now, days: 14 });
  assert.deepEqual(celebrations.map((c) => c.name), ['Birthday Soon']);
});

test('the attendance trend compares like with like', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00Z');
  for (let week = 1; week <= 16; week++) {
    db.insert('attendance', blank('attendance', {
      date: isoDate(addDays(now, -week * 7)),
      service: 'Friday Worship',
      total: week <= 8 ? 60 : 100,
    }));
  }
  const trend = attendanceTrend(db, { now, weeks: 8 });
  assert.equal(Math.round(trend.recentAverage), 60);
  // The session sitting exactly on the eight-week boundary may fall either
  // side of it depending on the time of day, so this is a band, not a point.
  assert.ok(trend.priorAverage > 90 && trend.priorAverage <= 100, `prior ${trend.priorAverage}`);
  assert.equal(trend.direction, 'down');
  assert.ok(trend.changePct < -30);
});

test('the finance snapshot adds up and ignores rejected entries', async () => {
  const db = await tenantDb();
  const today = isoDate(new Date());
  db.insert('transactions', blank('transactions', { kind: 'giving', date: today, amount: 100.5, category: 'Tithes' }));
  db.insert('transactions', blank('transactions', { kind: 'giving', date: today, amount: 49.5, category: 'Offerings' }));
  db.insert('transactions', blank('transactions', { kind: 'expense', date: today, amount: 60, category: 'Rent' }));
  db.insert('transactions', blank('transactions', { kind: 'expense', date: today, amount: 999, category: 'Rent', status: 'rejected' }));

  const snapshot = financeSnapshot(db);
  assert.equal(snapshot.giving, 150);
  assert.equal(snapshot.expenses, 60);
  assert.equal(snapshot.net, 90);
  assert.equal(snapshot.givingByCategory[0].category, 'Tithes');
});

test('volunteer shortages and suggestions come from real assignments', async () => {
  const db = await tenantDb();
  const now = new Date();
  const member = db.insert('members', blank('members', { fullName: 'Ana Lucero', status: 'member', ministries: ['Worship'] }));
  const event = db.insert('events', blank('events', {
    title: 'Baptism Service', type: 'baptism', startsAt: addDays(now, 5).toISOString(),
  }));
  db.insert('eventTasks', blank('eventTasks', { eventId: event.id, title: 'Sound' }));
  db.insert('eventTasks', blank('eventTasks', { eventId: event.id, title: 'Welcome', ownerId: member.id }));

  const shortages = volunteerShortages(db, { now });
  assert.equal(shortages.length, 1);
  assert.equal(shortages[0].unassigned, 1);

  const suggested = suggestVolunteers(db, { role: 'worship', count: 1 });
  assert.equal(suggested[0].member.fullName, 'Ana Lucero');
});

test('insights are filtered by what the reader may see', async () => {
  const db = await tenantDb();
  const now = new Date();
  db.insert('budgets', blank('budgets', { name: 'Rent', year: now.getFullYear(), category: 'Rent', amount: 100 }));
  db.insert('transactions', blank('transactions', { kind: 'expense', date: isoDate(now), amount: 120, category: 'Rent' }));

  const forAdmin = computeInsights(db, { role: 'church_admin' }, { now });
  assert.ok(forAdmin.some((i) => i.id === 'budget'));

  const forVolunteer = computeInsights(db, { role: 'volunteer' }, { now });
  assert.ok(!forVolunteer.some((i) => i.id === 'budget'));
});

test('insights are ordered with the urgent ones first', async () => {
  const db = await tenantDb();
  const now = new Date();
  db.insert('care', blank('care', { memberId: 'm', type: 'visit', summary: 'Hospital', priority: 'urgent', dueDate: isoDate(addDays(now, -3)) }));
  db.insert('members', blank('members', { fullName: 'Birthday', status: 'member', birthDate: isoDate(addDays(now, 2)) }));
  const insights = computeInsights(db, { role: 'church_admin' }, { now });
  assert.equal(insights[0].severity, 'urgent');
});

test('a decision past its own review date surfaces as an insight, more urgently the longer it has waited', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-10');
  db.insert('decisions', blank('decisions', {
    title: 'Approve the new sound system', date: isoDate(addDays(now, -100)), decision: 'Approved.', reviewOn: isoDate(addDays(now, -5)),
  }));
  const insights = computeInsights(db, { role: 'church_admin' }, { now });
  const found = insights.find((i) => i.id === 'decisions-review');
  assert.ok(found);
  assert.equal(found.severity, 'attention', 'five days overdue is not yet urgent');
  assert.match(found.detail, /Approve the new sound system/);

  db.insert('decisions', blank('decisions', {
    title: 'Old benevolence policy', date: isoDate(addDays(now, -400)), decision: 'Approved.', reviewOn: isoDate(addDays(now, -60)),
  }));
  const laterInsights = computeInsights(db, { role: 'church_admin' }, { now });
  assert.equal(laterInsights.find((i) => i.id === 'decisions-review').severity, 'urgent', 'sixty days overdue is urgent');
});

test('a decision not yet due for review does not appear', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-10');
  db.insert('decisions', blank('decisions', {
    title: 'Future review', date: isoDate(now), decision: 'Approved.', reviewOn: isoDate(addDays(now, 30)),
  }));
  const insights = computeInsights(db, { role: 'church_admin' }, { now });
  assert.ok(!insights.some((i) => i.id === 'decisions-review'));
});

/* ── smart notifications ─────────────────────────────────────────────────── */

test('activeNotifications hides a dismissed insight until the underlying detail changes', () => {
  const now = new Date('2026-06-10');
  const insight = { id: 'absent', severity: 'attention', title: 'x', detail: '3 people quiet' };
  const dismissal = { insightId: 'absent', detail: '3 people quiet', createdAt: isoDate(addDays(now, -1)) };

  assert.deepEqual(activeNotifications([insight], [dismissal], { now }), [], 'dismissed yesterday, same detail — stays hidden');

  const changed = { ...insight, detail: '5 people quiet' };
  assert.deepEqual(activeNotifications([changed], [dismissal], { now }), [changed], 'the count changed — surfaced again');
});

test('activeNotifications brings a dismissed insight back after the snooze window, even with no change', () => {
  const now = new Date('2026-06-10');
  const insight = { id: 'absent', severity: 'attention', title: 'x', detail: '3 people quiet' };
  const staleDismissal = { insightId: 'absent', detail: '3 people quiet', createdAt: isoDate(addDays(now, -8)) };
  const freshDismissal = { insightId: 'absent', detail: '3 people quiet', createdAt: isoDate(addDays(now, -1)) };

  assert.deepEqual(activeNotifications([insight], [staleDismissal], { now, snoozeDays: 7 }), [insight]);
  assert.deepEqual(activeNotifications([insight], [freshDismissal], { now, snoozeDays: 7 }), []);
});

test('activeNotifications only ever considers the most recent dismissal for a given insight', () => {
  const now = new Date('2026-06-10');
  const insight = { id: 'absent', severity: 'attention', title: 'x', detail: '3 people quiet' };
  const old = { insightId: 'absent', detail: '9 people quiet', createdAt: isoDate(addDays(now, -20)) };
  const recent = { insightId: 'absent', detail: '3 people quiet', createdAt: isoDate(addDays(now, -1)) };

  assert.deepEqual(activeNotifications([insight], [old, recent], { now }), [], 'the recent dismissal matches, so it stays hidden');
});

/* ── assistant ───────────────────────────────────────────────────────────── */

test('a local draft is a real artefact, and every result is labelled', async () => {
  const db = await tenantDb();
  const assistant = new Assistant({ db });
  const result = await assistant.run('sermon.outline', { title: 'The God Who Sees', passage: 'Genesis 16' });

  assert.equal(result.aiGenerated, true);
  assert.equal(result.source, 'local');
  assert.match(result.text, /The God Who Sees/);
  assert.match(result.text, /Movement 1/);
  assert.equal(db.all('audit').filter((e) => e.action === 'ai.generate').length, 1);
});

test('the assistant uses a configured model when there is one', async () => {
  const db = await tenantDb();
  let sent = null;
  const assistant = new Assistant({
    db,
    config: { enabled: true, endpoint: 'https://ai.example/proxy', secret: 's3cret', model: 'test-model' },
    fetchImpl: async (url, init) => {
      sent = { url, init };
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Model answer.' }] }) };
    },
  });
  const result = await assistant.run('announcement.draft', { subject: 'Retreat' });

  assert.equal(result.text, 'Model answer.');
  assert.equal(result.source, 'model');
  assert.equal(sent.init.headers['x-proxy-secret'], 's3cret');
  assert.match(JSON.parse(sent.init.body).messages[0].content, /Retreat/);
});

test('a failed model call falls back to the local draft rather than losing the work', async () => {
  const db = await tenantDb();
  const assistant = new Assistant({
    db,
    config: { enabled: true, endpoint: 'https://ai.example/proxy', model: 'test-model' },
    fetchImpl: async () => { throw new Error('offline'); },
  });
  const result = await assistant.run('event.checklist', { title: 'Retreat', type: 'retreat' });
  assert.match(result.text, /Rooming list/);
  assert.match(result.text, /could not be reached/);
});

test('the knowledge assistant answers only from records the reader may see', async () => {
  const db = await tenantDb();
  db.insert('meetings', blank('meetings', {
    title: 'Council — April', date: new Date().toISOString(),
    minutes: 'Decided the youth ministry will meet on Friday evenings from now on.',
  }));
  const index = new SearchIndex(db);
  const assistant = new Assistant({ db, search: index });

  const answered = await assistant.answer('what did we decide about youth ministry', ADMIN);
  assert.equal(answered.sources.length, 1);
  assert.match(answered.text, /youth ministry/i);

  const denied = await assistant.answer('what did we decide about youth ministry', { role: 'volunteer' });
  assert.equal(denied.sources.length, 0);
  assert.match(denied.text, /Nothing in this church/);
});

test('unlike the knowledge assistant, "ask Shepherd" is not confined to church records', async () => {
  const db = await tenantDb();
  const noHits = await new Assistant({ db, search: new SearchIndex(db) }).ask('what does Ephesians 4 mean', ADMIN);
  assert.equal(noHits.sources.length, 0);
  assert.match(noHits.text, /no general knowledge of its own/);
  assert.doesNotMatch(noHits.text, /Nothing in this church's records answers/);
});

test('"ask Shepherd" still surfaces this church\'s own records when they are relevant', async () => {
  const db = await tenantDb();
  db.insert('meetings', blank('meetings', {
    title: 'Council — April', date: new Date().toISOString(),
    minutes: 'Decided the youth ministry will meet on Friday evenings from now on.',
  }));
  const assistant = new Assistant({ db, search: new SearchIndex(db) });

  const found = await assistant.ask('what did we decide about youth ministry', ADMIN);
  assert.equal(found.sources.length, 1);
  assert.match(found.text, /youth ministry/i);

  const denied = await assistant.ask('what did we decide about youth ministry', { role: 'volunteer' });
  assert.equal(denied.sources.length, 0, 'a role without leadership:read must not see the meeting minutes either');
});

test('a configured model is told to draw on general knowledge, not just church records', async () => {
  const db = await tenantDb();
  let sentSystem = '';
  const assistant = new Assistant({
    db,
    config: { enabled: true, endpoint: 'https://ai.example/proxy', model: 'test-model' },
    fetchImpl: async (url, init) => {
      sentSystem = JSON.parse(init.body).system;
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'Ephesians 4 calls the church to unity.' }] }) };
    },
  });
  const result = await assistant.ask('what does Ephesians 4 mean', ADMIN);
  assert.equal(result.source, 'model');
  assert.equal(result.text, 'Ephesians 4 calls the church to unity.');
  assert.match(sentSystem, /general knowledge/i);
  assert.match(sentSystem, /invent specific facts about THIS church/i);
});

test('checklists differ by event type', () => {
  const baptism = buildLocalDraft('event.checklist', { type: 'baptism' }, null).text;
  const retreat = buildLocalDraft('event.checklist', { type: 'retreat' }, null).text;
  assert.match(baptism, /Certificates printed/);
  assert.match(retreat, /Rooming list/);
});

/* ── exports ─────────────────────────────────────────────────────────────── */

test('CSV escapes commas, quotes and newlines', () => {
  const csv = toCSV(
    [{ name: 'Antonio, Ruth', note: 'She said "yes"', tags: ['a', 'b'] }],
    [{ key: 'name', label: 'Name' }, { key: 'note', label: 'Note' }, { key: 'tags', label: 'Tags' }],
  );
  const [header, row] = csv.split('\r\n');
  assert.equal(header, 'Name,Note,Tags');
  assert.equal(row, '"Antonio, Ruth","She said ""yes""",a; b');
});

test('Excel export types numbers as numbers', () => {
  const xml = toExcelXml([{
    name: 'Giving',
    columns: [{ key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount' }],
    rows: [{ category: 'Tithes', amount: 420.5 }],
  }]);
  assert.match(xml, /ss:Type="Number">420.5/);
  assert.match(xml, /ss:Type="String">Tithes/);
  assert.match(xml, /ss:Name="Giving"/);
});

test('an ICS file is well formed and escaped', () => {
  const ics = toICS([{
    id: 'e1', title: 'Retreat; Khiran', startsAt: '2026-08-14T15:00:00Z',
    endsAt: '2026-08-14T18:00:00Z', venue: 'Chalets', description: 'Line one\nLine two',
  }]);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /SUMMARY:Retreat\\; Khiran/);
  assert.match(ics, /DESCRIPTION:Line one\\nLine two/);
  assert.match(ics, /DTSTART:20260814T150000Z/);
  assert.match(ics, /END:VCALENDAR$/);
});

/* ── seed data ───────────────────────────────────────────────────────────── */

test('the example church is complete and internally consistent', async () => {
  const db = await tenantDb();
  seedTenant(db, { user: ADMIN });

  assert.ok(db.all('members').length >= 30);
  assert.ok(db.all('attendance').length >= 100);
  assert.ok(db.all('songs').length >= 10);
  assert.ok(db.all('sermons').length >= 8);
  assert.ok(db.all('transactions').length >= 50);
  assert.ok(db.all('events').length >= 4);

  for (const member of db.all('members')) {
    assert.ok(db.find('families', member.familyId), 'every person belongs to a family that exists');
  }
  for (const task of db.all('eventTasks')) {
    assert.ok(db.find('events', task.eventId), 'every task belongs to an event that exists');
  }
  const trend = attendanceTrend(db, { weeks: 8 });
  assert.ok(trend.recentAverage > 0);

  const insights = computeInsights(db, ADMIN, { settings: { followUpAfterWeeks: 3 } });
  assert.ok(insights.length > 0, 'the dashboard has something to say on day one');
});

test('example data can be cleared without touching users', async () => {
  const db = await tenantDb();
  db.insert('users', { name: 'Ruth', email: 'ruth@example.com', role: 'church_admin' });
  seedTenant(db, { user: ADMIN });
  await clearSeedData(db);

  assert.equal(db.all('members').length, 0);
  assert.equal(db.all('transactions').length, 0);
  assert.equal(db.all('users').length, 1, 'accounts survive');
});

/* ── routing & odds and ends ─────────────────────────────────────────────── */

test('routes parse, including the shareable church link', () => {
  assert.deepEqual(Router.parse('#/members/abc?tab=care'), {
    id: 'members', params: ['abc'], query: { tab: 'care' }, path: 'members/abc',
  });
  assert.equal(Router.parse('#/c/grace/finance').id, 'finance');
  assert.equal(Router.parse('').id, '');
});

test('money is formatted in fils for Kuwait', () => {
  assert.match(formatMoney(1234.5), /1,234\.500/);
});

test('ids sort by creation and initials are sane', () => {
  const [a, b] = [uid(), uid()];
  assert.ok(a < b || a.slice(0, 8) === b.slice(0, 8));
  assert.equal(initials('Maria Dela Cruz'), 'MC');
  assert.equal(initials('Ruth'), 'RU');
  assert.equal(initials(''), '?');
});

test('relative time reads naturally', () => {
  const now = Date.now();
  assert.equal(relativeTime(new Date(now + 3 * 864e5), now), 'in 3 days');
  assert.equal(relativeTime(new Date(now - 2 * 36e5), now), '2 hours ago');
});
