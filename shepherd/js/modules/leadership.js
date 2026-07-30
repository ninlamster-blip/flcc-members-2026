/**
 * Leadership hub — committees, meetings, action items, decisions, goals, and
 * the wider leadership operating system: ministry workspaces, the annual
 * worship service schedule, a leader's own task list, computed ministry
 * health, the leadership directory, annual planning, and a permission-
 * filtered activity timeline.
 *
 * The thing churches lose is not the minutes; it is *why* something was
 * decided, and what was supposed to happen next. So the decision log is a
 * first-class record with its own rationale and review date, and action items
 * carry an owner and a due date out of the meeting they came from.
 *
 * A meeting can be marked leadership-only, in which case its minutes are
 * hidden from anyone without leadership permission.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, table, list, listItem, emptyState, badge, segmented, statCard, avatar,
  toast, aiOutput, progress, barChart, searchField, modal, field, textarea, select, input, tagInput, formModal,
} from '../core/ui.js';
import { formatDate, formatDateTime, formatMoney, formatDateParts, relativeTime, isoDate, daysBetween } from '../core/format.js';
import { COLLECTIONS, SERVICE_TYPES } from '../core/schema.js';
import {
  openRecordModal, newButton, statusBadge, memberName, matches, sentence, deleteRecord, healthTone,
  refOptions, friendly, refLabel,
} from './_shared.js';
import {
  ministryHealthScore, ministryHealthTrend, churchHealthOverview, successionRisk, volunteerWellBeing,
  pastoralCareOverview, suggestForRole, SERVICE_ROLE_FIELDS, serviceAssignees, SERVICE_TEMPLATES,
  EMCEE_RESPONSIBILITIES, serviceReadiness,
} from '../core/ai.js';
import {
  canAccessMinistryWorkspace, canWriteActionItem, ledMinistries, isCommunionScheduled, canAccessJournalEntry,
} from '../core/policies.js';
import { roleLabel } from '../core/rbac.js';
import { downloadCSV, downloadExcel, printReport } from '../core/exporters.js';

const MEETING_FIELDS = ['title', 'date', 'committeeId', 'attendees', 'agenda', 'minutes', 'confidential'];
const PLAN_FIELDS = ['ministryId', 'year', 'title', 'vision', 'objectives', 'kpis', 'budget', 'volunteerNeeds', 'status'];
const TASK_FIELDS = ['title', 'detail', 'dueDate', 'ministryId'];

export async function render(ctx, route) {
  if (route.params[0]) {
    const meeting = ctx.db.find('meetings', route.params[0]);
    if (meeting) return meetingDetail(ctx, meeting);
  }
  const tab = route.query.tab || 'meetings';
  const { db } = ctx;

  const openActions = db.where('actionItems', (a) => a.status === 'open' || a.status === 'in-progress');
  const overdue = openActions.filter((a) => a.dueDate && new Date(a.dueDate) < new Date());

  const body = h('div');
  body.appendChild(
    tab === 'actions' ? actionsTab(ctx)
      : tab === 'decisions' ? decisionsTab(ctx)
      : tab === 'goals' ? goalsTab(ctx)
      : tab === 'committees' ? committeesTab(ctx)
      : tab === 'workspaces' ? workspacesTab(ctx, route)
      : tab === 'schedule' ? scheduleTab(ctx, route)
      : tab === 'tasks' ? tasksTab(ctx)
      : tab === 'health' ? healthTab(ctx)
      : tab === 'churchhealth' ? churchHealthTab(ctx)
      : tab === 'succession' ? successionTab(ctx)
      : tab === 'wellbeing' ? wellBeingTab(ctx)
      : tab === 'care' ? careCenterTab(ctx)
      : tab === 'journal' ? journalTab(ctx)
      : tab === 'directory' ? directoryTab(ctx)
      : tab === 'planner' ? plannerTab(ctx)
      : tab === 'timeline' ? timelineTab(ctx)
      : meetingsTab(ctx),
  );

  return page({
    title: 'Leadership',
    subtitle: 'Every ministry, its people, its plan, and its part in Sunday.',
    actions: [
      tab === 'schedule'
        ? newButton(ctx, 'worship', 'New service', () => openServiceModal(ctx, {}))
        : tab === 'planner'
          ? (canPlanAnything(ctx)
            ? h('button.btn.btn--primary', { onClick: () => openRecordModal(ctx, { collection: 'annualPlans', fields: PLAN_FIELDS, defaults: { year: new Date().getFullYear() } }) }, icon('plus', { size: 16 }), 'New plan')
            : null)
          : tab === 'tasks'
            ? (ctx.user.memberId
              ? h('button.btn.btn--primary', {
                onClick: () => openRecordModal(ctx, {
                  collection: 'actionItems', fields: TASK_FIELDS, defaults: { ownerId: ctx.user.memberId, status: 'open' },
                }),
              }, icon('plus', { size: 16 }), 'New task')
              : null)
            : ['journal', 'health', 'churchhealth', 'succession', 'wellbeing', 'care', 'directory', 'timeline'].includes(tab)
              ? null
              : newButton(ctx, 'leadership', 'New meeting', () => openRecordModal(ctx, { collection: 'meetings', fields: MEETING_FIELDS })),
    ].filter(Boolean),
    children: [
      h('div.grid.grid--4', { style: { marginBottom: '18px' } },
        statCard({ value: db.all('meetings').length, label: 'Meetings recorded' }),
        statCard({ value: openActions.length, label: 'Open actions' }),
        statCard({ value: overdue.length, label: 'Overdue' }),
        statCard({ value: db.all('decisions').length, label: 'Decisions logged' })),
      h('div', { style: { marginBottom: '18px', overflowX: 'auto', paddingBottom: '4px' } },
        segmented({
          options: [
            { value: 'meetings', label: 'Meetings' },
            { value: 'actions', label: `Actions (${openActions.length})` },
            { value: 'decisions', label: 'Decisions' },
            { value: 'goals', label: 'Goals' },
            { value: 'committees', label: 'Committees' },
            { value: 'workspaces', label: 'Ministry Workspaces' },
            { value: 'schedule', label: 'Worship Schedule' },
            { value: 'tasks', label: 'My Tasks' },
            { value: 'health', label: 'Ministry Health' },
            { value: 'churchhealth', label: 'Church Health' },
            { value: 'succession', label: 'Succession' },
            { value: 'wellbeing', label: 'Volunteer Well-Being' },
            { value: 'care', label: 'Care Center' },
            { value: 'journal', label: 'Journal' },
            { value: 'directory', label: 'Directory' },
            { value: 'planner', label: 'Annual Planner' },
            { value: 'timeline', label: 'Timeline' },
          ],
          value: tab,
          onChange: (value) => ctx.navigate(`/leadership?tab=${value}`),
        })),
      body,
    ],
  });
}

/* ── meetings ────────────────────────────────────────────────────────────── */

function meetingsTab(ctx) {
  const { db } = ctx;
  let query = '';
  const results = h('div');

  const draw = () => {
    const meetings = db.all('meetings')
      .filter((m) => matches(m, query, ['title', 'agenda', 'minutes', 'summary']))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    results.textContent = '';
    results.appendChild(meetings.length
      ? table({
        columns: [
          {
            label: 'Meeting',
            render: (meeting) => h('div', null,
              h('div', { style: { fontWeight: '500' } }, meeting.title),
              h('div.tiny.subtle', meeting.committeeId ? (db.find('committees', meeting.committeeId) || {}).name || '' : '')),
          },
          { label: 'Date', value: (meeting) => formatDate(meeting.date) },
          { label: 'Present', numeric: true, value: (meeting) => (meeting.attendees || []).length },
          {
            label: 'Actions',
            render: (meeting) => {
              const actions = db.where('actionItems', (a) => a.meetingId === meeting.id);
              const done = actions.filter((a) => a.status === 'done').length;
              return actions.length ? badge(`${done}/${actions.length}`, done === actions.length ? 'ok' : 'warn') : h('span.subtle', '—');
            },
          },
          { label: '', render: (meeting) => (meeting.confidential ? badge('Leaders only', 'warn') : null) },
        ],
        rows: meetings,
        onRowClick: (meeting) => ctx.navigate(`/leadership/${meeting.id}`),
      })
      : emptyState({
        title: 'No meetings recorded',
        detail: 'Minutes here are searchable — and the knowledge centre can answer questions from them later.',
        iconName: 'shield',
        action: newButton(ctx, 'leadership', 'New meeting', () => openRecordModal(ctx, { collection: 'meetings', fields: MEETING_FIELDS })),
      }));
  };

  const wrap = h('div.stack',
    searchField({ placeholder: 'Search minutes and agendas…', onInput: (value) => { query = value; draw(); } }),
    results);
  draw();
  return wrap;
}

