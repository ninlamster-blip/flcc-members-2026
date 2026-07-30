/**
 * Equip — the learning platform: course gating for leader-restricted
 * training, per-member enrollment writes, learning progress, the next-course
 * recommendation, and leadership readiness.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memoryStorage } from '../js/core/storage.js';
import { Database } from '../js/core/db.js';
import { blank } from '../js/core/schema.js';
import { can } from '../js/core/rbac.js';
import { canWriteEnrollment, canEnrollInCourse } from '../js/core/policies.js';
import {
  learningProgress, recommendNextCourse, leadershipReadiness, buildLocalDraft, Assistant,
} from '../js/core/ai.js';

const CHURCH_ADMIN = { id: 'u1', name: 'Ruth', role: 'church_admin' };

async function tenantDb(actor = CHURCH_ADMIN, storage = memoryStorage()) {
  return new Database({ tenantId: 'grace', storage, actor }).open();
}

/* ── permissions ─────────────────────────────────────────────────────────── */

test('every role reads Equip, but only an admin-like role authors the catalogue', () => {
  for (const role of ['member', 'volunteer', 'ministry_head', 'elder', 'pastor', 'treasurer', 'secretary', 'senior_pastor', 'church_admin']) {
    assert.equal(can({ role }, 'equip:read'), true, `${role} should read Equip`);
  }
  assert.equal(can({ role: 'volunteer' }, 'equip:write'), false);
  assert.equal(can({ role: 'church_admin' }, 'equip:write'), true);
});

test('a leader-only course is closed to a volunteer but open to an elder or the catalogue owner', () => {
  const course = { leaderOnly: true };
  assert.equal(canEnrollInCourse({ role: 'volunteer' }, course), false);
  assert.equal(canEnrollInCourse({ role: 'elder' }, course), true, 'elder holds leadership:read');
  assert.equal(canEnrollInCourse({ role: 'ministry_head' }, course), true, 'ministry_head holds leadership:read');
  assert.equal(canEnrollInCourse({ role: 'church_admin' }, course), true, 'church_admin holds equip:write');
  assert.equal(canEnrollInCourse({ role: 'volunteer' }, { leaderOnly: false }), true, 'an ordinary course is open to everyone');
});

test('a member writes only their own enrollment', () => {
  const mine = { id: 'u2', memberId: 'm1' };
  assert.equal(canWriteEnrollment(mine, { memberId: 'm1' }), true);
  assert.equal(canWriteEnrollment(mine, { memberId: 'm2' }), false);
  assert.equal(canWriteEnrollment({ id: 'u3' }, { memberId: 'm1' }), false, 'no linked member record, no write');
});

test('the database enforces the same per-member enrollment boundary on insert and update', async () => {
  const storage = memoryStorage();
  const adminDb = await tenantDb(CHURCH_ADMIN, storage);
  const alice = adminDb.insert('members', blank('members', { fullName: 'Alice', status: 'member' }));
  const bob = adminDb.insert('members', blank('members', { fullName: 'Bob', status: 'member' }));
  const course = adminDb.insert('courses', blank('courses', { title: 'New Believer 101', category: 'Discipleship' }));

  const aliceUser = { id: 'u-alice', role: 'member', memberId: alice.id };
  const aliceDb = new Database({ tenantId: 'grace', storage, actor: aliceUser });
  await aliceDb.open();

  const own = aliceDb.insert('enrollments', blank('enrollments', { memberId: alice.id, courseId: course.id, status: 'in-progress' }));
  assert.equal(aliceDb.find('enrollments', own.id).status, 'in-progress');
  aliceDb.update('enrollments', own.id, { status: 'completed' });
  assert.equal(aliceDb.find('enrollments', own.id).status, 'completed');

  assert.throws(() => aliceDb.insert('enrollments', blank('enrollments', { memberId: bob.id, courseId: course.id })), /permission/i);
});

/* ── learning progress, recommendation, readiness ────────────────────────── */

