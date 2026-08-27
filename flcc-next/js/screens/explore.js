// EXPLORE — a curated library of covers, not a grid of cards.

import { h, poster, label, display, headline, art, go, track, rise, waiting, note } from '../core/ui.js';
import * as content from '../core/content.js';
import { forMode, isKids } from '../core/profile.js';
import { getProgress } from '../core/progress.js';

export default async function exploreScreen(ctx) {
  const el = h('div', { style: 'display:contents' }, waiting());

  let journeys = [];
  let topics = [];
  try {
    [journeys, topics] = await Promise.all([content.journeys(), content.realLife()]);
  } catch (error) {
    return { title: 'Explore', el: poster({ tone: 'paper', className: 'full' }, note(`Nothing loaded. ${error.message}`)) };
  }

  const state = getProgress();
  const doneIn = (id) => Object.keys(state.done).filter((k) => k.startsWith(`lesson:${id}/`)).length;

  const blocks = [
    ...journeys.map((journey, index) => {
      const done = doneIn(journey.id);
      const percent = Math.round((done / journey.lessons) * 100);
      return poster({ tone: journey.tone, tall: index === 0, as: 'button',
        className: index === 0 ? 'full' : '', onclick: () => ctx.go(`journey/${journey.id}`) },
        label(index === 0 ? 'Featured journey' : 'Journey'),
        h('div', {},
          index === 0 ? display(journey.title) : headline(journey.title),
          h('p', { class: 'body dim', style: 'margin-top:.9rem', text: forMode(journey.blurb, ctx.mode) })),
        h('div', { class: 'poster-foot' },
          h('div', { style: 'flex:1;display:flex;flex-direction:column;gap:.6rem' },
            done ? track(percent) : null,
            h('p', { class: 'label', text: done ? `${percent}% complete` : `${journey.lessons} lessons` })),
          art(journey.symbol, { tone: journey.tone, size: index === 0 ? '' : 'sm' })));
    }),

    poster({ tone: 'ink', className: 'full' },
      label('Real life'),
      h('div', {},
        display(isKids() ? 'THINGS THAT MATTER.' : 'THE STUFF NOBODY TALKS ABOUT.'),
        h('p', { class: 'body dim', style: 'margin-top:.9rem',
          text: isKids() ? 'Feelings, friends, family — and what God says about them.'
                         : 'Pressure, anxiety, identity, relationships — with the Bible taken seriously.' })),
      h('div', { class: 'poster-foot' }, h('span', { class: 'label', text: `${topics.length} topics` }), art('bulb', { tone: 'ink', size: 'sm' }))),

    ...topics
      .filter((topic) => topic.ageGroup === 'both' || topic.ageGroup === ctx.mode)
      .map((topic) => poster({ tone: topic.tone, as: 'button', onclick: () => ctx.go(`topic/${topic.id}`) },
        label('Real life'),
        h('div', {}, headline(topic.title),
          h('p', { class: 'body dim', style: 'margin-top:.7rem', text: forMode(topic.hook, ctx.mode) })),
        h('div', { class: 'poster-foot' }, go('Open', () => ctx.go(`topic/${topic.id}`)), art(topic.symbol, { tone: topic.tone, size: 'sm' })))),
  ];

  el.replaceChildren(...blocks);
  rise(blocks);
  return { title: 'Explore', el };
}
