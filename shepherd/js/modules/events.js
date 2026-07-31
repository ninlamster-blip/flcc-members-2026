/**
 * Events — planning, volunteers, budget, check-in and the debrief.
 *
 * An event in a church is mostly a list of jobs and the people who agreed to
 * do them, so the detail view leads with the task list and who is missing.
 * Check-in is a code on a QR poster: a phone camera opens the app at that
 * event and the welcome desk taps a name — no scanner app, no accounts for
 * visitors, nothing to install.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, list, listItem, emptyState, badge, avatar, segmented, statCard, table,
  toast, modal, progress, aiOutput, searchField,
} from '../core/ui.js';
import { formatDate, formatDateParts, formatTime, relativeTime, isoDate, formatMoney } from '../core/format.js';
import { blank } from '../core/schema.js';
import { downloadICS, downloadCSV } from '../core/exporters.js';
import { suggestVolunteers } from '../core/ai.js';
import { openRecordModal, newButton, statusBadge, memberName, sentence, deleteRecord, matches } from './_shared.js';

const EVENT_FIELDS = ['title', 'type', 'startsAt', 'endsAt', 'venue', 'description', 'capacity', 'budget', 'ownerId', 'status', 'recurring'];

export async function render(ctx, route) {
  if (route.params[0]) {
    const event = ctx.db.find('events', route.params[0]);
    if (event) return detail(ctx, event, route);
  }
  if (route.query.new === '1' && ctx.can('events:write')) {
    setTimeout(() => openRecordModal(ctx, { collection: 'events', fields: EVENT_FIELDS }), 0);
  }
  return calendar(ctx, route);
}

/* ── list ────────────────────────────────────────────────────────────────── */

function calendar(ctx, route) {
  const { db } = ctx;
  const now = new Date();
  const tab = route.query.tab || 'upcoming';
  let query = '';

  const all = db.all('events');
  const upcoming = all.filter((e) => new Date(e.startsAt) >= now && e.status !== 'cancelled')
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const past = all.filter((e) => new Date(e.startsAt) < now)
    .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));

  const results = h('div');
  const draw = () => {
    const source = tab === 'past' ? past : upcoming;
    const events = source.filter((e) => matches(e, query, ['title', 'venue', 'type', 'description']));
    results.textContent = '';
    results.appendChild(events.length
      ? h('div.stack.stack--sm', ...events.map((event) => eventRow(ctx, event)))
      : emptyState({
        title: tab === 'past' ? 'Nothing in the past' : 'Nothing scheduled',
        detail: 'Retreats, baptisms, training, communion — anything the church puts in a diary.',
        iconName: 'calendar',
        action: newButton(ctx, 'events', 'New event', () => openRecordModal(ctx, { collection: 'events', fields: EVENT_FIELDS })),
      }));
  };
  draw();

  return page({
    title: 'Events',
    subtitle: `${upcoming.length} upcoming · ${past.length} past`,
    actions: [
      h('button.btn', { onClick: () => exportCalendar(ctx, upcoming) }, icon('download', { size: 15 }), 'Calendar file'),
      newButton(ctx, 'events', 'New event', () => openRecordModal(ctx, { collection: 'events', fields: EVENT_FIELDS })),
    ].filter(Boolean),
    children: [
      h('div.row.row--wrap', { style: { marginBottom: '16px' } },
        segmented({
          options: [{ value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }, { value: 'calendar', label: 'Calendar' }],
          value: tab,
          onChange: (value) => ctx.navigate(`/events?tab=${value}`),
        }),
        tab === 'calendar' ? null : h('div', { style: { flex: '1', minWidth: '200px' } },
          searchField({ placeholder: 'Search events…', onInput: (value) => { query = value; draw(); } }))),
      tab === 'calendar' ? eventsCalendar(ctx, all, route) : results,
    ],
  });
}

/* ── calendar ────────────────────────────────────────────────────────────── */

/**
 * Year overview by default (?view=year, or nothing) — twelve small months at
 * once, the same shape as leadership.js's scheduleCalendar, so glancing at
 * the year takes one screen, not twelve. Selecting a month (its title, or
 * any day in it) drills into ?view=month for that one month, which is where
 * a specific day becomes clickable — the year view is for orientation, the
 * month view is for the day-level detail a plan actually needs.
 */
