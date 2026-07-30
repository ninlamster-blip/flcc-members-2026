/**
 * Reports — attendance, growth, visitors, volunteers, giving, prayer, events.
 *
 * Reports are built from the same computations the dashboard uses, so a
 * number never disagrees with itself between screens. Everything on this page
 * can leave as PDF, Excel or CSV, because the audience for a report is often
 * a council meeting or an auditor rather than a browser.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, table, segmented, statCard, barChart, emptyState, badge, toast, progress, aiOutput,
} from '../core/ui.js';
import { formatDate, formatDateParts, formatMoney, isoDate, addDays, formatNumber } from '../core/format.js';
import {
  attendanceTrend, financeSnapshot, absentMembers, churchHealthOverview, ministryHealthScore,
  successionRisk, volunteerWellBeing,
} from '../core/ai.js';
import { downloadCSV, downloadExcel, printReport } from '../core/exporters.js';
import { memberName, sentence, healthTone } from './_shared.js';

export async function render(ctx, route) {
  const tab = route.query.tab || 'attendance';
  const months = Number(route.query.months) || 12;
  const now = new Date();
  const from = addDays(now, -months * 30);

  const reports = {
    attendance: () => attendanceReport(ctx, from, now),
    growth: () => growthReport(ctx, from, now),
    volunteers: () => volunteerReport(ctx, from, now),
    giving: () => givingReport(ctx, from, now),
    prayer: () => prayerReport(ctx, from, now),
    events: () => eventsReport(ctx, from, now),
    leadership: () => leadershipReport(ctx, now),
  };

  const built = (reports[tab] || reports.attendance)();

  return page({
    title: 'Reports',
    subtitle: `${formatDate(from)} – ${formatDate(now)}`,
    actions: [
      h('button.btn', { onClick: () => printReport({ title: `${ctx.tenant.name} — ${built.title}`, subtitle: `${formatDate(from)} – ${formatDate(now)} · prepared by ${ctx.user.name}`, nodes: built.printNodes || [built.node] }) },
        icon('file', { size: 15 }), 'PDF'),
      ctx.can('reports:export') && built.export
        ? h('button.btn', { onClick: () => built.export('excel') }, icon('download', { size: 15 }), 'Excel')
        : null,
      ctx.can('reports:export') && built.export
        ? h('button.btn', { onClick: () => built.export('csv') }, icon('download', { size: 15 }), 'CSV')
        : null,
    ].filter(Boolean),
    children: [
      h('div.row.row--wrap', { style: { marginBottom: '18px' } },
        h('div', { style: { overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' } },
          segmented({
            options: [
              { value: 'attendance', label: 'Attendance' },
              { value: 'growth', label: 'Growth' },
              { value: 'volunteers', label: 'Volunteers' },
              ...(ctx.can('finance:read') ? [{ value: 'giving', label: 'Giving' }] : []),
              { value: 'prayer', label: 'Prayer' },
              { value: 'events', label: 'Events' },
              ...(ctx.can('leadership:read') ? [{ value: 'leadership', label: 'Leadership' }] : []),
            ],
            value: tab,
            onChange: (value) => ctx.navigate(`/reports?tab=${value}&months=${months}`),
          })),
        h('div.spacer'),
        segmented({
          options: [{ value: 3, label: '3m' }, { value: 6, label: '6m' }, { value: 12, label: '12m' }, { value: 24, label: '24m' }],
          value: months,
          onChange: (value) => ctx.navigate(`/reports?tab=${tab}&months=${value}`),
        })),
      built.node,
    ],
  });
}

/* ── attendance ──────────────────────────────────────────────────────────── */

