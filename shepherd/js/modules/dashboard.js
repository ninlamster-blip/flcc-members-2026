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
  computeInsights, activeNotifications, attendanceTrend, upcomingCelebrations, financeSnapshot, absentMembers,
  buildBriefing, ministryHealthScore, SERVICE_ROLE_FIELDS, serviceReadiness,
} from '../core/ai.js';
import { ledMinistries, isCommunionScheduled } from '../core/policies.js';
import { formatDate, formatDateParts, formatTime, formatDateTime, relativeTime, isoDate, addDays, formatMoney, daysBetween } from '../core/format.js';
import { can } from '../core/rbac.js';
import { syncFLCCAttendance } from '../core/flccSync.js';
import { memberName, statusBadge, healthTone } from './_shared.js';

/**
 * A church opts into this in Settings → Data; off by default. Fires without
 * blocking the dashboard's own render — a slow or unreachable FLCC endpoint
 * must never be why the dashboard takes longer to appear. At most once a day
 * per tenant, and only for a login that could actually write an attendance
 * record anyway (attendance's resource is members, per schema.js).
 */
function maybeAutoSyncFLCCAttendance(ctx) {
  const { db, user, app } = ctx;
  if (!can(user, 'members:write')) return;
  const config = app.loadFLCCSyncConfig();
  if (!config.autoSync) return;
  if (config.lastSyncedAt && daysBetween(config.lastSyncedAt, new Date()) < 1) return;

  syncFLCCAttendance(db)
    .then(() => app.saveFLCCSyncConfig({ lastSyncedAt: new Date().toISOString() }))
    .catch(() => { /* a quiet background check should stay quiet when it fails, too */ });
}

/**
 * Which of the role-based dashboards this login sees.
 *
 * The spec asks for a bespoke layout per ministry (Worship, Children, Youth,
 * Evangelism, Discipleship). Five of those overlap almost entirely in what
 * real data backs them — roster, tasks, shortages, health — so rather than
 * invent widgets for data Shepherd does not track (memory verses, conversion
 * statistics, a discipleship pathway), they share one adaptable "ministry
 * lead" template keyed by whichever ministry this user actually leads.
 * Finance (treasurer) and the Senior Pastor overview get their own, because
 * finance.js and the church-wide insights genuinely support something
 * different for them.
 */
function dashboardMode(ctx) {
  const { user, db } = ctx;
  if (user.role === 'senior_pastor') return { key: 'senior_pastor', label: 'Senior Pastor' };
  if (user.role === 'treasurer') return { key: 'finance', label: 'Finance leader' };

  const led = ledMinistries(db, user);
  if (led.length) {
    const preferredOrder = [/worship/i, /children/i, /youth/i, /evangelism/i, /discipleship/i];
    const preferred = preferredOrder.map((re) => led.find((m) => re.test(m.name))).find(Boolean);
    const ministry = preferred || led[0];
    return { key: 'ministry', label: `${ministry.name} leader`, ministry };
  }
  if (['church_admin', 'secretary'].includes(user.role)) return { key: 'admin', label: 'Admin' };
  return { key: 'generic', label: '' };
}

export async function render(ctx) {
  const { db, user } = ctx;
  const now = new Date();
  const dismissals = db.where('dismissals', (d) => d.createdBy === user.id);
  const insights = activeNotifications(computeInsights(db, user, { settings: ctx.settings }), dismissals, { now });
  const briefing = buildBriefing(db, user, { now, settings: ctx.settings });
  const mode = dashboardMode(ctx);

  notifyIfEnabled(ctx, insights);
  maybeAutoSyncFLCCAttendance(ctx);

  const columns = h('div.grid.grid--main-side',
    h('div.stack', briefingCard(briefing), ...mainColumn(ctx, now, insights, mode)),
    h('div.stack', ...sideColumn(ctx, now, mode)));

  return page({
    eyebrow: `${greeting(now)}${mode.label ? ` · ${mode.label}` : ''}`,
    title: firstName(user.name),
    subtitle: `${ctx.tenant.name} · ${formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}`,
    actions: quickActions(ctx, mode),
    children: [columns],
  });
}

/* ── the morning briefing ────────────────────────────────────────────────── */

