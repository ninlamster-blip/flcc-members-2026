/**
 * The Leadership Operating System additions: ministry health scoring, the
 * AI executive briefing, smart assignment for the annual worship schedule,
 * and ministry workspace access.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { memoryStorage } from '../js/core/storage.js';
import { Database } from '../js/core/db.js';
import { blank } from '../js/core/schema.js';
import { isoDate, addDays } from '../js/core/format.js';
import {
  ministryHealthScore, buildBriefing, suggestForRole, serviceAssignees, SERVICE_ROLE_FIELDS,
  CORE_SERVICE_ROLES, SERVICE_TEMPLATES, serviceReadiness, worshipShortages,
} from '../js/core/ai.js';
import { canAccessMinistryWorkspace, ledMinistries, isCommunionScheduled } from '../js/core/policies.js';
import { can, ROLES } from '../js/core/rbac.js';

const CHURCH_ADMIN = { id: 'u1', name: 'Ruth', role: 'church_admin' };

async function tenantDb(actor = CHURCH_ADMIN, storage = memoryStorage()) {
  return new Database({ tenantId: 'grace', storage, actor }).open();
}

/* ── ministry health ─────────────────────────────────────────────────────── */

test('a fully staffed, up-to-date ministry scores well; an understaffed, overdue one does not', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');

  const healthy = db.insert('ministries', blank('ministries', { name: 'Worship', minVolunteers: 2 }));
  const struggling = db.insert('ministries', blank('ministries', { name: 'Youth', minVolunteers: 6 }));

  const singer = db.insert('members', blank('members', { fullName: 'Singer One', status: 'member', ministries: ['Worship'] }));
  const singer2 = db.insert('members', blank('members', { fullName: 'Singer Two', status: 'member', ministries: ['Worship'] }));
  const lonely = db.insert('members', blank('members', { fullName: 'Lonely Leader', status: 'member', ministries: ['Youth'] }));

  db.insert('eventTasks', blank('eventTasks', { eventId: 'e1', title: 'Set up', ownerId: singer.id, done: true }));
  db.insert('eventTasks', blank('eventTasks', { eventId: 'e1', title: 'Sound check', ownerId: singer2.id, done: true, updatedAt: now.toISOString() }));
  // One understaffed ministry, one overdue task, untouched for two months —
  // every factor in the formula pointing the same direction.
  db.insert('eventTasks', blank('eventTasks', {
    eventId: 'e2', title: 'Plan retreat', ownerId: lonely.id, done: false,
    dueDate: isoDate(addDays(now, -10)), updatedAt: new Date(addDays(now, -60)).toISOString(),
  }));

  const goodScore = ministryHealthScore(db, healthy, { now });
  const badScore = ministryHealthScore(db, struggling, { now });

  assert.ok(goodScore.score > badScore.score, `expected ${goodScore.score} > ${badScore.score}`);
  assert.equal(goodScore.rating, 'Excellent');
  assert.ok(badScore.score < 60, `expected an understaffed ministry with an overdue, stale task to score under 60, got ${badScore.score}`);
  assert.equal(badScore.rating, 'Attention needed');
  assert.equal(goodScore.breakdown.length, 4);
});

test('a ministry with no history yet is not penalised for having nothing overdue', async () => {
  const db = await tenantDb();
  const ministry = db.insert('ministries', blank('ministries', { name: 'Prayer' }));
  const score = ministryHealthScore(db, ministry, { now: new Date() });
  assert.equal(score.tasksOverdue, 0);
  assert.ok(score.score > 0);
});

/* ── AI executive briefing ───────────────────────────────────────────────── */

test('the briefing surfaces only what the reader is permitted to know', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  db.insert('members', blank('members', { fullName: 'Birthday Soon', status: 'member', birthDate: '1990-06-03' }));
  db.insert('transactions', blank('transactions', { kind: 'expense', date: isoDate(now), amount: 50, category: 'Rent', status: 'pending-approval' }));

  const adminLines = buildBriefing(db, { role: 'church_admin' }, { now, settings: {} });
  assert.ok(adminLines.some((l) => /birthday/i.test(l)));

  const volunteerLines = buildBriefing(db, { role: 'volunteer' }, { now, settings: {} });
  assert.ok(!volunteerLines.some((l) => /finance|approval/i.test(l)), 'a volunteer holds no finance permission');
  assert.ok(volunteerLines.length >= 1, 'always says something, even if just reassurance');
});

