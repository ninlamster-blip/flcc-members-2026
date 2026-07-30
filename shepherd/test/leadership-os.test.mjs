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
  ministryHealthScore, ministryHealthTrend, churchHealthOverview, successionRisk, volunteerWellBeing,
  pastoralCareOverview, buildBriefing, suggestForRole, serviceAssignees, SERVICE_ROLE_FIELDS,
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

  db.insert('eventTasks', blank('eventTasks', { eventId: 'e1', title: 'Set up', ownerId: singer.id, done: true, createdAt: isoDate(addDays(now, -5)) }));
  db.insert('eventTasks', blank('eventTasks', { eventId: 'e1', title: 'Sound check', ownerId: singer2.id, done: true, createdAt: isoDate(addDays(now, -5)), updatedAt: now.toISOString() }));
  // One understaffed ministry, one overdue task, untouched for two months —
  // every factor in the formula pointing the same direction.
  db.insert('eventTasks', blank('eventTasks', {
    eventId: 'e2', title: 'Plan retreat', ownerId: lonely.id, done: false, createdAt: isoDate(addDays(now, -70)),
    dueDate: isoDate(addDays(now, -10)), updatedAt: new Date(addDays(now, -60)).toISOString(),
  }));

  const goodScore = ministryHealthScore(db, healthy, { now });
  const badScore = ministryHealthScore(db, struggling, { now });

  assert.ok(goodScore.score > badScore.score, `expected ${goodScore.score} > ${badScore.score}`);
  // Perfect on the four original factors, neutral (untested) on the three new
  // ones — "Healthy", not "Excellent"; excellence now requires more than the
  // original formula measured.
  assert.equal(goodScore.rating, 'Healthy');
  assert.ok(badScore.score < 60, `expected an understaffed ministry with an overdue, stale task to score under 60, got ${badScore.score}`);
  assert.equal(badScore.rating, 'Attention needed');
  assert.equal(goodScore.breakdown.length, 7);
});

test('a ministry with no history yet is not penalised for having nothing overdue', async () => {
  const db = await tenantDb();
  const ministry = db.insert('ministries', blank('ministries', { name: 'Prayer' }));
  const score = ministryHealthScore(db, ministry, { now: new Date() });
  assert.equal(score.tasksOverdue, 0);
  assert.ok(score.score > 0);
});

test('ministry health factors in goal progress, training completion and member engagement', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  const ministry = db.insert('ministries', blank('ministries', { name: 'Worship' }));
  const member = db.insert('members', blank('members', { fullName: 'Worship One', status: 'member', ministries: ['Worship'] }));

  db.insert('goals', blank('goals', {
    title: 'Grow the worship team', ministryId: ministry.id, year: 2026, progress: 90, target: 100,
    createdAt: isoDate(addDays(now, -5)),
  }));
  const course = db.insert('courses', blank('courses', { title: 'Worship Basics', category: 'Worship Ministry' }));
  db.insert('enrollments', blank('enrollments', {
    memberId: member.id, courseId: course.id, status: 'completed', createdAt: isoDate(addDays(now, -5)),
  }));
  db.insert('attendance', blank('attendance', { date: isoDate(now), memberIds: [member.id] }));

  const score = ministryHealthScore(db, ministry, { now });
  const byLabel = Object.fromEntries(score.breakdown.map((b) => [b.label, b.value]));
  assert.ok(byLabel['Goal progress'] >= 85, `expected goal progress near 90, got ${byLabel['Goal progress']}`);
  assert.equal(byLabel['Training completion'], 100);
  assert.equal(byLabel['Member engagement'], 100);
  assert.equal(score.breakdown.find((b) => b.label === 'Budget utilisation'), undefined);
});