function meetingDetail(ctx, meeting) {
  const { db } = ctx;
  const committee = meeting.committeeId ? db.find('committees', meeting.committeeId) : null;
  const actions = db.where('actionItems', (a) => a.meetingId === meeting.id);
  const decisions = db.where('decisions', (d) => d.meetingId === meeting.id);
  const summaryHost = h('div');

  const header = card({
    children: [
      h('div.row.row--wrap',
        h('div', { style: { flex: '1', minWidth: '220px' } },
          h('h2', meeting.title),
          h('p.muted', [formatDateTime(meeting.date), committee ? committee.name : null].filter(Boolean).join(' · ')),
          meeting.confidential ? h('div', { style: { marginTop: '8px' } }, badge('Leadership only', 'warn')) : null),
        ctx.can('leadership:write')
          ? h('button.btn.btn--primary', { onClick: () => openRecordModal(ctx, { collection: 'meetings', doc: meeting, fields: MEETING_FIELDS }) }, icon('edit', { size: 15 }), 'Edit')
          : null),
      (meeting.attendees || []).length
        ? h('div', { style: { marginTop: '14px' } },
          h('p.eyebrow', `Present (${meeting.attendees.length})`),
          h('div.chip-list', ...meeting.attendees.map((id) => h('span.chip', memberName(db, id)))))
        : null,
    ],
  });

  const minutesCard = card({
    title: 'Minutes',
    actions: [ctx.can('assistant:read') && meeting.minutes
      ? h('button.btn.btn--sm', { onClick: () => summarise(ctx, meeting, summaryHost) }, icon('sparkles', { size: 14 }), 'Summarise')
      : null].filter(Boolean),
    children: [
      meeting.agenda ? h('div', { style: { marginBottom: '16px' } }, h('p.eyebrow', 'Agenda'), h('div.prose.small', meeting.agenda)) : null,
      meeting.minutes ? h('div.prose', meeting.minutes) : h('p.small.muted', 'No minutes recorded yet.'),
      meeting.summary ? h('div.panel', { style: { marginTop: '16px' } },
        h('div.row', h('p.eyebrow', 'Summary'), meeting.aiGenerated ? badge('AI drafted', 'ai') : null),
        h('div.prose.small', meeting.summary)) : null,
      summaryHost,
    ],
  });

  const actionsCard = card({
    title: 'Action items',
    actions: [ctx.can('leadership:write')
      ? h('button.btn.btn--sm', {
        onClick: () => openRecordModal(ctx, { collection: 'actionItems', defaults: { meetingId: meeting.id }, hidden: ['meetingId'] }),
      }, icon('plus', { size: 14 }), 'Add')
      : null].filter(Boolean),
    children: [actions.length
      ? list(actions.map((action) => actionRow(ctx, action)))
      : h('p.small.muted', 'None recorded. An action without an owner and a date is a wish.')],
  });

  const decisionsCard = card({
    title: 'Decisions',
    actions: [ctx.can('leadership:write')
      ? h('button.btn.btn--sm', {
        onClick: () => openRecordModal(ctx, { collection: 'decisions', defaults: { meetingId: meeting.id, date: isoDate(meeting.date) }, hidden: ['meetingId'] }),
      }, icon('plus', { size: 14 }), 'Log a decision')
      : null].filter(Boolean),
    children: [decisions.length
      ? h('div.stack.stack--sm', ...decisions.map((decision) => h('div.panel',
        h('strong.small', decision.title),
        h('p.small', { style: { marginTop: '4px' } }, decision.decision),
        decision.rationale ? h('p.tiny.muted', { style: { marginTop: '4px' } }, `Why: ${decision.rationale}`) : null)))
      : h('p.small.muted', 'Nothing decided, or nothing recorded — the second is the expensive one.')],
  });

  return page({
    eyebrow: 'Leadership',
    title: meeting.title,
    actions: [
      h('button.btn', { onClick: () => ctx.navigate('/leadership') }, icon('arrowLeft', { size: 15 }), 'Meetings'),
      h('button.btn.no-print', { onClick: () => window.print() }, icon('file', { size: 15 }), 'Print'),
      ctx.can('leadership:delete')
        ? h('button.btn.btn--danger', {
          onClick: async () => { if (await deleteRecord(ctx, 'meetings', meeting.id, meeting.title)) ctx.navigate('/leadership'); },
        }, icon('trash', { size: 15 }))
        : null,
    ].filter(Boolean),
    children: [h('div.stack', header,
      h('div.grid.grid--main-side',
        h('div.stack', minutesCard),
        h('div.stack', actionsCard, decisionsCard)))],
  });
}

async function summarise(ctx, meeting, host) {
  host.textContent = '';
  host.appendChild(h('p.small.muted', { style: { marginTop: '14px' } }, 'Working…'));
  const result = await ctx.assistant.run('meeting.summary', { minutes: meeting.minutes, churchName: ctx.tenant.name });
  host.textContent = '';
  host.appendChild(h('div', { style: { marginTop: '16px' } }, aiOutput({
    result,
    actions: [ctx.can('leadership:write') ? h('button.btn.btn--sm', {
      onClick: async () => {
        ctx.db.update('meetings', meeting.id, { summary: result.text, aiGenerated: true });
        await ctx.db.flush();
        toast('Saved to the meeting, labelled as an AI draft.', { variant: 'ok' });
        ctx.refresh();
      },
    }, 'Save to meeting') : null].filter(Boolean),
  })));
}

/* ── actions ─────────────────────────────────────────────────────────────── */

function actionRow(ctx, action) {
  const { db } = ctx;
  const overdue = action.dueDate && new Date(action.dueDate) < new Date() && action.status !== 'done';
  // Full leadership can edit any action item; otherwise the same scoped rule
  // the database itself enforces — your own ministry's, or your own assignment.
  const mayWrite = ctx.can('leadership:write') || canWriteActionItem(ctx.user, action, db);
  return h('div.list__item',
    h('input', {
      type: 'checkbox',
      checked: action.status === 'done',
      'aria-label': `Mark "${action.title}" done`,
      disabled: !mayWrite,
      onChange: async (e) => {
        ctx.db.update('actionItems', action.id, { status: e.target.checked ? 'done' : 'open' });
        await ctx.db.flush();
        ctx.refresh();
      },
    }),
    h('div.list__body',
      h('div.list__title', { style: action.status === 'done' ? { textDecoration: 'line-through', opacity: '.6' } : {} }, action.title),
      h('div.list__meta', [
        action.ownerId ? memberName(db, action.ownerId) : 'no owner',
        action.dueDate ? `due ${formatDate(action.dueDate)}` : 'no date',
      ].join(' · '))),
    overdue ? badge('Overdue', 'danger') : statusBadge(action.status),
    mayWrite
      ? h('button.icon-btn', { 'aria-label': 'Edit', onClick: () => openRecordModal(ctx, { collection: 'actionItems', doc: action }) }, icon('edit', { size: 15 }))
      : null);
}

function actionsTab(ctx) {
  const { db } = ctx;
  const actions = db.all('actionItems');
  const open = actions.filter((a) => a.status === 'open' || a.status === 'in-progress');
  const done = actions.filter((a) => a.status === 'done');

  const byOwner = new Map();
  for (const action of open) {
    const key = action.ownerId || 'unassigned';
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push(action);
  }

  return h('div.stack',
    h('div.row.row--end', newButton(ctx, 'leadership', 'New action', () => openRecordModal(ctx, { collection: 'actionItems' }))),
    open.length
      ? h('div.grid.grid--2', ...[...byOwner].map(([ownerId, items]) => card({
        tight: true,
        children: [
          h('div.row', { style: { marginBottom: '10px' } },
            ownerId === 'unassigned' ? icon('alert', { size: 18 }) : avatar(memberName(db, ownerId), { size: 'sm' }),
            h('strong', ownerId === 'unassigned' ? 'Unassigned' : memberName(db, ownerId)),
            h('div.spacer'),
            badge(`${items.length}`)),
          list(items.map((action) => actionRow(ctx, action))),
        ],
      })))
      : emptyState({ title: 'No open actions', detail: 'Everything from the last meetings is closed.', iconName: 'check' }),
    done.length ? card({
      title: 'Recently completed',
      children: [list(done.slice(-8).reverse().map((action) => listItem({
        leading: icon('check', { size: 16 }),
        title: action.title,
        meta: `${action.ownerId ? memberName(db, action.ownerId) : 'unassigned'} · ${relativeTime(action.updatedAt)}`,
      })))],
    }) : null);
}

/* ── decisions ───────────────────────────────────────────────────────────── */

function decisionsTab(ctx) {
  const { db } = ctx;
  let query = '';
  const results = h('div');

  const draw = () => {
    const decisions = db.all('decisions')
      .filter((d) => matches(d, query, ['title', 'decision', 'rationale', 'area']))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    results.textContent = '';
    results.appendChild(decisions.length
      ? h('div.timeline', ...decisions.map((decision) => h('div.timeline__item.timeline__item--accent',
        h('div.row.row--between',
          h('strong', decision.title),
          h('span.tiny.subtle', formatDate(decision.date))),
        h('p.small', { style: { marginTop: '4px' } }, decision.decision),
        decision.rationale ? h('p.small.muted', { style: { marginTop: '4px' } }, `Why: ${decision.rationale}`) : null,
        h('div.row', { style: { marginTop: '6px', gap: '6px' } },
          decision.area ? badge(decision.area) : null,
          decision.reviewOn ? badge(`Review ${formatDate(decision.reviewOn)}`, new Date(decision.reviewOn) < new Date() ? 'warn' : '') : null,
          decision.meetingId ? h('button.btn.btn--sm.btn--ghost', { onClick: () => ctx.navigate(`/leadership/${decision.meetingId}`) }, 'Meeting') : null,
          ctx.can('leadership:write')
            ? h('button.btn.btn--sm.btn--ghost', { onClick: () => openRecordModal(ctx, { collection: 'decisions', doc: decision }) }, 'Edit')
            : null))))
      : emptyState({
        title: 'No decisions logged',
        detail: 'Record what was decided and why. In two years, the "why" is the part nobody remembers.',
        iconName: 'shield',
        action: newButton(ctx, 'leadership', 'Log a decision', () => openRecordModal(ctx, { collection: 'decisions' })),
      }));
  };

  const wrap = h('div.stack',
    h('div.row.row--wrap',
      h('div', { style: { flex: '1', minWidth: '220px' } },
        searchField({ placeholder: 'Search decisions…', onInput: (value) => { query = value; draw(); } })),
      newButton(ctx, 'leadership', 'Log a decision', () => openRecordModal(ctx, { collection: 'decisions' }))),
    results);
  draw();
  return wrap;
}

