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
  toast, aiOutput, progress, searchField, modal, field, textarea,
} from '../core/ui.js';
import { formatDate, formatDateTime, formatMoney, relativeTime, isoDate, daysBetween } from '../core/format.js';
import { COLLECTIONS } from '../core/schema.js';
import {
  openRecordModal, newButton, statusBadge, memberName, matches, sentence, deleteRecord, healthTone,
} from './_shared.js';
import {
  ministryHealthScore, suggestForRole, SERVICE_ROLE_FIELDS, serviceAssignees,
} from '../core/ai.js';
import { canAccessMinistryWorkspace } from '../core/policies.js';
import { roleLabel } from '../core/rbac.js';
import { downloadCSV, downloadExcel, printReport } from '../core/exporters.js';

const MEETING_FIELDS = ['title', 'date', 'committeeId', 'attendees', 'agenda', 'minutes', 'confidential'];
const SERVICE_FIELDS = [
  'date', 'service', 'preacherId', 'worshipLeaderId', 'songLeaderId', 'openingPrayerId',
  'offeringId', 'communionId', 'mediaId', 'soundId', 'usherId', 'childrenTeacherIds', 'youthLeaderId', 'notes',
];
const PLAN_FIELDS = ['ministryId', 'year', 'title', 'vision', 'objectives', 'kpis', 'budget', 'volunteerNeeds', 'status'];

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
        ? newButton(ctx, 'worship', 'New service', () => openRecordModal(ctx, { collection: 'serviceSchedule', fields: SERVICE_FIELDS }))
        : tab === 'planner'
          ? newButton(ctx, 'leadership', 'New plan', () => openRecordModal(ctx, { collection: 'annualPlans', fields: PLAN_FIELDS, defaults: { year: new Date().getFullYear() } }))
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
  return h('div.list__item',
    h('input', {
      type: 'checkbox',
      checked: action.status === 'done',
      'aria-label': `Mark "${action.title}" done`,
      disabled: !ctx.can('leadership:write'),
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
    ctx.can('leadership:write')
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
        subtitle: [goal.year, goal.ownerId ? memberName(db, goal.ownerId) : null].filter(Boolean).join(' · '),
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

  const tasksCard = card({
    title: 'Tasks',
    subtitle: `${openTasks.length} open`,
    actions: [ctx.can('leadership:write')
      ? h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'actionItems', defaults: { ministryId: ministry.id }, hidden: ['ministryId'] }) }, icon('plus', { size: 14 }), 'Add')
      : null].filter(Boolean),
    children: [openTasks.length
      ? list(openTasks.slice(0, 8).map((t) => listItem({ title: t.title, meta: t.dueDate ? `due ${formatDate(t.dueDate)}` : 'no date' })))
      : emptyState({ title: 'Nothing open', iconName: 'check' })],
  });

  const planCard = card({
    title: `${year} plan`,
    actions: [ctx.can('leadership:write')
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
  const records = db.where('serviceSchedule', (s) => new Date(s.date).getFullYear() === year)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const years = new Set(db.all('serviceSchedule').map((s) => new Date(s.date).getFullYear()));
  years.add(year);
  const yearList = [...years].sort((a, b) => b - a);

  return h('div.stack',
    h('div.row.row--wrap',
      h('select.select', {
        style: { maxWidth: '120px' }, 'aria-label': 'Year',
        onChange: (e) => ctx.navigate(`/leadership?tab=schedule&year=${e.target.value}`),
      }, ...yearList.map((y) => h('option', { value: y, selected: y === year }, String(y)))),
      h('div.spacer'),
      records.length ? h('button.btn.btn--sm', { onClick: () => exportSchedule(ctx, records, 'excel') }, icon('download', { size: 14 }), 'Excel') : null,
      records.length ? h('button.btn.btn--sm', { onClick: () => exportSchedule(ctx, records, 'csv') }, icon('download', { size: 14 }), 'CSV') : null,
      records.length ? h('button.btn.btn--sm', { onClick: () => printSchedule(ctx, records, year) }, icon('file', { size: 14 }), 'Print / PDF') : null),
    records.length
      ? h('div.stack.stack--sm', ...records.map((record) => serviceRow(ctx, record)))
      : emptyState({
        title: `No services scheduled in ${year}`,
        detail: 'One record per service, with every role — preacher, worship, media, sound, ushers, teachers.',
        iconName: 'calendar',
        action: newButton(ctx, 'worship', 'New service', () => openRecordModal(ctx, {
          collection: 'serviceSchedule', fields: SERVICE_FIELDS, defaults: { date: isoDate(new Date()) },
        })),
      }));
}

function serviceRow(ctx, record) {
  const { db } = ctx;
  const attended = db.first('attendance', (a) => a.date === record.date && a.service === record.service);
  const assignments = SERVICE_ROLE_FIELDS.map(([key, label]) => [label, record[key]]).filter(([, id]) => id);
  const childrenTeachers = (record.childrenTeacherIds || []).map((id) => memberName(db, id));

  return card({
    tight: true,
    children: [
      h('div.row.row--between.row--wrap',
        h('div', null,
          h('strong', record.service),
          h('div.tiny.subtle', formatDate(record.date, { weekday: 'long', day: 'numeric', month: 'long' }))),
        h('div.row',
          badge(attended ? 'Attendance recorded' : 'Attendance pending', attended ? 'ok' : 'warn'),
          ctx.can('worship:write')
            ? h('button.btn.btn--sm', { onClick: () => suggestAssignments(ctx, record) }, icon('sparkles', { size: 14 }), 'Suggest')
            : null,
          ctx.can('worship:write')
            ? h('button.icon-btn', { 'aria-label': 'Edit', onClick: () => openRecordModal(ctx, { collection: 'serviceSchedule', doc: record, fields: SERVICE_FIELDS }) }, icon('edit', { size: 15 }))
            : null)),
      h('div.chip-list', { style: { marginTop: '10px' } },
        ...assignments.map(([label, id]) => h('span.chip', `${label}: ${memberName(db, id)}`)),
        ...(childrenTeachers.length ? [h('span.chip', `Children: ${childrenTeachers.join(', ')}`)] : [])),
      !assignments.length && !childrenTeachers.length ? h('p.small.muted', { style: { marginTop: '8px' } }, 'Nothing assigned yet.') : null,
    ],
  });
}

/** The smart assignment engine: least-recently-served, ministry-matched, conflict-checked. */
function suggestAssignments(ctx, record) {
  const empty = SERVICE_ROLE_FIELDS.filter(([key]) => !record[key]);
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
    { label: 'Date', value: (r) => r.date }, { label: 'Service', key: 'service' },
    ...SERVICE_ROLE_FIELDS.map(([key, label]) => ({ label, value: (r) => memberName(ctx.db, r[key], '') })),
    { label: 'Children teachers', value: (r) => (r.childrenTeacherIds || []).map((id) => memberName(ctx.db, id)).join('; ') },
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
      { label: 'Preacher', value: (r) => memberName(ctx.db, r.preacherId, '') },
      { label: 'Worship', value: (r) => memberName(ctx.db, r.worshipLeaderId, '') },
      { label: 'Media', value: (r) => memberName(ctx.db, r.mediaId, '') },
      { label: 'Sound', value: (r) => memberName(ctx.db, r.soundId, '') },
      { label: 'Usher', value: (r) => memberName(ctx.db, r.usherId, '') },
    ],
    rows: records,
  });
  printReport({ title: `${ctx.tenant.name} — worship schedule ${year}`, subtitle: `Prepared ${formatDate(new Date())}`, nodes: [tableNode] });
  ctx.db.log('export', `Printed the ${year} worship schedule.`);
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
    h('p.small.muted', 'A heuristic score from task completion, overdue work, volunteer coverage against stated need, and recent activity — a place to look first, not a judgement.'),
    h('div.grid.grid--2', ...scored.map(({ ministry, health }) => card({
      title: ministry.name,
      actions: [badge(`${health.score}% ${health.rating}`, healthTone(health.score))],
      children: [
        h('div.stack.stack--sm', ...health.breakdown.map((row) => h('div', null,
          h('div.row.row--between', h('span.tiny.muted', row.label), h('span.tiny', `${row.value}%`)),
          progress(row.value, 100, { variant: '' })))),
        h('p.tiny.subtle', { style: { marginTop: '8px' } },
          `${health.serving} serving${health.needed ? ` of ${health.needed} needed` : ''} · ${health.tasksOpen} open tasks · ${health.tasksOverdue} overdue`),
        h('button.btn.btn--sm', { style: { marginTop: '8px' }, onClick: () => ctx.navigate(`/leadership?tab=workspaces&ministry=${ministry.id}`) }, 'Open workspace'),
      ],
    }))));
}

