/**
 * People — the directory and each person's profile.
 *
 * The unit of this module is a person, not a row: the profile pulls together
 * everything the church knows about them — family, ministry, attendance, care
 * history, prayer, counselling — with each section shown only to those allowed
 * to see it. Counselling notes are encrypted and gated separately from the
 * rest of the record, because "can see the directory" and "can read a
 * counselling file" are not the same permission.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, table, list, listItem, emptyState, badge, avatar, searchField, segmented,
  stat, chips, modal, toast, lockedNotice,
} from '../core/ui.js';
import { formatDate, formatDateParts, relativeTime, isoDate, daysUntilAnnual, addDays, pluralize } from '../core/format.js';
import { blank } from '../core/schema.js';
import { absentMembers, upcomingCelebrations } from '../core/ai.js';
import { downloadCSV } from '../core/exporters.js';
import {
  openRecordModal, deleteRecord, newButton, statusBadge, memberName, matches, sentence,
} from './_shared.js';

export async function render(ctx, route) {
  if (route.params[0]) {
    const member = ctx.db.find('members', route.params[0]);
    if (member) return profile(ctx, member);
  }
  if (route.query.new === '1' && ctx.can('members:write')) {
    setTimeout(() => openRecordModal(ctx, { collection: 'members', fields: CREATE_FIELDS }), 0);
  }
  return directory(ctx, route);
}

const CREATE_FIELDS = [
  'fullName', 'preferredName', 'status', 'gender', 'birthDate', 'phone', 'whatsapp', 'email',
  'nationality', 'language', 'area', 'joinedOn', 'maritalStatus', 'anniversary', 'familyId',
  'familyRole', 'ministries', 'emergencyName', 'emergencyPhone', 'emergencyRelation',
  'baptised', 'baptismDate', 'newBeliever', 'careLevel', 'notes',
];

/* ── directory ───────────────────────────────────────────────────────────── */

function directory(ctx, route) {
  const tab = route.query.tab || 'people';
  const tabs = [
    { value: 'people', label: 'Directory' },
    { value: 'families', label: 'Families' },
    { value: 'ministries', label: 'Ministries' },
    { value: 'attendance', label: 'Attendance' },
  ];

  const body = h('div');
  const draw = () => {
    body.textContent = '';
    body.appendChild(
      tab === 'families' ? familiesTab(ctx)
        : tab === 'ministries' ? ministriesTab(ctx)
        : tab === 'attendance' ? attendanceTab(ctx)
        : peopleTab(ctx, route),
    );
  };
  draw();

  const counts = {
    member: ctx.db.where('members', (m) => m.status === 'member' && !m.archived).length,
    regular: ctx.db.where('members', (m) => m.status === 'regular' && !m.archived).length,
    visitor: ctx.db.where('members', (m) => m.status === 'visitor' && !m.archived).length,
  };

  return page({
    title: 'People',
    subtitle: `${counts.member} members · ${counts.regular} regulars · ${counts.visitor} visitors`,
    actions: [
      h('button.btn', { onClick: () => exportPeople(ctx) }, icon('download', { size: 15 }), 'Export'),
      newButton(ctx, 'members', 'Add person', () => openRecordModal(ctx, { collection: 'members', fields: CREATE_FIELDS })),
    ].filter(Boolean),
    children: [
      h('div', { style: { marginBottom: '18px' } },
        segmented({ options: tabs, value: tab, onChange: (value) => ctx.navigate(`/members?tab=${value}`) })),
      body,
    ],
  });
}

