// PLAY — two of them, and neither one is trying to disciple you.
//
// Worth stating, because a church app is the exact place this goes wrong: the
// games here are not a delivery mechanism for anything. There is no verse to
// unlock, no streak, no points that turn into a badge, and nothing is reported
// to anybody. They are here because an adult waiting for a lift after a
// service would rather do a crossword than close the app.
//
// The crossword is where the Bible actually lives on this tab, and it earns it
// by being hard.

import { h, poster, label, display, art, pill, note, rows, row, rise } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as progress from '../core/progress.js';

export default async function playScreen(ctx) {
  const parts = [];

  let run = null;
  try {
    const bank = await content.crossword();
    run = rotation.cycleOf(bank.clues, { count: bank.perDay || 9, offset: 5 });
  } catch { /* the poster still stands, just without the day count */ }

  const solvedToday = progress.isDone('crossword', new Date().toISOString().slice(0, 10));

  parts.push(poster({ tone: 'sky', tall: true, as: 'button', onclick: () => ctx.go('crossword') },
    label(solvedToday ? 'Today’s crossword · solved' : 'Today’s crossword'),
    h('div', {},
      display('CROSSWORD'),
      h('p', { class: 'lead dim', style: 'margin-top:1rem',
        text: 'Nine clues, dealt fresh every morning from a bank of nearly two hundred. It assumes you have read the text — “where the boat came to rest”, not “Noah’s boat”.' })),
    h('div', { class: 'poster-foot' },
      h('span', { class: 'go' }, solvedToday ? 'Open it again' : 'Solve it'),
      art('star', { tone: 'sky', size: 'sm' }))));

  parts.push(poster({ tone: 'rose', tall: true, as: 'button', onclick: () => ctx.go('game') },
    label('Match three'),
    h('div', {},
      display('MATCH THREE'),
      h('p', { class: 'lead dim', style: 'margin-top:1rem',
        text: 'The one everybody already knows how to play, drawn in this app’s own colours. No timer, no lives, and nothing to lose by closing it.' })),
    h('div', { class: 'poster-foot' },
      h('span', { class: 'go' }, 'Play'),
      art('heart', { tone: 'rose', size: 'sm' }))));

  parts.push(poster({ tone: 'paper' },
    label('What these are not'),
    rows(
      row({ title: 'A score anyone else can see', meta: 'No' }),
      row({ title: 'A streak you lose by missing a day', meta: 'No' }),
      row({ title: 'Anything reported to the church', meta: 'No' }),
    ),
    note(run && run.days > 1
      ? `The crossword bank runs ${run.days} days before a clue comes round again, and it is reshuffled each time — so the same clue turns up crossing different words.`
      : 'The crossword is dealt from a bank rather than authored one puzzle at a time, so it does not run out.')));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Play', el };
}
