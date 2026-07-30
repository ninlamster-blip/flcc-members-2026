/**
 * The rules that are not simply "does this role hold this permission":
 * self-approval, prayer visibility, restricted counselling notes, what the
 * search index and the knowledge centre will never touch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  needsApproval, canApproveTransaction, canSeePrayer, canReadCounselingNote, canAccessJournalEntry,
  knowledgeMayUse, KNOWLEDGE_EXCLUDED, NEVER_INDEXED, expiryStatus,
  DEFAULT_APPROVAL_THRESHOLD,
} from '../js/core/policies.js';
import { memoryStorage } from '../js/core/storage.js';
import { Database } from '../js/core/db.js';
import { SearchIndex } from '../js/core/search.js';
import { Assistant } from '../js/core/ai.js';
import { blank } from '../js/core/schema.js';
import { isoDate, addDays } from '../js/core/format.js';

const TREASURER = { id: 'u-treasurer', role: 'treasurer' };
const PASTOR = { id: 'u-pastor', role: 'pastor' };
const SENIOR = { id: 'u-senior', role: 'senior_pastor' };
const VOLUNTEER = { id: 'u-volunteer', role: 'volunteer' };

/* ── finance ─────────────────────────────────────────────────────────────── */

test('only expenses over the threshold need approval', () => {
  assert.equal(needsApproval({ kind: 'expense', amount: 250 }, 100), true);
  assert.equal(needsApproval({ kind: 'expense', amount: 100 }, 100), false, 'the threshold itself is allowed');
  assert.equal(needsApproval({ kind: 'giving', amount: 5000 }, 100), false, 'giving is not approved, it is received');
  assert.equal(needsApproval({ kind: 'expense', amount: 250, status: 'approved' }, 100), false);
  assert.equal(needsApproval({ kind: 'expense', amount: 250, status: 'pending-approval' }, 100), false);
  assert.equal(needsApproval(null, 100), false);
  assert.equal(DEFAULT_APPROVAL_THRESHOLD, 100);
});

test('nobody approves their own spending', () => {
  const tx = { id: 't1', createdBy: TREASURER.id, amount: 500, kind: 'expense', status: 'pending-approval' };
  const own = canApproveTransaction(TREASURER, tx);
  assert.equal(own.ok, false);
  assert.match(own.reason, /you cannot approve it/i);

  const other = canApproveTransaction({ id: 'u-other', role: 'church_admin' }, tx);
  assert.equal(other.ok, true);
});

test('approving requires the permission, and cannot be done twice', () => {
  const tx = { id: 't2', createdBy: 'someone-else', amount: 500, kind: 'expense' };
  assert.equal(canApproveTransaction(PASTOR, tx).ok, false, 'a pastor does not hold finance:approve');
  assert.equal(canApproveTransaction(SENIOR, tx).ok, true, 'a senior pastor does');
  assert.equal(canApproveTransaction(SENIOR, { ...tx, status: 'approved' }).ok, false);
});

/* ── prayer ──────────────────────────────────────────────────────────────── */

test('prayer visibility separates the wall, the leaders and the private', () => {
  const wall = { visibility: 'wall', createdBy: 'someone' };
  const leaders = { visibility: 'leaders', createdBy: 'someone' };
  const priv = { visibility: 'private', createdBy: PASTOR.id };

  assert.equal(canSeePrayer(VOLUNTEER, wall), true);
  assert.equal(canSeePrayer(VOLUNTEER, leaders), false);
  assert.equal(canSeePrayer(VOLUNTEER, priv), false);

  assert.equal(canSeePrayer(PASTOR, leaders), true);
  assert.equal(canSeePrayer(PASTOR, priv), true, 'the author can read their own');

  assert.equal(canSeePrayer(SENIOR, priv), false, 'even a senior pastor does not read someone else\'s private request');
  assert.equal(canSeePrayer({ id: 'x', role: 'treasurer' }, wall), false, 'a treasurer holds no prayer permission at all');
});

/* ── counselling ─────────────────────────────────────────────────────────── */

test('a restricted counselling note is for its author and the senior pastor', () => {
  const restricted = { restricted: true, createdBy: PASTOR.id };
  const open = { restricted: false, createdBy: PASTOR.id };

  assert.equal(canReadCounselingNote(PASTOR, restricted), true);
  assert.equal(canReadCounselingNote(SENIOR, restricted), true);
  assert.equal(canReadCounselingNote({ id: 'other', role: 'pastor' }, restricted), false);
  assert.equal(canReadCounselingNote({ id: 'other', role: 'pastor' }, open), true);
  assert.equal(canReadCounselingNote({ id: 'a', role: 'church_admin' }, open), false, 'an administrator holds no counselling permission');
});

/* ── leadership journal ──────────────────────────────────────────────────── */

test('a journal entry is for its author alone — unlike a counselling note, there is no senior-pastor override', () => {
  const mine = { createdBy: PASTOR.id };
  assert.equal(canAccessJournalEntry(PASTOR, mine), true);
  assert.equal(canAccessJournalEntry(SENIOR, mine), false, 'even a senior pastor cannot read someone else\'s journal entry');
  assert.equal(canAccessJournalEntry({ id: 'other', role: 'pastor' }, mine), false);
  assert.equal(canAccessJournalEntry(PASTOR, { createdBy: null }), false, 'no author on record means no access');
});