function peopleTab(ctx, route) {
  const { db } = ctx;
  let query = '';
  let status = route.query.status || 'all';
  let filter = route.query.filter || '';

  const container = h('div.stack');
  const results = h('div');

  const draw = () => {
    const now = new Date();
    let people = db.where('members', (m) => !m.archived);
    if (status !== 'all') people = people.filter((m) => m.status === status);
    if (filter === 'new-believer') people = people.filter((m) => m.newBeliever);
    if (filter === 'celebrations') {
      const ids = new Set(upcomingCelebrations(db, { now, days: 14 }).map((c) => c.memberId));
      people = people.filter((m) => ids.has(m.id));
    }
    if (filter === 'absent') {
      const ids = new Set(absentMembers(db, { now, weeks: ctx.settings.followUpAfterWeeks || 3 }).map((m) => m.id));
      people = people.filter((m) => ids.has(m.id));
    }
    if (filter === 'care') people = people.filter((m) => m.careLevel !== 'none');
    people = people.filter((m) => matches(m, query, ['fullName', 'preferredName', 'phone', 'email', 'area', 'nationality']));
    people.sort((a, b) => a.fullName.localeCompare(b.fullName));

    results.textContent = '';
    results.appendChild(people.length
      ? table({
        columns: [
          {
            label: 'Name',
            render: (m) => h('div.row', avatar(m.fullName, { size: 'sm' }),
              h('div', null,
                h('div', { style: { fontWeight: '500' } }, m.fullName),
                h('div.tiny.subtle', null, [m.area, m.nationality].filter(Boolean).join(' · ')))),
          },
          { label: 'Status', render: (m) => statusBadge(m.status) },
          { label: 'Ministries', value: (m) => (m.ministries || []).join(', ') || '—' },
          { label: 'Contact', value: (m) => m.phone || m.email || '—' },
          {
            label: 'Last seen',
            render: (m) => {
              const last = lastSeen(db, m.id);
              return last
                ? h('span', { class: daysAgo(last) > 21 ? 'badge badge--warn' : '' }, relativeTime(last))
                : h('span.subtle', null, '—');
            },
          },
        ],
        rows: people,
        onRowClick: (m) => ctx.navigate(`/members/${m.id}`),
      })
      : emptyState({
        title: query ? `Nobody matches “${query}”` : 'No one here yet',
        detail: query ? 'Try a name, an area or a phone number.' : 'Add the first person to begin.',
        iconName: 'users',
        action: newButton(ctx, 'members', 'Add person', () => openRecordModal(ctx, { collection: 'members', fields: CREATE_FIELDS })),
      }));
  };

  container.appendChild(h('div.row.row--wrap', { style: { marginBottom: '14px' } },
    h('div', { style: { flex: '1', minWidth: '220px' } },
      searchField({ placeholder: 'Search people…', onInput: (value) => { query = value; draw(); } })),
    segmented({
      options: [
        { value: 'all', label: 'All' }, { value: 'member', label: 'Members' },
        { value: 'regular', label: 'Regulars' }, { value: 'visitor', label: 'Visitors' },
      ],
      value: status,
      onChange: (value) => { status = value; draw(); },
    })));

  container.appendChild(h('div', { style: { marginBottom: '14px' } },
    chips({
      options: [
        { value: 'absent', label: 'Not seen recently' },
        { value: 'care', label: 'On the care list' },
        { value: 'new-believer', label: 'New believers' },
        { value: 'celebrations', label: 'Birthdays & anniversaries' },
      ],
      selected: filter ? [filter] : [],
      onToggle: (value) => { filter = filter === value ? '' : value; draw(); },
    })));

  container.appendChild(results);
  draw();
  return container;
}

function familiesTab(ctx) {
  const { db } = ctx;
  const families = db.all('families').sort((a, b) => a.name.localeCompare(b.name));
  return h('div.stack',
    h('div.row.row--end', newButton(ctx, 'members', 'Add family', () => openRecordModal(ctx, { collection: 'families' }))),
    families.length
      ? h('div.grid.grid--3', ...families.map((family) => {
        const people = db.where('members', (m) => m.familyId === family.id && !m.archived);
        return card({
          tight: true,
          className: 'card--link',
          children: [
            h('div.row.row--between', h('h3', null, family.name), badge(pluralize(people.length, 'person', 'people'))),
            family.area ? h('p.small.muted', null, family.area) : null,
            h('div.stack.stack--sm', { style: { marginTop: '10px' } },
              ...people.map((person) => h('button.list__item', {
                onClick: () => ctx.navigate(`/members/${person.id}`),
              },
                avatar(person.fullName, { size: 'sm' }),
                h('div.list__body',
                  h('div.list__title', null, person.fullName),
                  h('div.list__meta', null, sentence(person.familyRole || 'member')))))),
          ],
        });
      }))
      : emptyState({ title: 'No families recorded', detail: 'Families group people for visits, greetings and care.', iconName: 'users' }));
}