/* ── goals ───────────────────────────────────────────────────────────────── */

function goalsTab(ctx) {
  const { db } = ctx;
  const year = new Date().getFullYear();
  const goals = db.all('goals').sort((a, b) => (b.year || 0) - (a.year || 0));

  return h('div.stack',
    h('div.row.row--end', newButton(ctx, 'leadership', 'New goal', () => openRecordModal(ctx, { collection: 'goals', defaults: { year } }))),
    goals.length
      ? h('div.grid.grid--2', ...goals.map((goal) => card({
        title: goal.title,
        subtitle: [goal.year, goal.ownerId ? memberName(db, goal.ownerId) : null,
          goal.ministryId ? (db.find('ministries', goal.ministryId) || {}).name : null].filter(Boolean).join(' · '),
        actions: [statusBadge(goal.status)],
        children: [
          goal.detail ? h('p.small.muted', goal.detail) : null,
          h('div', { style: { marginTop: '12px' } },
            h('div.row.row--between.small',
              h('span.muted', 'Progress'),
              h('span.nums', `${goal.progress || 0}${goal.unit || ''} of ${goal.target || 100}${goal.unit || ''}`)),
            progress(goal.progress || 0, goal.target || 100)),
          ctx.can('leadership:write')
            ? h('div.row', { style: { marginTop: '12px' } },
              h('input.input', {
                type: 'number', style: { maxWidth: '110px' }, value: goal.progress || 0,
                'aria-label': 'Progress',
                onChange: async (e) => {
                  ctx.db.update('goals', goal.id, { progress: Number(e.target.value) });
                  await ctx.db.flush();
                  ctx.refresh();
                },
              }),
              h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'goals', doc: goal }) }, 'Edit'))
            : null,
        ],
      })))
      : emptyState({
        title: 'No goals set',
        detail: 'Two or three goals a church can actually name beats twelve nobody remembers.',
        iconName: 'chart',
        action: newButton(ctx, 'leadership', 'New goal', () => openRecordModal(ctx, { collection: 'goals', defaults: { year } })),
      }));
}

/* ── committees ──────────────────────────────────────────────────────────── */

function committeesTab(ctx) {
  const { db } = ctx;
  const committees = db.all('committees');
  return h('div.stack',
    h('div.row.row--end', newButton(ctx, 'leadership', 'New committee', () => openRecordModal(ctx, { collection: 'committees' }))),
    committees.length
      ? h('div.grid.grid--2', ...committees.map((committee) => {
        const meetings = db.where('meetings', (m) => m.committeeId === committee.id)
          .sort((a, b) => new Date(b.date) - new Date(a.date));
        return card({
          title: committee.name,
          subtitle: committee.cadence,
          children: [
            committee.mandate ? h('p.small.muted', committee.mandate) : null,
            committee.chairId ? h('p.small', { style: { marginTop: '8px' } }, `Chair: ${memberName(db, committee.chairId)}`) : null,
            h('div.chip-list', { style: { marginTop: '10px' } },
              ...(committee.memberIds || []).map((id) => h('span.chip', memberName(db, id)))),
            meetings.length ? h('p.tiny.subtle', { style: { marginTop: '10px' } },
              `Last met ${formatDate(meetings[0].date)} · ${meetings.length} meetings recorded`) : null,
            ctx.can('leadership:write')
              ? h('div.row', { style: { marginTop: '12px' } },
                h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'committees', doc: committee }) }, 'Edit'),
                h('button.btn.btn--sm', {
                  onClick: () => openRecordModal(ctx, {
                    collection: 'meetings',
                    fields: MEETING_FIELDS,
                    defaults: { committeeId: committee.id, attendees: committee.memberIds || [] },
                  }),
                }, icon('plus', { size: 14 }), 'Meeting'))
              : null,
          ],
        });
      }))
      : emptyState({
        title: 'No committees',
        detail: 'A committee groups its meetings, its members and its mandate.',
        iconName: 'shield',
      }));
}

/* ── ministry workspaces ─────────────────────────────────────────────────── */

function workspacesTab(ctx, route) {
  const { db } = ctx;

  if (route.query.ministry) {
    const ministry = db.find('ministries', route.query.ministry);
    if (!ministry) return emptyState({ title: 'Ministry not found', iconName: 'shield' });
    if (!canAccessMinistryWorkspace(ctx.user, ministry)) {
      return emptyState({
        title: 'Not your workspace',
        detail: `Only ${ministry.name}'s lead, and church-wide leadership, can open this. If that should be you, ask an administrator to set you as its lead in People → Ministries and link your account to your member profile in Settings → Users.`,
        iconName: 'lock',
      });
    }
    return ministryWorkspaceDetail(ctx, ministry);
  }

  const ministries = db.all('ministries');
  if (!ministries.length) {
    return emptyState({ title: 'No ministries recorded', detail: 'Add one from People → Ministries first.', iconName: 'shield' });
  }

  return h('div.grid.grid--3', ...ministries.map((ministry) => {
    const health = ministryHealthScore(db, ministry);
    const serving = db.where('members', (m) => !m.archived && (m.ministries || []).includes(ministry.name));
    const accessible = canAccessMinistryWorkspace(ctx.user, ministry);
    return card({
      tight: true,
      children: [
        h('div.row.row--between',
          h('strong', ministry.name),
          badge(`${health.score}%`, healthTone(health.score))),
        h('p.small.muted', { style: { marginTop: '4px' } }, ministry.purpose || ''),
        h('p.tiny.subtle', { style: { marginTop: '8px' } },
          `${serving.length} serving${ministry.leadId ? ` · led by ${memberName(db, ministry.leadId)}` : ' · no lead assigned'}`),
        h('div.row', { style: { marginTop: '10px' } },
          accessible
            ? h('button.btn.btn--sm.btn--primary', { onClick: () => ctx.navigate(`/leadership?tab=workspaces&ministry=${ministry.id}`) }, 'Open workspace')
            : badge('Lead only', 'warn')),
      ],
    });
  }));
}

function ministryWorkspaceDetail(ctx, ministry) {
  const { db } = ctx;
  const health = ministryHealthScore(db, ministry);
  const serving = db.where('members', (m) => !m.archived && (m.ministries || []).includes(ministry.name));
  const year = new Date().getFullYear();
  const plan = db.first('annualPlans', (p) => p.ministryId === ministry.id && p.year === year);
  const tasks = db.all('eventTasks').filter((t) => serving.some((m) => m.id === t.ownerId))
    .concat(db.where('actionItems', (a) => a.ministryId === ministry.id));
  const openTasks = tasks.filter((t) => !t.done && t.status !== 'done');
  const docs = db.where('documents', (d) => (d.tags || []).some((tag) => String(tag).toLowerCase() === ministry.name.toLowerCase()));
  const spend = ctx.can('finance:read')
    ? db.where('transactions', (t) => t.kind === 'expense' && t.department === ministry.name && new Date(t.date).getFullYear() === year)
      .reduce((total, t) => total + Number(t.amount || 0), 0)
    : null;

  const header = card({
    children: [h('div.row.row--wrap',
      h('div', { style: { flex: '1', minWidth: '220px' } },
        h('h2', ministry.name),
        ministry.purpose ? h('p.muted', ministry.purpose) : null,
        h('div.row', { style: { marginTop: '8px', gap: '6px', flexWrap: 'wrap' } },
          badge(`${health.score}% ${health.rating}`, healthTone(health.score)),
          ministry.leadId ? badge(`Led by ${memberName(db, ministry.leadId)}`) : badge('No lead assigned', 'warn'),
          ministry.meetingDay ? badge(ministry.meetingDay) : null)),
      ctx.can('members:write')
        ? h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'ministries', doc: ministry }) }, icon('edit', { size: 14 }), 'Edit ministry')
        : null)],
  });

  const rosterCard = card({
    title: 'Members serving',
    subtitle: `${serving.length}${ministry.minVolunteers ? ` of ${ministry.minVolunteers} needed` : ''}`,
    children: [serving.length
      ? list(serving.map((m) => listItem({
        leading: avatar(m.fullName, { size: 'sm' }), title: m.fullName, meta: m.area || '',
        onClick: () => ctx.navigate(`/members/${m.id}`),
      })))
      : emptyState({ title: 'Nobody recorded yet', detail: 'Set this ministry on a member\'s profile in People.', iconName: 'users' })],
  });

  const canManage = canAccessMinistryWorkspace(ctx.user, ministry);
  const tasksCard = card({
    title: 'Tasks',
    subtitle: `${openTasks.length} open`,
    actions: [canManage
      ? h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'actionItems', defaults: { ministryId: ministry.id }, hidden: ['ministryId'] }) }, icon('plus', { size: 14 }), 'Add')
      : null].filter(Boolean),
    children: [openTasks.length
      ? list(openTasks.slice(0, 8).map((t) => listItem({ title: t.title, meta: t.dueDate ? `due ${formatDate(t.dueDate)}` : 'no date' })))
      : emptyState({ title: 'Nothing open', iconName: 'check' })],
  });

  const planCard = card({
    title: `${year} plan`,
    actions: [canManage
      ? h('button.btn.btn--sm', {
        onClick: () => openRecordModal(ctx, {
          collection: 'annualPlans', doc: plan, fields: PLAN_FIELDS,
          defaults: { ministryId: ministry.id, year }, hidden: plan ? [] : [],
        }),
      }, plan ? 'Edit' : 'Create')
      : null].filter(Boolean),
    children: [plan
      ? h('div.stack.stack--sm',
        plan.vision ? h('p.small', plan.vision) : null,
        (plan.objectives || []).length ? h('div', null, h('p.eyebrow', 'Objectives'), h('div.chip-list', ...plan.objectives.map((o) => h('span.chip', o)))) : null,
        plan.budget ? h('p.small.muted', `Budget: ${formatMoney(plan.budget)}`) : null)
      : h('p.small.muted', `No ${year} plan yet. Vision, objectives, KPIs and budget for this ministry belong here — see the Annual Planner tab.`)],
  });

  const docsCard = card({
    title: 'Documents',
    subtitle: 'Tagged with this ministry\'s name in the vault',
    children: [docs.length
      ? list(docs.map((d) => listItem({ title: d.title, meta: sentence(d.category), onClick: () => ctx.navigate(`/documents/${d.id}`) })))
      : h('p.small.muted', `Tag a document "${ministry.name}" in the document vault to see it here.`)],
  });

  const linksCard = card({
    title: 'Elsewhere',
    subtitle: 'Budget, calendar, announcements and prayer live in their own modules',
    children: [h('div.row.row--wrap',
      spend !== null ? h('button.btn.btn--sm', { onClick: () => ctx.navigate('/finance?tab=expenses') }, `${formatMoney(spend)} spent in ${year}`) : null,
      ctx.can('events:read') ? h('button.btn.btn--sm', { onClick: () => ctx.navigate('/events') }, icon('calendar', { size: 14 }), 'Calendar') : null,
      ctx.can('communications:read') ? h('button.btn.btn--sm', { onClick: () => ctx.navigate('/communications') }, icon('megaphone', { size: 14 }), 'Announcements') : null,
      ctx.can('prayer:read') ? h('button.btn.btn--sm', { onClick: () => ctx.navigate('/prayer') }, icon('heart', { size: 14 }), 'Prayer requests') : null)],
  });

  return h('div.stack',
    h('button.btn.btn--sm', { onClick: () => ctx.navigate('/leadership?tab=workspaces') }, icon('arrowLeft', { size: 14 }), 'All workspaces'),
    header,
    h('div.grid.grid--main-side',
      h('div.stack', rosterCard, tasksCard),
      h('div.stack', planCard, docsCard, linksCard)));
}

