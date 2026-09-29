// PLAY — each game gets its own colour and its own poster.

import { h, poster, label, display, headline, art, rise, note } from '../core/ui.js';
import * as content from '../core/content.js';
import { forMode } from '../core/profile.js';
import { count } from '../core/progress.js';

export default async function playScreen(ctx) {
  let games = [];
  try { games = await content.games(); }
  catch (error) { return { title: 'Play', el: poster({ tone: 'paper', className: 'full' }, note(`Games could not be loaded. ${error.message}`)) }; }

  const played = count('game');
  const blocks = games.map((game, index) => poster({
    tone: game.tone, tall: index === 0, as: 'button',
    className: index === 0 ? 'full' : '',
    onclick: () => ctx.go(`game/${game.id}`),
  },
    label(index === 0 ? 'Today’s game' : 'Game'),
    h('div', {},
      index === 0 ? display(game.title) : headline(game.title),
      h('p', { class: 'body dim', style: 'margin-top:.8rem', text: forMode(game.blurb, ctx.mode) })),
    h('div', { class: 'poster-foot' },
      h('p', { class: 'label', text: '★'.repeat(game.difficulty) + '☆'.repeat(5 - game.difficulty) }),
      art(game.symbol, { tone: game.tone, size: index === 0 ? '' : 'sm' }))));

  // Play together: a quiz for 2–4 players taking turns on one phone.
  const together = poster({ tone: 'sky', className: 'full', as: 'button', onclick: () => ctx.go('party') },
    label('With friends'),
    h('div', {}, headline('PLAY TOGETHER'),
      h('p', { class: 'body dim', style: 'margin-top:.8rem', text: 'A Bible quiz for 2 to 4 players on one phone. Take turns, pass the phone, see who wins.' })),
    h('div', { class: 'poster-foot' }, h('p', { class: 'label', text: 'Start a game' }), art('people', { tone: 'sky', size: 'sm' })));

  const el = h('div', { style: 'display:contents' },
    blocks[0], together, ...blocks.slice(1),
    played ? poster({ tone: 'paper', className: 'full' },
      label('So far'),
      h('p', { class: 'numeral', text: String(played) }),
      h('p', { class: 'label dim', text: played === 1 ? 'game played' : 'games played' })) : null);

  rise(blocks);
  return { title: 'Play', el };
}
