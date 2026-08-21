/**
 * Tasks — action items, each still attached to the sentence it came from.
 *
 * A task here is never free-floating: "Open source" takes you to the moment
 * in the recording where it was agreed, which is the difference between a
 * to-do list and a record of what people committed to.
 */

import { h, icon } from '../core/dom.js';
import { dueLabel, shortDate } from '../core/format.js';
import { rows, button, tag, empty, menu, confirm, toast, dialog, field, searchField } from '../core/ui.js';
import { actionsCsv, download } from '../core/exporters.js';

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'done', label: 'Completed' },
  { key: 'all',  label: 'All' },
];

export async function render(app, route) {
  const db = app.db;
  let filter = route.query.filter || 'open';
  let owner = route.query.owner || '';
  let query = '';

  const list = h('div');
  const count = h('span.meta-sm');

  const paint = () => {
    const items = select(db, { filter, owner, query });
    count.textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'}${owner ? ` for ${owner}` : ''}`;
    list.replaceChildren(items.length
      ? rows(...items.map(({ action, meeting }) => taskRow(app, action, meeting, paint)))
      : empty({
        title: filter === 'done' ? 'Nothing completed yet.' : 'No action items.',
        body: 'Action items are pulled out of a meeting when it is processed, with whoever they were assigned to.',
      }));
  };

  const filterButtons = h('div.btn-group', { role: 'group', 'aria-label': 'Filter tasks' },
    ...FILTERS.map((option) => {
      const node = button(option.label, {
        size: 'sm',
        onClick: () => {
          filter = option.key;
          for (const other of filterButtons.children) other.setAttribute('aria-pressed', 'false');
          node.setAttribute('aria-pressed', 'true');
          paint();
        },
      });
      node.setAttribute('aria-pressed', String(option.key === filter));
      return node;
    }));

  const owners = [...new Set(db.all('actions').map((a) => a.ownerName).filter(Boolean))].sort();
  const ownerButton = button(owner || 'Everyone', { size: 'sm', iconName: 'chevronDown' });
  ownerButton.addEventListener('click', () => menu(ownerButton, [
    { label: 'Everyone', onSelect: () => { owner = ''; ownerButton.replaceChildren(icon('chevronDown', { size: 16 }), 'Everyone'); paint(); } },
    ...owners.map((name) => ({
      label: name,
      onSelect: () => { owner = name; ownerButton.replaceChildren(icon('chevronDown', { size: 16 }), name); paint(); },
    })),
  ]));

  const search = searchField({ placeholder: 'Search tasks', onInput: (value) => { query = value; paint(); } });
  search.style.maxWidth = '280px';

  paint();

  return h('div.view.stack',
    h('div.view__head',
      h('div.grow', h('h1.page-title', 'Tasks')),
      button('Export CSV', { iconName: 'download', onClick: () => {
        const items = select(db, { filter, owner, query });
        if (!items.length) { toast('Nothing to export.'); return; }
        download('longhand-action-items.csv', actionsCsv(items), 'text/csv');
      } })),
    h('div.row', search, h('div.spacer'), filterButtons, ownerButton),
    h('div.row.row--between', count),
    list);
}

export function select(db, { filter = 'open', owner = '', query = '' } = {}) {
  const words = String(query || '').trim().toLowerCase();
  return db.all('actions')
    .filter((action) => (filter === 'all' ? true : action.status === filter))
    .filter((action) => (owner ? action.ownerName === owner : true))
    .filter((action) => (words ? `${action.task} ${action.context} ${action.ownerName}`.toLowerCase().includes(words) : true))
    .map((action) => ({ action, meeting: db.get('meetings', action.meetingId) }))
    .sort((a, b) => {
      const byDue = (a.action.dueDate || '9999').localeCompare(b.action.dueDate || '9999');
      if (byDue) return byDue;
      return String(b.meeting ? b.meeting.startedAt : '').localeCompare(String(a.meeting ? a.meeting.startedAt : ''));
    });
}

function taskRow(app, action, meeting, paint) {
  const done = action.status === 'done';
  const due = dueLabel(action.dueDate);

  const options = button('', { iconName: 'more', variant: 'quiet', size: 'sm', title: 'Task options' });
  options.addEventListener('click', () => menu(options, [
    { label: 'Edit', iconName: 'edit', onSelect: () => editTask(app, action, paint) },
    meeting ? { label: 'Open source meeting', iconName: 'link', onSelect: () => openSource(app, action, meeting) } : null,
    '-',
    { label: 'Delete', iconName: 'trash', danger: true, onSelect: async () => {
      if (await confirm({ title: 'Delete this action item?', body: 'The transcript it came from is unaffected.', confirmLabel: 'Delete', danger: true })) {
        app.db.remove('actions', action.id);
        toast('Deleted.');
        paint();
      }
    } },
  ].filter(Boolean)));

  return h('div.row-item',
    h('label.checkbox', { style: { paddingTop: '2px' } },
      h('input', {
        type: 'checkbox', checked: done || null,
        'aria-label': `Mark "${action.task}" ${done ? 'open' : 'completed'}`,
        onChange: () => {
          app.db.update('actions', action.id, { status: done ? 'open' : 'done', completedAt: done ? null : new Date().toISOString() });
          paint();
        },
      })),
    h('div.row-item__main',
      h('span.row-item__title', { style: done ? { textDecoration: 'line-through', color: 'var(--ink-3)' } : null },
        action.ownerName ? h('strong', `${action.ownerName} — `) : null, action.task),
      h('span.meta', [
        meeting ? meeting.title : 'meeting deleted',
        meeting ? shortDate(meeting.startedAt) : null,
        action.context || null,
      ].filter(Boolean).join(' · '))),
    h('div.row-item__side',
      due ? tag(due, due === 'Overdue' && !done ? 'attention' : '') : null,
      done ? tag('Completed', 'done') : null,
      meeting ? button('Source', { size: 'sm', variant: 'quiet', onClick: () => openSource(app, action, meeting) }) : null,
      options));
}

function openSource(app, action, meeting) {
  const segment = (action.segmentIds || []).map((id) => app.db.get('segments', id)).filter(Boolean)[0];
  app.go('meeting', [meeting.id], segment ? { t: Math.floor(segment.start), seg: segment.id } : {});
}

async function editTask(app, action, paint) {
  const task = h('textarea.textarea', { rows: 2 }, action.task);
  const ownerName = h('input.input', { type: 'text', value: action.ownerName || '' });
  const dueDate = h('input.input', { type: 'date', value: action.dueDate || '' });
  const saved = await dialog({
    title: 'Edit action item',
    body: h('div.stack',
      field('Task', task),
      field('Owner', ownerName, 'The name as it was said in the meeting.'),
      field('Due', dueDate, 'Left empty unless a date was actually agreed.')),
    actions: (close) => [
      button('Cancel', { onClick: () => close(null) }),
      button('Save', { variant: 'primary', onClick: () => close({
        task: task.value.trim(), ownerName: ownerName.value.trim(), dueDate: dueDate.value || null,
      }) }),
    ],
  });
  if (!saved || !saved.task) return;
  app.db.update('actions', action.id, saved);
  toast('Saved.');
  paint();
}