test('ministry health only scores budget utilisation when a matching budget line exists', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  const ministry = db.insert('ministries', blank('ministries', { name: 'Missions' }));
  db.insert('budgets', blank('budgets', { name: 'Missions annual budget', year: 2026, category: 'Missions', amount: 1000 }));
  db.insert('transactions', blank('transactions', {
    kind: 'expense', category: 'Missions', amount: 400, date: isoDate(now),
  }));

  const withBudget = ministryHealthScore(db, ministry, { now });
  const label = withBudget.breakdown.find((b) => b.label === 'Budget utilisation');
  assert.ok(label, 'expected a Budget utilisation entry when a matching budget line exists');
  assert.equal(label.value, 100);

  const noBudgetMinistry = db.insert('ministries', blank('ministries', { name: 'Unbudgeted' }));
  const withoutBudget = ministryHealthScore(db, noBudgetMinistry, { now });
  assert.equal(withoutBudget.breakdown.find((b) => b.label === 'Budget utilisation'), undefined);
});

test('ministry health surfaces weaknesses and matching recommendations, honestly', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  const ministry = db.insert('ministries', blank('ministries', { name: 'Youth', minVolunteers: 6 }));
  db.insert('members', blank('members', { fullName: 'Solo Leader', status: 'member', ministries: ['Youth'] }));

  const score = ministryHealthScore(db, ministry, { now });
  assert.ok(score.weaknesses.includes('Volunteer coverage'));
  assert.equal(score.recommendations.length, score.weaknesses.length);
  assert.ok(score.recommendations.some((r) => /volunteers/i.test(r)));
});

test('ministry health trend recomputes honestly as of earlier points in time', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  const ministry = db.insert('ministries', blank('ministries', { name: 'Worship', minVolunteers: 1 }));
  db.insert('members', blank('members', {
    fullName: 'Late Joiner', status: 'member', ministries: ['Worship'], createdAt: now.toISOString(),
  }));

  const trend = ministryHealthTrend(db, ministry, { now, points: 3, intervalDays: 30 });
  assert.equal(trend.length, 3);
  assert.equal(trend[2].date, isoDate(now));
  // The volunteer did not exist 60 days ago, so coverage — and therefore the
  // overall score — should genuinely have been lower back then.
  assert.ok(trend[0].score <= trend[2].score, `expected an earlier score <= today's, got ${trend[0].score} vs ${trend[2].score}`);
});

/* ── church health overview ───────────────────────────────────────────────── */

test('church health overview returns a status per dimension and discloses what it does not track', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  db.insert('ministries', blank('ministries', { name: 'Worship', minVolunteers: 1 }));
  db.insert('members', blank('members', { fullName: 'Regular Member', status: 'member', ministries: ['Worship'] }));

  const overview = churchHealthOverview(db, { now });
  assert.ok(overview.score >= 0 && overview.score <= 100);
  assert.ok(['excellent', 'healthy', 'needs-attention', 'critical'].includes(overview.status));
  assert.equal(overview.dimensions.length, 9);
  for (const dim of overview.dimensions) {
    assert.ok(dim.key && dim.label && dim.detail, `dimension ${dim.key} missing a field`);
    assert.ok(['excellent', 'healthy', 'needs-attention', 'critical'].includes(dim.status));
  }
  assert.ok(overview.notTracked.some((n) => /small group/i.test(n)));
});

test('church health overview recommends only on dimensions that are actually struggling', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  // No ministries, no members, no history at all — every dimension defaults
  // to the neutral 70, which is "needs-attention" but not "critical".
  const overview = churchHealthOverview(db, { now });
  for (const rec of overview.recommendations) {
    const dim = overview.dimensions.find((d) => rec.startsWith(d.label));
    assert.ok(dim && (dim.status === 'critical' || dim.status === 'needs-attention'));
  }
});

/* ── succession planning ──────────────────────────────────────────────────── */

