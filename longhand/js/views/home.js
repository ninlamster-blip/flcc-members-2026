/**
 * Home — a workspace, not a dashboard.
 *
 * Three lists in the order the day actually needs them: what you recorded,
 * what you owe someone, what you asked. No tiles, no counters for their own
 * sake, nothing that is only there because dashboards usually have one.
 */

import { h, icon } from '../core/dom.js';
import { greeting, dayLabel, duration, dueLabel, shortDate } from '../core/format.js';
import { section, rows, linkRow, empty, statusTag, button, tag } from '../core/ui.js';
import { Router } from '../core/router.js';
import { speakerMap } from '../core/intelligence.js';

export async function render(app) {
  const db = app.db;
  const meetings = db.all('meetings')
    .filter((m) => !m.archived)
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));

  const view = h('div.view.stack-6');

  view.appendChild(h('div.view__head',
    h('div.grow',
      h('h1.page-title', greeting()),
      h('p.lede', { style: { marginTop: '6px' } }, standing(meetings, db))),
    h('div.row.row--tight',
      h('a.btn.btn--record.btn--lg', { href: '#/record' }, icon('mic', { size: 16 }), 'Start recording'))));

  if (!meetings.length) {
    view.appendChild(empty({
      title: 'No meetings yet.',
      body: 'Recordings you make appear here, transcribed and searchable. Nothing is uploaded anywhere but the transcription service you choose in Settings.',
      action: h('a.btn.btn--primary', { href: '#/record' }, 'Start recording'),
    }));
    return view;
  }

  /* Recent meetings */
  const recent = meetings.slice(0, 6);
  view.appendChild(section(
    { title: 'Recent meetings', actions: [h('a.btn.btn--quiet.btn--sm', { href: '#/meetings' }, 'All meetings')] },
    rows(...recent.map((meeting) => meetingRow(db, meeting)))));

  /* Outstanding actions */
  const open = db.where('actions', { status: 'open' })
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  view.appendChild(section(
    { title: 'Outstanding actions', aside: open.length ? `${open.length} open` : null,
      actions: open.length ? [h('a.btn.btn--quiet.btn--sm', { href: '#/tasks' }, 'All tasks')] : [] },
    open.length
      ? rows(...open.slice(0, 5).map((action) => actionRow(app, action)))
      : h('p.meta', 'Nothing outstanding. Action items found in a recording appear here.')));

  /* Recent questions */
  const asked = db.all('memory').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 4);
  if (asked.length) {
    view.appendChild(section(
      { title: 'Recent questions', actions: [h('a.btn.btn--quiet.btn--sm', { href: '#/memory' }, 'AI Memory')] },
      rows(...asked.map((entry) => linkRow({
        href: Router.href('memory', [], { q: entry.question }),
        title: entry.question,
        lines: [h('span.meta.clamp-2', entry.answer)],
        side: [h('span.meta-sm', shortDate(entry.createdAt))],
      })))));
  }

  return view;
}

function standing(meetings, db) {
  if (!meetings.length) return 'Record a conversation and it becomes searchable, with its decisions and action items pulled out.';
  const open = db.where('actions', { status: 'open' }).length;
  const last = meetings[0];
  const bits = [`${meetings.length} ${meetings.length === 1 ? 'meeting' : 'meetings'} recorded`];
  if (open) bits.push(`${open} action ${open === 1 ? 'item' : 'items'} outstanding`);
  bits.push(`last recorded ${dayLabel(last.startedAt).toLowerCase()}`);
  return `${bits.join(' · ')}.`;
}

export function meetingRow(db, meeting) {
  const names = [...speakerMap(db, meeting.id).values()].filter(Boolean);
  const lines = [];
  const facts = [dayLabel(meeting.startedAt), duration(meeting.durationSec)];
  if (names.length) facts.push(names.slice(0, 4).join(' · ') + (names.length > 4 ? ` +${names.length - 4}` : ''));
  lines.push(facts.join(' · '));
  if (meeting.summary) lines.push(h('span.meta.clamp-2', { style: { color: 'var(--ink-2)' } }, meeting.summary));

  const status = statusTag(meeting.status);
  const openActions = db.where('actions', { meetingId: meeting.id, status: 'open' }).length;
  return linkRow({
    href: Router.href('meeting', [meeting.id]),
    title: meeting.title,
    lines,
    side: [
      meeting.favorite ? icon('star', { size: 14, title: 'Favourite' }) : null,
      openActions ? tag(`${openActions} open`) : null,
      status,
    ].filter(Boolean),
  });
}

function actionRow(app, action) {
  const meeting = app.db.get('meetings', action.meetingId);
  const due = dueLabel(action.dueDate);
  return h('div.row-item',
    h('button.btn.btn--icon.btn--sm', {
      type: 'button',
      title: 'Mark completed',
      'aria-label': `Mark "${action.task}" completed`,
      onClick: () => {
        app.db.update('actions', action.id, { status: 'done', completedAt: new Date().toISOString() });
        app.notify('Marked completed.');
        app.refresh();
      },
    }, icon('circle', { size: 15 })),
    h('div.row-item__main',
      h('span.row-item__title', action.task),
      h('span.meta', [action.ownerName, meeting ? meeting.title : null].filter(Boolean).join(' · '))),
    h('div.row-item__side',
      due ? tag(due, due === 'Overdue' ? 'attention' : '') : null,
      meeting ? h('a.btn.btn--quiet.btn--sm', { href: Router.href('meeting', [meeting.id]) }, 'Open') : null));
}