function ministriesTab(ctx) {
  const { db } = ctx;
  const ministries = db.all('ministries').sort((a, b) => a.name.localeCompare(b.name));
  return h('div.stack',
    h('div.row.row--end', newButton(ctx, 'members', 'Add ministry', () => openRecordModal(ctx, { collection: 'ministries' }))),
    ministries.length
      ? h('div.grid.grid--2', ...ministries.map((ministry) => {
        const serving = db.where('members', (m) => (m.ministries || []).includes(ministry.name) && !m.archived);
        const short = ministry.minVolunteers > serving.length;
        return card({
          title: ministry.name,
          subtitle: ministry.meetingDay,
          actions: [short ? badge(`${ministry.minVolunteers - serving.length} short`, 'warn') : badge(`${serving.length} serving`, 'ok')],
          children: [
            ministry.purpose ? h('p.small.muted', null, ministry.purpose) : null,
            ministry.leadId ? h('p.small', { style: { marginTop: '8px' } }, `Led by ${memberName(db, ministry.leadId)}`) : null,
            h('div.chip-list', { style: { marginTop: '12px' } },
              ...serving.slice(0, 12).map((person) => h('button.chip', {
                onClick: () => ctx.navigate(`/members/${person.id}`),
              }, person.fullName))),
            ctx.can('members:write')
              ? h('div.row', { style: { marginTop: '12px' } },
                h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'ministries', doc: ministry }) }, 'Edit'))
              : null,
          ],
        });
      }))
      : emptyState({ title: 'No ministries yet', detail: 'Ministries drive rotas, shortages and the care list.', iconName: 'shield' }));
}

/* ── attendance ──────────────────────────────────────────────────────────── */

function attendanceTab(ctx) {
  const { db } = ctx;
  const sessions = db.all('attendance').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 40);

  return h('div.stack',
    h('div.row.row--end',
      newButton(ctx, 'members', 'Record a service', () => recordAttendance(ctx))),
    sessions.length
      ? table({
        columns: [
          { label: 'Date', value: (s) => formatDate(s.date) },
          { label: 'Service', value: (s) => s.service },
          { label: 'Present', numeric: true, value: (s) => (s.memberIds || []).length },
          { label: 'Visitors', numeric: true, value: (s) => s.visitors || 0 },
          { label: 'Total', numeric: true, render: (s) => h('strong', null, s.total || 0) },
        ],
        rows: sessions,
        onRowClick: ctx.can('members:write') ? (s) => recordAttendance(ctx, s) : undefined,
      })
      : emptyState({
        title: 'No services recorded',
        detail: 'Attendance drives the trend, the absence list and most of the care insights.',
        iconName: 'chart',
      }));
}

function recordAttendance(ctx, session = null) {
  const { db } = ctx;
  const people = db.where('members', (m) => !m.archived).sort((a, b) => a.fullName.localeCompare(b.fullName));
  const present = new Set(session ? session.memberIds || [] : []);
  const dateInput = h('input.input', { type: 'date', value: session ? isoDate(session.date) : isoDate(new Date()) });
  const serviceInput = h('select.select', null,
    ...(ctx.settings.services || ['Friday Worship']).map((service) =>
      h('option', { value: service, selected: session && session.service === service }, service)));
  const visitorsInput = h('input.input', { type: 'number', min: 0, value: session ? session.visitors || 0 : 0 });
  const counter = h('span.badge.badge--accent', null, `${present.size} present`);

  const updateCount = () => { counter.textContent = `${present.size} present`; };
  const rows = people.map((person) => {
    const box = h('input', {
      type: 'checkbox',
      checked: present.has(person.id),
      onChange: (e) => { if (e.target.checked) present.add(person.id); else present.delete(person.id); updateCount(); },
    });
    return h('label.checkbox', box, h('span', null, person.fullName, ' ', h('span.tiny.subtle', null, person.area || '')));
  });

  const ref = modal({
    title: session ? 'Edit attendance' : 'Record a service',
    wide: true,
    body: h('div.stack',
      h('div.form-grid',
        h('div.field', h('label.field__label', null, 'Date'), dateInput),
        h('div.field', h('label.field__label', null, 'Service'), serviceInput),
        h('div.field', h('label.field__label', null, 'Visitors'), visitorsInput)),
      h('div.row.row--between',
        h('h3', null, 'Who was there'),
        h('div.row',
          counter,
          h('button.btn.btn--sm', {
            onClick: () => { people.forEach((p) => present.add(p.id)); rows.forEach((r) => { r.querySelector('input').checked = true; }); updateCount(); },
          }, 'All'),
          h('button.btn.btn--sm', {
            onClick: () => { present.clear(); rows.forEach((r) => { r.querySelector('input').checked = false; }); updateCount(); },
          }, 'None'))),
      h('div', { style: { maxHeight: '340px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px' } }, ...rows)),
    actions: [
      h('button.btn', { onClick: () => ref.close() }, 'Cancel'),
      h('button.btn.btn--primary', {
        onClick: async () => {
          const doc = {
            date: dateInput.value,
            service: serviceInput.value,
            memberIds: [...present],
            visitors: Number(visitorsInput.value) || 0,
            total: present.size + (Number(visitorsInput.value) || 0),
          };
          try {
            if (session) db.update('attendance', session.id, doc);
            else db.insert('attendance', blank('attendance', doc));
            await db.flush();
            toast('Attendance recorded.', { variant: 'ok' });
            ref.close();
            ctx.refresh();
          } catch (err) {
            toast(err.message, { variant: 'danger' });
          }
        },
      }, 'Save'),
    ],
  });
}