function attendanceReport(ctx, from, now) {
  const { db } = ctx;
  const sessions = db.all('attendance')
    .filter((s) => new Date(s.date) >= from)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!sessions.length) {
    return { title: 'Attendance', node: emptyState({ title: 'No attendance in this period', iconName: 'chart' }) };
  }

  const trend = attendanceTrend(db, { now, weeks: 8 });
  const byService = new Map();
  for (const session of sessions) {
    const entry = byService.get(session.service) || { service: session.service, count: 0, total: 0, best: 0 };
    entry.count += 1;
    entry.total += session.total || 0;
    entry.best = Math.max(entry.best, session.total || 0);
    byService.set(session.service, entry);
  }
  const rows = [...byService.values()].map((entry) => ({
    ...entry, average: Math.round(entry.total / entry.count),
  }));

  const chart = barChart(sessions.slice(-24).map((session) => ({
    label: formatDateParts(session.date, { day: 'numeric', month: 'numeric' }),
    value: session.total || 0,
  })));

  const tableNode = table({
    columns: [
      { label: 'Service', key: 'service' },
      { label: 'Services held', numeric: true, key: 'count' },
      { label: 'Average', numeric: true, key: 'average' },
      { label: 'Best', numeric: true, key: 'best' },
    ],
    rows,
  });

  const node = h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: sessions.length, label: 'Services recorded' }),
      statCard({ value: Math.round(sessions.reduce((total, s) => total + (s.total || 0), 0) / sessions.length), label: 'Average attendance' }),
      statCard({ value: Math.max(...sessions.map((s) => s.total || 0)), label: 'Highest' }),
      statCard({
        value: `${trend.changePct > 0 ? '+' : ''}${Math.round(trend.changePct)}%`,
        label: 'Eight-week trend',
        deltaDirection: trend.direction === 'down' ? 'down' : 'up',
      })),
    card({ title: 'Every service in the period', children: [chart] }),
    card({ title: 'By service', children: [tableNode] }));

  return {
    title: 'Attendance report',
    node,
    printNodes: [tableNode],
    export: (format) => exportRows(ctx, format, 'attendance', sessions.map((s) => ({
      date: s.date, service: s.service, present: (s.memberIds || []).length, visitors: s.visitors || 0, total: s.total || 0,
    })), [
      { key: 'date', label: 'Date' }, { key: 'service', label: 'Service' },
      { key: 'present', label: 'Members present' }, { key: 'visitors', label: 'Visitors' }, { key: 'total', label: 'Total' },
    ]),
  };
}

/* ── growth ──────────────────────────────────────────────────────────────── */

function growthReport(ctx, from, now) {
  const { db } = ctx;
  const members = db.where('members', (m) => !m.archived);
  const joined = members.filter((m) => new Date(m.joinedOn || m.createdAt) >= from);
  const baptisms = members.filter((m) => m.baptismDate && new Date(m.baptismDate) >= from);
  const absent = absentMembers(db, { now, weeks: ctx.settings.followUpAfterWeeks || 3 });

  const monthly = new Map();
  for (const member of joined) {
    const key = String(member.joinedOn || member.createdAt).slice(0, 7);
    monthly.set(key, (monthly.get(key) || 0) + 1);
  }
  const points = [...monthly].sort().map(([month, count]) => ({ label: month.slice(5), value: count }));

  const statusRows = ['visitor', 'regular', 'member', 'inactive', 'transferred'].map((status) => ({
    status: sentence(status),
    count: members.filter((m) => m.status === status).length,
  }));

  const nationalities = new Map();
  for (const member of members) {
    if (!member.nationality) continue;
    nationalities.set(member.nationality, (nationalities.get(member.nationality) || 0) + 1);
  }

  const tableNode = table({
    columns: [{ label: 'Status', key: 'status' }, { label: 'People', numeric: true, key: 'count' }],
    rows: statusRows,
  });

  const node = h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: members.length, label: 'People on the roll' }),
      statCard({ value: joined.length, label: 'New in this period' }),
      statCard({ value: baptisms.length, label: 'Baptisms' }),
      statCard({ value: absent.length, label: 'Not seen recently' })),
    points.length ? card({ title: 'New people by month', children: [barChart(points)] }) : null,
    h('div.grid.grid--2',
      card({ title: 'By status', children: [tableNode] }),
      card({
        title: 'By nationality',
        subtitle: 'A Gulf congregation is usually many churches in one room.',
        children: [table({
          columns: [{ label: 'Nationality', key: 'nationality' }, { label: 'People', numeric: true, key: 'count' }],
          rows: [...nationalities].sort((a, b) => b[1] - a[1]).map(([nationality, count]) => ({ nationality, count })),
        })],
      })));

  return {
    title: 'Growth report',
    node,
    printNodes: [tableNode],
    export: (format) => exportRows(ctx, format, 'growth', members.map((m) => ({
      name: m.fullName, status: m.status, joined: m.joinedOn || '', baptised: m.baptised ? 'yes' : '',
      nationality: m.nationality || '', ministries: (m.ministries || []).join('; '),
    })), [
      { key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }, { key: 'joined', label: 'First visit' },
      { key: 'baptised', label: 'Baptised' }, { key: 'nationality', label: 'Nationality' }, { key: 'ministries', label: 'Ministries' },
    ]),
  };
}