function eventsCalendar(ctx, events, route) {
  const byDate = new Map();
  for (const event of events) {
    if (event.status === 'cancelled') continue;
    const key = isoDate(new Date(event.startsAt));
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(event);
  }

  return route.query.view === 'month'
    ? eventsMonthCalendar(ctx, byDate, route)
    : eventsYearCalendar(ctx, events, byDate, route);
}

function eventsYearCalendar(ctx, events, byDate, route) {
  const now = new Date();
  const viewYear = /^\d{4}$/.test(route.query.year) ? Number(route.query.year) : now.getFullYear();

  const years = new Set(events.map((e) => new Date(e.startsAt).getFullYear()));
  years.add(now.getFullYear());
  years.add(viewYear);
  const yearList = [...years].sort((a, b) => a - b);

  return h('div.stack',
    h('div.row.row--wrap', { style: { alignItems: 'center' } },
      h('select.select', {
        style: { maxWidth: '110px' }, 'aria-label': 'Year',
        onChange: (e) => ctx.navigate(`/events?tab=calendar&year=${e.target.value}`),
      }, ...yearList.map((y) => h('option', { value: y, selected: y === viewYear }, String(y)))),
      h('div.spacer'),
      h('span.tiny.subtle', 'Select a month to plan it in detail')),
    h('div.cal-year', ...Array.from({ length: 12 }, (_, month) => yearMonthGrid(ctx, viewYear, month, byDate))));
}

function yearMonthGrid(ctx, year, month, byDate) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = new Date(year, month, 1).getDay();
  const today = isoDate(new Date());
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(h('div.cal-day.cal-day--empty'));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = isoDate(new Date(year, month, day));
    const dayEvents = byDate.get(dateKey) || [];
    cells.push(h('div.cal-day', { class: `${dayEvents.length ? 'cal-day--ok' : ''} ${dateKey === today ? 'cal-day--today' : ''}`.trim() },
      h('span', String(day)), dayEvents.length ? h('span.cal-day__dot') : null));
  }
  const monthParam = `${year}-${String(month + 1).padStart(2, '0')}`;
  return h('button.cal-month', {
    type: 'button',
    style: { textAlign: 'left', cursor: 'pointer', width: '100%' },
    'aria-label': `Open ${formatDateParts(new Date(year, month, 1), { month: 'long', year: 'numeric' })}`,
    onClick: () => ctx.navigate(`/events?tab=calendar&view=month&month=${monthParam}`),
  },
    h('h3.cal-month__title', formatDateParts(new Date(year, month, 1), { month: 'long' })),
    h('div.cal-grid.cal-grid--head', ...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => h('span.cal-weekday', w))),
    h('div.cal-grid', ...cells));
}