test('an empty week still gets a friendly line, never a blank briefing', async () => {
  const db = await tenantDb();
  const lines = buildBriefing(db, { role: 'volunteer' }, { now: new Date(), settings: {} });
  assert.ok(lines.length >= 1);
});

/* ── smart assignment for the worship schedule ──────────────────────────── */

test('suggestions match the ministry, skip who is already on the service, and skip who is away', async () => {
  const db = await tenantDb();
  const serviceDate = '2026-08-07';

  const eligible = db.insert('members', blank('members', { fullName: 'Eligible Singer', status: 'member', ministries: ['Worship'] }));
  const away = db.insert('members', blank('members', { fullName: 'Away Singer', status: 'member', ministries: ['Worship'], awayUntil: '2026-08-20' }));
  const alreadyOn = db.insert('members', blank('members', { fullName: 'Already Assigned', status: 'member', ministries: ['Worship'] }));
  db.insert('members', blank('members', { fullName: 'Wrong Ministry', status: 'member', ministries: ['Youth'] }));

  const record = { date: serviceDate, presidingLeaderId: alreadyOn.id };
  const alreadyAssigned = serviceAssignees(record);
  assert.deepEqual(alreadyAssigned, [alreadyOn.id]);

  const candidates = suggestForRole(db, { roleKey: 'worshipSongLeaderId', date: serviceDate, alreadyAssigned });
  const ids = candidates.map((c) => c.member.id);

  assert.ok(ids.includes(eligible.id), 'the eligible worship-ministry member is offered');
  assert.ok(!ids.includes(away.id), 'someone away past the service date is skipped');
  assert.ok(!ids.includes(alreadyOn.id), 'someone already on this service is skipped');
  assert.ok(!ids.some((id) => id === db.first('members', (m) => m.fullName === 'Wrong Ministry').id), 'a member of a different ministry is not offered for a worship role');
});

test('whoever served least recently is offered first', async () => {
  const db = await tenantDb();
  const recent = db.insert('members', blank('members', { fullName: 'Served Last Week', status: 'member', ministries: ['Media & Sound'] }));
  const rested = db.insert('members', blank('members', { fullName: 'Not Served In Months', status: 'member', ministries: ['Media & Sound'] }));

  db.insert('serviceSchedule', blank('serviceSchedule', { date: '2026-07-01', service: 'Friday Worship', mediaId: recent.id }));
  db.insert('serviceSchedule', blank('serviceSchedule', { date: '2026-03-01', service: 'Friday Worship', mediaId: rested.id }));

  const candidates = suggestForRole(db, { roleKey: 'mediaId', date: '2026-08-07', alreadyAssigned: [] });
  assert.equal(candidates[0].member.id, rested.id, 'the one who served longest ago is offered first');
});

test('SERVICE_ROLE_FIELDS and serviceAssignees agree on what counts as assigned', () => {
  const record = Object.fromEntries(SERVICE_ROLE_FIELDS.map(([key], i) => [key, `m${i}`]));
  const assignees = serviceAssignees(record);
  for (const [key] of SERVICE_ROLE_FIELDS) assert.ok(assignees.includes(record[key]));
});

/* ── ministry workspace access ───────────────────────────────────────────── */

test('a ministry lead can open their own workspace and nobody else\'s', () => {
  const worshipLead = { id: 'u2', role: 'ministry_head', memberId: 'm-worship-lead' };
  const otherLead = { id: 'u3', role: 'ministry_head', memberId: 'm-someone-else' };
  const worship = { id: 'min1', name: 'Worship', leadId: 'm-worship-lead' };

  assert.equal(canAccessMinistryWorkspace(worshipLead, worship), true);
  assert.equal(canAccessMinistryWorkspace(otherLead, worship), false);
  assert.equal(canAccessMinistryWorkspace(null, worship), false);
});

test('church-wide leadership opens every workspace regardless of who leads it', () => {
  const worship = { id: 'min1', name: 'Worship', leadId: 'someone-else' };
  assert.equal(canAccessMinistryWorkspace({ id: 'a', role: 'church_admin' }, worship), true);
  assert.equal(canAccessMinistryWorkspace({ id: 'a', role: 'senior_pastor' }, worship), true);
  assert.equal(canAccessMinistryWorkspace({ id: 'a', role: 'pastor' }, worship), false, 'a pastor is not automatically every ministry\'s lead');
});

