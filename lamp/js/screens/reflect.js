// REFLECT — the private half of the app in one place: prayer, journal, and the
// verses being learned by heart. A quiet index, not a hub.

import { h, strip, go, list, row, notice } from '../core/ui.js';
import * as store from '../core/storage.js';
import * as memory from '../core/memory.js';
import { parseRef, formatRef } from '../core/refs.js';
import { pips } from '../core/ui.js';

export default async function reflectScreen(ctx) {
  const journal = store.read(store.KEYS.journal, { entries: [] }) || { entries: [] };
  const prayers = (store.read(store.KEYS.prayers, { items: [] }) || {}).items || [];
  const verses = memory.getMemory().verses;
  const due = memory.dueVerses();

  const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });

  const el = h('div', {},
    h('section', { class: 'strip strip-tight' },
      h('h1', { class: 'title-lg', text: 'Reflect' }),
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

    strip('By heart',
      verses.length
        ? h('ul', { class: 'list' }, ...verses.slice(0, 5).map((verse) => h('li', {},
            h('button', { class: 'row', type: 'button', onclick: () => ctx.go('memory') },
              h('span', { class: 'row-main' },
                h('span', { class: 'row-title', text: formatRef(parseRef(verse.ref)) || verse.ref }),
                h('span', { class: 'row-sub', text: memory.STAGE_LABEL[verse.stage] })),
              pips(memory.STAGES.indexOf(verse.stage) + 1)))))
        : h('p', { class: 'lede', text: 'Tap a verse while reading and choose Remember. It comes back a day later, then three days, then a week.' }),
      go(due.length ? `Practise ${due.length} due` : 'Memory verses', () => ctx.go('memory'))),
  );

  return { title: 'Reflect', el };
}
