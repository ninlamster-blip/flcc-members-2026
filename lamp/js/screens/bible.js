// BIBLE — book and chapter navigation, a jump-to field, and search over the
// chapters this device has already downloaded.

import { h, section, list, row, button, notice, spinner, toast, sceneEl } from '../core/ui.js';
import { OLD_TESTAMENT, NEW_TESTAMENT } from '../core/books.js';
import { parseRef, formatRef, displayRef } from '../core/refs.js';
import * as content from '../core/content.js';
import { pick } from '../core/age.js';
import { hasScene } from '../core/art.js';
import { searchCached, TRANSLATIONS } from '../core/bible.js';
import { translationId, saveSettings } from '../core/profile.js';

export default async function bibleScreen(ctx) {
  const el = h('div');
  const trans = translationId(ctx.settings);

  const results = h('div');
  const input = h('input', {
    type: 'search',
    id: 'bible-jump',
    placeholder: 'John 3:16, Psalm 23, or a word to look for',
    autocomplete: 'off',
    autocapitalize: 'none',
  });

  const form = h('form', { class: 'field', onsubmit: async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    const ref = parseRef(query);
    if (ref) { ctx.go(`read/${ref.book.id}/${ref.chapter}${ref.verseStart ? `?v=${ref.verseStart}` : ''}`); return; }

    results.replaceChildren(spinner());
    const { results: hits, searched } = await searchCached(query, { translationId: trans });
    if (!hits.length) {
      results.replaceChildren(notice(searched
        ? `Nothing found for “${query}” in the ${searched} chapter${searched === 1 ? '' : 's'} you have read. Search looks through what this device has downloaded.`
        : 'Search looks through the chapters you have already opened. Read a chapter first, and it becomes searchable — even offline.'));
      return;
    }
    results.replaceChildren(
      h('p', { class: 'eyebrow', text: `${hits.length} result${hits.length === 1 ? '' : 's'}` }),
      list(...hits.map((hit) => row({
        title: `${hit.book.name} ${hit.chapter}:${hit.verse}`,
        sub: hit.text.length > 90 ? `${hit.text.slice(0, 90)}…` : hit.text,
        onclick: () => ctx.go(`read/${hit.book.id}/${hit.chapter}?v=${hit.verse}`),
      }))),
    );
  } },
    h('label', { for: 'bible-jump', text: 'Go to' }),
    input,
    h('p', { class: 'field-hint', text: 'Type a reference to jump, or a word to search what you have read.' }));

  el.appendChild(form);
  el.appendChild(results);

  const openBook = (book, holder) => {
    const existing = holder.querySelector('.chapter-grid');
    if (existing) { existing.remove(); return; }
    holder.querySelectorAll('.chapter-grid').forEach((node) => node.remove());
    const grid = h('div', { class: 'grid chapter-grid', style: 'grid-template-columns:repeat(auto-fill,minmax(3rem,1fr));padding:.5rem 0 1rem' });
    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      grid.appendChild(button(String(chapter), {
        style: 'min-height:44px;padding:.4rem;border-radius:10px',
        onclick: () => ctx.go(`read/${book.id}/${chapter}`),
      }));
    }
    holder.appendChild(grid);
  };

  const testament = (title, books) => {
    const wrap = h('div');
    wrap.appendChild(list(...books.map((book) => {
      const item = h('li', {});
      item.appendChild(h('button', { class: 'row', type: 'button', onclick: () => openBook(book, item) },
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title', text: book.name }),
          h('span', { class: 'row-sub', text: `${book.chapters} chapter${book.chapters === 1 ? '' : 's'}` }))));
      return item;
    })));
    return section(title, wrap);
  };

  // "WEB / KJV / ASV" means nothing to a seven-year-old, and it is the first
  // thing they would see. It stays in Me → Settings for that band.
  if (ctx.band !== '7-10') el.appendChild(h('div', { class: 'btn-row', style: 'margin-bottom:1.5rem' },
    ...TRANSLATIONS.map((option) => {
      const active = option.id === trans;
      return button(option.id, {
        variant: active ? 'btn-primary' : '',
        title: option.name,
        onclick: () => {
          saveSettings({ translation: option.id });
          toast(`Reading the ${option.name}.`);
          ctx.refresh();
        },
      });
    })));

  // The youngest bands get somewhere to start before the full canon.
  const startHere = h('div');
  if (ctx.band !== '15-18') {
    el.appendChild(startHere);
    (async () => {
      let entries = [];
      try { entries = await content.load('start-here.json'); } catch { return; }
      const rows = entries.map((entry) => {
        const ref = parseRef(entry.ref);
        if (!ref) return null;
        return h('li', {},
          h('button', { class: 'row', type: 'button', onclick: () => ctx.go(`read/${ref.book.id}/${ref.chapter}`) },
            entry.scene && hasScene(entry.scene) ? sceneEl(entry.scene, { ratio: 'thumb' }) : null,
            h('span', { class: 'row-main' },
              h('span', { class: 'row-title', text: pick(entry.label, ctx.band) }),
              h('span', { class: 'row-sub', text: displayRef(entry.ref) }))));
      }).filter(Boolean);
      startHere.replaceChildren(section('Start here', h('ul', { class: 'list' }, ...rows)));
    })();
  }

  el.appendChild(testament('Old Testament', OLD_TESTAMENT));
  el.appendChild(testament('New Testament', NEW_TESTAMENT));

  return { title: 'Bible', el };
}
