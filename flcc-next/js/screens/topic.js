// One Real Life topic — an editorial cover, then something honest.

import { h, poster, label, display, art, pill, go, note } from '../core/ui.js';
import * as content from '../core/content.js';
import { forMode } from '../core/profile.js';

export default async function topicScreen(ctx) {
  const id = ctx.route.args[0];
  let topic = null;
  try { topic = (await content.realLife()).find((row) => row.id === id); } catch { /* below */ }
  if (!topic) return { title: 'Real life', el: poster({ tone: 'paper', className: 'full' }, note('That topic could not be found.')) };

  const el = h('div', { style: 'display:contents' },
    poster({ tone: topic.tone, tall: true, className: 'full' },
      label('Real life'),
      h('div', {}, display(topic.title),
        h('p', { class: 'lead dim', style: 'margin-top:1.1rem', text: forMode(topic.hook, ctx.mode) })),
      h('div', { class: 'poster-foot' }, h('span'), art(topic.symbol, { tone: topic.tone }))),

    poster({ tone: 'paper', className: 'full' },
      label('Straight up'),
      h('p', { class: 'lead', text: forMode(topic.body, ctx.mode) })),

    poster({ tone: 'ink', className: 'full' },
      label('What the Bible says'),
      h('p', { class: 'verse', text: `“${topic.verse}”` }),
      h('p', { class: 'ref dim', text: topic.ref })),

    poster({ tone: 'paper', className: 'full' },
      label('One next step'),
      h('p', { class: 'lead', text: forMode(topic.step, ctx.mode) }),
      h('div', { class: 'poster-foot' },
        pill('Ask about this', () => ctx.go('ask')),
        go('Pray', () => ctx.go('prayer')))),
  );

  return { title: topic.title, el };
}