test('ledMinistries finds exactly the ministries this account leads', async () => {
  const db = await tenantDb();
  const lead = db.insert('members', blank('members', { fullName: 'Lead Person', status: 'member' }));
  db.insert('members', blank('members', { fullName: 'Someone Else', status: 'member' }));
  db.insert('ministries', blank('ministries', { name: 'Worship', leadId: lead.id }));
  db.insert('ministries', blank('ministries', { name: 'Youth', leadId: lead.id }));
  db.insert('ministries', blank('ministries', { name: 'Children', leadId: 'not-this-person' }));

  const led = ledMinistries(db, { id: 'u', role: 'ministry_head', memberId: lead.id });
  assert.deepEqual(led.map((m) => m.name).sort(), ['Worship', 'Youth']);
  assert.deepEqual(ledMinistries(db, { id: 'u', role: 'volunteer', memberId: null }), []);
});

/* ── RBAC: a ministry head can reach the leadership hub ─────────────────── */

test('a ministry head reads the whole leadership hub, but holds no blanket write', () => {
  const ministryHead = { role: 'ministry_head' };
  assert.equal(can(ministryHead, 'leadership:read'), true);
  assert.equal(can(ministryHead, 'leadership:write'), false, 'writing is scoped per-record, not granted church-wide');
  assert.ok(ROLES.ministry_head.permissions.includes('leadership:read'));
  assert.ok(!ROLES.ministry_head.permissions.includes('leadership:write'));
});

/* ── per-instance ministry write scoping (enforced in Database, not just UI) */

test('a ministry head writes their own ministry\'s tasks and plan, not another\'s', async () => {
  const storage = memoryStorage();
  const setup = await tenantDb(CHURCH_ADMIN, storage);
  const lead = setup.insert('members', blank('members', { fullName: 'Ministry Lead', status: 'member' }));
  const worship = setup.insert('ministries', blank('ministries', { name: 'Worship', leadId: lead.id }));
  const youth = setup.insert('ministries', blank('ministries', { name: 'Youth', leadId: 'someone-else' }));
  await setup.flush();

  const head = { id: 'u-head', role: 'ministry_head', memberId: lead.id };
  const db = new Database({ tenantId: 'grace', storage, actor: head });
  await db.open();

  // Their own ministry: allowed.
  const ownTask = db.insert('actionItems', { title: 'Book the sound engineer', ministryId: worship.id });
  assert.equal(ownTask.ministryId, worship.id);
  db.update('actionItems', ownTask.id, { status: 'done' });
  assert.equal(db.find('actionItems', ownTask.id).status, 'done');

  const ownPlan = db.insert('annualPlans', { ministryId: worship.id, year: 2026, title: 'Worship Plan' });
  db.update('annualPlans', ownPlan.id, { vision: 'Grow the team' });
  assert.equal(db.find('annualPlans', ownPlan.id).vision, 'Grow the team');

  // Someone else's ministry: refused.
  assert.throws(() => db.insert('actionItems', { title: 'Plan the youth retreat', ministryId: youth.id }), /permission/i);
  assert.throws(() => db.insert('annualPlans', { ministryId: youth.id, year: 2026, title: 'Youth Plan' }), /permission/i);

  // No ministry at all (an unscoped, church-wide item): also refused.
  assert.throws(() => db.insert('actionItems', { title: 'General action, nobody\'s ministry' }), /permission/i);

  // Church-wide governance with no ministry dimension: read-only for a ministry head.
  assert.throws(() => db.insert('meetings', { title: 'Council', date: '2026-01-01' }), /permission/i);
  assert.equal(can(head, 'leadership:read'), true, 'but they can still see meetings, decisions, goals and committees');
});

test('completing your own assigned task works regardless of which ministry it belongs to', async () => {
  const storage = memoryStorage();
  const setup = await tenantDb(CHURCH_ADMIN, storage);
  const worker = setup.insert('members', blank('members', { fullName: 'Task Owner', status: 'member' }));
  const someoneElse = setup.insert('members', blank('members', { fullName: 'Someone Else', status: 'member' }));
  const worship = setup.insert('ministries', blank('ministries', { name: 'Worship' }));
  const ownTask = setup.insert('actionItems', { title: 'Set up chairs', ownerId: worker.id, ministryId: worship.id });
  const othersTask = setup.insert('actionItems', { title: 'Print the bulletin', ownerId: someoneElse.id, ministryId: worship.id });
  await setup.flush();

  // A ministry head who leads nothing, but owns one of these two tasks.
  const nobody = { id: 'u-nobody', role: 'ministry_head', memberId: worker.id };
  const db = new Database({ tenantId: 'grace', storage, actor: nobody });
  await db.open();

  db.update('actionItems', ownTask.id, { status: 'done' });
  assert.equal(db.find('actionItems', ownTask.id).status, 'done');

  // But not someone else's task in that same ministry, since they lead neither.
  assert.throws(() => db.update('actionItems', othersTask.id, { status: 'done' }), /permission/i);
});