/* ── volunteers ──────────────────────────────────────────────────────────── */

function volunteerReport(ctx, from, now) {
  const { db } = ctx;
  const tasks = db.all('eventTasks');
  const counts = new Map();
  for (const task of tasks) {
    if (!task.ownerId) continue;
    counts.set(task.ownerId, (counts.get(task.ownerId) || 0) + 1);
  }
  const rows = [...counts].map(([memberId, count]) => ({
    name: memberName(db, memberId),
    count,
    ministries: (db.find('members', memberId) || {}).ministries || [],
  })).sort((a, b) => b.count - a.count);

  const ministries = db.all('ministries').map((ministry) => {
    const serving = db.where('members', (m) => (m.ministries || []).includes(ministry.name) && !m.archived).length;
    return { ministry: ministry.name, serving, needed: ministry.minVolunteers || 0, gap: Math.max(0, (ministry.minVolunteers || 0) - serving) };
  });

  const unassigned = tasks.filter((t) => !t.ownerId && !t.done).length;
  const tableNode = table({
    columns: [
      { label: 'Person', key: 'name' },
      { label: 'Jobs taken', numeric: true, key: 'count' },
      { label: 'Ministries', value: (row) => row.ministries.join(', ') },
    ],
    rows: rows.slice(0, 40),
  });

  const node = h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: rows.length, label: 'People serving' }),
      statCard({ value: tasks.length, label: 'Jobs on the rota' }),
      statCard({ value: unassigned, label: 'Unassigned' }),
      statCard({ value: ministries.reduce((total, m) => total + m.gap, 0), label: 'Volunteers short' })),
    card({
      title: 'Ministry coverage',
      children: [ministries.length
        ? h('div.stack.stack--sm', ...ministries.map((entry) => h('div', null,
          h('div.row.row--between',
            h('strong.small', entry.ministry),
            h('span.small.nums', `${entry.serving}${entry.needed ? ` of ${entry.needed}` : ''}`)),
          entry.needed ? progress(entry.serving, entry.needed) : null)))
        : h('p.small.muted', 'No ministries recorded.')],
    }),
    card({ title: 'Who is carrying the load', children: [tableNode] }));

  return {
    title: 'Volunteer report',
    node,
    printNodes: [tableNode],
    export: (format) => exportRows(ctx, format, 'volunteers', rows, [
      { key: 'name', label: 'Person' }, { key: 'count', label: 'Jobs taken' },
      { label: 'Ministries', value: (row) => row.ministries.join('; ') },
    ]),
  };
}

/* ── giving ──────────────────────────────────────────────────────────────── */

function givingReport(ctx, from, now) {
  const { db } = ctx;
  if (!ctx.can('finance:read')) {
    return { title: 'Giving', node: emptyState({ title: 'Not available to your role', iconName: 'lock' }) };
  }
  const snapshot = financeSnapshot(db, { from, to: now });
  const transactions = db.where('transactions', (t) => new Date(t.date) >= from && t.status !== 'rejected');

  const monthly = new Map();
  for (const tx of transactions) {
    const key = String(tx.date).slice(0, 7);
    const entry = monthly.get(key) || { month: key, giving: 0, expenses: 0 };
    if (tx.kind === 'giving') entry.giving += Number(tx.amount || 0);
    else entry.expenses += Number(tx.amount || 0);
    monthly.set(key, entry);
  }
  const points = [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month));

  const tableNode = table({
    columns: [
      { label: 'Month', key: 'month' },
      { label: 'Giving', numeric: true, value: (row) => formatMoney(row.giving) },
      { label: 'Expenses', numeric: true, value: (row) => formatMoney(row.expenses) },
      { label: 'Net', numeric: true, value: (row) => formatMoney(row.giving - row.expenses) },
    ],
    rows: points,
  });

  const node = h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: formatMoney(snapshot.giving), label: 'Total giving' }),
      statCard({ value: formatMoney(snapshot.expenses), label: 'Total spending' }),
      statCard({ value: formatMoney(snapshot.net), label: 'Net' }),
      statCard({ value: formatMoney(points.length ? snapshot.giving / points.length : 0), label: 'Average month' })),
    card({ title: 'Giving by month', children: [barChart(points.map((p) => ({ label: p.month.slice(5), value: p.giving })), { format: formatMoney })] }),
    card({ title: 'Month by month', children: [tableNode] }),
    card({
      title: 'By category',
      children: [table({
        columns: [
          { label: 'Category', key: 'category' },
          { label: 'Amount', numeric: true, value: (row) => formatMoney(row.amount) },
        ],
        rows: snapshot.givingByCategory,
      })],
    }));

  return {
    title: 'Giving report',
    node,
    printNodes: [tableNode],
    export: (format) => exportRows(ctx, format, 'giving', points, [
      { key: 'month', label: 'Month' },
      { label: 'Giving', value: (row) => row.giving },
      { label: 'Expenses', value: (row) => row.expenses },
      { label: 'Net', value: (row) => row.giving - row.expenses },
    ]),
  };
}