/* ── annual worship service schedule ─────────────────────────────────────── */

function scheduleTab(ctx, route) {
  const { db } = ctx;
  const year = Number(route.query.year) || new Date().getFullYear();
  const view = route.query.view === 'calendar' ? 'calendar' : 'list';
  const records = db.where('serviceSchedule', (s) => new Date(s.date).getFullYear() === year)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const years = new Set(db.all('serviceSchedule').map((s) => new Date(s.date).getFullYear()));
  years.add(year);
  const yearList = [...years].sort((a, b) => b - a);

  return h('div.stack',
    h('div.row.row--wrap',
      h('select.select', {
        style: { maxWidth: '120px' }, 'aria-label': 'Year',
        onChange: (e) => ctx.navigate(`/leadership?tab=schedule&view=${view}&year=${e.target.value}`),
      }, ...yearList.map((y) => h('option', { value: y, selected: y === year }, String(y)))),
      segmented({
        options: [{ value: 'list', label: 'List' }, { value: 'calendar', label: 'Calendar' }],
        value: view,
        onChange: (v) => ctx.navigate(`/leadership?tab=schedule&view=${v}&year=${year}`),
      }),
      h('div.spacer'),
      records.length ? h('button.btn.btn--sm', { onClick: () => exportSchedule(ctx, records, 'excel') }, icon('download', { size: 14 }), 'Excel') : null,
      records.length ? h('button.btn.btn--sm', { onClick: () => exportSchedule(ctx, records, 'csv') }, icon('download', { size: 14 }), 'CSV') : null,
      records.length ? h('button.btn.btn--sm', { onClick: () => printSchedule(ctx, records, year) }, icon('file', { size: 14 }), 'Print / PDF') : null),
    !records.length
      ? emptyState({
        title: `No services scheduled in ${year}`,
        detail: 'Start from the Friday or Sunday template — the roles, order of service and communion schedule fill in for you.',
        iconName: 'calendar',
        action: newButton(ctx, 'worship', 'New service', () => openServiceModal(ctx, {})),
      })
      : view === 'calendar'
        ? scheduleCalendar(ctx, records, year)
        : h('div.stack.stack--sm', ...records.map((record) => serviceRow(ctx, record))));
}

/** A wall-calendar view of the year: one grid per month, each staffed service coloured by how complete its roster is. */
function scheduleCalendar(ctx, records, year) {
  const byDate = new Map();
  for (const record of records) {
    if (!byDate.has(record.date)) byDate.set(record.date, []);
    byDate.get(record.date).push(record);
  }
  return h('div.stack',
    h('div.cal-legend',
      h('span.small.muted', 'Fully staffed'), dotBadge('ok'),
      h('span.small.muted', 'Partly staffed'), dotBadge('warn'),
      h('span.small.muted', 'Nothing assigned'), dotBadge('danger')),
    h('div.cal-year', ...Array.from({ length: 12 }, (_, month) => monthGrid(ctx, year, month, byDate))));
}

function dotBadge(tone) {
  return h('span.cal-day__dot', { class: `cal-day--${tone}`, style: { width: '10px', height: '10px', borderRadius: '50%' } });
}

function monthGrid(ctx, year, month, byDate) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(h('div.cal-day.cal-day--empty'));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = isoDate(new Date(year, month, day));
    cells.push(dayCell(ctx, day, dateKey, byDate.get(dateKey) || []));
  }
  return h('div.cal-month',
    h('h3.cal-month__title', formatDateParts(new Date(year, month, 1), { month: 'long' })),
    h('div.cal-grid.cal-grid--head', ...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => h('span.cal-weekday', w))),
    h('div.cal-grid', ...cells));
}

function dayCell(ctx, day, dateKey, dayRecords) {
  if (!dayRecords.length) return h('div.cal-day', h('span', String(day)));
  const tone = staffingTone(dayRecords);
  const summary = dayRecords.map((r) => {
    const communion = isCommunionScheduled(r) ? ' · Communion' : '';
    return `${r.service}${r.theme ? ` — ${r.theme}` : ''}${r.preacherId ? ` · ${memberName(ctx.db, r.preacherId)}` : ''}${communion}`;
  }).join('\n');
  return h('button.cal-day.cal-day--has', {
    type: 'button',
    class: `cal-day--${tone}`,
    title: summary,
    'aria-label': `${dayRecords.length > 1 ? `${dayRecords.length} services` : dayRecords[0].service} on ${formatDate(dateKey)}`,
    onClick: () => openDayModal(ctx, dateKey, dayRecords),
  }, h('span', String(day)), h('span.cal-day__dot'));
}

/** Fully staffed only if every service that day fills every core role (see serviceReadiness). */
function staffingTone(dayRecords) {
  const readiness = dayRecords.map((r) => serviceReadiness(r));
  if (readiness.every((r) => r.filled >= r.total)) return 'ok';
  if (readiness.every((r) => r.filled === 0)) return 'danger';
  return 'warn';
}

