/**
 * Dashboard — what a leader needs to know before Friday.
 *
 * Widgets are permission-aware: a treasurer sees the financial snapshot, a
 * volunteer sees their rota and the prayer wall, and neither is told the other
 * exists. Every number is computed from this church's own records at render
 * time, so it is never stale.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, stat, statCard, listItem, list, barChart, emptyState, badge, avatar, progress,
} from '../core/ui.js';
import {
  computeInsights, attendanceTrend, upcomingCelebrations, financeSnapshot, absentMembers,
} from '../core/ai.js';
import { formatDate, formatDateParts, formatTime, relativeTime, isoDate, addDays, formatMoney, daysBetween } from '../core/format.js';
import { memberName, statusBadge } from './_shared.js';

export async function render(ctx) {
  const { db, user } = ctx;
  const now = new Date();
  const insights = computeInsights(db, user, { settings: ctx.settings });

  const columns = h('div.grid.grid--main-side',
    h('div.stack', ...mainColumn(ctx, now, insights)),
    h('div.stack', ...sideColumn(ctx, now)));

  return page({
    eyebrow: greeting(now),
    title: firstName(user.name),
    subtitle: `${ctx.tenant.name} · ${formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}`,
    actions: quickActions(ctx),
    children: [columns],
  });
}

/* ── columns ─────────────────────────────────────────────────────────────── */

function mainColumn(ctx, now, insights) {
  const { db, user } = ctx;
  const out = [];

  out.push(statRow(ctx, now));

  if (insights.length) {
    out.push(card({
      title: 'Shepherd noticed',
      subtitle: 'Computed from your own records on this device.',
      actions: [h('span.badge.badge--ai', icon('sparkles', { size: 12 }), 'Insights')],
      children: [h('div.stack.stack--sm', ...insights.slice(0, 6).map((insight) => insightCard(ctx, insight)))],
    }));
  }

  out.push(todaySchedule(ctx, now));

  if (ctx.can('members:read')) out.push(attendanceCard(ctx, now));
  if (ctx.can('care:read')) out.push(followUpsCard(ctx, now));
  if (ctx.can('prayer:read')) out.push(prayerCard(ctx));

  return out;
}

function sideColumn(ctx, now) {
  const out = [];
  if (ctx.can('events:read')) out.push(upcomingEvents(ctx, now));
  if (ctx.can('members:read')) out.push(celebrationsCard(ctx, now));
  if (ctx.can('finance:read')) out.push(financeCard(ctx, now));
  if (ctx.can('members:read')) out.push(visitorsCard(ctx, now));
  out.push(activityCard(ctx));
  return out;
}

/* ── widgets ─────────────────────────────────────────────────────────────── */

function statRow(ctx, now) {
  const { db } = ctx;
  const cards = [];

  if (ctx.can('members:read')) {
    const members = db.where('members', (m) => !m.archived && m.status === 'member').length;
    const trend = attendanceTrend(db, { now, weeks: 4 });
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const visitors = db.where('members', (m) => new Date(m.joinedOn || m.createdAt) >= monthStart).length;

    cards.push(statCard({ value: members, label: 'Members', onClick: () => ctx.navigate('/members') }));
    cards.push(statCard({
      value: Math.round(trend.recentAverage) || '—',
      label: 'Average attendance',
      delta: trend.priorAverage ? `${trend.changePct > 0 ? '+' : ''}${Math.round(trend.changePct)}%` : '',
      deltaDirection: trend.direction === 'down' ? 'down' : 'up',
      onClick: () => ctx.navigate('/reports'),
    }));
    cards.push(statCard({ value: visitors, label: 'New this month', onClick: () => ctx.navigate('/members') }));
  }

  if (ctx.can('care:read')) {
    const due = db.where('care', (c) => !c.completedAt).length;
    cards.push(statCard({ value: due, label: 'Follow-ups open', onClick: () => ctx.navigate('/care') }));
  } else if (ctx.can('prayer:read')) {
    const open = db.where('prayers', (p) => p.status === 'open' || p.status === 'praying').length;
    cards.push(statCard({ value: open, label: 'Prayer requests', onClick: () => ctx.navigate('/prayer') }));
  }

  return h('div.grid.grid--4', ...cards);
}

