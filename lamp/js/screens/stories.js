// Bible stories — the list. Each story is the same six parts (SPEC.md §7).

import { h, list, row, notice, spinner, section } from '../core/ui.js';
import * as content from '../core/content.js';
import { getProgress } from '../core/progress.js';
import { pick } from '../core/age.js';
import { prettyRef } from '../core/refs.js';

export default async function storiesScreen(ctx) {
  const el = h('div', {}, spinner());

  try {
    const index = await content.stories();
    const read = getProgress().stories || {};
    const groups = [
      ['Old Testament', index.filter((s) => s.testament === 'OT')],
      ['New Testament', index.filter((s) => s.testament === 'NT')],
    ];
    el.replaceChildren(
      h('p', { class: 'lede', style: 'margin-bottom:1.5rem',
        text: 'Every story has the same six parts: the story, what happened, what it teaches, something to think about, a prayer, and a challenge.' }),
      ...groups.filter(([, items]) => items.length).map(([title, items]) => section(title,
        list(...items.map((story) => row({
          title: story.title,
          sub: `${prettyRef(story.reference)}${story.summary ? ' · ' + pick(story.summary, ctx.band) : ''}`,
          end: read[story.slug] ? 'Read' : '',
          onclick: () => ctx.go(`story/${story.slug}`),
        }))))),
    );
  } catch (error) {
    el.replaceChildren(notice(`Stories could not be loaded. ${error.message}`));
  }

  return { title: 'Bible stories', el };
}