/* ── prayer ──────────────────────────────────────────────────────────────── */

function prayerReport(ctx, from, now) {
  const { db } = ctx;
  const requests = db.all('prayers').filter((p) => new Date(p.createdAt) >= from);
  const answered = requests.filter((p) => p.status === 'answered');
  const byCategory = new Map();
  for (const request of requests) byCategory.set(request.category, (byCategory.get(request.category) || 0) + 1);

  const rows = [...byCategory].sort((a, b) => b[1] - a[1]).map(([category, count]) => ({
    category: sentence(category),
    count,
    answered: requests.filter((p) => p.category === category && p.status === 'answered').length,
  }));

  const tableNode = table({
    columns: [
      { label: 'Category', key: 'category' },
      { label: 'Requests', numeric: true, key: 'count' },
      { label: 'Answered', numeric: true, key: 'answered' },
    ],
    rows,
  });

  const node = h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: requests.length, label: 'Requests recorded' }),
      statCard({ value: answered.length, label: 'Answered' }),
      statCard({ value: requests.length ? `${Math.round((answered.length / requests.length) * 100)}%` : '—', label: 'Answered and recorded' }),
      statCard({ value: requests.reduce((total, p) => total + (p.prayedCount || 0), 0), label: 'Times prayed' })),
    card({ title: 'By category', children: [tableNode] }),
    card({
      title: 'Answered prayer in this period',
      children: [answered.length
        ? h('div.timeline', ...answered.slice(0, 12).map((request) => h('div.timeline__item.timeline__item--accent',
          h('strong.small', request.title),
          request.answeredNote ? h('p.small.muted', request.answeredNote) : null,
          h('div.tiny.subtle', request.answeredOn ? formatDate(request.answeredOn) : ''))))
        : h('p.small.muted', 'None recorded — worth asking the congregation what God has done.')],
    }));

  return {
    title: 'Prayer report',
    node,
    printNodes: [tableNode],
    export: (format) => exportRows(ctx, format, 'prayer', rows, [
      { key: 'category', label: 'Category' }, { key: 'count', label: 'Requests' }, { key: 'answered', label: 'Answered' },
    ]),
  };
}

/* ── events ──────────────────────────────────────────────────────────────── */

function eventsReport(ctx, from, now) {
  const { db } = ctx;
  const events = db.all('events').filter((e) => new Date(e.startsAt) >= from);
  const rows = events.map((event) => ({
    title: event.title,
    type: sentence(event.type),
    date: formatDate(event.startsAt),
    attended: db.where('checkins', (c) => c.eventId === event.id).length,
    tasks: db.where('eventTasks', (t) => t.eventId === event.id).length,
    budget: event.budget || 0,
  })).sort((a, b) => new Date(b.date) - new Date(a.date));

  const tableNode = table({
    columns: [
      { label: 'Event', key: 'title' },
      { label: 'Type', key: 'type' },
      { label: 'Date', key: 'date' },
      { label: 'Checked in', numeric: true, key: 'attended' },
      { label: 'Tasks', numeric: true, key: 'tasks' },
      ...(ctx.can('finance:read') ? [{ label: 'Budget', numeric: true, value: (row) => formatMoney(row.budget) }] : []),
    ],
    rows,
  });

  const node = h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: events.length, label: 'Events' }),
      statCard({ value: rows.reduce((total, r) => total + r.attended, 0), label: 'Total check-ins' }),
      statCard({ value: events.filter((e) => e.status === 'cancelled').length, label: 'Cancelled' }),
      statCard({ value: db.all('checkins').filter((c) => c.firstTime).length, label: 'First-time visitors' })),
    card({ title: 'Every event in the period', children: [tableNode] }));

  return {
    title: 'Events report',
    node,
    printNodes: [tableNode],
    export: (format) => exportRows(ctx, format, 'events', rows, [
      { key: 'title', label: 'Event' }, { key: 'type', label: 'Type' }, { key: 'date', label: 'Date' },
      { key: 'attended', label: 'Checked in' }, { key: 'tasks', label: 'Tasks' },
    ]),
  };
}

