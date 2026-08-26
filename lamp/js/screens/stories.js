// Bible stories — the list, which is a different thing at seven and at sixteen.
// At 7–10 it is a shelf of pictures; at 11–14 a list with a thumbnail; at
// 15–18 a plain index, because by then the picture is in the way.

import { h, list, row, notice, spinner, section, sceneEl, reveal } from '../core/ui.js';
import * as content from '../core/content.js';
import { getProgress } from '../core/progress.js';
import { pick } from '../core/age.js';
import { displayRef } from '../core/refs.js';
import { hasScene } from '../core/art.js';

export default async function storiesScreen(ctx) {
  const el = h('div', {}, spinner());

  let index;
  try {
    index = await content.stories();
  } catch (error) {
    el.replaceChildren(notice(`Stories could not be loaded. ${error.message}`));
    return { title: 'Bible stories', el };
  }

  const read = getProgress().stories || {};
  const band = ctx.band;

  const card = (story) => {
    const button = h('button', { class: 'story-card', type: 'button', onclick: () => ctx.go(`story/${story.slug}`) },
      hasScene(story.slug) ? sceneEl(story.slug, { ratio: 'story', title: story.title }) : null,
      h('span', { class: 'label' },
        h('span', { class: 'name', text: story.title }),
        h('span', { class: 'ref', text: displayRef(story.reference) }),
        read[story.slug] ? h('span', { class: 'done', text: 'Read' }) : null));
    return button;
  };

  const listRow = (story) => h('li', {},
    h('button', { class: 'row', type: 'button', onclick: () => ctx.go(`story/${story.slug}`) },
      hasScene(story.slug) ? sceneEl(story.slug, { ratio: 'thumb', title: story.title }) : null,
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title', text: story.title }),
        h('span', { class: 'row-sub', text: `${displayRef(story.reference)} · ${pick(story.summary, band)}` })),
      read[story.slug] ? h('span', { class: 'row-end', text: 'Read' }) : null));

  const plainRow = (story) => row({
    title: story.title,
    sub: `${displayRef(story.reference)} · ${pick(story.summary, band)}`,
    end: read[story.slug] ? 'Read' : '',
    onclick: () => ctx.go(`story/${story.slug}`),
  });

  const group = (title, stories) => {
    if (!stories.length) return null;
    if (band === '7-10') return section(title, h('div', { class: 'story-grid' }, ...stories.map(card)));
    if (band === '11-14') return section(title, h('ul', { class: 'list' }, ...stories.map(listRow)));
    return section(title, list(...stories.map(plainRow)));
  };

  const intro = band === '15-18'
    ? 'Each story in six parts: the story, what happened, what it teaches, something to think about, a prayer, and a challenge.'
    : 'Every story has six parts — the story, what happened, what it teaches, something to think about, a prayer, and a challenge.';

  const sections = [
    group('Old Testament', index.filter((s) => s.testament === 'OT')),
    group('New Testament', index.filter((s) => s.testament === 'NT')),
  ].filter(Boolean);

  el.replaceChildren(h('p', { class: 'lede', style: 'margin-bottom:1.5rem', text: intro }), ...sections);
  reveal(sections);

  return { title: 'Bible stories', el };
}