function briefingCard(lines) {
  return card({
    title: 'This week',
    actions: [badge('Personalised for you')],
    children: [h('ul', { style: { margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px' } },
      ...lines.map((line) => h('li.small', line)))],
  });
}

/* ── columns ─────────────────────────────────────────────────────────────── */

function mainColumn(ctx, now, insights, mode) {
  const out = [];

  if (mode.key === 'finance') out.push(...financeLeaderCards(ctx, now));
  if (mode.key === 'ministry') out.push(...ministryLeaderCards(ctx, now, mode.ministry));

  out.push(statRow(ctx, now));

  if (insights.length) {
    out.push(card({
      title: 'Shepherd noticed',
      subtitle: 'Computed from your own records on this device.',
      actions: [notificationToggle(ctx), h('span.badge.badge--ai', icon('sparkles', { size: 12 }), 'Insights')],
      children: [h('div.stack.stack--sm', ...insights.slice(0, 6).map((insight) => insightCard(ctx, insight)))],
    }));
  }

  out.push(todaySchedule(ctx, now));

  if (ctx.can('worship:read')) {
    const widget = upcomingServiceWidget(ctx, now);
    if (widget) out.push(widget);
  }
  if (ctx.can('members:read') && mode.key !== 'ministry') out.push(attendanceCard(ctx, now));
  if (ctx.can('care:read') && mode.key !== 'finance') out.push(followUpsCard(ctx, now));
  if (ctx.can('prayer:read') && mode.key !== 'finance') out.push(prayerCard(ctx));

  return out;
}

function sideColumn(ctx, now, mode) {
  const out = [];
  if (ctx.can('events:read')) out.push(upcomingEvents(ctx, now));
  if (ctx.can('members:read')) out.push(celebrationsCard(ctx, now));
  if (mode.key !== 'finance' && ctx.can('finance:read')) out.push(financeCard(ctx, now));
  if (mode.key !== 'ministry' && ctx.can('members:read')) out.push(visitorsCard(ctx, now));
  if ((mode.key === 'senior_pastor' || mode.key === 'admin') && ctx.can('leadership:read')) out.push(ministryHealthOverviewCard(ctx, now));
  out.push(activityCard(ctx));
  return out;
}

/* ── finance leader ──────────────────────────────────────────────────────── */

function financeLeaderCards(ctx, now) {
  const { db } = ctx;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const snapshot = financeSnapshot(db, { from: monthStart, to: now });
  const pending = db.where('transactions', (t) => t.status === 'pending-approval')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const expiringFinanceDocs = db.where('documents', (d) => d.category === 'finance' && d.expiresOn && daysBetween(now, d.expiresOn) <= 60);

  return [
    h('div.grid.grid--3',
      statCard({ value: formatMoney(snapshot.giving), label: 'Given this month' }),
      statCard({ value: formatMoney(snapshot.expenses), label: 'Spent this month' }),
      statCard({ value: pending.length, label: 'Awaiting approval' })),
    card({
      title: 'Financial reports awaiting approval',
      actions: [h('button.btn.btn--sm', { onClick: () => ctx.navigate('/finance?tab=approvals') }, 'Open')],
      children: [pending.length
        ? list(pending.slice(0, 6).map((tx) => listItem({
          title: tx.description || tx.category,
          meta: `${formatMoney(tx.amount)} · ${formatDate(tx.date)}`,
          onClick: () => ctx.navigate('/finance?tab=approvals'),
        })))
        : emptyState({ title: 'Nothing waiting', iconName: 'check' })],
    }),
    card({
      title: 'Ministry spending this month',
      children: [snapshot.expensesByCategory.length
        ? h('div.stack.stack--sm', ...snapshot.expensesByCategory.slice(0, 6).map((row) => h('div.row.row--between.small',
          h('span', row.category), h('span.nums', formatMoney(row.amount)))))
        : h('p.small.muted', 'Nothing recorded yet this month.')],
    }),
    expiringFinanceDocs.length ? card({
      title: 'Audit reminders',
      subtitle: 'Finance documents expiring soon',
      children: [list(expiringFinanceDocs.map((d) => listItem({
        title: d.title,
        meta: `Expires ${formatDate(d.expiresOn)}`,
        onClick: () => ctx.navigate(`/documents/${d.id}`),
      })))],
    }) : null,
  ].filter(Boolean);
}

/* ── ministry leader (worship / children / youth / evangelism / discipleship) */

function ministryLeaderCards(ctx, now, ministry) {
  const { db } = ctx;
  const health = ministryHealthScore(db, ministry, { now });
  const serving = db.where('members', (m) => !m.archived && (m.ministries || []).includes(ministry.name));
  const tasks = db.all('eventTasks').filter((t) => serving.some((m) => m.id === t.ownerId) && !t.done)
    .concat(db.where('actionItems', (a) => a.ministryId === ministry.id && a.status !== 'done' && a.status !== 'dropped'));

  return [
    card({
      title: ministry.name,
      subtitle: ministry.purpose,
      actions: [badge(`${health.score}% ${health.rating}`, healthTone(health.score)), h('button.btn.btn--sm', { onClick: () => ctx.navigate(`/leadership?tab=workspaces&ministry=${ministry.id}`) }, 'Workspace')],
      children: [
        h('div.row', { style: { gap: '24px' } },
          stat({ value: serving.length, label: 'Serving' }),
          stat({ value: tasks.length, label: 'Open tasks' }),
          stat({ value: health.tasksOverdue, label: 'Overdue' })),
        health.needed && serving.length < health.needed
          ? h('p.small.muted', { style: { marginTop: '10px' } }, `Short ${health.needed - serving.length} of ${health.needed} volunteers needed.`)
          : null,
      ],
    }),
    tasks.length ? card({
      title: 'Open tasks',
      children: [list(tasks.slice(0, 6).map((task) => listItem({
        title: task.title,
        meta: task.dueDate ? `due ${formatDate(task.dueDate)}` : 'no date',
        onClick: () => ctx.navigate('/leadership?tab=tasks'),
      })))],
    }) : null,
  ].filter(Boolean);
}

/* ── senior pastor / admin: health across every ministry ────────────────── */

function ministryHealthOverviewCard(ctx, now) {
  const { db } = ctx;
  const ministries = db.all('ministries');
  if (!ministries.length) return null;
  const scored = ministries.map((m) => ({ ministry: m, health: ministryHealthScore(db, m, { now }) }))
    .sort((a, b) => a.health.score - b.health.score);

  return card({
    title: 'Ministry health',
    subtitle: 'Computed from tasks, coverage and recent activity.',
    actions: [h('button.btn.btn--sm', { onClick: () => ctx.navigate('/leadership?tab=health') }, 'Details')],
    children: [list(scored.map(({ ministry, health }) => listItem({
      title: ministry.name,
      meta: `${health.serving} serving${health.needed ? ` of ${health.needed}` : ''}`,
      trailing: badge(`${health.score}%`, healthTone(health.score)),
      onClick: () => ctx.navigate(`/leadership?tab=workspaces&ministry=${ministry.id}`),
    })))],
  });
}

/* ── upcoming service widgets — the Leadership Dashboard ─────────────────── */

/**
 * The two recurring services, side by side, each with its own countdown,
 * this user's assigned role(s), the communion indicator, the practice
 * schedule if one is set, and a preparation-status readout — rather than a
 * single "next service" card that hides whichever of Friday/Sunday is
 * further off. Volunteer shortages are covered separately by the
 * worship-shortages insight in "Shepherd noticed", not duplicated here.
 */
function upcomingServiceWidget(ctx, now) {
  const { db } = ctx;
  const nextFriday = db.where('serviceSchedule', (s) => s.serviceType === 'friday' && new Date(s.date) >= new Date(now.toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  const nextSunday = db.where('serviceSchedule', (s) => s.serviceType === 'sunday' && new Date(s.date) >= new Date(now.toDateString()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
  if (!nextFriday && !nextSunday) return null;

  return card({
    title: 'Upcoming services',
    children: [h('div.grid.grid--2',
      ...[nextFriday, nextSunday].filter(Boolean).map((service) => serviceCountdownCard(ctx, now, service)))],
  });
}

function serviceCountdownCard(ctx, now, service) {
  const { user } = ctx;
  const days = Math.round((new Date(service.date) - new Date(now.toDateString())) / 864e5);
  const myRoles = SERVICE_ROLE_FIELDS
    .filter(([key]) => user.memberId && service[key] === user.memberId)
    .map(([, label]) => label);
  const readiness = serviceReadiness(service);
  const communion = isCommunionScheduled(service);

  return h('div.card.card--tight',
    h('div.row.row--between.row--wrap',
      h('div', null,
        h('strong', service.service),
        h('div.tiny.subtle', formatDate(service.date, { weekday: 'long', day: 'numeric', month: 'long' }))),
      badge(days === 0 ? 'Today' : `${days} day${days === 1 ? '' : 's'}`, days <= 1 ? 'accent' : '')),
    h('div.chip-list', { style: { marginTop: '8px' } },
      communion ? badge('Communion', 'accent') : null,
      badge(`${readiness.filled}/${readiness.total} roles filled`, readiness.filled >= readiness.total ? 'ok' : readiness.filled === 0 ? 'danger' : 'warn'),
      service.rehearsalAt ? badge(`Practice ${formatDateTime(service.rehearsalAt)}`, '') : null),
    h('div', { style: { marginTop: '8px' } }, myRoles.length
      ? h('div.stack.stack--sm', ...myRoles.map((role) => h('div.row', icon('check', { size: 15 }), h('span.small', `You are assigned as ${role}`))))
      : h('p.small.muted', 'You are not assigned to a role on this service.')),
    h('div.row', { style: { marginTop: '10px' } },
      h('button.btn.btn--sm', { onClick: () => ctx.navigate('/leadership?tab=schedule') }, 'Open the schedule')));
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
      : null,
    h('button.icon-btn', {
      'aria-label': 'Dismiss',
      title: 'Dismiss — comes back if this changes, or after a week',
      onClick: async () => {
        ctx.db.insert('dismissals', { insightId: insight.id, detail: insight.detail || '' });
        await ctx.db.flush();
        ctx.refresh();
      },
    }, icon('x', { size: 14 })));
}

/**
 * A small opt-in toggle for native browser notifications on urgent insights
 * — client-side only, and only while this tab is open, since Shepherd has no
 * server to push through. Stored per user in `preferences`.
 */
function notificationToggle(ctx) {
  const { db, user } = ctx;
  if (typeof Notification === 'undefined') return null;
  const pref = db.where('preferences', (p) => p.createdBy === user.id)[0];
  const enabled = !!(pref && pref.browserNotifications) && Notification.permission === 'granted';

  return h(`button.icon-btn${enabled ? '.icon-btn--active' : ''}`, {
    'aria-label': enabled ? 'Browser alerts on' : 'Enable browser alerts',
    title: enabled ? 'Browser alerts on for urgent insights — click to turn off' : 'Get a browser alert for urgent insights while this tab is open',
    onClick: async () => {
      if (enabled) {
        if (pref) { ctx.db.update('preferences', pref.id, { browserNotifications: false }); await ctx.db.flush(); }
        ctx.refresh();
        return;
      }
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') return;
      if (pref) ctx.db.update('preferences', pref.id, { browserNotifications: true });
      else ctx.db.insert('preferences', { browserNotifications: true });
      await ctx.db.flush();
      ctx.refresh();
    },
  }, icon('bell', { size: 14 }));
}

/** Fire a real browser notification for anything urgent this session hasn't already shown. */
function notifyIfEnabled(ctx, insights) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const pref = ctx.db.where('preferences', (p) => p.createdBy === ctx.user.id)[0];
  if (!pref || !pref.browserNotifications) return;

  const storageKey = `shepherd-notified-${ctx.tenant.id}-${ctx.user.id}`;
  let alreadyShown;
  try {
    alreadyShown = new Set(JSON.parse(sessionStorage.getItem(storageKey) || '[]'));
  } catch {
    alreadyShown = new Set();
  }

  for (const insight of insights) {
    if (insight.severity !== 'urgent') continue;
    const key = `${insight.id}::${insight.detail || ''}`;
    if (alreadyShown.has(key)) continue;
    alreadyShown.add(key);
    try { new Notification(insight.title, { body: insight.detail }); } catch { /* best-effort only */ }
  }
  sessionStorage.setItem(storageKey, JSON.stringify([...alreadyShown]));
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

function quickActions(ctx, mode) {
  const actions = [];

  if (mode.key === 'finance' && ctx.can('finance:write')) {
    actions.push(['Add expense', 'wallet', '/finance?new=1&kind=expense']);
    actions.push(['Record offering', 'wallet', '/finance?new=1&kind=giving']);
    if (ctx.can('finance:approve')) actions.push(['Approve request', 'check', '/finance?tab=approvals']);
    actions.push(['Export report', 'download', '/finance']);
  } else if (mode.key === 'ministry') {
    actions.push(['Ministry workspace', 'shield', `/leadership?tab=workspaces&ministry=${mode.ministry.id}`]);
    if (ctx.can('leadership:write')) actions.push(['Add task', 'plus', '/leadership?tab=tasks']);
    if (ctx.can('worship:write')) actions.push(['Worship schedule', 'calendar', '/leadership?tab=schedule']);
  } else if (mode.key === 'admin') {
    if (ctx.can('worship:write')) actions.push(['Assign volunteer', 'users', '/leadership?tab=schedule']);
    if (ctx.can('communications:write')) actions.push(['Add announcement', 'megaphone', '/communications?tab=compose']);
    actions.push(['Update member', 'users', '/members']);
    actions.push(['Print attendance', 'file', '/members?tab=attendance']);
  } else {
    if (ctx.can('members:write')) actions.push(['Add person', 'users', '/members?new=1']);
    if (ctx.can('prayer:write')) actions.push(['Prayer request', 'heart', '/prayer?new=1']);
    if (ctx.can('care:write')) actions.push(['Log a visit', 'check', '/care?new=1']);
    if (ctx.can('events:write')) actions.push(['New event', 'calendar', '/events?new=1']);
    if (ctx.can('assistant:read')) actions.push(['Ask Shepherd', 'sparkles', '/assistant']);
  }

  return actions.slice(0, 4).map(([label, iconName, route]) =>
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