function openDayModal(ctx, dateKey, dayRecords) {
  const ref = modal({
    title: formatDate(dateKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    body: h('div.stack.stack--sm', ...dayRecords.map((record) => serviceRow(ctx, record))),
    actions: [h('button.btn', { onClick: () => ref.close() }, 'Close')],
  });
}

function serviceRow(ctx, record) {
  const { db } = ctx;
  const attended = db.first('attendance', (a) => a.date === record.date && a.service === record.service);
  const communion = isCommunionScheduled(record);
  const readiness = serviceReadiness(record);
  // Emcee and communion minister carry auto-shown detail beneath the name; every other role is a plain chip.
  const DEDICATED_ROLES = ['presidingLeaderId', 'emceeId', 'pastoralPrayerId', 'communionMinisterId', 'childrenYouthLeaderId', 'childrenYouthAssistantId'];
  const chipRoles = SERVICE_ROLE_FIELDS.filter(([key]) => !DEDICATED_ROLES.includes(key) && record[key]);

  return card({
    tight: true,
    children: [
      h('div.row.row--between.row--wrap',
        h('div', null,
          h('div.row',
            h('strong', record.service),
            badge(sentence(record.serviceType || 'other'), 'accent'),
            statusBadge(record.status)),
          h('div.tiny.subtle', formatDate(record.date, { weekday: 'long', day: 'numeric', month: 'long' })),
          record.theme ? h('div.small', `${record.theme}${record.scripture ? ` — ${record.scripture}` : ''}`) : null),
        h('div.row.row--wrap',
          badge(attended ? 'Attendance recorded' : 'Attendance pending', attended ? 'ok' : 'warn'),
          badge(`${readiness.filled}/${readiness.total} roles filled`, readiness.filled >= readiness.total ? 'ok' : readiness.filled === 0 ? 'danger' : 'warn'),
          ctx.can('worship:write')
            ? h('button.btn.btn--sm', { onClick: () => suggestAssignments(ctx, record) }, icon('sparkles', { size: 14 }), 'Suggest')
            : null,
          ctx.can('worship:write')
            ? h('button.icon-btn', { 'aria-label': 'Edit', onClick: () => openServiceModal(ctx, { doc: record }) }, icon('edit', { size: 15 }))
            : null)),
      h('div.stack.stack--sm', { style: { marginTop: '10px' } },
        record.presidingLeaderId ? h('div.small', `Presiding: ${memberName(db, record.presidingLeaderId)}`) : null,
        record.emceeId ? h('div.small',
          `Emcee: ${memberName(db, record.emceeId)}`,
          h('div.tiny.subtle', `Responsibilities: ${EMCEE_RESPONSIBILITIES.join(' · ')}`)) : null,
        record.pastoralPrayerId ? h('div.small', `Pastoral prayer: ${memberName(db, record.pastoralPrayerId)}`) : null,
        communion ? h('div.small',
          h('span.badge.badge--accent', 'Communion'),
          ` ${record.communionMinisterId ? memberName(db, record.communionMinisterId) : 'no minister assigned yet'}`,
          record.communionNotes ? h('div.tiny.subtle', record.communionNotes) : null) : null,
        (record.childrenYouthLeaderId || record.childrenYouthAssistantId) ? h('div.small',
          `Children & Youth: ${memberName(db, record.childrenYouthLeaderId, 'no leader yet')}`
          + `${record.childrenYouthAssistantId ? ` (assist. ${memberName(db, record.childrenYouthAssistantId)})` : ''}`
          + `${record.childrenYouthClassroom ? ` · ${record.childrenYouthClassroom}` : ''}`
          + `${record.childrenYouthAttendance != null ? ` · ${record.childrenYouthAttendance} present` : ''}`) : null),
      h('div.chip-list', { style: { marginTop: '10px' } },
        ...chipRoles.map(([key, label]) => h('span.chip', `${label}: ${memberName(db, record[key])}`)),
        record.foodInCharge ? h('span.chip', `Food: ${record.foodInCharge}`) : null),
      !chipRoles.length && !record.foodInCharge && !record.presidingLeaderId && !record.emceeId ? h('p.small.muted', { style: { marginTop: '8px' } }, 'Nothing assigned yet.') : null,
    ],
  });
}

/** The smart assignment engine: least-recently-served, ministry-matched, conflict-checked. */
function suggestAssignments(ctx, record) {
  const communionApplies = isCommunionScheduled(record);
  const empty = SERVICE_ROLE_FIELDS.filter(([key]) => !record[key] && (key !== 'communionMinisterId' || communionApplies));
  if (!empty.length) {
    toast('Every named role on this service is already filled.');
    return;
  }
  const assigned = serviceAssignees(record);
  const rows = empty.map(([key, label]) => {
    const candidates = suggestForRole(ctx.db, { roleKey: key, date: record.date, alreadyAssigned: assigned });
    const pick = h('select.select', null,
      h('option', { value: '' }, 'Leave unassigned'),
      ...candidates.map(({ member, lastServed }) => h('option', { value: member.id },
        `${member.fullName}${lastServed ? ` — last served ${relativeTime(lastServed)}` : ' — has not served yet'}`)));
    return { key, pick, node: field({ label, control: pick }) };
  });

  const ref = modal({
    title: 'Suggested assignments',
    body: h('div.stack',
      h('p.small.muted', 'Whoever matches the ministry and served least recently is offered first — skipping anyone already on this service, or marked away.'),
      ...rows.map((r) => r.node)),
    actions: [
      h('button.btn', { onClick: () => ref.close() }, 'Cancel'),
      h('button.btn.btn--primary', {
        onClick: async () => {
          const patch = {};
          let count = 0;
          for (const { key, pick } of rows) {
            if (!pick.value) continue;
            patch[key] = pick.value;
            count += 1;
          }
          if (count) {
            ctx.db.update('serviceSchedule', record.id, patch);
            await ctx.db.flush();
          }
          toast(count ? `${count} assigned.` : 'Nothing assigned.', { variant: count ? 'ok' : '' });
          ref.close();
          ctx.refresh();
        },
      }, 'Assign'),
    ],
  });
}

function exportSchedule(ctx, records, format) {
  const columns = [
    { label: 'Date', value: (r) => r.date }, { label: 'Type', value: (r) => sentence(r.serviceType || 'other') },
    { label: 'Service', key: 'service' }, { label: 'Theme', key: 'theme' }, { label: 'Scripture', key: 'scripture' },
    { label: 'Communion', value: (r) => (isCommunionScheduled(r) ? 'Yes' : 'No') },
    ...SERVICE_ROLE_FIELDS.map(([key, label]) => ({ label, value: (r) => memberName(ctx.db, r[key], '') })),
    { label: 'Food in charge', key: 'foodInCharge' },
    { label: 'Status', key: 'status' },
  ];
  if (format === 'excel') downloadExcel(`${ctx.tenant.id}-worship-schedule.xls`, [{ name: 'Schedule', columns, rows: records }]);
  else downloadCSV(`${ctx.tenant.id}-worship-schedule.csv`, records, columns);
  ctx.db.log('export', `Exported the worship schedule (${records.length} services).`);
  toast('Exported.', { variant: 'ok' });
}

function printSchedule(ctx, records, year) {
  const tableNode = table({
    columns: [
      { label: 'Date', value: (r) => formatDate(r.date) }, { label: 'Service', key: 'service' },
      { label: 'Theme', key: 'theme' },
      { label: 'Preacher', value: (r) => memberName(ctx.db, r.preacherId, '') },
      { label: 'Worship & Song', value: (r) => memberName(ctx.db, r.worshipSongLeaderId, '') },
      { label: 'Emcee', value: (r) => memberName(ctx.db, r.emceeId, '') },
      { label: 'Pastoral prayer', value: (r) => memberName(ctx.db, r.pastoralPrayerId, '') },
      { label: 'Communion', value: (r) => (isCommunionScheduled(r) ? 'Yes' : 'No') },
      { label: 'Media', value: (r) => memberName(ctx.db, r.mediaId, '') },
      { label: 'Sound', value: (r) => memberName(ctx.db, r.soundId, '') },
      { label: 'Usher', value: (r) => memberName(ctx.db, r.usherId, '') },
      { label: 'Food in charge', key: 'foodInCharge' },
    ],
    rows: records,
  });
  printReport({ title: `${ctx.tenant.name} — worship schedule ${year}`, subtitle: `Prepared ${formatDate(new Date())}`, nodes: [tableNode] });
  ctx.db.log('export', `Printed the ${year} worship schedule.`);
}

/**
 * The worship service creator/editor — a purpose-built form rather than the
 * generic schema editor, because three things it needs are not generic:
 * a Friday/Sunday template that fills in the title, order of service and a
 * default communion checklist; a Communion section that shows itself only
 * when the date (or an explicit override) calls for it; and the Emcee's
 * responsibilities, which are shown, not assigned.
 */
function openServiceModal(ctx, { doc = null } = {}) {
  const { db } = ctx;
  const editing = !!doc;
  const source = doc || { date: isoDate(new Date()), serviceType: 'friday', communionOverride: 'auto', status: 'planning', ...SERVICE_TEMPLATES.friday };

  const memberOpts = refOptions(db, 'members');
  const refSelect = (value) => select({ options: memberOpts, value: value || '' });

  const roles = {
    preacherId: refSelect(source.preacherId),
    presidingLeaderId: refSelect(source.presidingLeaderId),
    worshipSongLeaderId: refSelect(source.worshipSongLeaderId),
    emceeId: refSelect(source.emceeId),
    pastoralPrayerId: refSelect(source.pastoralPrayerId),
    communionMinisterId: refSelect(source.communionMinisterId),
    childrenYouthLeaderId: refSelect(source.childrenYouthLeaderId),
    childrenYouthAssistantId: refSelect(source.childrenYouthAssistantId),
    mediaId: refSelect(source.mediaId),
    soundId: refSelect(source.soundId),
    usherId: refSelect(source.usherId),
    securityId: refSelect(source.securityId),
    hospitalityId: refSelect(source.hospitalityId),
    prayerTeamId: refSelect(source.prayerTeamId),
    parkingId: refSelect(source.parkingId),
    photographyId: refSelect(source.photographyId),
  };

  const serviceTypeSelect = select({ options: SERVICE_TYPES.map((t) => ({ value: t, label: sentence(t) })), value: source.serviceType || 'friday' });
  const dateInput = input({ type: 'date', value: source.date || isoDate(new Date()) });
  const titleInput = input({ value: source.service || '' });
  const themeInput = input({ value: source.theme || '' });
  const scriptureInput = input({ value: source.scripture || '' });
  const notesArea = textarea({ value: source.notes || '' });
  const orderInput = textarea({ value: source.orderOfService || '' });
  const rehearsalInput = input({ type: 'datetime-local', value: '' });
  const statusSelect = select({ options: ['planning', 'confirmed', 'completed', 'cancelled'].map((s) => ({ value: s, label: sentence(s) })), value: source.status || 'planning' });

  const communionOverrideSelect = select({
    options: [{ value: 'auto', label: 'Automatic' }, { value: 'yes', label: 'Force on' }, { value: 'no', label: 'Force off' }],
    value: source.communionOverride || 'auto',
  });
  const communionNotesArea = textarea({ value: source.communionNotes || '' });
  let communionChecklist = source.communionChecklist || [];
  const communionChecklistControl = tagInput({ value: communionChecklist, onChange: (next) => { communionChecklist = next; } });

  const childrenClassroomInput = input({ value: source.childrenYouthClassroom || '' });
  const childrenAttendanceInput = input({ type: 'number', value: source.childrenYouthAttendance ?? '' });
  const childrenLessonInput = input({ value: source.childrenYouthLesson || '' });
  const childrenNotesArea = textarea({ value: source.childrenYouthNotes || '' });
  const foodInChargeInput = input({ value: source.foodInCharge || '', placeholder: 'Often a family or a pair, not one person' });

  const communionDetail = h('div');
  const redrawCommunion = () => {
    communionDetail.textContent = '';
    if (isCommunionScheduled({ date: dateInput.value, communionOverride: communionOverrideSelect.value })) {
      communionDetail.appendChild(h('div.stack.stack--sm',
        field({ label: 'Assigned minister', control: roles.communionMinisterId }),
        field({ label: 'Preparation notes', control: communionNotesArea, full: true }),
        field({ label: 'Elements checklist', control: communionChecklistControl, full: true })));
    } else {
      communionDetail.appendChild(h('p.small.muted', 'Not scheduled for this date — set the override above to force it on for an exception.'));
    }
  };
  redrawCommunion();
  dateInput.addEventListener('input', redrawCommunion);
  communionOverrideSelect.addEventListener('change', redrawCommunion);

  const applyTemplate = (type) => {
    serviceTypeSelect.value = type;
    const tpl = SERVICE_TEMPLATES[type] || SERVICE_TEMPLATES.other;
    if (!titleInput.value || Object.values(SERVICE_TEMPLATES).some((t) => t.service === titleInput.value)) titleInput.value = tpl.service;
    if (!orderInput.value) orderInput.value = tpl.orderOfService;
    if (!communionChecklist.length) { communionChecklist = [...(tpl.communionChecklist || [])]; communionChecklistControl.value = communionChecklist.join(', '); }
    autofillSuggestions();
  };

  /** Smart default: whoever matches the role's ministry and served least recently, offered automatically rather than left blank. */
  const autofillSuggestions = () => {
    const date = dateInput.value;
    if (!date) return;
    const already = Object.values(roles).map((c) => c.value).filter(Boolean);
    for (const key of ['preacherId', 'presidingLeaderId', 'worshipSongLeaderId', 'emceeId', 'pastoralPrayerId', 'mediaId', 'soundId', 'usherId', 'securityId', 'hospitalityId', 'prayerTeamId', 'childrenYouthLeaderId', 'childrenYouthAssistantId']) {
      const control = roles[key];
      if (control.value) continue;
      const [top] = suggestForRole(db, { roleKey: key, date, alreadyAssigned: already });
      if (top) { control.value = top.member.id; already.push(top.member.id); }
    }
  };

  const section = (title, ...children) => h('div', { style: { marginTop: '18px' } }, h('p.eyebrow', title), ...children);

  const formNodes = [
    !editing ? h('div.row', { style: { marginBottom: '4px' } },
      h('span.small.muted', 'Start from a template:'),
      h('button.btn.btn--sm', { type: 'button', onClick: () => applyTemplate('friday') }, 'Friday'),
      h('button.btn.btn--sm', { type: 'button', onClick: () => applyTemplate('sunday') }, 'Sunday')) : null,

    section('General information',
      h('div.form-grid',
        field({ label: 'Service type', control: serviceTypeSelect }),
        field({ label: 'Date', control: dateInput }),
        field({ label: 'Service title', control: titleInput }),
        field({ label: 'Theme', control: themeInput }),
        field({ label: 'Scripture', control: scriptureInput }),
        field({ label: 'Preacher', control: roles.preacherId }),
        field({ label: 'Presiding leader', control: roles.presidingLeaderId }),
        field({ label: 'Status', control: statusSelect })),
      field({ label: 'Notes', control: notesArea, full: true })),

    section('Worship team',
      h('div.form-grid', field({ label: 'Worship & Song Leader', control: roles.worshipSongLeaderId }))),

    section('Emcee',
      h('div.form-grid',
        field({ label: 'Emcee', control: roles.emceeId }),
        field({ label: 'Pastoral prayer', control: roles.pastoralPrayerId, help: 'Only needed where this is its own named role, separate from the emcee.' })),
      h('p.tiny.subtle', `Emcee responsibilities: ${EMCEE_RESPONSIBILITIES.join(' · ')} — shown automatically, not assigned separately.`)),

    section('Communion',
      h('div.form-grid', field({ label: 'Communion', control: communionOverrideSelect, help: 'Automatic: the first Friday and first Sunday of each month.' })),
      communionDetail),

    section('Children & Youth',
      h('div.form-grid',
        field({ label: 'Leader', control: roles.childrenYouthLeaderId }),
        field({ label: 'Assistant', control: roles.childrenYouthAssistantId }),
        field({ label: 'Classroom', control: childrenClassroomInput }),
        field({ label: 'Attendance', control: childrenAttendanceInput }),
        field({ label: 'Lesson', control: childrenLessonInput })),
      field({ label: 'Notes', control: childrenNotesArea, full: true })),

    section('Additional roles',
      h('div.form-grid',
        field({ label: 'Media', control: roles.mediaId }),
        field({ label: 'Sound', control: roles.soundId }),
        field({ label: 'Usher', control: roles.usherId }),
        field({ label: 'Security', control: roles.securityId }),
        field({ label: 'Hospitality', control: roles.hospitalityId }),
        field({ label: 'Prayer team', control: roles.prayerTeamId }),
        field({ label: 'Parking (optional)', control: roles.parkingId }),
        field({ label: 'Photography (optional)', control: roles.photographyId }),
        field({ label: 'Food in charge', control: foodInChargeInput }))),

    section('Planning',
      h('div.form-grid',
        field({ label: 'Rehearsal / practice', control: rehearsalInput }),
        field({ label: 'Order of service', control: orderInput, full: true }))),
  ].filter(Boolean);

  return formModal({
    title: editing ? 'Edit service' : 'New service',
    submitLabel: editing ? 'Save changes' : 'Create',
    wide: true,
    fields: formNodes,
    onSubmit: async () => {
      const patch = {
        date: dateInput.value,
        serviceType: serviceTypeSelect.value,
        service: titleInput.value,
        theme: themeInput.value,
        scripture: scriptureInput.value,
        preacherId: roles.preacherId.value || null,
        presidingLeaderId: roles.presidingLeaderId.value || null,
        notes: notesArea.value,
        worshipSongLeaderId: roles.worshipSongLeaderId.value || null,
        emceeId: roles.emceeId.value || null,
        pastoralPrayerId: roles.pastoralPrayerId.value || null,
        communionOverride: communionOverrideSelect.value,
        communionMinisterId: roles.communionMinisterId.value || null,
        communionNotes: communionNotesArea.value,
        communionChecklist,
        childrenYouthLeaderId: roles.childrenYouthLeaderId.value || null,
        childrenYouthAssistantId: roles.childrenYouthAssistantId.value || null,
        childrenYouthClassroom: childrenClassroomInput.value,
        childrenYouthAttendance: childrenAttendanceInput.value === '' ? null : Number(childrenAttendanceInput.value),
        childrenYouthLesson: childrenLessonInput.value,
        childrenYouthNotes: childrenNotesArea.value,
        mediaId: roles.mediaId.value || null,
        soundId: roles.soundId.value || null,
        usherId: roles.usherId.value || null,
        securityId: roles.securityId.value || null,
        hospitalityId: roles.hospitalityId.value || null,
        prayerTeamId: roles.prayerTeamId.value || null,
        parkingId: roles.parkingId.value || null,
        photographyId: roles.photographyId.value || null,
        foodInCharge: foodInChargeInput.value,
        rehearsalAt: rehearsalInput.value ? new Date(rehearsalInput.value).toISOString() : null,
        orderOfService: orderInput.value,
        status: statusSelect.value,
      };
      try {
        const saved = editing
          ? ctx.db.update('serviceSchedule', doc.id, patch)
          : ctx.db.insert('serviceSchedule', { ...source, ...patch });
        await ctx.db.flush();
        toast('Service saved.', { variant: 'ok' });
        ctx.refresh();
        return saved;
      } catch (err) {
        throw friendly(err);
      }
    },
  });
}

/* ── leader task centre ──────────────────────────────────────────────────── */

function tasksTab(ctx) {
  const { db, user } = ctx;
  if (!user.memberId) {
    return emptyState({
      title: 'Link your account to a member profile',
      detail: 'Ask a church administrator to set this in Settings → Users & roles, so your own tasks — and your ministry workspace, if you lead one — can be found.',
      iconName: 'users',
    });
  }

  const now = new Date();
  const mine = [
    ...db.where('actionItems', (a) => a.ownerId === user.memberId).map((a) => ({ ...a, kind: 'Action', done: a.status === 'done' })),
    ...db.where('eventTasks', (t) => t.ownerId === user.memberId).map((t) => ({ ...t, kind: 'Event task' })),
    ...(ctx.can('care:read') ? db.where('care', (c) => c.assignedTo === user.id)
      .map((c) => ({ ...c, title: c.summary, kind: 'Care', done: !!c.completedAt })) : []),
  ];

  const overdue = mine.filter((t) => !t.done && t.dueDate && new Date(t.dueDate) < now);
  const today = mine.filter((t) => !t.done && t.dueDate && isoDate(t.dueDate) === isoDate(now));
  const upcoming = mine.filter((t) => !t.done && !overdue.includes(t) && !today.includes(t));
  const done = mine.filter((t) => t.done);

  const section = (label, items) => (items.length ? card({
    title: `${label} (${items.length})`,
    children: [list(items.map((t) => taskRow(ctx, t)))],
  }) : null);

  return h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: overdue.length, label: 'Overdue' }),
      statCard({ value: today.length, label: 'Today' }),
      statCard({ value: upcoming.length, label: 'Upcoming' }),
      statCard({ value: done.length, label: 'Completed' })),
    section('Overdue', overdue),
    section('Today', today),
    section('Upcoming', upcoming.slice(0, 20)),
    section('Recently completed', done.slice(-8).reverse()),
    mine.length ? null : emptyState({ title: 'Nothing assigned to you', detail: 'Action items, event jobs and care visits you own will appear here.', iconName: 'check' }));
}

