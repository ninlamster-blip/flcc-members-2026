// JOURNAL — a private spiritual diary, not a form.
// Entries never leave the device, never reach the AI unprompted, and are not
// shown in parent mode (SPEC.md §10, §11).

import { h, section, card, eyebrow, button, list, row, empty, toast } from '../core/ui.js';
import * as store from '../core/storage.js';
import * as content from '../core/content.js';
import { pick } from '../core/age.js';

function getJournal() {
  return store.read(store.KEYS.journal, { entries: [] }) || { entries: [] };
}

export default async function journalScreen(ctx) {
  const el = h('div');
  let prompts = { teaching: 'What is God teaching me?', thankful: 'What am I thankful for?', help: 'What do I need God’s help with?' };
  try {
    const loaded = await content.journalPrompts();
    prompts = {
      teaching: pick(loaded.teaching, ctx.band),
      thankful: pick(loaded.thankful, ctx.band),
      help: pick(loaded.help, ctx.band),
    };
  } catch { /* the defaults above are fine */ }

  const body = h('textarea', { 'aria-label': 'Today’s entry', placeholder: 'Today…', style: 'min-height:10rem' });
  const teaching = h('textarea', { 'aria-label': prompts.teaching, style: 'min-height:4rem' });
  const thankful = h('textarea', { 'aria-label': prompts.thankful, style: 'min-height:4rem' });
  const help = h('textarea', { 'aria-label': prompts.help, style: 'min-height:4rem' });

  const editor = card({},
    eyebrow(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })),
    body,
    h('div', { style: 'margin-top:1.25rem' }, h('label', { text: prompts.teaching }), teaching),
    h('div', { style: 'margin-top:1rem' }, h('label', { text: prompts.thankful }), thankful),
    h('div', { style: 'margin-top:1rem' }, h('label', { text: prompts.help }), help),
    h('div', { class: 'btn-row', style: 'margin-top:1.1rem' },
      button('Save', { variant: 'btn-primary', onclick: () => {
        const text = [body.value, teaching.value, thankful.value, help.value].join('').trim();
        if (!text) { toast('Nothing to save yet.'); return; }
        const state = getJournal();
        state.entries.unshift({
          id: `j${Date.now()}`,
          date: new Date().toISOString(),
          body: body.value.trim(),
          prompts: { teaching: teaching.value.trim(), thankful: thankful.value.trim(), help: help.value.trim() },
        });
        store.write(store.KEYS.journal, state);
        toast('Saved. Only you can read this.');
        ctx.refresh();
      } })),
    h('p', { class: 'field-hint', text: 'Private. Kept on this device, never uploaded, and not shown to a parent.' }));

  const entries = getJournal().entries;

  el.appendChild(section(null, editor));
  el.appendChild(entries.length
    ? section('Earlier entries', list(...entries.map((entry) => row({
        title: entry.body ? (entry.body.length > 60 ? `${entry.body.slice(0, 60)}…` : entry.body) : 'Entry',
        sub: new Date(entry.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }),
        onclick: () => {
          const parts = [entry.body, entry.prompts && entry.prompts.teaching, entry.prompts && entry.prompts.thankful, entry.prompts && entry.prompts.help].filter(Boolean);
          const view = card({}, eyebrow(new Date(entry.date).toLocaleDateString()),
            ...parts.map((part) => h('p', { text: part })),
            h('div', { class: 'btn-row', style: 'margin-top:1.1rem' }, button('Delete this entry', { variant: 'btn-quiet', onclick: () => {
              const state = getJournal();
              state.entries = state.entries.filter((e) => e.id !== entry.id);
              store.write(store.KEYS.journal, state);
              toast('Deleted.');
              ctx.refresh();
            } })));
          el.replaceChildren(view, button('Back to journal', { variant: 'btn-quiet', onclick: ctx.refresh }));
        },
      }))))
    : section(null, empty('Nothing written yet', 'A date and an empty page is a fine entry. Write when you want to.')));

  return { title: 'Journal', el, tab: 'me' };
}