function insightCard(ctx, insight) {
  return h('div', { class: `insight insight--${insight.severity}` },
    h('span.insight__mark'),
    h('div', { style: { minWidth: 0, flex: 1 } },
      h('div.insight__title', null, insight.title),
      h('div.insight__detail', null, insight.detail)),
    insight.action
      ? h('button.btn.btn--sm', { onClick: () => ctx.navigate(insight.action.replace('#', '')) }, insight.actionLabel || 'Open')
      : null);
}

function todaySchedule(ctx, now) {
  const { db } = ctx;
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const today = ctx.can('events:read')
    ? db.where('events', (e) => e.status !== 'cancelled'
      && new Date(e.startsAt) >= new Date(now.getFullYear(), now.getMonth(), now.getDate())
      && new Date(e.startsAt) <= endOfDay).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    : [];

  const dueToday = ctx.can('care:read')
    ? db.where('care', (c) => !c.completedAt && c.dueDate && isoDate(c.dueDate) === isoDate(now))
    : [];

  const meetings = ctx.can('leadership:read')
    ? db.where('meetings', (m) => isoDate(m.date) === isoDate(now))
    : [];

  const rows = [
    ...today.map((event) => listItem({
      leading: h('span.badge.badge--accent', null, formatTime(event.startsAt)),
      title: event.title,
      meta: [event.venue, event.type].filter(Boolean).join(' · '),
      onClick: () => ctx.navigate(`/events/${event.id}`),
    })),
    ...meetings.map((meeting) => listItem({
      leading: h('span.badge.badge--info', null, formatTime(meeting.date)),
      title: meeting.title,
      meta: 'Leadership meeting',
      onClick: () => ctx.navigate(`/leadership/${meeting.id}`),
    })),
    ...dueToday.map((item) => listItem({
      leading: icon('heart', { size: 18 }),
      title: item.summary,
      meta: `Follow-up · ${memberName(ctx.db, item.memberId)}`,
      onClick: () => ctx.navigate('/care'),
    })),
  ];

  return card({
    title: 'Today',
    subtitle: formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' }),
    children: [rows.length
      ? list(rows)
      : emptyState({
        title: 'Nothing scheduled today',
        detail: 'A clear day. Use it on someone who has not been asked how they are.',
        iconName: 'clock',
      })],
  });
}

function attendanceCard(ctx, now) {
  const trend = attendanceTrend(ctx.db, { now, weeks: 8 });
  const points = trend.points.slice(-12);
  if (!points.length) {
    return card({
      title: 'Attendance',
      children: [emptyState({
        title: 'No attendance recorded yet',
        detail: 'Record a service and the trend appears here.',
        iconName: 'chart',
        action: ctx.can('members:write')
          ? h('button.btn.btn--primary', { onClick: () => ctx.navigate('/members?tab=attendance') }, 'Record a service')
          : null,
      })],
    });
  }
  return card({
    title: 'Attendance trend',
    subtitle: `Last ${points.length} services · averaging ${Math.round(trend.recentAverage)}`,
    actions: [h('button.btn.btn--sm', { onClick: () => ctx.navigate('/reports') }, 'Reports')],
    children: [barChart(points.map((p) => ({ label: formatDateParts(p.date, { day: 'numeric', month: 'numeric' }), value: p.total })))],
  });
}