test('successionRisk flags a ministry with no lead, and one with a lead but no deputy or bench, as urgent', async () => {
  const db = await tenantDb();
  const leaderless = db.insert('ministries', blank('ministries', { name: 'Missions' }));
  const soloLed = db.insert('ministries', blank('ministries', { name: 'Youth' }));
  const soloMember = db.insert('members', blank('members', { fullName: 'Solo Lead', status: 'member', ministries: ['Youth'] }));
  db.update('ministries', soloLed.id, { leadId: soloMember.id });

  const risks = successionRisk(db);
  const missions = risks.find((r) => r.id === leaderless.id);
  const youth = risks.find((r) => r.id === soloLed.id);
  assert.equal(missions.risk, 'urgent');
  assert.match(missions.reason, /no one currently leads/i);
  assert.equal(youth.risk, 'urgent');
  assert.match(youth.reason, /no deputy/i);
});

test('successionRisk downgrades to attention once a bench exists, and to low risk once a deputy is also named alongside a bench', async () => {
  const db = await tenantDb();
  const ministry = db.insert('ministries', blank('ministries', { name: 'Worship' }));
  const lead = db.insert('members', blank('members', { fullName: 'Lead', status: 'member', ministries: ['Worship'] }));
  const helper = db.insert('members', blank('members', { fullName: 'Helper', status: 'member', ministries: ['Worship'] }));
  db.update('ministries', ministry.id, { leadId: lead.id });

  const withBench = successionRisk(db).find((r) => r.id === ministry.id);
  assert.equal(withBench.risk, 'attention');
  assert.equal(withBench.bench, 1);

  // Naming the only other server as deputy leaves no one else at all —
  // still a real risk, just a different one (no reason to call it "low").
  db.update('ministries', ministry.id, { deputyId: helper.id });
  const deputyButNoBench = successionRisk(db).find((r) => r.id === ministry.id);
  assert.equal(deputyButNoBench.risk, 'attention');
  assert.equal(deputyButNoBench.bench, 0);

  const another = db.insert('members', blank('members', { fullName: 'Another', status: 'member', ministries: ['Worship'] }));
  const withDeputyAndBench = successionRisk(db).find((r) => r.id === ministry.id);
  assert.equal(withDeputyAndBench.risk, 'info');
  assert.equal(withDeputyAndBench.hasDeputy, true);
  assert.equal(withDeputyAndBench.bench, 1);
  assert.ok(another.id);
});

test('successionRisk checks committees the same way, by chair and deputy chair', async () => {
  const db = await tenantDb();
  const committee = db.insert('committees', blank('committees', { name: 'Building Fund' }));
  const risks = successionRisk(db);
  const found = risks.find((r) => r.role === 'committee' && r.id === committee.id);
  assert.ok(found, 'expected the committee to appear in successionRisk');
  assert.equal(found.risk, 'urgent');
});

/* ── volunteer well-being ─────────────────────────────────────────────────── */

test('volunteerWellBeing scores a volunteer in one ministry with no open tasks near 100', async () => {
  const db = await tenantDb();
  const member = db.insert('members', blank('members', { fullName: 'Rested Volunteer', status: 'member', ministries: ['Prayer'] }));
  const wellBeing = volunteerWellBeing(db, { now: new Date() });
  const entry = wellBeing.find((v) => v.memberId === member.id);
  assert.ok(entry.score >= 90, `expected a lightly-loaded volunteer to score near 100, got ${entry.score}`);
  assert.equal(entry.status, 'excellent');
});

test('volunteerWellBeing scores lower for someone in several ministries with overdue tasks', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  const member = db.insert('members', blank('members', {
    fullName: 'Stretched Volunteer', status: 'member', ministries: ['Worship', 'Youth', 'Ushering'],
  }));
  db.insert('eventTasks', blank('eventTasks', {
    eventId: 'e1', title: 'Overdue one', ownerId: member.id, done: false,
    dueDate: isoDate(addDays(now, -5)), createdAt: isoDate(addDays(now, -10)),
  }));
  db.insert('eventTasks', blank('eventTasks', {
    eventId: 'e1', title: 'Overdue two', ownerId: member.id, done: false,
    dueDate: isoDate(addDays(now, -3)), createdAt: isoDate(addDays(now, -10)),
  }));

  const wellBeing = volunteerWellBeing(db, { now });
  const entry = wellBeing.find((v) => v.memberId === member.id);
  assert.equal(entry.ministryCount, 3);
  assert.equal(entry.overdueTasks, 2);
  assert.ok(entry.score < 70, `expected a stretched volunteer to score under 70, got ${entry.score}`);
});