/* ── what is never indexed ───────────────────────────────────────────────── */

test('the sensitive collections are excluded by name', () => {
  for (const collection of ['counseling', 'transactions', 'budgets', 'projects', 'users', 'audit', 'journal']) {
    assert.equal(knowledgeMayUse(collection), false, `${collection} is excluded`);
    assert.ok(NEVER_INDEXED.includes(collection));
  }
  assert.equal(knowledgeMayUse('meetings'), true);
  assert.equal(knowledgeMayUse('documents'), true);
  assert.deepEqual(NEVER_INDEXED, KNOWLEDGE_EXCLUDED);
});

test('a counselling subject cannot be found through search, at any role', async () => {
  const storage = memoryStorage();
  const db = await new Database({ tenantId: 'grace', storage, actor: SENIOR }).open();
  db.insert('counseling', { memberId: 'm1', date: '2026-01-01', subject: 'Marriage difficulty', notes: 'private' });
  db.insert('members', blank('members', { fullName: 'Marriage Counsellor Test', status: 'member' }));

  const index = new SearchIndex(db);
  const hits = index.search('marriage', { user: SENIOR });
  assert.ok(hits.length > 0, 'the ordinary record is found');
  assert.ok(hits.every((hit) => hit.collection !== 'counseling'), 'the counselling note is not');
});

test('a journal entry cannot be found through search, at any role', async () => {
  const storage = memoryStorage();
  const db = await new Database({ tenantId: 'grace', storage, actor: PASTOR }).open();
  db.insert('journal', blank('journal', { title: 'Wrestling with the budget decision', date: '2026-01-01', entry: 'Prayed about the roof repair vote.' }));
  db.insert('members', blank('members', { fullName: 'Roof Repair Test', status: 'member' }));

  const index = new SearchIndex(db);
  const hits = index.search('roof', { user: PASTOR });
  assert.ok(hits.length > 0, 'the ordinary record is found');
  assert.ok(hits.every((hit) => hit.collection !== 'journal'), 'the journal entry is not');
});

test('the database enforces the journal author-only boundary on insert and update, with no senior-pastor override', async () => {
  const { generateVaultKey } = await import('../js/core/crypto.js');
  const storage = memoryStorage();
  const key = await generateVaultKey();
  const db = await new Database({ tenantId: 'grace', storage, vaultKey: key, actor: PASTOR }).open();
  const own = db.insert('journal', blank('journal', { title: 'Reflection', date: '2026-01-01', entry: 'Today was hard.' }));
  assert.equal(own.createdBy, PASTOR.id);

  db.update('journal', own.id, { entry: 'Updated reflection.' });
  assert.equal(db.find('journal', own.id).entry, 'Updated reflection.');
  await db.flush();

  const seniorDb = await new Database({ tenantId: 'grace', storage, vaultKey: key, actor: SENIOR }).open();
  assert.throws(() => seniorDb.update('journal', own.id, { entry: 'Overwritten' }), /permission/i, 'not even the senior pastor may write another leader\'s entry');
});

test('a gift amount cannot be found through search either', async () => {
  const storage = memoryStorage();
  const db = await new Database({ tenantId: 'grace', storage, actor: { id: 'u', role: 'church_admin' } }).open();
  db.insert('transactions', blank('transactions', {
    kind: 'giving', date: isoDate(new Date()), amount: 5000, category: 'Building fund',
    description: 'Anonymous gift towards the roof',
  }));
  const index = new SearchIndex(db);
  assert.deepEqual(index.search('roof', { user: { id: 'u', role: 'church_admin' } }), []);
});

test('the knowledge assistant draws only on permitted, indexable records', async () => {
  const storage = memoryStorage();
  const db = await new Database({ tenantId: 'grace', storage, actor: SENIOR }).open();
  db.insert('meetings', blank('meetings', {
    title: 'Council', date: new Date().toISOString(),
    minutes: 'Agreed the benevolence limit stays at fifty dinars per family per month.',
  }));
  db.insert('counseling', { memberId: 'm1', date: '2026-01-01', subject: 'Benevolence request', notes: 'private' });

  const assistant = new Assistant({ db, search: new SearchIndex(db) });
  const answer = await assistant.answer('what is the benevolence limit', SENIOR);
  assert.ok(answer.sources.length >= 1);
  assert.ok(answer.sources.every((hit) => hit.collection !== 'counseling'));
  assert.match(answer.text, /benevolence/i);
});

/* ── documents ───────────────────────────────────────────────────────────── */

test('expiry nags at sixty days and shouts under a fortnight', () => {
  const now = new Date('2026-06-01T09:00:00');
  assert.equal(expiryStatus(null, now).due, false);
  assert.equal(expiryStatus(isoDate(addDays(now, 90)), now).due, false);

  const soon = expiryStatus(isoDate(addDays(now, 45)), now);
  assert.equal(soon.due, true);
  assert.equal(soon.severity, 'attention');
  assert.equal(soon.days, 45);

  const urgent = expiryStatus(isoDate(addDays(now, 10)), now);
  assert.equal(urgent.severity, 'urgent');

  const lapsed = expiryStatus(isoDate(addDays(now, -5)), now);
  assert.equal(lapsed.due, true);
  assert.equal(lapsed.days, -5);
  assert.equal(lapsed.severity, 'urgent');
});