/** One month at a time, day cells clickable to a modal listing that day's events. */
function eventsMonthCalendar(ctx, byDate, route) {
  const now = new Date();
  const monthParam = route.query.month;
  const valid = monthParam && /^\d{4}-\d{2}$/.test(monthParam);
  const viewYear = valid ? Number(monthParam.slice(0, 4)) : now.getFullYear();
  const viewMonth = valid ? Number(monthParam.slice(5, 7)) - 1 : now.getMonth();

  const monthParamFor = (y, m) => `${y}-${String(m + 1).padStart(2, '0')}`;
  const prevMonth = viewMonth === 0 ? monthParamFor(viewYear - 1, 11) : monthParamFor(viewYear, viewMonth - 1);
  const nextMonth = viewMonth === 11 ? monthParamFor(viewYear + 1, 0) : monthParamFor(viewYear, viewMonth + 1);
  const today = isoDate(now);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(h('div.cal-day.cal-day--empty'));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = isoDate(new Date(viewYear, viewMonth, day));
    cells.push(calendarDayCell(ctx, day, dateKey, byDate.get(dateKey) || [], dateKey === today));
  }

  return h('div.stack',
    h('div.row.row--wrap', { style: { alignItems: 'center', gap: '10px' } },
      h('button.btn.btn--sm', { onClick: () => ctx.navigate(`/events?tab=calendar&year=${viewYear}`) }, '‹ All months'),
      h('div.spacer')),
    h('div.row.row--between.row--wrap', { style: { alignItems: 'center' } },
      h('h3.font-display', formatDateParts(new Date(viewYear, viewMonth, 1), { month: 'long', year: 'numeric' })),
      h('div.row', { style: { gap: '6px' } },
        h('button.btn.btn--sm', { onClick: () => ctx.navigate(`/events?tab=calendar&view=month&month=${prevMonth}`) }, '‹ Prev'),
        h('button.btn.btn--sm', { onClick: () => ctx.navigate('/events?tab=calendar&view=month') }, 'Today'),
        h('button.btn.btn--sm', { onClick: () => ctx.navigate(`/events?tab=calendar&view=month&month=${nextMonth}`) }, 'Next ›'))),
    h('div.cal-month', { style: { maxWidth: '680px' } },
      h('div.cal-grid.cal-grid--head', ...['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w) => h('span.cal-weekday', w))),
      h('div.cal-grid', ...cells)));
}

function calendarDayCell(ctx, day, dateKey, dayEvents, isToday) {
  const todayClass = isToday ? ' cal-day--today' : '';
  if (!dayEvents.length) return h('div.cal-day', { class: todayClass.trim() }, h('span', String(day)));

  const summary = dayEvents.map((e) => `${formatTime(e.startsAt)} · ${e.title}`).join('\n');
  return h('button.cal-day.cal-day--has', {
    type: 'button',
    class: `cal-day--ok${todayClass}`,
    title: summary,
    'aria-label': `${dayEvents.length > 1 ? `${dayEvents.length} events` : dayEvents[0].title} on ${formatDate(dateKey)}`,
    onClick: () => openCalendarDayModal(ctx, dateKey, dayEvents),
  }, h('span', String(day)), h('span.cal-day__dot'));
}

function openCalendarDayModal(ctx, dateKey, dayEvents) {
  const ref = modal({
    title: formatDate(dateKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    body: h('div.stack.stack--sm', ...dayEvents.map((event) => eventRow(ctx, event))),
    actions: [h('button.btn', { onClick: () => ref.close() }, 'Close')],
  });
}

function eventRow(ctx, event) {
  const tasks = ctx.db.where('eventTasks', (t) => t.eventId === event.id);
  const unassigned = tasks.filter((t) => !t.ownerId && !t.done).length;
  const checkins = ctx.db.where('checkins', (c) => c.eventId === event.id).length;

  return h('button.card.card--link.card--tight', {
    style: { width: '100%', textAlign: 'left', display: 'block' },
    onClick: () => ctx.navigate(`/events/${event.id}`),
  },
    h('div.row.row--wrap',
      h('div', {
        style: {
          textAlign: 'center', minWidth: '54px', padding: '6px 8px', borderRadius: '10px',
          background: 'var(--surface-2)', flex: 'none',
        },
      },
        h('div.tiny.subtle', formatDateParts(event.startsAt, { month: 'short' })),
        h('div', { style: { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.1' } }, new Date(event.startsAt).getDate()),
        h('div.tiny.subtle', formatDateParts(event.startsAt, { weekday: 'short' }))),
      h('div', { style: { flex: '1', minWidth: '180px' } },
        h('div', { style: { fontWeight: '600' } }, event.title),
        h('div.small.muted', [formatTime(event.startsAt), event.venue, sentence(event.type)].filter(Boolean).join(' · ')),
        h('div.row', { style: { marginTop: '6px', gap: '6px', flexWrap: 'wrap' } },
          statusBadge(event.status),
          unassigned ? badge(`${unassigned} unassigned`, 'warn') : (tasks.length ? badge('Rota complete', 'ok') : null),
          checkins ? badge(`${checkins} checked in`, 'info') : null)),
      h('div.subtle', icon('chevronRight', { size: 18 }))));
}

/* ── detail ──────────────────────────────────────────────────────────────── */

function detail(ctx, event, route) {
  const { db } = ctx;
  const tasks = db.where('eventTasks', (t) => t.eventId === event.id);
  const checkins = db.where('checkins', (c) => c.eventId === event.id);
  const spent = db.where('transactions', (t) => t.kind === 'expense' && t.description
    && String(t.description).toLowerCase().includes(String(event.title).toLowerCase()))
    .reduce((total, t) => total + Number(t.amount || 0), 0);

  const header = card({
    children: [
      h('div.row.row--wrap',
        h('div', { style: { flex: '1', minWidth: '220px' } },
          h('h2', event.title),
          h('p.muted', [
            `${formatDate(event.startsAt, { weekday: 'long' })} · ${formatTime(event.startsAt)}`,
            event.endsAt ? `until ${formatTime(event.endsAt)}` : null,
            event.venue,
          ].filter(Boolean).join(' · ')),
          h('div.row', { style: { marginTop: '8px', gap: '6px' } },
            statusBadge(event.status),
            badge(sentence(event.type)),
            event.ownerId ? badge(`Coordinator: ${memberName(db, event.ownerId)}`) : null)),
        h('div.row.no-print',
          h('button.btn.btn--sm', { onClick: () => exportCalendar(ctx, [event]) }, icon('calendar', { size: 14 }), 'Add to calendar'),
          ctx.can('events:write')
            ? h('button.btn.btn--sm.btn--primary', { onClick: () => openRecordModal(ctx, { collection: 'events', doc: event, fields: EVENT_FIELDS }) }, icon('edit', { size: 14 }), 'Edit')
            : null)),
      event.description ? h('p.small.prose', { style: { marginTop: '12px' } }, event.description) : null,
    ],
  });

  const taskCard = card({
    title: 'Tasks & volunteers',
    subtitle: `${tasks.filter((t) => t.done).length} of ${tasks.length} done`,
    actions: [
      ctx.can('events:write') ? h('button.btn.btn--sm', { onClick: () => suggestRota(ctx, event, tasks) }, icon('sparkles', { size: 14 }), 'Suggest') : null,
      ctx.can('events:write') ? h('button.btn.btn--sm', {
        onClick: () => openRecordModal(ctx, { collection: 'eventTasks', defaults: { eventId: event.id }, hidden: ['eventId'] }),
      }, icon('plus', { size: 14 }), 'Task') : null,
    ].filter(Boolean),
    children: [
      tasks.length ? progress(tasks.filter((t) => t.done).length, tasks.length) : null,
      tasks.length
        ? h('div.list', { style: { marginTop: '12px' } }, ...tasks.map((task) => h('div.list__item',
          h('input', {
            type: 'checkbox',
            checked: !!task.done,
            'aria-label': `Mark ${task.title} done`,
            disabled: !ctx.can('events:write'),
            onChange: async (e) => {
              ctx.db.update('eventTasks', task.id, { done: e.target.checked });
              await ctx.db.flush();
              ctx.refresh();
            },
          }),
          h('div.list__body',
            h('div.list__title', { style: task.done ? { textDecoration: 'line-through', opacity: '.6' } : {} }, task.title),
            h('div.list__meta', [
              task.ownerId ? memberName(db, task.ownerId) : 'Unassigned',
              task.dueDate ? `due ${formatDate(task.dueDate)}` : null,
            ].filter(Boolean).join(' · '))),
          !task.ownerId && !task.done ? badge('Needs someone', 'warn') : null,
          ctx.can('events:write')
            ? h('button.icon-btn', { 'aria-label': 'Edit task', onClick: () => openRecordModal(ctx, { collection: 'eventTasks', doc: task, hidden: ['eventId'] }) }, icon('edit', { size: 15 }))
            : null)))
        : h('p.small.muted', 'No tasks yet. Generate a checklist below, or add them one at a time.'),
    ],
  });

  const checklistCard = ctx.can('events:write') ? checklistSection(ctx, event) : null;

  const checkinCard = card({
    title: 'Check-in',
    subtitle: `${checkins.length} checked in${event.capacity ? ` of ${event.capacity}` : ''}`,
    actions: [ctx.can('events:write')
      ? h('button.btn.btn--sm', { onClick: () => openCheckin(ctx, event) }, icon('qr', { size: 14 }), 'Open desk')
      : null].filter(Boolean),
    children: [
      event.capacity ? progress(checkins.length, event.capacity) : null,
      checkins.length
        ? list(checkins.slice(-8).reverse().map((entry) => listItem({
          leading: avatar(entry.name || memberName(db, entry.memberId, 'Guest'), { size: 'sm' }),
          title: entry.name || memberName(db, entry.memberId, 'Guest'),
          meta: `${formatTime(entry.at)} · ${entry.method}${entry.firstTime ? ' · first time' : ''}`,
        })))
        : h('p.small.muted', { style: { marginTop: '10px' } },
          'Nobody yet. Open the desk on a tablet at the door, or print the QR code so people check themselves in.'),
    ],
  });

  const budgetCard = ctx.can('finance:read') && event.budget ? card({
    title: 'Budget',
    children: [
      h('div.row', { style: { gap: '24px', marginBottom: '10px' } },
        h('div.stat', h('span.stat__value', formatMoney(event.budget)), h('span.stat__label', 'Allocated')),
        h('div.stat', h('span.stat__value', formatMoney(spent)), h('span.stat__label', 'Spent'))),
      progress(spent, event.budget),
      h('p.tiny.subtle', { style: { marginTop: '8px' } }, 'Matched from expenses that mention this event by name.'),
    ],
  }) : null;

  const dangerCard = ctx.can('events:delete') ? card({
    title: 'Event',
    children: [h('div.row',
      h('button.btn.btn--sm', {
        onClick: async () => {
          ctx.db.update('events', event.id, { status: event.status === 'cancelled' ? 'planning' : 'cancelled' });
          await ctx.db.flush();
          ctx.refresh();
        },
      }, event.status === 'cancelled' ? 'Reinstate' : 'Cancel event'),
      h('button.btn.btn--sm.btn--danger', {
        onClick: async () => { if (await deleteRecord(ctx, 'events', event.id, event.title)) ctx.navigate('/events'); },
      }, icon('trash', { size: 14 }), 'Delete'))],
  }) : null;

  return page({
    eyebrow: 'Events',
    title: event.title,
    actions: [h('button.btn', { onClick: () => ctx.navigate('/events') }, icon('arrowLeft', { size: 15 }), 'All events')],
    children: [h('div.stack', header,
      h('div.grid.grid--main-side',
        h('div.stack', taskCard, checklistCard),
        h('div.stack', checkinCard, budgetCard, dangerCard)))],
  });
}

/* ── checklist & rota ────────────────────────────────────────────────────── */

function checklistSection(ctx, event) {
  const output = h('div');
  const generate = async () => {
    output.textContent = '';
    output.appendChild(h('p.small.muted', 'Working…'));
    const result = await ctx.assistant.run('event.checklist', {
      title: event.title, type: event.type, date: formatDate(event.startsAt), churchName: ctx.tenant.name,
    });
    const lines = result.text.split('\n').filter((line) => line.trim().startsWith('- [ ]'))
      .map((line) => line.replace('- [ ]', '').trim());
    output.textContent = '';
    output.appendChild(aiOutput({
      result,
      actions: [lines.length ? h('button.btn.btn--sm', {
        onClick: async () => {
          for (const title of lines) {
            ctx.db.insert('eventTasks', blank('eventTasks', { eventId: event.id, title }));
          }
          await ctx.db.flush();
          toast(`${lines.length} tasks added.`, { variant: 'ok' });
          ctx.refresh();
        },
      }, `Add ${lines.length} tasks`) : null].filter(Boolean),
    }));
  };

  return card({
    title: 'Planning checklist',
    subtitle: 'Everything this kind of event usually needs.',
    actions: [h('button.btn.btn--sm.btn--primary', { onClick: generate }, icon('sparkles', { size: 14 }), 'Generate')],
    children: [output],
  });
}

function suggestRota(ctx, event, tasks) {
  const unassigned = tasks.filter((t) => !t.ownerId && !t.done);
  if (!unassigned.length) {
    toast('Every task already has someone.');
    return;
  }
  const assigned = new Set(tasks.map((t) => t.ownerId).filter(Boolean));
  const rows = unassigned.map((task) => {
    const candidates = suggestVolunteers(ctx.db, { role: task.role || '', count: 3, exclude: [...assigned] });
    const pick = h('select.select', null,
      h('option', { value: '' }, 'Leave unassigned'),
      ...candidates.map(({ member, lastServed }) => h('option', { value: member.id },
        `${member.fullName}${lastServed ? ` — last served ${relativeTime(lastServed)}` : ' — has not served yet'}`)));
    return { task, pick, node: h('div.field', h('label.field__label', task.title), pick) };
  });

  const ref = modal({
    title: 'Suggested volunteers',
    body: h('div.stack',
      h('p.small.muted', 'Whoever has served least recently is offered first, so the same four people are not asked every time.'),
      ...rows.map((r) => r.node)),
    actions: [
      h('button.btn', { onClick: () => ref.close() }, 'Cancel'),
      h('button.btn.btn--primary', {
        onClick: async () => {
          let count = 0;
          for (const { task, pick } of rows) {
            if (!pick.value) continue;
            ctx.db.update('eventTasks', task.id, { ownerId: pick.value });
            count += 1;
          }
          await ctx.db.flush();
          toast(count ? `${count} assigned.` : 'Nothing assigned.', { variant: count ? 'ok' : '' });
          ref.close();
          ctx.refresh();
        },
      }, 'Assign'),
    ],
  });
}

/* ── check-in desk ───────────────────────────────────────────────────────── */

function openCheckin(ctx, event) {
  const { db } = ctx;
  const code = event.checkinCode || `SHP-${event.id.slice(-4).toUpperCase()}`;
  if (!event.checkinCode) {
    db.update('events', event.id, { checkinCode: code });
    db.flush();
  }

  const results = h('div', { style: { maxHeight: '320px', overflowY: 'auto' } });
  const guestName = h('input.input', { placeholder: 'Visitor name' });
  let query = '';

  const draw = () => {
    const already = new Set(db.where('checkins', (c) => c.eventId === event.id).map((c) => c.memberId).filter(Boolean));
    const people = db.where('members', (m) => !m.archived
      && String(m.fullName).toLowerCase().includes(query.toLowerCase())).slice(0, 40);
    results.textContent = '';
    for (const person of people) {
      results.appendChild(h('div.list__item',
        avatar(person.fullName, { size: 'sm' }),
        h('div.list__body', h('div.list__title', person.fullName), h('div.list__meta', person.area || '')),
        already.has(person.id)
          ? badge('In', 'ok')
          : h('button.btn.btn--sm.btn--primary', {
            onClick: async () => {
              db.insert('checkins', blank('checkins', {
                eventId: event.id, memberId: person.id, name: person.fullName,
                at: new Date().toISOString(), method: 'kiosk',
              }));
              await db.flush();
              draw();
            },
          }, 'Check in')));
    }
    if (!people.length) results.appendChild(h('p.small.muted', { style: { padding: '12px' } }, 'No match. Use the visitor box below.'));
  };

  const link = `${location.origin}${location.pathname}#/events/${event.id}?checkin=${code}`;
  const ref = modal({
    title: 'Check-in desk',
    wide: true,
    body: h('div.stack',
      h('div.panel.row.row--between',
        h('div', null,
          h('p.eyebrow', 'Check-in code'),
          h('div.mono', { style: { fontSize: '1.25rem' } }, code)),
        h('div', { style: { textAlign: 'right' } },
          h('p.tiny.subtle', 'Print this as a QR code for the door:'),
          h('div.tiny.mono.truncate', { style: { maxWidth: '260px' } }, link))),
      h('div.field',
        h('label.field__label', 'Find a member'),
        h('input.input', { placeholder: 'Type a name…', onInput: (e) => { query = e.target.value; draw(); } })),
      results,
      h('div.field',
        h('label.field__label', 'Or check in a visitor'),
        h('div.row', guestName,
          h('button.btn.btn--primary', {
            onClick: async () => {
              if (!guestName.value.trim()) return;
              db.insert('checkins', blank('checkins', {
                eventId: event.id, name: guestName.value.trim(),
                at: new Date().toISOString(), method: 'manual', firstTime: true,
              }));
              await db.flush();
              guestName.value = '';
              toast('Visitor checked in. Add them to People to follow up.', { variant: 'ok' });
              draw();
            },
          }, 'Check in')))),
    actions: [
      h('button.btn', { onClick: () => { ref.close(); ctx.refresh(); } }, 'Done'),
      h('button.btn', {
        onClick: () => {
          const rows = db.where('checkins', (c) => c.eventId === event.id);
          downloadCSV(`${event.title.replace(/\W+/g, '-').toLowerCase()}-checkins.csv`, rows, [
            { label: 'Name', value: (c) => c.name || memberName(db, c.memberId, 'Guest') },
            { label: 'Time', value: (c) => c.at },
            { key: 'method', label: 'Method' },
            { label: 'First time', value: (c) => (c.firstTime ? 'yes' : '') },
          ]);
        },
      }, icon('download', { size: 15 }), 'Export'),
    ],
  });
  draw();
}

function exportCalendar(ctx, events) {
  if (!events.length) {
    toast('Nothing to export.');
    return;
  }
  downloadICS(`${ctx.tenant.id}-events-${isoDate(new Date())}.ics`, events, `${ctx.tenant.shortName} events`);
  toast('Calendar file downloaded — open it to add these to your phone.', { variant: 'ok' });
}
