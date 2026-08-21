/**
 * Folders.
 *
 * The one piece of organisation the app has beyond favourites and archive: a
 * meeting belongs to at most one folder, folders have no hierarchy, and there
 * is no separate screen to manage them — a folder is created by moving
 * something into it and disappears when it is deleted from the filter it
 * appears in. Anything more elaborate would be filing, not recording.
 */

import { h } from './dom.js';
import { dialog, button, field, rows, toast, confirm } from './ui.js';

/**
 * Ask where a meeting should live, then put it there.
 * @param {{db: import('./db.js').Database}} app
 * @param {string} meetingId
 * @returns {Promise<boolean>} whether anything moved
 */
export async function moveToFolder(app, meetingId) {
  const db = app.db;
  const meeting = db.get('meetings', meetingId);
  if (!meeting) return false;
  const folders = db.all('folders').sort((a, b) => a.name.localeCompare(b.name));

  const name = h('input.input', { type: 'text', placeholder: 'New folder' });
  // The rows need the dialog's own close function, which only exists once the
  // dialog is building its buttons. They are only ever *called* after that, so
  // holding it in a local is enough.
  let close = () => {};
  const choice = await dialog({
    title: 'Move to folder',
    body: h('div.stack',
      rows(
        row('No folder', !meeting.folderId, () => close({ folderId: null })),
        ...folders.map((folder) => row(folder.name, meeting.folderId === folder.id, () => close({ folderId: folder.id })))),
      field('Or create one', name)),
    actions: (done) => {
      close = done;
      return [
        button('Cancel', { onClick: () => done(null) }),
        button('Create and move', { variant: 'primary', onClick: () => done({ newFolder: name.value.trim() }) }),
      ];
    },
  });

  if (!choice) return false;
  let folderId = choice.folderId ?? null;
  if (choice.newFolder) {
    const existing = folders.find((folder) => folder.name.toLowerCase() === choice.newFolder.toLowerCase());
    folderId = existing ? existing.id : db.insert('folders', { name: choice.newFolder }).id;
  } else if (choice.newFolder === '') {
    return false;                       // "Create and move" with nothing typed
  }
  db.update('meetings', meetingId, { folderId });
  toast(folderId ? `Moved to ${db.get('folders', folderId).name}.` : 'Removed from its folder.');
  return true;
}

function row(label, current, onSelect) {
  return h('button.row-item', { type: 'button', onClick: onSelect },
    h('div.row-item__main', h('span.row-item__title', label)),
    current ? h('div.row-item__side', h('span.meta-sm', 'Current')) : '');
}

/** Delete a folder, leaving its meetings where they are. */
export async function deleteFolder(app, folderId) {
  const folder = app.db.get('folders', folderId);
  if (!folder) return false;
  const inside = app.db.where('meetings', { folderId });
  const done = await confirm({
    title: `Delete the folder “${folder.name}”?`,
    body: inside.length
      ? `The ${inside.length} ${inside.length === 1 ? 'meeting' : 'meetings'} in it stay exactly where they are — they simply stop being filed under it.`
      : 'Nothing is in it.',
    confirmLabel: 'Delete folder',
    danger: true,
  });
  if (!done) return false;
  for (const meeting of inside) app.db.update('meetings', meeting.id, { folderId: null });
  app.db.remove('folders', folderId);
  toast('Folder deleted.');
  return true;
}
