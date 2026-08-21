/**
 * The library. A list, filtered and sorted — not a grid of cards.
 */

import { h, icon } from '../core/dom.js';
import { dayLabel, duration, longDate } from '../core/format.js';
import { rows, linkRow, empty, statusTag, button, tag, menu, confirm, promptDialog, toast, searchField } from '../core/ui.js';
import { Router } from '../core/router.js';
import { speakerMap } from '../core/intelligence.js';
import { moveToFolder, deleteFolder } from '../core/folders.js';

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'recent',   label: 'Recent' },
  { key: 'favorite', label: 'Favourites' },
  { key: 'attention',label: 'Needs attention' },
  { key: 'archived', label: 'Archived' },
];

const SORTS = [
  { key: 'newest',   label: 'Newest' },
  { key: 'oldest',   label: 'Oldest' },
  { key: 'longest',  label: 'Longest' },
  { key: 'shortest', label: 'Shortest' },
  { key: 'title',    label: 'Alphabetical' },
];

export async function render(app, route) {
  const db = app.db;
  let filter = route.query.filter || 'all';
  let sort = route.query.sort || 'newest';
  let query = route.query.q || '';
  let folderId = route.query.folder || '';

  const list = h('div');
  const countLabel = h('span.meta-sm');

  const paint = () => {
    const meetings = select(db, { filter, sort, query, folderId });
    countLabel.textContent = `${meetings.length} ${meetings.length === 1 ? 'meeting' : 'meetings'}`;
    list.replaceChildren(meetings.length
      ? rows(...meetings.map((meeting) => meetingRow(app, meeting, paint)))
      : empty({
        title: query ? 'Nothing matches that.' : 'No meetings here.',
        body: query ? 'Try fewer words, or search inside transcripts from the Search screen.' : 'Recordings appear here once you make one.',
        action: query ? null : h('a.btn.btn--primary', { href: '#/record' }, 'Start recording'),
      }));
  };

  const search = searchField({
    value: query, placeholder: 'Search meetings',
    onInput: (value) => { query = value; paint(); },
  });
  search.style.flex = '1';
  search.style.maxWidth = '340px';

  const filterButtons = h('div.btn-group', { role: 'group', 'aria-label': 'Filter meetings' },
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

  const folderButton = button(folderLabel(db, folderId), { size: 'sm', iconName: 'folder' });
  const paintFolder = () => folderButton.replaceChildren(icon('folder', { size: 16 }), folderLabel(db, folderId));
  folderButton.addEventListener('click', () => {
    const folders = db.all('folders').sort((a, b) => a.name.localeCompare(b.name));
    menu(folderButton, [
      { label: 'All folders', onSelect: () => { folderId = ''; paintFolder(); paint(); } },
      ...folders.map((folder) => ({
        label: folder.name,
        onSelect: () => { folderId = folder.id; paintFolder(); paint(); },
      })),
      ...(folderId ? ['-', {
        label: 'Delete this folder', iconName: 'trash', danger: true,
        onSelect: async () => {
          if (await deleteFolder(app, folderId)) { folderId = ''; paintFolder(); paint(); }
        },
      }] : []),
    ]);
  });

  const sortButton = button(SORTS.find((s) => s.key === sort).label, { size: 'sm', iconName: 'chevronDown' });
  sortButton.addEventListener('click', () => menu(sortButton, SORTS.map((option) => ({
    label: option.label,
    onSelect: () => { sort = option.key; sortButton.replaceChildren(icon('chevronDown', { size: 16 }), option.label); paint(); },
  }))));

  paint();

  return h('div.view.stack',
    h('div.view__head',
      h('div.grow', h('h1.page-title', 'Meetings')),
      h('a.btn.btn--record', { href: '#/record' }, icon('mic', { size: 16 }), 'Record')),
    h('div.row', search, h('div.spacer'), filterButtons, folderButton, sortButton),
    h('div.row.row--between', countLabel),
    list);
}

export function select(db, { filter = 'all', sort = 'newest', query = '', folderId = '' } = {}) {
  const words = String(query || '').trim().toLowerCase();
  let meetings = db.all('meetings');

  meetings = meetings.filter((meeting) => {
    if (filter === 'archived') return meeting.archived;
    if (meeting.archived) return false;
    if (filter === 'favorite') return meeting.favorite;
    if (filter === 'attention') return meeting.status === 'failed' || Boolean(meeting.error);
    if (filter === 'recent') return Date.now() - new Date(meeting.startedAt).getTime() < 14 * 86400000;
    return true;
  });

  if (folderId) meetings = meetings.filter((meeting) => meeting.folderId === folderId);

  if (words) {
    meetings = meetings.filter((meeting) => {
      const haystack = [meeting.title, meeting.summary, longDate(meeting.startedAt)].join(' ').toLowerCase();
      return haystack.includes(words);
    });
  }

  const compare = {
    newest:   (a, b) => String(b.startedAt).localeCompare(String(a.startedAt)),
    oldest:   (a, b) => String(a.startedAt).localeCompare(String(b.startedAt)),
    longest:  (a, b) => b.durationSec - a.durationSec,
    shortest: (a, b) => a.durationSec - b.durationSec,
    title:    (a, b) => a.title.localeCompare(b.title),
  }[sort] || ((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));

  return [...meetings].sort(compare);
}

function folderLabel(db, folderId) {
  const folder = folderId ? db.get('folders', folderId) : null;
  return folder ? folder.name : 'All folders';
}

function meetingRow(app, meeting, paint) {
  const db = app.db;
  const names = [...speakerMap(db, meeting.id).values()].filter(Boolean);
  const openActions = db.where('actions', { meetingId: meeting.id, status: 'open' }).length;

  const options = button('', { iconName: 'more', variant: 'quiet', size: 'sm', title: 'Options' });
  options.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    menu(options, [
      { label: 'Rename', iconName: 'edit', onSelect: async () => {
        const title = await promptDialog({ title: 'Rename meeting', label: 'Title', value: meeting.title });
        if (title) { db.update('meetings', meeting.id, { title }); paint(); }
      } },
      { label: meeting.favorite ? 'Remove from favourites' : 'Add to favourites', iconName: 'star', onSelect: () => {
        db.update('meetings', meeting.id, { favorite: !meeting.favorite }); paint();
      } },
      { label: meeting.archived ? 'Unarchive' : 'Archive', iconName: 'bookmark', onSelect: () => {
        db.update('meetings', meeting.id, { archived: !meeting.archived }); paint();
      } },
      { label: 'Move to folder…', iconName: 'folder', onSelect: async () => {
        if (await moveToFolder(app, meeting.id)) paint();
      } },
      '-',
      { label: 'Delete', iconName: 'trash', danger: true, onSelect: async () => {
        if (await confirm({
          title: `Delete “${meeting.title}”?`,
          body: 'The recording, transcript and everything drawn from it are permanently deleted from this device.',
          confirmLabel: 'Delete', danger: true,
        })) { await db.deleteMeeting(meeting.id); toast('Meeting deleted.'); paint(); }
      } },
    ]);
  });

  const facts = [dayLabel(meeting.startedAt), duration(meeting.durationSec)];
  if (names.length) facts.push(names.slice(0, 3).join(' · '));

  const row = linkRow({
    href: Router.href('meeting', [meeting.id]),
    title: meeting.title,
    lines: [facts.join(' · '), meeting.summary ? h('span.meta.clamp-2', meeting.summary) : null].filter(Boolean),
    side: [
      meeting.favorite ? icon('star', { size: 14, title: 'Favourite' }) : null,
      openActions ? tag(`${openActions} open`) : null,
      statusTag(meeting.status),
      options,
    ].filter(Boolean),
  });
  return row;
}
