/**
 * Member care — the follow-ups, visits and needs that make up shepherding.
 *
 * The organising question is not "what records exist" but "who has not been
 * seen, and who is going to go". So the module leads with the people Shepherd
 * has noticed and a one-click way to turn each into an assigned follow-up.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, list, listItem, emptyState, badge, avatar, segmented, statCard, toast, modal,
} from '../core/ui.js';
import { formatDate, relativeTime, isoDate, addDays } from '../core/format.js';
import { blank } from '../core/schema.js';
import { absentMembers, upcomingCelebrations } from '../core/ai.js';
import { openRecordModal, newButton, statusBadge, memberName, sentence, deleteRecord } from './_shared.js';

export async function render(ctx, route) {
  if (route.query.new === '1' && ctx.can('care:write')) {
    setTimeout(() => openRecordModal(ctx, { collection: 'care' }), 0);
  }
  const tab = route.query.tab || 'due';
  const { db } = ctx;
  const now = new Date();

  const open = db.where('care', (c) => !c.completedAt);
  const overdue = open.filter((c) => c.dueDate && new Date(c.dueDate) < now);
  const absent = absentMembers(db, { now, weeks: ctx.settings.followUpAfterWeeks || 3 });

  const body = h('div');
  const draw = () => {
    body.textContent = '';
    body.appendChild(
      tab === 'attention' ? attentionTab(ctx, absent, now)
        : tab === 'done' ? doneTab(ctx)
        : dueTab(ctx, open, now),
    );
  };
  draw();

  return page({
    title: 'Member care',
    subtitle: 'Who needs a visit, a call, or simply to be asked how they are.',
    actions: [newButton(ctx, 'care', 'Log care', () => openRecordModal(ctx, { collection: 'care' }))].filter(Boolean),
    children: [
      h('div.grid.grid--4', { style: { marginBottom: '18px' } },
        statCard({ value: open.length, label: 'Open follow-ups' }),
        statCard({ value: overdue.length, label: 'Past due' }),
        statCard({ value: absent.length, label: 'Not seen recently' }),
        statCard({ value: db.where('members', (m) => m.careLevel !== 'none' && !m.archived).length, label: 'On the care list' })),
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [
            { value: 'due', label: `Due (${open.length})` },
            { value: 'attention', label: `Needs attention (${absent.length})` },
            { value: 'done', label: 'Completed' },
          ],
          value: tab,
          onChange: (value) => ctx.navigate(`/care?tab=${value}`),
        })),
      body,
    ],
  });
}

/* ── due ─────────────────────────────────────────────────────────────────── */

function dueTab(ctx, open, now) {
  const { db } = ctx;
  if (!open.length) {
    return emptyState({
      title: 'Nothing outstanding',
      detail: 'Every follow-up is closed. Look at "Needs attention" for people the records have gone quiet about.',
      iconName: 'check',
    });
  }
  const groups = [
    ['Past due', open.filter((c) => c.dueDate && new Date(c.dueDate) < startOfDay(now))],
    ['Today', open.filter((c) => c.dueDate && isoDate(c.dueDate) === isoDate(now))],
    ['This week', open.filter((c) => c.dueDate && new Date(c.dueDate) > now && new Date(c.dueDate) <= addDays(now, 7))],
    ['Later', open.filter((c) => !c.dueDate || new Date(c.dueDate) > addDays(now, 7))],
  ].filter(([, items]) => items.length);

  return h('div.stack', ...groups.map(([label, items]) => card({
    title: label,
    subtitle: `${items.length} ${items.length === 1 ? 'item' : 'items'}`,
    children: [list(items
      .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
      .map((item) => careRow(ctx, item)))],
  })));
}

function careRow(ctx, item) {
  const { db } = ctx;
  const person = db.find('members', item.memberId);
  return h('div.list__item',
    avatar(person ? person.fullName : '?', { size: 'sm' }),
    h('div.list__body',
      h('div.list__title', item.summary),
      h('div.list__meta', [
        person ? person.fullName : 'Unknown',
        sentence(item.type),
        item.dueDate ? `due ${relativeTime(item.dueDate)}` : null,
        item.assignedTo ? `→ ${assigneeName(ctx, item.assignedTo)}` : 'unassigned',
      ].filter(Boolean).join(' · ')),
      item.detail ? h('p.small.muted', { style: { marginTop: '4px' } }, item.detail) : null),
    h('div.row',
      item.priority === 'urgent' ? badge('Urgent', 'danger') : null,
      ctx.can('care:write')
        ? h('button.btn.btn--sm', { onClick: () => completeCare(ctx, item) }, icon('check', { size: 14 }), 'Close')
        : null,
      ctx.can('care:write')
        ? h('button.icon-btn', { 'aria-label': 'Edit', onClick: () => openRecordModal(ctx, { collection: 'care', doc: item }) }, icon('edit', { size: 15 }))
        : null,
      person ? h('button.icon-btn', { 'aria-label': 'Open profile', onClick: () => ctx.navigate(`/members/${person.id}`) }, icon('chevronRight', { size: 16 })) : null));
}