test('volunteerWellBeing only includes members recorded as serving somewhere', async () => {
  const db = await tenantDb();
  db.insert('members', blank('members', { fullName: 'Not Serving', status: 'member' }));
  const wellBeing = volunteerWellBeing(db, { now: new Date() });
  assert.equal(wellBeing.length, 0);
});

/* ── pastoral care centre ─────────────────────────────────────────────────── */

test('pastoralCareOverview groups open care by assignee and counts overdue', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  const member = db.insert('members', blank('members', { fullName: 'Care Recipient', status: 'member' }));
  db.insert('care', blank('care', {
    memberId: member.id, summary: 'Follow up', assignedTo: 'u-elder1', dueDate: isoDate(addDays(now, -2)),
  }));
  db.insert('care', blank('care', { memberId: member.id, summary: 'Visit', assignedTo: 'u-elder1' }));
  db.insert('care', blank('care', { memberId: member.id, summary: 'Call', assignedTo: 'u-elder2' }));
  db.insert('care', blank('care', {
    memberId: member.id, summary: 'Already handled', assignedTo: 'u-elder2', completedAt: now.toISOString(),
  }));

  const overview = pastoralCareOverview(db, { now });
  assert.equal(overview.openCount, 3, 'the completed item is excluded');
  assert.equal(overview.overdueCount, 1);
  const elder1 = overview.caseload.find((c) => c.assignedTo === 'u-elder1');
  const elder2 = overview.caseload.find((c) => c.assignedTo === 'u-elder2');
  assert.equal(elder1.open, 2);
  assert.equal(elder1.overdue, 1);
  assert.equal(elder2.open, 1);
  assert.equal(elder2.overdue, 0);
});

test('pastoralCareOverview surfaces priority members by longest since contact, and whether a follow-up is already open', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  const longQuiet = db.insert('members', blank('members', { fullName: 'Long Quiet', status: 'member', careLevel: 'priority' }));
  const recentlySeen = db.insert('members', blank('members', { fullName: 'Recently Seen', status: 'member', careLevel: 'priority' }));
  db.insert('care', blank('care', {
    memberId: longQuiet.id, summary: 'Old visit', completedAt: isoDate(addDays(now, -60)), createdAt: isoDate(addDays(now, -60)),
  }));
  db.insert('care', blank('care', {
    memberId: recentlySeen.id, summary: 'Recent visit', completedAt: isoDate(addDays(now, -2)), createdAt: isoDate(addDays(now, -2)),
  }));

  const overview = pastoralCareOverview(db, { now });
  assert.equal(overview.priorityMembers[0].memberId, longQuiet.id, 'longest-quiet priority member surfaces first');
  assert.equal(overview.priorityMembers[0].hasOpenCare, false);
  assert.equal(overview.priorityMembers[1].memberId, recentlySeen.id);
});

test('pastoralCareOverview flags a quietly-absent member only when no one has already started a follow-up', async () => {
  const db = await tenantDb();
  const now = new Date('2026-06-01T09:00:00');
  const noFollowUp = db.insert('members', blank('members', { fullName: 'Absent No FollowUp', status: 'member' }));
  const withFollowUp = db.insert('members', blank('members', { fullName: 'Absent With FollowUp', status: 'member' }));
  db.insert('care', blank('care', { memberId: withFollowUp.id, summary: 'Reaching out' }));

  const overview = pastoralCareOverview(db, { now });
  assert.ok(overview.absentWithoutFollowUp.includes(noFollowUp.id));
  assert.ok(!overview.absentWithoutFollowUp.includes(withFollowUp.id));
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