function taskRow(ctx, item) {
  return listItem({
    title: item.title,
    meta: [item.kind, item.dueDate ? `due ${formatDate(item.dueDate)}` : 'no date'].filter(Boolean).join(' · '),
    trailing: item.done ? badge('Done', 'ok') : h('button.btn.btn--sm', {
      onClick: async () => {
        if (item.kind === 'Action') ctx.db.update('actionItems', item.id, { status: 'done' });
        else if (item.kind === 'Event task') ctx.db.update('eventTasks', item.id, { done: true });
        else if (item.kind === 'Care') ctx.db.update('care', item.id, { completedAt: new Date().toISOString() });
        await ctx.db.flush();
        toast('Marked done.', { variant: 'ok' });
        ctx.refresh();
      },
    }, 'Done'),
  });
}

/* ── ministry health ─────────────────────────────────────────────────────── */

function healthTab(ctx) {
  const { db } = ctx;
  const ministries = db.all('ministries');
  if (!ministries.length) return emptyState({ title: 'No ministries recorded', iconName: 'shield' });

  const scored = ministries.map((ministry) => ({ ministry, health: ministryHealthScore(db, ministry) }))
    .sort((a, b) => a.health.score - b.health.score);

  return h('div.stack',
    h('p.small.muted', 'A heuristic score from task completion, overdue work, volunteer coverage, recent activity, goal progress, training completion, member engagement, and — where a budget line matches — spending discipline. A place to look first, not a judgement.'),
    h('div.grid.grid--2', ...scored.map(({ ministry, health }) => {
      const trend = ministryHealthTrend(db, ministry, { points: 4, intervalDays: 30 });
      return card({
        title: ministry.name,
        actions: [badge(`${health.score}% ${health.rating}`, healthTone(health.score))],
        children: [
          h('div.stack.stack--sm', ...health.breakdown.map((row) => h('div', null,
            h('div.row.row--between', h('span.tiny.muted', row.label), h('span.tiny', `${row.value}%`)),
            progress(row.value, 100, { variant: '' })))),
          h('p.tiny.subtle', { style: { marginTop: '8px' } },
            `${health.serving} serving${health.needed ? ` of ${health.needed} needed` : ''} · ${health.tasksOpen} open tasks · ${health.tasksOverdue} overdue`),
          barChart(trend.map((t) => ({ label: formatDate(t.date, { year: undefined }), value: t.score })), { format: (v) => `${v}%` }),
          health.strengths.length
            ? h('p.tiny', { style: { color: 'var(--ok, #2a9d5c)' } }, `Strong: ${health.strengths.join(', ')}`)
            : null,
          health.recommendations.length
            ? h('div.stack.stack--xs', ...health.recommendations.map((r) => h('p.tiny.subtle', `→ ${r}`)))
            : null,
          h('button.btn.btn--sm', { style: { marginTop: '8px' }, onClick: () => ctx.navigate(`/leadership?tab=workspaces&ministry=${ministry.id}`) }, 'Open workspace'),
        ].filter(Boolean),
      });
    })));
}