/* ── profile ─────────────────────────────────────────────────────────────── */

function profile(ctx, member) {
  const { db } = ctx;
  const now = new Date();
  const family = member.familyId ? db.find('families', member.familyId) : null;
  const relatives = family ? db.where('members', (m) => m.familyId === family.id && m.id !== member.id && !m.archived) : [];
  const careItems = db.where('care', (c) => c.memberId === member.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const prayers = ctx.can('prayer:read') ? db.where('prayers', (p) => p.memberId === member.id) : [];
  const attended = db.all('attendance')
    .filter((s) => (s.memberIds || []).includes(member.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const last = attended[0] ? attended[0].date : null;

  const header = card({
    children: [
      h('div.row.row--wrap',
        avatar(member.fullName, { size: 'lg' }),
        h('div', { style: { flex: '1', minWidth: '200px' } },
          h('h2', null, member.fullName),
          h('p.small.muted', null, [
            sentence(member.status),
            member.area,
            member.nationality,
            member.language,
          ].filter(Boolean).join(' · ')),
          h('div.row', { style: { marginTop: '8px', gap: '6px', flexWrap: 'wrap' } },
            member.baptised ? badge('Baptised', 'ok') : null,
            member.newBeliever ? badge('New believer', 'accent') : null,
            member.careLevel !== 'none' ? badge(`Care: ${member.careLevel}`, member.careLevel === 'priority' ? 'danger' : 'warn') : null,
            last && daysAgo(last) > 21 ? badge(`Last seen ${relativeTime(last)}`, 'warn') : null)),
        h('div.row.no-print',
          member.phone ? h('a.btn.btn--sm', { href: `tel:${member.phone}` }, icon('bell', { size: 14 }), 'Call') : null,
          member.whatsapp || member.phone
            ? h('a.btn.btn--sm', { href: `https://wa.me/${String(member.whatsapp || member.phone).replace(/[^0-9]/g, '')}`, target: '_blank', rel: 'noopener' }, 'WhatsApp')
            : null,
          ctx.can('members:write')
            ? h('button.btn.btn--sm.btn--primary', {
              onClick: () => openRecordModal(ctx, { collection: 'members', doc: member, fields: CREATE_FIELDS }),
            }, icon('edit', { size: 14 }), 'Edit')
            : null)),
    ],
  });

  const details = card({
    title: 'Details',
    children: [
      definitionList([
        ['Mobile', member.phone],
        ['Email', member.email],
        ['Date of birth', member.birthDate ? `${formatDate(member.birthDate)} · ${birthdayLine(member.birthDate, now)}` : null],
        ['Marital status', member.maritalStatus && sentence(member.maritalStatus)],
        ['Anniversary', member.anniversary ? formatDate(member.anniversary) : null],
        ['First visit', member.joinedOn && formatDate(member.joinedOn)],
        ['Member since', member.membershipDate && formatDate(member.membershipDate)],
        ['Baptised', member.baptised ? (member.baptismDate ? formatDate(member.baptismDate) : 'Yes') : 'Not recorded'],
        ['Ministries', (member.ministries || []).join(', ')],
        ['Gifts & skills', (member.spiritualGifts || []).join(', ')],
      ]),
      member.notes ? h('div', { style: { marginTop: '14px' } },
        h('p.eyebrow', null, 'Notes'),
        h('p.small.prose', null, member.notes)) : null,
    ],
  });

  const emergency = card({
    title: 'Emergency contact',
    children: [member.emergencyName
      ? definitionList([
        ['Name', member.emergencyName],
        ['Phone', member.emergencyPhone],
        ['Relationship', member.emergencyRelation],
      ])
      : h('p.small.muted', null, 'None recorded. Worth asking for — it matters exactly once, and badly.')],
  });

  const familyCard = card({
    title: 'Family',
    subtitle: family ? family.name : 'Not linked to a family',
    children: [relatives.length
      ? list(relatives.map((relative) => listItem({
        leading: avatar(relative.fullName, { size: 'sm' }),
        title: relative.fullName,
        meta: sentence(relative.familyRole || ''),
        onClick: () => ctx.navigate(`/members/${relative.id}`),
      })))
      : h('p.small.muted', null, family ? 'No one else in this family yet.' : 'Link a family to see relatives here.')],
  });

  const attendanceCard = card({
    title: 'Attendance',
    subtitle: last ? `Last seen ${relativeTime(last)}` : 'Never marked present',
    children: [
      h('div.row', { style: { gap: '24px', marginBottom: '12px' } },
        stat({ value: attended.length, label: 'Services attended' }),
        stat({ value: attendedInLast(attended, now, 90), label: 'Last 90 days' })),
      attended.length
        ? h('div.chip-list', ...attended.slice(0, 12).map((session) =>
          h('span.chip', null, `${formatDateParts(session.date, { day: 'numeric', month: 'short' })}`)))
        : h('p.small.muted', null, 'Recorded when a service is marked in People → Attendance.'),
    ],
  });

  const careCard = ctx.can('care:read') ? card({
    title: 'Care & follow-ups',
    actions: [ctx.can('care:write')
      ? h('button.btn.btn--sm', {
        onClick: () => openRecordModal(ctx, { collection: 'care', defaults: { memberId: member.id }, hidden: ['memberId'] }),
      }, icon('plus', { size: 14 }), 'Log')
      : null].filter(Boolean),
    children: [careItems.length
      ? h('div.timeline', ...careItems.slice(0, 8).map((item) => h('div', { class: `timeline__item${item.completedAt ? '' : ' timeline__item--accent'}` },
        h('div.row.row--between',
          h('div.small', { style: { fontWeight: '500' } }, item.summary),
          item.completedAt ? badge('Done', 'ok') : statusBadge(item.priority)),
        h('div.tiny.subtle', null, `${sentence(item.type)} · ${item.dueDate ? `due ${formatDate(item.dueDate)}` : formatDate(item.createdAt)}`),
        item.detail ? h('p.small.muted', null, item.detail) : null)))
      : h('p.small.muted', null, 'Nothing logged. Every visit, call and need recorded here builds the church\'s memory of this person.')],
  }) : null;

  const counselingCard = ctx.can('counseling:read') ? counselingSection(ctx, member) : null;

  const prayerCard = prayers.length ? card({
    title: 'Prayer requests',
    children: [list(prayers.map((prayer) => listItem({
      leading: icon(prayer.status === 'answered' ? 'check' : 'heart', { size: 16 }),
      title: prayer.title,
      meta: `${sentence(prayer.category)} · ${sentence(prayer.status)}`,
      onClick: () => ctx.navigate('/prayer'),
    })))],
  }) : null;

  const dangerZone = ctx.can('members:delete') ? card({
    title: 'Record',
    children: [
      h('div.row.row--wrap',
        h('button.btn.btn--sm', {
          onClick: async () => {
            ctx.db.update('members', member.id, { archived: !member.archived });
            await ctx.db.flush();
            toast(member.archived ? 'Restored.' : 'Archived — hidden from lists, kept in the record.');
            ctx.refresh();
          },
        }, member.archived ? 'Restore' : 'Archive'),
        h('button.btn.btn--sm.btn--danger', {
          onClick: async () => {
            if (await deleteRecord(ctx, 'members', member.id, member.fullName)) ctx.navigate('/members');
          },
        }, icon('trash', { size: 14 }), 'Delete')),
      h('p.tiny.subtle', { style: { marginTop: '8px' } },
        `Added ${formatDate(member.createdAt)}. Last changed ${relativeTime(member.updatedAt)}.`),
    ],
  }) : null;

  return page({
    eyebrow: 'People',
    title: member.preferredName || member.fullName,
    actions: [h('button.btn', { onClick: () => ctx.navigate('/members') }, icon('arrowLeft', { size: 15 }), 'Directory')],
    children: [
      h('div.stack', header,
        h('div.grid.grid--main-side',
          h('div.stack', details, careCard, counselingCard, prayerCard),
          h('div.stack', familyCard, emergency, attendanceCard, dangerZone))),
    ],
  });
}

/** Counselling notes: separately permissioned, encrypted, and restrictable to the author. */
function counselingSection(ctx, member) {
  const { db } = ctx;
  if (db.isLocked('counseling')) {
    return card({ title: 'Counselling notes', children: [lockedNotice('Counselling')] });
  }
  const notes = db.where('counseling', (n) => n.memberId === member.id)
    .filter((n) => !n.restricted || n.createdBy === ctx.user.id || ctx.user.role === 'senior_pastor')
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return card({
    title: 'Counselling notes',
    subtitle: 'Encrypted. Visible only to those with counselling permission.',
    actions: [ctx.can('counseling:write')
      ? h('button.btn.btn--sm', {
        onClick: () => openRecordModal(ctx, {
          collection: 'counseling',
          defaults: { memberId: member.id, date: isoDate(new Date()) },
          hidden: ['memberId'],
        }),
      }, icon('plus', { size: 14 }), 'New note')
      : null].filter(Boolean),
    children: [notes.length
      ? h('div.stack.stack--sm', ...notes.map((note) => h('div.panel',
        h('div.row.row--between',
          h('strong.small', null, note.subject),
          h('span.tiny.subtle', null, formatDate(note.date))),
        h('p.small.prose', { style: { marginTop: '6px' } }, note.notes || ''),
        note.followUp ? h('p.tiny.muted', { style: { marginTop: '6px' } }, `Follow-up: ${note.followUp}`) : null,
        h('div.row', { style: { marginTop: '8px' } },
          note.restricted ? badge('Author only', 'warn') : null,
          h('div.spacer'),
          ctx.can('counseling:write')
            ? h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'counseling', doc: note, hidden: ['memberId'] }) }, 'Edit')
            : null))))
      : h('p.small.muted', null, 'No notes. What is written here is encrypted at rest and never leaves this device unless you export it.')],
  });
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