function followUpsCard(ctx, now) {
  const { db } = ctx;
  const items = db.where('care', (c) => !c.completedAt)
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
    .slice(0, 6);
  const absent = absentMembers(db, { now, weeks: ctx.settings.followUpAfterWeeks || 3 });

  return card({
    title: 'Follow-ups due',
    subtitle: absent.length ? `${absent.length} people have not been seen recently` : 'Everyone has been seen recently',
    actions: [h('button.btn.btn--sm', { onClick: () => ctx.navigate('/care') }, 'Open')],
    children: [items.length
      ? list(items.map((item) => listItem({
        leading: avatar(memberName(db, item.memberId), { size: 'sm' }),
        title: item.summary,
        meta: [memberName(db, item.memberId), item.dueDate ? `due ${relativeTime(item.dueDate)}` : null].filter(Boolean).join(' · '),
        trailing: item.priority === 'urgent' ? badge('Urgent', 'danger') : null,
        onClick: () => ctx.navigate('/care'),
      })))
      : emptyState({ title: 'Nothing outstanding', detail: 'Every follow-up is closed.', iconName: 'check' })],
  });
}

function prayerCard(ctx) {
  const { db } = ctx;
  const requests = db.where('prayers', (p) => (p.status === 'open' || p.status === 'praying') && p.visibility !== 'private')
    .sort((a, b) => (b.urgent === true) - (a.urgent === true) || new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  const answered = db.where('prayers', (p) => p.status === 'answered').length;

  return card({
    title: 'Prayer',
    subtitle: `${answered} answered ${answered === 1 ? 'prayer' : 'prayers'} recorded`,
    actions: [h('button.btn.btn--sm', { onClick: () => ctx.navigate('/prayer') }, 'Prayer centre')],
    children: [requests.length
      ? list(requests.map((request) => listItem({
        leading: icon(request.urgent ? 'alert' : 'heart', { size: 18 }),
        title: request.title,
        meta: [request.category, request.memberId ? memberName(db, request.memberId) : null].filter(Boolean).join(' · '),
        trailing: request.urgent ? badge('Urgent', 'danger') : null,
        onClick: () => ctx.navigate('/prayer'),
      })))
      : emptyState({ title: 'No open requests', detail: 'The wall is clear.', iconName: 'heart' })],
  });
}

function upcomingEvents(ctx, now) {
  const events = ctx.db.where('events', (e) => e.status !== 'cancelled' && new Date(e.startsAt) > now)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 5);
  return card({
    title: 'Coming up',
    actions: [h('button.btn.btn--sm', { onClick: () => ctx.navigate('/events') }, 'All')],
    children: [events.length
      ? list(events.map((event) => listItem({
        leading: h('div', { style: { textAlign: 'center', width: '38px', flex: 'none' } },
          h('div.tiny.subtle', null, formatDateParts(event.startsAt, { month: 'short' })),
          h('div', { style: { fontWeight: '600' } }, new Date(event.startsAt).getDate())),
        title: event.title,
        meta: [formatTime(event.startsAt), event.venue].filter(Boolean).join(' · '),
        trailing: statusBadge(event.status),
        onClick: () => ctx.navigate(`/events/${event.id}`),
      })))
      : emptyState({ title: 'Nothing scheduled', iconName: 'calendar' })],
  });
}

function celebrationsCard(ctx, now) {
  const celebrations = upcomingCelebrations(ctx.db, { now, days: 14 }).slice(0, 6);
  return card({
    title: 'Birthdays & anniversaries',
    subtitle: 'Next fourteen days',
    children: [celebrations.length
      ? list(celebrations.map((celebration) => listItem({
        leading: avatar(celebration.name, { size: 'sm' }),
        title: celebration.name,
        meta: `${celebration.label === 'birthday' ? 'Birthday' : 'Anniversary'} · ${celebration.inDays === 0 ? 'today' : formatDateParts(celebration.date, { day: 'numeric', month: 'short' })}`,
        trailing: celebration.inDays === 0 ? badge('Today', 'accent') : null,
        onClick: () => ctx.navigate(`/members/${celebration.memberId}`),
      })))
      : emptyState({ title: 'None this fortnight', iconName: 'calendar' })],
  });
}