/* ── church health overview ──────────────────────────────────────────────── */

function churchHealthTab(ctx) {
  const { db } = ctx;
  const overview = churchHealthOverview(db);

  return h('div.stack',
    h('p.small.muted', 'One status per question a leader actually asks — computed from this church\'s own records, not a single number pretending to answer all of them at once.'),
    card({
      title: 'Overall church health',
      actions: [badge(`${overview.score}% ${overview.statusLabel}`, healthTone(overview.score))],
      children: [
        h('div.grid.grid--3', ...overview.dimensions.map((dim) => h('div.stack.stack--sm', { style: { padding: '10px', border: '1px solid var(--border, #e5e5e5)', borderRadius: '8px' } },
          h('div.row.row--between', h('span.small', dim.label), badge(`${dim.score}%`, healthTone(dim.score))),
          progress(dim.score, 100, { variant: '' }),
          h('p.tiny.subtle', dim.detail)))),
      ],
    }),
    overview.recommendations.length
      ? card({
        title: 'Where to focus',
        children: [h('div.stack.stack--sm', ...overview.recommendations.map((r) => h('p.small', `• ${r}`)))],
      })
      : null,
    overview.notTracked.length
      ? card({
        title: 'Not yet tracked',
        children: [h('div.stack.stack--sm', ...overview.notTracked.map((n) => h('p.tiny.subtle', n)))],
      })
      : null,
  );
}

/* ── succession planning ─────────────────────────────────────────────────── */

const RISK_TONES = { urgent: 'danger', attention: 'warn', info: '' };
const RISK_LABELS = { urgent: 'No plan', attention: 'Partial plan', info: 'Covered' };

function successionTab(ctx) {
  const { db } = ctx;
  const risks = successionRisk(db);
  if (!risks.length) return emptyState({ title: 'No ministries or committees recorded', iconName: 'shield' });

  return h('div.stack',
    h('p.small.muted', 'Who could step in if a lead had to step back — a named deputy, and how many others are recorded as serving alongside them. Not a judgement of anyone currently leading.'),
    h('div.grid.grid--2', ...risks.map((r) => card({
      title: r.name,
      subtitle: r.role === 'ministry' ? 'Ministry' : 'Committee',
      actions: [badge(RISK_LABELS[r.risk], RISK_TONES[r.risk])],
      children: [
        h('div.stack.stack--sm',
          h('p.small', `Lead: ${r.hasLead ? memberName(db, r.leadId) : '— none named —'}`),
          h('p.small', `Deputy: ${r.hasDeputy ? memberName(db, r.deputyId) : '— none named —'}`),
          h('p.small', `${r.bench} other${r.bench === 1 ? '' : 's'} recorded serving here${r.benchReadiness != null ? ` · averaging ${r.benchReadiness}% leader-training readiness` : ''}`)),
        h('p.tiny.subtle', { style: { marginTop: '8px' } }, r.reason),
        h('button.btn.btn--sm', {
          style: { marginTop: '8px' },
          onClick: () => (r.role === 'ministry'
            ? openRecordModal(ctx, { collection: 'ministries', doc: db.find('ministries', r.id) })
            : openRecordModal(ctx, { collection: 'committees', doc: db.find('committees', r.id) })),
        }, r.hasDeputy ? 'Edit' : 'Name a deputy'),
      ],
    }))));
}

/* ── volunteer well-being ─────────────────────────────────────────────────── */

function wellBeingTab(ctx) {
  const { db } = ctx;
  const wellBeing = volunteerWellBeing(db);
  if (!wellBeing.length) return emptyState({ title: 'No one is recorded as serving in a ministry yet', iconName: 'heart' });

  return h('div.stack',
    h('p.small.muted', 'A signal, not a verdict — how many ministries someone serves in, how many tasks and worship-service roles are theirs right now. A falling number is worth a conversation, not an accusation.'),
    card({
      children: [table({
        columns: [
          { label: 'Volunteer', value: (r) => memberName(db, r.memberId) },
          { label: 'Ministries', value: (r) => r.ministryCount },
          { label: 'Open tasks', value: (r) => r.openTasks },
          { label: 'Overdue', value: (r) => r.overdueTasks },
          { label: 'Upcoming service roles (8 wks)', value: (r) => r.upcomingRoles },
          { label: 'Well-being', value: (r) => badge(`${r.score}% ${r.statusLabel}`, healthTone(r.score)) },
        ],
        rows: wellBeing,
        onRowClick: (r) => ctx.navigate(`/members/${r.memberId}`),
      })],
    }));
}

/* ── pastoral care centre ─────────────────────────────────────────────────── */

function careCenterTab(ctx) {
  if (!ctx.can('care:read')) {
    return emptyState({ title: 'You do not hold pastoral care permission', iconName: 'heart' });
  }
  const { db } = ctx;
  const overview = pastoralCareOverview(db);

  return h('div.stack',
    h('p.small.muted', 'A leadership rollup of the same care records kept in Member care — how the caseload is spread, and who has gone longest without contact.'),
    h('div.grid.grid--2', statCard({ value: overview.openCount, label: 'Open care items' }), statCard({ value: overview.overdueCount, label: 'Overdue' })),
    card({
      title: 'Caseload by assignee',
      children: [overview.caseload.length
        ? table({
          columns: [
            { label: 'Assigned to', value: (r) => (r.assignedTo ? refLabel(db, 'users', r.assignedTo) : 'Unassigned') },
            { label: 'Open', value: (r) => r.open },
            { label: 'Overdue', value: (r) => r.overdue },
          ],
          rows: overview.caseload,
        })
        : emptyState({ title: 'No open care items', iconName: 'heart' })],
    }),
    card({
      title: 'Priority members',
      subtitle: 'Marked priority on their profile — sorted by longest since last contact.',
      children: [overview.priorityMembers.length
        ? table({
          columns: [
            { label: 'Member', value: (r) => memberName(db, r.memberId) },
            { label: 'Last contact', value: (r) => (r.daysSinceContact == null ? 'No record yet' : `${r.daysSinceContact} days ago`) },
            { label: 'Open follow-up', value: (r) => (r.hasOpenCare ? badge('Yes', 'ok') : badge('None', 'danger')) },
          ],
          rows: overview.priorityMembers,
          onRowClick: (r) => ctx.navigate(`/members/${r.memberId}`),
        })
        : emptyState({ title: 'No members marked priority care', iconName: 'heart' })],
    }),
    overview.absentWithoutFollowUp.length
      ? card({
        title: 'Quietly absent, and no one is on it yet',
        subtitle: 'Three or more weeks unseen, with no open follow-up recorded.',
        children: [list(overview.absentWithoutFollowUp.map((memberId) => listItem({
          title: memberName(db, memberId),
          trailing: h('button.btn.btn--sm', {
            onClick: () => openRecordModal(ctx, { collection: 'care', defaults: { memberId }, hidden: ['memberId'] }),
          }, 'Start a follow-up'),
        })))],
      })
      : null);
}

