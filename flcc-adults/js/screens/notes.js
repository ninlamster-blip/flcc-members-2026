// NOTES — every sermon you have written anything down for.
//
// A list and one button. The button is the feature.

import { h, poster, label, display, headline, art, go, pill, note, rows, row,
         rise } from '../core/ui.js';
import * as notes from '../core/notes.js';

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** The first line of the body, for a note whose author never gave it a title. */
const firstLine = (body) => {
  const line = String(body || '').split('\n').map((one) => one.trim()).find(Boolean) || '';
  return line.length > 60 ? `${line.slice(0, 60)}…` : line;
};

export default async function notesScreen(ctx) {
  // Anything left blank from a previous visit goes now, rather than
  // accumulating as a list of "Untitled" a member has to clean up.
  notes.tidy();
  const all = notes.list();
  const parts = [];

  parts.push(poster({ tone: 'captain', tall: !all.length },
    label('Sermon notes'),
    h('div', {},
      all.length ? headline('YOUR NOTES') : display('WRITE IT DOWN.'),
      h('p', { class: 'lead dim', style: 'margin-top:1rem',
        text: all.length
          ? 'Everything you have written, newest first. It stays on this phone.'
          : 'A title, the passage, and a page to write on. Nothing else — you are meant to be listening.' })),
    h('div', { class: 'poster-foot' },
      pill('Start a note', () => ctx.go(`note/${notes.create().id}`)),
      art('book', { tone: 'captain', size: 'sm' }))));

  if (all.length) {
    parts.push(poster({ tone: 'paper' },
      label(`${all.length} ${all.length === 1 ? 'note' : 'notes'}`),
      rows(...all.map((one) => row({
        title: String(one.title).trim() || firstLine(one.body) || 'Untitled',
        note: [one.speaker, one.ref].filter(Boolean).join(' · '),
        meta: when(one.updatedAt),
        onclick: () => ctx.go(`note/${one.id}`),
      })))));
  }

  parts.push(poster({ tone: 'paper' },
    label('Where these live'),
    h('p', { class: 'body', text: 'On this phone, and nowhere else. There is no account behind this app, so nobody at the church can read your notes — and a second phone starts empty.' }),
    note('Clearing your browser’s data for this site clears them too. If a note matters, copy it somewhere.')));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Notes', el };
}