/* ── schema ──────────────────────────────────────────────────────────────── */

test('a service schedule record round-trips with every role assignable', async () => {
  const db = await tenantDb();
  const preacher = db.insert('members', blank('members', { fullName: 'Preacher', status: 'member' }));
  const record = db.insert('serviceSchedule', blank('serviceSchedule', {
    date: '2026-08-07', serviceType: 'friday', service: 'Friday Worship',
    preacherId: preacher.id, childrenYouthLeaderId: preacher.id,
  }));
  assert.equal(db.find('serviceSchedule', record.id).preacherId, preacher.id);
  assert.equal(db.find('serviceSchedule', record.id).childrenYouthLeaderId, preacher.id);
});

/* ── worship service redesign: templates, communion, readiness ──────────── */

test('communion is automatic on the first Friday or first Sunday of the month, and can be overridden', () => {
  assert.equal(isCommunionScheduled({ date: '2026-08-07' }), true, 'the 7th is within the first week');
  assert.equal(isCommunionScheduled({ date: '2026-08-14' }), false, 'the 14th is not');
  assert.equal(isCommunionScheduled({ date: '2026-08-14', communionOverride: 'yes' }), true, 'an explicit override always wins');
  assert.equal(isCommunionScheduled({ date: '2026-08-07', communionOverride: 'no' }), false, 'including turning it off on a first Friday');
});

test('service readiness counts core roles, excludes the optional ones, and only counts communion when it applies', () => {
  const bareService = { date: '2026-08-14', communionOverride: 'auto' }; // not a communion week
  const bare = serviceReadiness(bareService);
  assert.equal(bare.filled, 0);
  assert.ok(!CORE_SERVICE_ROLES.some(([key]) => key === 'parkingId' || key === 'photographyId'), 'parking and photography never count toward readiness');

  const communionWeek = { date: '2026-08-07', communionOverride: 'auto', communionMinisterId: 'm1' };
  const withMinister = serviceReadiness(communionWeek);
  const withoutCommunion = serviceReadiness({ ...communionWeek, date: '2026-08-14' });
  assert.equal(withMinister.total, withoutCommunion.total + 1, 'the communion minister role only counts on a communion week');
  assert.equal(withMinister.filled, 1);
});

test('the Friday and Sunday templates supply a title and a default order of service', () => {
  assert.equal(SERVICE_TEMPLATES.friday.service, 'Friday Worship');
  assert.equal(SERVICE_TEMPLATES.sunday.service, 'Sunday Worship');
  assert.match(SERVICE_TEMPLATES.friday.orderOfService, /Praise & Worship/);
});

test('worshipShortages lists upcoming services that are not fully staffed, soonest first', async () => {
  const db = await tenantDb();
  const now = new Date('2026-08-01T09:00:00');
  db.insert('serviceSchedule', blank('serviceSchedule', {
    date: '2026-08-14', serviceType: 'friday', service: 'Friday Worship', preacherId: 'm1',
  }));
  db.insert('serviceSchedule', blank('serviceSchedule', {
    date: '2026-08-07', serviceType: 'friday', service: 'Friday Worship',
  }));
  const shortages = worshipShortages(db, { now });
  assert.equal(shortages.length, 2);
  assert.equal(shortages[0].date, '2026-08-07', 'the sooner short-staffed service is listed first');
  assert.ok(shortages.every((s) => s.filled < s.total));
});

test('an annual plan belongs to one ministry and one year', async () => {
  const db = await tenantDb();
  const ministry = db.insert('ministries', blank('ministries', { name: 'Worship' }));
  const plan = db.insert('annualPlans', blank('annualPlans', {
    ministryId: ministry.id, year: 2026, title: 'Worship Plan', objectives: ['Grow the team'],
  }));
  assert.equal(db.find('annualPlans', plan.id).ministryId, ministry.id);
});