function financeCard(ctx, now) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const snapshot = financeSnapshot(ctx.db, { from: monthStart, to: now });
  const yearBudget = ctx.db.where('budgets', (b) => b.year === now.getFullYear())
    .reduce((total, b) => total + Number(b.amount || 0), 0);
  const yearSpend = financeSnapshot(ctx.db, { from: new Date(now.getFullYear(), 0, 1), to: now }).expenses;

  return card({
    title: 'Finance',
    subtitle: formatDate(monthStart, { month: 'long', year: 'numeric' }),
    actions: [h('button.btn.btn--sm', { onClick: () => ctx.navigate('/finance') }, 'Open')],
    children: [
      h('div.row', { style: { gap: '24px', marginBottom: '14px' } },
        stat({ value: formatMoney(snapshot.giving), label: 'Given this month' }),
        stat({ value: formatMoney(snapshot.expenses), label: 'Spent' })),
      yearBudget > 0 ? h('div.stack.stack--sm',
        h('div.row.row--between.small',
          h('span.muted', null, 'Annual budget used'),
          h('span.nums', null, `${formatMoney(yearSpend)} of ${formatMoney(yearBudget)}`)),
        progress(yearSpend, yearBudget)) : null,
    ],
  });
}

function visitorsCard(ctx, now) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const visitors = ctx.db.where('members', (m) => m.status === 'visitor'
    && new Date(m.joinedOn || m.createdAt) >= addDays(now, -60))
    .sort((a, b) => new Date(b.joinedOn || b.createdAt) - new Date(a.joinedOn || a.createdAt))
    .slice(0, 5);
  const thisMonth = ctx.db.where('members', (m) => m.status === 'visitor' && new Date(m.joinedOn || m.createdAt) >= monthStart).length;

  return card({
    title: 'Visitors',
    subtitle: `${thisMonth} this month`,
    children: [visitors.length
      ? list(visitors.map((visitor) => listItem({
        leading: avatar(visitor.fullName, { size: 'sm' }),
        title: visitor.fullName,
        meta: `First seen ${formatDate(visitor.joinedOn || visitor.createdAt)} · ${Math.abs(daysBetween(visitor.joinedOn || visitor.createdAt, now))} days ago`,
        onClick: () => ctx.navigate(`/members/${visitor.id}`),
      })))
      : emptyState({ title: 'No recent visitors recorded', iconName: 'users' })],
  });
}

function activityCard(ctx) {
  const entries = ctx.can('audit:read')
    ? ctx.db.all('audit').sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8)
    : [];
  if (!entries.length) return card({ title: 'Recent activity', children: [emptyState({ title: 'Nothing yet', iconName: 'clock' })] });
  return card({
    title: 'Recent activity',
    children: [h('div.timeline', ...entries.map((entry) => h('div.timeline__item',
      h('div.small', null, entry.summary),
      h('div.tiny.subtle', null, `${entry.actorName || 'system'} · ${relativeTime(entry.at)}`))))],
  });
}

/* ── quick actions ───────────────────────────────────────────────────────── */

function quickActions(ctx) {
  const actions = [];
  if (ctx.can('members:write')) actions.push(['Add person', 'users', '/members?new=1']);
  if (ctx.can('prayer:write')) actions.push(['Prayer request', 'heart', '/prayer?new=1']);
  if (ctx.can('care:write')) actions.push(['Log a visit', 'check', '/care?new=1']);
  if (ctx.can('events:write')) actions.push(['New event', 'calendar', '/events?new=1']);
  if (ctx.can('assistant:read')) actions.push(['Ask Shepherd', 'sparkles', '/assistant']);
  return actions.slice(0, 3).map(([label, iconName, route]) =>
    h('button.btn', { onClick: () => ctx.navigate(route) }, icon(iconName, { size: 15 }), label));
}

function greeting(now) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(name) {
  return String(name || '').split(' ')[0] || 'Welcome';
}