/* ── leadership journal ───────────────────────────────────────────────────── */

const JOURNAL_FIELDS = ['title', 'date', 'entry', 'tags', 'linkedDecisionId', 'linkedMeetingId'];

function journalTab(ctx) {
  if (!ctx.can('journal:read')) {
    return emptyState({ title: 'You do not hold journal permission', iconName: 'book' });
  }
  const { db, user } = ctx;
  const entries = db.where('journal', (e) => canAccessJournalEntry(user, e))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return h('div.stack',
    h('p.small.muted', "Private to you — not even church-wide leadership or the senior pastor can read another leader's entry. Reflections, prayers, and the \"why\" behind a decision that never belongs in the official minutes."),
    h('div.row.row--end', h('button.btn.btn--primary', {
      onClick: () => openRecordModal(ctx, { collection: 'journal', fields: JOURNAL_FIELDS, defaults: { date: isoDate(new Date()) } }),
    }, icon('plus', { size: 16 }), 'New entry')),
    entries.length
      ? h('div.stack', ...entries.map((entry) => card({
        title: entry.title,
        subtitle: formatDate(entry.date),
        children: [
          h('p.small', entry.entry),
          entry.tags && entry.tags.length ? h('div.row', ...entry.tags.map((t) => badge(t))) : null,
          entry.linkedDecisionId ? h('p.tiny.subtle', `Related decision: ${refLabel(db, 'decisions', entry.linkedDecisionId) || '—'}`) : null,
          entry.linkedMeetingId ? h('p.tiny.subtle', `Related meeting: ${refLabel(db, 'meetings', entry.linkedMeetingId) || '—'}`) : null,
          h('div.row', { style: { marginTop: '8px' } },
            h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'journal', doc: entry, fields: JOURNAL_FIELDS }) }, 'Edit'),
            h('button.btn.btn--sm.btn--ghost', { onClick: () => deleteRecord(ctx, 'journal', entry.id, 'this entry') }, 'Delete')),
        ].filter(Boolean),
      })))
      : emptyState({
        title: 'No journal entries yet',
        detail: 'A private place to reflect — on a decision, a hard conversation, or where you sense God is leading.',
        iconName: 'book',
      }));
}

/* ── leadership directory ────────────────────────────────────────────────── */

const CHURCH_LEADERSHIP_ROLES = ['senior_pastor', 'pastor', 'elder', 'treasurer', 'secretary', 'church_admin'];

function directoryTab(ctx) {
  const { db } = ctx;
  const entries = [];
  const risks = new Map(successionRisk(db).map((r) => [`${r.role}:${r.id}`, r]));

  for (const ministry of db.all('ministries')) {
    if (ministry.leadId) entries.push({ name: memberName(db, ministry.leadId, '—'), role: `${ministry.name} lead`, memberId: ministry.leadId, risk: risks.get(`ministry:${ministry.id}`) });
  }
  for (const committee of db.all('committees')) {
    if (committee.chairId) entries.push({ name: memberName(db, committee.chairId, '—'), role: `${committee.name} chair`, memberId: committee.chairId, risk: risks.get(`committee:${committee.id}`) });
  }
  for (const user of db.all('users')) {
    if (!CHURCH_LEADERSHIP_ROLES.includes(user.role) || user.suspended) continue;
    entries.push({ name: user.memberId ? memberName(db, user.memberId, user.name) : user.name, role: roleLabel(user.role), memberId: user.memberId, risk: null });
  }

  if (!entries.length) {
    return emptyState({ title: 'No leaders recorded yet', detail: 'Set a lead on a ministry, or a chair on a committee, to build the directory.', iconName: 'users' });
  }

  return card({
    title: 'Who leads what',
    subtitle: 'Ministry leads, committee chairs, and church-wide leadership.',
    children: [table({
      columns: [
        { label: 'Name', value: (r) => r.name },
        { label: 'Role', value: (r) => r.role },
        { label: 'Succession', value: (r) => (r.risk ? badge(RISK_LABELS[r.risk.risk], RISK_TONES[r.risk.risk]) : '—') },
      ],
      rows: entries,
      onRowClick: (r) => (r.memberId ? ctx.navigate(`/members/${r.memberId}`) : undefined),
    })],
  });
}

/* ── annual planning ─────────────────────────────────────────────────────── */

function plannerTab(ctx) {
  const { db } = ctx;
  const year = new Date().getFullYear();
  const plans = db.all('annualPlans').sort((a, b) => (b.year || 0) - (a.year || 0));

  return h('div.stack',
    plans.length
      ? h('div.grid.grid--2', ...plans.map((plan) => {
        const ministry = db.find('ministries', plan.ministryId);
        const health = ministry ? ministryHealthScore(db, ministry) : null;
        return card({
          title: plan.title,
          subtitle: `${ministry ? ministry.name : 'Unknown ministry'} · ${plan.year}`,
          actions: [health ? badge(`${health.score}% health`, healthTone(health.score)) : null, statusBadge(plan.status)].filter(Boolean),
          children: [
            plan.vision ? h('p.small.muted', plan.vision) : null,
            (plan.objectives || []).length
              ? h('div', { style: { marginTop: '8px' } }, h('p.eyebrow', 'Objectives'), h('div.chip-list', ...plan.objectives.map((o) => h('span.chip', o))))
              : null,
            (plan.kpis || []).length
              ? h('div', { style: { marginTop: '8px' } }, h('p.eyebrow', 'KPIs'), h('div.chip-list', ...plan.kpis.map((k) => h('span.chip', k))))
              : null,
            plan.budget ? h('p.small', { style: { marginTop: '8px' } }, `Budget: ${formatMoney(plan.budget)}`) : null,
            // Full leadership manages any plan; a ministry head only theirs.
            (ctx.can('leadership:write') || ledMinistries(db, ctx.user).some((m) => m.id === plan.ministryId))
              ? h('div.row', { style: { marginTop: '10px' } },
                h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'annualPlans', doc: plan, fields: PLAN_FIELDS }) }, 'Edit'),
                h('button.btn.btn--sm', { onClick: () => quarterlyReview(ctx, plan) }, 'Quarterly review'))
              : null,
          ],
        });
      }))
      : emptyState({
        title: 'No annual plans yet',
        detail: 'Vision, objectives, KPIs, budget and volunteer needs, per ministry, per year — reviewed each quarter.',
        iconName: 'chart',
        action: canPlanAnything(ctx)
          ? h('button.btn.btn--primary', { onClick: () => openRecordModal(ctx, { collection: 'annualPlans', fields: PLAN_FIELDS, defaults: { year } }) }, icon('plus', { size: 16 }), 'New plan')
          : null,
      }));
}

/** Full leadership, or leads at least one ministry worth planning for. */
function canPlanAnything(ctx) {
  return ctx.can('leadership:write') || ledMinistries(ctx.db, ctx.user).length > 0;
}

function quarterlyReview(ctx, plan) {
  const q1 = textarea({ value: plan.q1Review || '' });
  const q2 = textarea({ value: plan.q2Review || '' });
  const q3 = textarea({ value: plan.q3Review || '' });
  const q4 = textarea({ value: plan.q4Review || '' });

  const ref = modal({
    title: `${plan.title} — quarterly review`,
    wide: true,
    body: h('div.form-grid',
      field({ label: 'Q1', control: q1, full: true }), field({ label: 'Q2', control: q2, full: true }),
      field({ label: 'Q3', control: q3, full: true }), field({ label: 'Q4', control: q4, full: true })),
    actions: [
      h('button.btn', { onClick: () => ref.close() }, 'Cancel'),
      h('button.btn.btn--primary', {
        onClick: async () => {
          ctx.db.update('annualPlans', plan.id, { q1Review: q1.value, q2Review: q2.value, q3Review: q3.value, q4Review: q4.value });
          await ctx.db.flush();
          toast('Saved.', { variant: 'ok' });
          ref.close();
          ctx.refresh();
        },
      }, 'Save'),
    ],
  });
}

/* ── leadership timeline ─────────────────────────────────────────────────── */

const TIMELINE_COLLECTIONS = ['meetings', 'decisions', 'actionItems', 'events', 'announcements', 'transactions', 'documents', 'serviceSchedule', 'annualPlans'];

function timelineTab(ctx) {
  const { db } = ctx;
  const entries = db.all('audit')
    .filter((e) => e.collection && TIMELINE_COLLECTIONS.includes(e.collection))
    .filter((e) => {
      const def = COLLECTIONS[e.collection];
      return def && ctx.can(`${def.resource}:read`);
    })
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 150);

  if (!entries.length) {
    return emptyState({
      title: 'Nothing yet',
      detail: 'Meetings, decisions, events, finance and documents appear here as they happen — only what you are permitted to see.',
      iconName: 'clock',
    });
  }

  const groups = new Map();
  for (const entry of entries) {
    const label = dayLabel(entry.at);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(entry);
  }

  return h('div.stack', ...[...groups].map(([label, items]) => card({
    title: label,
    children: [h('div.timeline', ...items.map((entry) => h('div.timeline__item',
      h('div.small', entry.summary),
      h('div.tiny.subtle', `${entry.actorName || 'system'} · ${relativeTime(entry.at)}`))))],
  })));
}

function dayLabel(at) {
  const days = daysBetween(at, new Date());
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatDate(at, { weekday: 'long', day: 'numeric', month: 'long' });
}
