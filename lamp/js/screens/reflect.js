// NOTES — everything the reader wrote or marked: journal, prayers, and the
// verses they highlighted. A quiet index, not a hub. Nothing here leaves the
// device.

import { h, strip, go, list, row, notice } from '../core/ui.js';
import * as store from '../core/storage.js';
import * as memory from '../core/memory.js';
import { parseRef, formatRef } from '../core/refs.js';
import { pips } from '../core/ui.js';

export default async function reflectScreen(ctx) {
  const journal = store.read(store.KEYS.journal, { entries: [] }) || { entries: [] };
  const prayers = (store.read(store.KEYS.prayers, { items: [] }) || {}).items || [];
  // Highlights, newest chapter first.
  const marks = (store.read(store.KEYS.highlights, { items: {} }) || {}).items || {};
  const highlights = Object.entries(marks).flatMap(([chapterKey, verses]) => {
    const [bookId, chapter] = chapterKey.split('.');
    return Object.keys(verses).map((verse) => {
      const ref = parseRef(`${bookId}.${chapter}.${verse}`);
      return { bookId, chapter, verse, label: ref ? formatRef(ref) : `${chapterKey}:${verse}` };
    });
  });

  const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

  const el = h('div', {},
    h('section', { class: 'strip strip-tight' },
      h('h1', { class: 'title-lg', text: 'Notes' }),
      h('p', { class: 'sub', style: 'margin-top:.4rem',
        text: 'What you write here stays on this device. It is never uploaded, and never shown to a parent.' })),

    strip('Journal',
      journal.entries.length
        ? h('div', {},
            h('p', { class: 'scripture', style: 'font-size:1.05rem',
              text: journal.entries[0].body ? `“${journal.entries[0].body.slice(0, 120)}${journal.entries[0].body.length > 120 ? '…' : ''}”` : 'An entry with no words yet.' }),
            h('p', { class: 'ref', style: 'margin-top:.6rem', text: when(journal.entries[0].date) }))
        : h('p', { class: 'lede', text: 'A date and an empty page is a fine entry. Write when you want to.' }),
      go(journal.entries.length ? 'Open journal' : 'Start writing', () => ctx.go('journal'))),

    strip('Prayer',
      prayers.length
        ? h('p', { class: 'lede', text: `${prayers.length} prayer${prayers.length === 1 ? '' : 's'} kept, ${prayers.filter((p) => p.answeredAt).length} marked answered.` })
        : h('p', { class: 'lede', text: 'Tell God how you are, and let Scripture answer first.' }),
      go('Pray', () => ctx.go('prayer'))),

    strip('Highlights',
      highlights.length
        ? h('ul', { class: 'list' }, ...highlights.slice(0, 8).map((mark) => h('li', {},
            h('button', { class: 'row', type: 'button', onclick: () => ctx.go(`read/${mark.bookId}/${mark.chapter}?v=${mark.verse}`) },
              h('span', { class: 'row-main' },
                h('span', { class: 'row-title', text: mark.label }),
                h('span', { class: 'row-sub', text: 'Marked while reading' }))))))
        : h('p', { class: 'lede', text: 'Tap a verse while reading and choose a colour. Every verse you mark is listed here.' }),
      highlights.length > 8 ? h('p', { class: 'sub', style: 'margin-top:.9rem', text: `and ${highlights.length - 8} more` }) : null),
  );

  return { title: 'Notes', el };
}