/* ── leadership directory ────────────────────────────────────────────────── */

const CHURCH_LEADERSHIP_ROLES = ['senior_pastor', 'pastor', 'elder', 'treasurer', 'secretary', 'church_admin'];

function directoryTab(ctx) {
  const { db } = ctx;
  const entries = [];

  for (const ministry of db.all('ministries')) {
    if (ministry.leadId) entries.push({ name: memberName(db, ministry.leadId, '—'), role: `${ministry.name} lead`, memberId: ministry.leadId });
  }
  for (const committee of db.all('committees')) {
    if (committee.chairId) entries.push({ name: memberName(db, committee.chairId, '—'), role: `${committee.name} chair`, memberId: committee.chairId });
  }
  for (const user of db.all('users')) {
    if (!CHURCH_LEADERSHIP_ROLES.includes(user.role) || user.suspended) continue;
    entries.push({ name: user.memberId ? memberName(db, user.memberId, user.name) : user.name, role: roleLabel(user.role), memberId: user.memberId });
  }

  if (!entries.length) {
    return emptyState({ title: 'No leaders recorded yet', detail: 'Set a lead on a ministry, or a chair on a committee, to build the directory.', iconName: 'users' });
  }

  return card({
    title: 'Who leads what',
    subtitle: 'Ministry leads, committee chairs, and church-wide leadership.',
    children: [table({
      columns: [{ label: 'Name', value: (r) => r.name }, { label: 'Role', value: (r) => r.role }],
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
        return card({
          title: plan.title,
          subtitle: `${ministry ? ministry.name : 'Unknown ministry'} · ${plan.year}`,
          actions: [statusBadge(plan.status)],
          children: [
            plan.vision ? h('p.small.muted', plan.vision) : null,
            (plan.objectives || []).length
              ? h('div', { style: { marginTop: '8px' } }, h('p.eyebrow', 'Objectives'), h('div.chip-list', ...plan.objectives.map((o) => h('span.chip', o))))
              : null,
            (plan.kpis || []).length
              ? h('div', { style: { marginTop: '8px' } }, h('p.eyebrow', 'KPIs'), h('div.chip-list', ...plan.kpis.map((k) => h('span.chip', k))))
              : null,
            plan.budget ? h('p.small', { style: { marginTop: '8px' } }, `Budget: ${formatMoney(plan.budget)}`) : null,
            ctx.can('leadership:write')
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
        action: newButton(ctx, 'leadership', 'New plan', () => openRecordModal(ctx, { collection: 'annualPlans', fields: PLAN_FIELDS, defaults: { year } })),
      }));
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