function completeCare(ctx, item) {
  const outcome = h('textarea.textarea', { placeholder: 'What happened? Who did you speak to? What did they need?' });
  const ref = modal({
    title: 'Close this follow-up',
    body: h('div.stack',
      h('p.small.muted', `${item.summary} — ${memberName(ctx.db, item.memberId)}`),
      h('div.field', h('label.field__label', 'Outcome'), outcome)),
    actions: [
      h('button.btn', { onClick: () => ref.close() }, 'Cancel'),
      h('button.btn.btn--primary', {
        onClick: async () => {
          ctx.db.update('care', item.id, { completedAt: new Date().toISOString(), outcome: outcome.value });
          await ctx.db.flush();
          toast('Closed. The outcome stays on this person\'s record.', { variant: 'ok' });
          ref.close();
          ctx.refresh();
        },
      }, 'Close follow-up'),
    ],
  });
}

/* ── needs attention ─────────────────────────────────────────────────────── */

function attentionTab(ctx, absent, now) {
  const { db } = ctx;
  const celebrations = upcomingCelebrations(db, { now, days: 14 });
  const newBelievers = db.where('members', (m) => m.newBeliever && !m.archived);
  const careList = db.where('members', (m) => m.careLevel !== 'none' && !m.archived);

  const section = (title, subtitle, people, buildMeta, defaults) => card({
    title,
    subtitle,
    children: [people.length
      ? list(people.slice(0, 20).map((person) => listItem({
        leading: avatar(person.fullName || person.name, { size: 'sm' }),
        title: person.fullName || person.name,
        meta: buildMeta(person),
        trailing: ctx.can('care:write')
          ? h('button.btn.btn--sm', {
            onClick: (e) => {
              e.stopPropagation();
              openRecordModal(ctx, {
                collection: 'care',
                defaults: { memberId: person.memberId || person.id, ...defaults(person) },
              });
            },
          }, 'Follow up')
          : null,
        onClick: () => ctx.navigate(`/members/${person.memberId || person.id}`),
      })))
      : h('p.small.muted', 'Nobody in this group right now.')],
  });

  return h('div.stack',
    section(
      'Not seen recently',
      `No attendance mark for ${ctx.settings.followUpAfterWeeks || 3}+ weeks`,
      absent,
      (person) => (person.lastSeen ? `Last seen ${relativeTime(person.lastSeen)}` : 'Never marked present'),
      (person) => ({ type: 'call', summary: `Check in — not seen since ${person.lastSeen ? formatDate(person.lastSeen) : 'we started recording'}`, dueDate: isoDate(addDays(new Date(), 3)) }),
    ),
    section(
      'New believers',
      'Each needs a person, not a programme',
      newBelievers,
      (person) => `Since ${formatDate(person.joinedOn || person.createdAt)}`,
      () => ({ type: 'follow-up', summary: 'Arrange discipleship and a mentor', dueDate: isoDate(addDays(new Date(), 7)) }),
    ),
    section(
      'On the care list',
      'Flagged as watch or priority on their profile',
      careList,
      (person) => `${sentence(person.careLevel)} · ${person.area || ''}`,
      () => ({ type: 'visit', summary: 'Pastoral visit', dueDate: isoDate(addDays(new Date(), 7)) }),
    ),
    card({
      title: 'Birthdays & anniversaries',
      subtitle: 'Next fourteen days',
      children: [celebrations.length
        ? list(celebrations.map((celebration) => listItem({
          leading: avatar(celebration.name, { size: 'sm' }),
          title: celebration.name,
          meta: `${sentence(celebration.label)} · ${celebration.inDays === 0 ? 'today' : formatDate(celebration.date)}`,
          trailing: ctx.can('communications:write')
            ? h('button.btn.btn--sm', {
              onClick: (e) => { e.stopPropagation(); ctx.navigate(`/communications?greet=${celebration.memberId}&kind=${celebration.label}`); },
            }, 'Greet')
            : null,
          onClick: () => ctx.navigate(`/members/${celebration.memberId}`),
        })))
        : h('p.small.muted', 'None this fortnight.')],
    }));
}

/* ── completed ───────────────────────────────────────────────────────────── */

function doneTab(ctx) {
  const done = ctx.db.where('care', (c) => c.completedAt)
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
    .slice(0, 60);
  if (!done.length) return emptyState({ title: 'Nothing completed yet', iconName: 'check' });

  return card({
    title: 'Completed',
    subtitle: 'The church\'s memory of who was cared for, and how.',
    children: [h('div.timeline', ...done.map((item) => h('div.timeline__item',
      h('div.row.row--between',
        h('strong.small', item.summary),
        h('span.tiny.subtle', relativeTime(item.completedAt))),
      h('div.tiny.subtle', `${memberName(ctx.db, item.memberId)} · ${sentence(item.type)}`),
      item.outcome ? h('p.small.muted', { style: { marginTop: '4px' } }, item.outcome) : null,
      ctx.can('care:delete')
        ? h('button.btn.btn--sm.btn--ghost', { onClick: () => deleteRecord(ctx, 'care', item.id, 'this record') }, 'Delete')
        : null)))],
  });
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function assigneeName(ctx, userId) {
  const user = ctx.db.find('users', userId);
  return user ? user.name : 'someone';
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
