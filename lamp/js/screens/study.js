// STUDY — search, and the things that help a passage make sense.
//
// Search runs over the chapters this device has downloaded, which is honest
// about what it can find and works with no connection. Understanding sits
// here too, as a capability rather than a personality.

import { h, strip, go, list, row, notice, spinner, sceneEl, toast } from '../core/ui.js';
import { searchCached } from '../core/bible.js';
import { parseRef, displayRef, formatRef } from '../core/refs.js';
import { translationId } from '../core/profile.js';
import * as content from '../core/content.js';
import * as memory from '../core/memory.js';
import { pick } from '../core/age.js';
import { hasScene } from '../core/art.js';
import { getProgress } from '../core/progress.js';

export default async function studyScreen(ctx) {
  const trans = translationId(ctx.settings);
  const results = h('div');

  const input = h('input', {
    type: 'search', id: 'study-search', autocomplete: 'off', autocapitalize: 'none',
    placeholder: 'A word, or a reference like John 3:16',
  });

  const form = h('form', { onsubmit: async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    const ref = parseRef(query);
    if (ref) { ctx.go(`read/${ref.book.id}/${ref.chapter}${ref.verseStart ? `?v=${ref.verseStart}` : ''}`); return; }

    results.replaceChildren(spinner());
    const { results: hits, searched } = await searchCached(query, { translationId: trans });
    if (!hits.length) {
      results.replaceChildren(notice(searched
        ? `Nothing for “${query}” in the ${searched} chapter${searched === 1 ? '' : 's'} you have opened. Search looks through what this device has downloaded.`
        : 'Search looks through chapters you have already opened. Read one first and it becomes searchable, even offline.'));
      return;
    }
    const rows = hits.map((hit) => h('li', {},
      h('button', { class: 'row', type: 'button', onclick: () => ctx.go(`read/${hit.book.id}/${hit.chapter}?v=${hit.verse}`) },
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title', text: `${hit.book.name} ${hit.chapter}:${hit.verse}` }),
          h('span', { class: 'row-sub', text: hit.text.length > 96 ? `${hit.text.slice(0, 96)}…` : hit.text })))));
    results.replaceChildren(
      h('p', { class: 'eyebrow', style: 'margin-top:1.25rem', text: `${hits.length} result${hits.length === 1 ? '' : 's'}` }),
      h('ul', { class: 'list' }, ...rows));
  } }, h('label', { for: 'study-search', text: 'Search' }), input);

  const el = h('div', {},
    h('section', { class: 'strip strip-tight' }, form, results),

    strip('Understanding',
      h('p', { class: 'lede', text: 'Ask what a passage means, what was happening at the time, or how to live it out. Answers show what Scripture says, what Christians have believed, and where they disagree — separately.' }),
      go('Ask about a passage', () => ctx.go('ask'))),
  );

  // Stories, for the bands that read them.
  const stories = h('div');
  el.appendChild(stories);
  (async () => {
    let index = [];
    try { index = await content.stories(); } catch { return; }
    const read = getProgress().stories || {};
    if (ctx.band === '15-18') {
      stories.replaceChildren(strip('Stories',
        h('ul', { class: 'list' }, ...index.slice(0, 6).map((story) => h('li', {},
          h('button', { class: 'row', type: 'button', onclick: () => ctx.go(`story/${story.slug}`) },
            h('span', { class: 'row-main' },
              h('span', { class: 'row-title', text: story.title }),
              h('span', { class: 'row-sub', text: `${displayRef(story.reference)} · ${pick(story.summary, ctx.band)}` })),
            read[story.slug] ? h('span', { class: 'row-end', text: 'Read' }) : null)))),
        go('All stories', () => ctx.go('stories'))));
      return;
    }
    stories.replaceChildren(strip('Stories',
      h('div', { class: 'story-grid' }, ...index.slice(0, 4).map((story) =>
        h('button', { class: 'story-card', type: 'button', onclick: () => ctx.go(`story/${story.slug}`) },
          hasScene(story.slug) ? sceneEl(story.slug, { ratio: 'story', title: story.title }) : null,
          h('span', { class: 'name', text: story.title }),
          h('span', { class: 'ref', text: displayRef(story.reference) })))),
      go('All stories', () => ctx.go('stories'))));
  })();

  // Verses being learned by heart.
  const verses = memory.getMemory().verses;
  const due = memory.dueVerses();
  el.appendChild(strip('By heart',
    verses.length
      ? h('p', { class: 'lede', text: `${verses.length} verse${verses.length === 1 ? '' : 's'}, ${verses.filter((v) => v.stage === 'mastered').length} known by heart.` })
      : h('p', { class: 'lede', text: 'Tap a verse while reading and choose Remember. It comes back a day later, then three days, then a week.' }),
    go(due.length ? `Practise ${due.length} due` : 'Memory verses', () => ctx.go('memory'))));

  return { title: 'Study', el };
}