test('learningProgress totals completed/in-progress and estimates hours from course duration', async () => {
  const db = await tenantDb();
  const member = db.insert('members', blank('members', { fullName: 'Learner', status: 'member' }));
  const user = { id: 'u-learner', memberId: member.id };
  const c1 = db.insert('courses', blank('courses', { title: 'Foundations', category: 'Foundations of the Christian Faith', duration: '2 hours' }));
  const c2 = db.insert('courses', blank('courses', { title: 'Prayer Basics', category: 'Prayer', duration: '45 min' }));
  db.insert('enrollments', blank('enrollments', { memberId: member.id, courseId: c1.id, status: 'completed' }));
  db.insert('enrollments', blank('enrollments', { memberId: member.id, courseId: c2.id, status: 'in-progress' }));

  const progress = learningProgress(db, user);
  assert.equal(progress.completed.length, 1);
  assert.equal(progress.inProgress.length, 1);
  assert.equal(progress.hours, 2, 'only the completed course counts toward hours');
});

test('recommendNextCourse skips completed and gated courses, and prefers a prerequisite-satisfied, ministry-matched one', async () => {
  const db = await tenantDb();
  const member = db.insert('members', blank('members', { fullName: 'Learner', status: 'member', ministries: ['Worship'] }));
  const user = { id: 'u-learner', role: 'member', memberId: member.id };

  const basics = db.insert('courses', blank('courses', { title: 'Worship 101', category: 'Worship Ministry' }));
  const advanced = db.insert('courses', blank('courses', { title: 'Worship 201', category: 'Worship Ministry', prerequisites: [basics.id] }));
  db.insert('courses', blank('courses', { title: 'Church Governance', category: 'Church Administration', leaderOnly: true }));
  db.insert('enrollments', blank('enrollments', { memberId: member.id, courseId: basics.id, status: 'completed' }));

  const next = recommendNextCourse(db, user);
  assert.equal(next.id, advanced.id, 'the prerequisite is met and the category matches a ministry the member serves in');
});

test('recommendNextCourse returns null once nothing is left to recommend', async () => {
  const db = await tenantDb();
  const member = db.insert('members', blank('members', { fullName: 'Learner', status: 'member' }));
  const user = { id: 'u-learner', role: 'volunteer', memberId: member.id };
  db.insert('courses', blank('courses', { title: 'Church Governance', category: 'Church Administration', leaderOnly: true }));
  assert.equal(recommendNextCourse(db, user), null, 'the only course is gated behind a role this user lacks');
});

test('leadershipReadiness is transparent: a score plus how many of how many', async () => {
  const db = await tenantDb();
  const member = db.insert('members', blank('members', { fullName: 'Learner', status: 'member' }));
  const user = { id: 'u-learner', memberId: member.id };
  assert.deepEqual(leadershipReadiness(db, user), { score: 0, completed: 0, total: 0 }, 'no leader-only courses exist yet');

  const c1 = db.insert('courses', blank('courses', { title: 'Biblical Leadership', category: 'Leadership Development', leaderOnly: true }));
  db.insert('courses', blank('courses', { title: 'Conflict Resolution', category: 'Leadership Development', leaderOnly: true }));
  db.insert('enrollments', blank('enrollments', { memberId: member.id, courseId: c1.id, status: 'completed' }));

  const readiness = leadershipReadiness(db, user);
  assert.equal(readiness.completed, 1);
  assert.equal(readiness.total, 2);
  assert.equal(readiness.score, 50);
});

/* ── the learning coach (AI generation) ──────────────────────────────────── */

test('the quiz task produces study questions and a memory verse challenge offline', () => {
  const draft = buildLocalDraft('equip.quiz', { title: 'The God Who Sees', passage: 'Genesis 16' }, null);
  assert.match(draft.text, /Study questions/);
  assert.match(draft.text, /Memory verse challenge/);
  assert.match(draft.text, /Genesis 16/);
});

test('the coach task is encouraging without a model, and every result is labelled', async () => {
  const db = await tenantDb();
  const assistant = new Assistant({ db });
  const result = await assistant.run('equip.coach', { name: 'Ruth', completedCount: 2, hours: 3, nextCourse: 'Prayer Basics' });
  assert.equal(result.aiGenerated, true);
  assert.equal(result.source, 'local');
  assert.match(result.text, /Prayer Basics/);
});