/* ── leadership ──────────────────────────────────────────────────────────── */

/**
 * Not new computation — one printable, exportable page over the same
 * church health, ministry health, succession and well-being functions the
 * Leadership tabs already show live, for the audience that actually wants a
 * document out of it: a council meeting, a board packet, a handover file.
 */
function leadershipReport(ctx, now) {
  const { db } = ctx;
  if (!ctx.can('leadership:read')) {
    return { title: 'Leadership', node: emptyState({ title: 'Not available to your role', iconName: 'lock' }) };
  }

  const overview = churchHealthOverview(db, { now });
  const ministries = db.all('ministries').map((ministry) => ({ ministry, health: ministryHealthScore(db, ministry, { now }) }))
    .sort((a, b) => a.health.score - b.health.score);
  const risks = successionRisk(db).filter((r) => r.risk !== 'info');
  const wellBeing = volunteerWellBeing(db, { now });
  const stretched = wellBeing.filter((v) => v.status === 'needs-attention' || v.status === 'critical');

  const ministryRows = ministries.map(({ ministry, health }) => ({
    ministry: ministry.name, score: health.score, rating: health.rating, serving: health.serving, needed: health.needed,
  }));
  const ministryTable = table({
    columns: [
      { label: 'Ministry', key: 'ministry' },
      { label: 'Score', numeric: true, value: (r) => `${r.score}%` },
      { label: 'Rating', key: 'rating' },
      { label: 'Serving', numeric: true, value: (r) => `${r.serving}${r.needed ? ` of ${r.needed}` : ''}` },
    ],
    rows: ministryRows,
  });

  const riskRows = risks.map((r) => ({
    name: r.name, role: r.role === 'ministry' ? 'Ministry' : 'Committee', risk: r.risk, reason: r.reason,
  }));
  // A table cell wraps long free text into a tall, near-empty-looking row on
  // a narrow screen — every other table in this file keeps to short,
  // scannable columns and puts prose in its own line instead, so the risk
  // reason gets a list, not a "Why" table column.
  const riskList = riskRows.length
    ? h('div.stack.stack--sm', ...riskRows.map((r) => h('div', null,
      h('div.row.row--between',
        h('strong.small', `${r.name} (${r.role})`),
        badge(sentence(r.risk), r.risk === 'urgent' ? 'danger' : 'warn')),
      h('p.tiny.subtle', r.reason))))
    : h('p.small.muted', 'Every ministry and committee has a named deputy and a bench of others serving alongside the lead.');

  const node = h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: `${overview.score}%`, label: `Church health — ${overview.statusLabel}` }),
      statCard({ value: ministries.length, label: 'Ministries' }),
      statCard({ value: risks.length, label: 'Succession gaps' }),
      statCard({ value: stretched.length, label: 'Volunteers stretched' })),
    card({
      title: 'Church health by dimension',
      children: [h('div.grid.grid--3', ...overview.dimensions.map((dim) => h('div.stack.stack--sm', { style: { padding: '10px', border: '1px solid var(--border, #e5e5e5)', borderRadius: '8px' } },
        h('div.row.row--between', h('span.small', dim.label), badge(`${dim.score}%`, healthTone(dim.score))),
        h('p.tiny.subtle', dim.detail))))],
    }),
    card({ title: 'Ministry health', children: [ministryTable] }),
    card({ title: 'Succession gaps', children: [riskList] }));

  return {
    title: 'Leadership report',
    node,
    printNodes: [ministryTable, riskList],
    export: (format) => exportRows(ctx, format, 'leadership', ministryRows, [
      { key: 'ministry', label: 'Ministry' }, { key: 'score', label: 'Score' }, { key: 'rating', label: 'Rating' },
      { key: 'serving', label: 'Serving' }, { key: 'needed', label: 'Needed' },
    ]),
  };
}

/* ── export ──────────────────────────────────────────────────────────────── */

function exportRows(ctx, format, name, rows, columns) {
  const filename = `${ctx.tenant.id}-${name}-${isoDate(new Date())}`;
  if (format === 'excel') downloadExcel(`${filename}.xls`, [{ name: sentence(name), columns, rows }]);
  else downloadCSV(`${filename}.csv`, rows, columns);
  ctx.db.log('export', `Exported the ${name} report (${rows.length} rows).`);
  toast('Exported.', { variant: 'ok' });
}
