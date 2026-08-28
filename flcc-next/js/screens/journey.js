// One journey: its lessons, in order, with what has been finished.

import { h, poster, label, display, art, track, note, rise } from '../core/ui.js';
import * as content from '../core/content.js';
import { forMode } from '../core/profile.js';
import * as progress from '../core/progress.js';

export default async function journeyScreen(ctx) {
  const id = ctx.route.args[0];
  let journey = null;
  let lessons = [];
  try {
    journey = (await content.journeys()).find((row) => row.id === id);
    lessons = await content.lessons(id);
  } catch { /* handled below */ }
  if (!journey) return { title: 'Journey', el: poster({ tone: 'paper', className: 'full' }, note('That journey could not be found.')) };

  const state = progress.getProgress();
  const done = lessons.filter((lesson) => state.done[`lesson:${id}/${lesson.id}`]).length;
  const percent = Math.round((done / lessons.length) * 100);

  const rows = lessons.map((lesson, index) => {
    const finished = Boolean(state.done[`lesson:${id}/${lesson.id}`]);
    return poster({ tone: finished ? 'paper' : journey.tone, as: 'button',
      onclick: () => ctx.go(`lesson/${id}/${lesson.id}`) },
      label(`Lesson ${index + 1}${finished ? ' · done' : ''}`),
      h('div', {}, h('h2', { class: 'headline', text: lesson.title }),
        h('p', { class: 'label dim', style: 'margin-top:.7rem', text: lesson.ref })));
  });

  const el = h('div', { style: 'display:contents' },
    poster({ tone: journey.tone, tall: true, className: 'full' },
      label('Journey'),
      h('div', {}, display(journey.title),
        h('p', { class: 'body dim', style: 'margin-top:.9rem', text: forMode(journey.blurb, ctx.mode) })),
      h('div', { style: 'display:flex;flex-direction:column;gap:.7rem' },
        track(percent),
        h('div', { class: 'poster-foot' },
          h('p', { class: 'label', text: `${done} of ${lessons.length} lessons` }),
          art(journey.symbol, { tone: journey.tone, size: 'sm' })))),
    ...rows);

  rise(rows);
  return { title: journey.title, el };
}