function definitionList(pairs) {
  const rows = pairs.filter(([, value]) => value);
  if (!rows.length) return h('p.small.muted', null, 'Nothing recorded yet.');
  return h('dl', { style: { display: 'grid', gridTemplateColumns: 'minmax(120px, auto) 1fr', gap: '8px 16px', margin: 0 } },
    ...rows.flatMap(([label, value]) => [
      h('dt.small.muted', null, label),
      h('dd.small', { style: { margin: 0 } }, String(value)),
    ]));
}

function lastSeen(db, memberId) {
  let latest = null;
  for (const session of db.all('attendance')) {
    if (!(session.memberIds || []).includes(memberId)) continue;
    const date = new Date(session.date);
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

function daysAgo(date) {
  return Math.round((Date.now() - new Date(date).getTime()) / 864e5);
}

function attendedInLast(sessions, now, days) {
  const cutoff = addDays(now, -days);
  return sessions.filter((s) => new Date(s.date) >= cutoff).length;
}

function birthdayLine(birthDate, now) {
  const inDays = daysUntilAnnual(birthDate, now);
  if (inDays === 0) return 'birthday today';
  if (inDays <= 30) return `birthday in ${inDays} days`;
  const age = now.getFullYear() - new Date(birthDate).getFullYear();
  return `age ${age}`;
}

function exportPeople(ctx) {
  const rows = ctx.db.where('members', (m) => !m.archived);
  downloadCSV(`${ctx.tenant.id}-people-${isoDate(new Date())}.csv`, rows, [
    { key: 'fullName', label: 'Full name' },
    { key: 'status', label: 'Status' },
    { key: 'phone', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'area', label: 'Area' },
    { key: 'nationality', label: 'Nationality' },
    { key: 'ministries', label: 'Ministries' },
    { key: 'birthDate', label: 'Date of birth' },
    { key: 'joinedOn', label: 'First visit' },
    { label: 'Last seen', value: (m) => { const seen = lastSeen(ctx.db, m.id); return seen ? isoDate(seen) : ''; } },
  ]);
  ctx.db.log('export', `Exported ${rows.length} people to CSV.`);
  toast('Exported. Personal data — handle it the way you would a printed list.', { variant: 'ok' });
}
