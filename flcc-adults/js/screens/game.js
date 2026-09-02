// THE GAME — match three, drawn in this app's own system.
//
// It is Candy Crush's shape and none of its manners. No timer, no lives, no
// leaderboard, no score to compare with anybody at church, and nothing that
// asks a member to come back tomorrow or lose something. A round is thirty
// moves against a modest target; running out of moves ends the round and
// nothing else happens.
//
// Visually it is the poster system taken down to tile size: flat tones from
// the same six colours, one 3px navy outline, and the app's own drawings as
// the pieces. There is no shine, no bevel and no burst of particles when a
// run clears — a tile fades and the column falls.

import { h, poster, label, pill, note, track, rise, toast, moment, artMarkup, swap } from '../core/ui.js';
import * as match3 from '../games/match3.js';
import * as progress from '../core/progress.js';

const SIZE = 8;
const MOVES = 30;
const TARGET = 60;

// One drawing per tone, so a colour-blind reader has a second signal and the
// board still reads as this app rather than as a bag of sweets.
const SYMBOL = {
  sunshine: 'sun', rose: 'heart', sky: 'cloud', captain: 'mountain', poppy: 'flame',
};

export default async function gameScreen(ctx) {
  const el = h('div', { style: 'display:contents' });

  let next = match3.seeded(Date.now() % 2147483647);
  let board = match3.newBoard(SIZE, next);
  let moves = MOVES;
  let cleared = 0;
  let picked = null;
  let busy = false;

  const boardEl = h('div', { class: 'board', role: 'grid', 'aria-label': 'Match three board',
    style: `grid-template-columns: repeat(${SIZE}, 1fr)` });
  const movesEl = h('p', { class: 'numeral', text: String(moves) });
  const bar = track(0);
  const countEl = h('p', { class: 'label dim', text: `0 of ${TARGET} cleared` });

  const tileAt = (r, c) => boardEl.children[r * SIZE + c];

  function paint() {
    swap(boardEl, ...board.flatMap((row, r) => row.map((kind, c) => {
      const tile = h('button', {
        class: 'gem', type: 'button', dataset: { tone: kind },
        'aria-label': `${kind} at row ${r + 1}, column ${c + 1}`,
        onclick: () => tap(r, c),
      });
      // The drawings-off setting is honoured here as everywhere else; without
      // them the board is still perfectly playable on colour alone.
      tile.innerHTML = artMarkup(SYMBOL[kind] || 'star', kind);
      if (picked && picked.r === r && picked.c === c) tile.setAttribute('data-picked', '');
      return tile;
    })));
  }

  function paintScore() {
    const percent = Math.min(100, Math.round((cleared / TARGET) * 100));
    movesEl.textContent = String(moves);
    countEl.textContent = `${Math.min(cleared, TARGET)} of ${TARGET} cleared`;
    bar.setAttribute('aria-valuenow', String(percent));
    const fill = bar.querySelector('i');
    if (fill) fill.style.width = `${percent}%`;
  }

  /** Walk the cascade one step at a time so it reads as falling, not jumping. */
  async function run(steps) {
    for (const step of steps) {
      board = step.board;
      paint();
      for (const key of step.cleared) {
        const [r, c] = key.split(',').map(Number);
        const tile = tileAt(r, c);
        if (tile) tile.setAttribute('data-clearing', '');
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  async function tap(r, c) {
    if (busy) return;
    const here = { r, c };

    if (!picked) { picked = here; paint(); return; }
    if (picked.r === r && picked.c === c) { picked = null; paint(); return; }
    if (!match3.adjacent(picked, here)) { picked = here; paint(); return; }

    const from = picked;
    picked = null;

    const result = match3.play(board, from, here, next);
    if (!result.ok) {
      // Refused rather than played and snapped back: a misread should not cost
      // a move.
      paint();
      toast('That swap does not match anything.');
      return;
    }

    busy = true;
    moves -= 1;
    cleared += result.cleared;
    await run(result.steps);
    board = result.board;
    paint();
    paintScore();
    busy = false;

    if (result.cascades > 1) toast(`${result.cascades} in a row.`);

    if (cleared >= TARGET) {
      progress.complete('game', new Date().toISOString().slice(0, 10));
      moment({ tone: 'sunshine', eyebrow: 'Match three', big: 'DONE.',
        line: `${cleared} cleared, with ${moves} ${moves === 1 ? 'move' : 'moves'} to spare.`,
        action: 'Close' });
      return;
    }

    if (!moves) {
      moment({ tone: 'sky', eyebrow: 'Match three', big: 'OUT OF MOVES.',
        line: `${cleared} cleared. Start another whenever you like.`, action: 'Close' });
      return;
    }

    if (!match3.hasMove(board)) {
      toast('No moves left on this board — reshuffling.');
      board = match3.newBoard(SIZE, next);
      paint();
    }
  }

  function restart() {
    next = match3.seeded(Date.now() % 2147483647);
    board = match3.newBoard(SIZE, next);
    moves = MOVES;
    cleared = 0;
    picked = null;
    paint();
    paintScore();
  }

  const parts = [
    poster({ tone: 'rose' },
      h('div', { class: 'poster-head' },
        label('Match three'),
        h('span', { class: 'tag', text: `${TARGET} to clear` })),
      h('div', { style: 'display:flex;align-items:flex-end;gap:1.2rem' },
        h('div', {}, movesEl, h('p', { class: 'label dim', text: 'moves left' })),
        h('div', { style: 'flex:1' }, bar, h('div', { style: 'margin-top:.5rem' }, countEl)))),

    poster({ tone: 'paper' },
      boardEl,
      h('div', { class: 'poster-foot' },
        pill('Start again', restart, { quiet: true }),
        h('span'))),

    poster({ tone: 'paper' },
      label('How it works'),
      h('p', { class: 'body', text: 'Tap a tile, then tap one next to it. Three or more of the same colour in a line clear, and whatever is above them falls. A swap that matches nothing is simply refused — it does not cost you a move.' }),
      note('There is no timer, no score kept and nothing to compare with anyone else. When you have had enough, close it.')),
  ];

  el.append(...parts);
  paint();
  paintScore();
  rise(parts);
  return { title: 'Match three', el };
}
