/**
 * Leadership hub — committees, meetings, action items, decisions and goals.
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
  toast, aiOutput, progress, searchField, modal,
} from '../core/ui.js';
import { formatDate, formatDateTime, relativeTime, isoDate } from '../core/format.js';
import { blank } from '../core/schema.js';
import { openRecordModal, newButton, statusBadge, memberName, matches, sentence, deleteRecord } from './_shared.js';

const MEETING_FIELDS = ['title', 'date', 'committeeId', 'attendees', 'agenda', 'minutes', 'confidential'];

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
      : meetingsTab(ctx),
  );

  return page({
    title: 'Leadership',
    subtitle: 'Committees, minutes, decisions and the plan for the year.',
    actions: [newButton(ctx, 'leadership', 'New meeting', () => openRecordModal(ctx, { collection: 'meetings', fields: MEETING_FIELDS }))].filter(Boolean),
    children: [
      h('div.grid.grid--4', { style: { marginBottom: '18px' } },
        statCard({ value: db.all('meetings').length, label: 'Meetings recorded' }),
        statCard({ value: openActions.length, label: 'Open actions' }),
        statCard({ value: overdue.length, label: 'Overdue' }),
        statCard({ value: db.all('decisions').length, label: 'Decisions logged' })),
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [
            { value: 'meetings', label: 'Meetings' },
            { value: 'actions', label: `Actions (${openActions.length})` },
            { value: 'decisions', label: 'Decisions' },
            { value: 'goals', label: 'Goals' },
            { value: 'committees', label: 'Committees' },
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
