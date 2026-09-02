// THE CROSSWORD — a new one every morning, and it is meant to be hard.
//
// Nothing here is authored as a puzzle. The day deals nine clues out of a bank
// of nearly two hundred, `games/crossword.js` interlocks them into a grid, and
// that is the puzzle. Two things follow from that, and both were the point:
//
//   · It never runs out. There is no file of puzzles to exhaust and no week
//     where the app quietly starts again from the beginning.
//   · The same nine clues in a different order make a different grid, so even
//     when a clue comes round again — every twentieth day or so — it is
//     crossing different words in a different shape.
//
// The clues assume an adult who has actually read the text. "Noah's boat" is
// not a clue; "where the boat came to rest" is.

import { h, poster, label, headline, display, art, go, pill, note, track,
         rows, row, rise, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as build from '../games/crossword.js';
import * as rotation from '../core/rotation.js';
import * as progress from '../core/progress.js';
import * as store from '../core/storage.js';

// Offset so the crossword's cycle does not march in step with the Scripture
// moment's — a member should not meet the same theme twice in one morning.
const OFFSET = 5;

const today = () => new Date().toISOString().slice(0, 10);

/** Today's grid only. Yesterday's answers are of no use to anybody. */
function loadState() {
  const kept = store.read(store.KEYS.play, null);
  return kept && kept.crossword && kept.crossword.day === today()
    ? kept.crossword
    : { day: today(), filled: {}, given: [], checked: false };
}

function saveState(state) {
  const kept = store.read(store.KEYS.play, {}) || {};
  store.write(store.KEYS.play, { ...kept, crossword: { ...state, day: today() } });
}

export default async function crosswordScreen(ctx) {
  let bank;
  try {
    bank = await content.crossword();
  } catch {
    return { title: 'Crossword', el: poster({ tone: 'rose' },
      label('Crossword'),
      headline('THE CLUES DID NOT LOAD'),
      note('They need a connection the first time, and stay on the device afterwards.')) };
  }

  const words = rotation.deal(bank.clues, { count: bank.perDay || 9, offset: OFFSET });
  const run = rotation.cycleOf(bank.clues, { count: bank.perDay || 9, offset: OFFSET });
  const puzzle = build.build(words);

  const state = loadState();
  const parts = [];

  // ── The grid ────────────────────────────────────────────────────────────
  const byKey = new Map(puzzle.cells.map((cell) => [cell.key, cell]));
  const inputs = new Map();
  const cellEls = new Map();

  const grid = h('div', { class: 'xgrid', role: 'group', 'aria-label': 'Crossword grid',
    style: `grid-template-columns: repeat(${puzzle.width}, var(--cell))` });

  let lit = puzzle.entries[0] || null;

  const paintLit = () => {
    for (const [key, el] of cellEls) {
      const on = lit && lit.cells.includes(key);
      if (on) el.setAttribute('data-lit', ''); else el.removeAttribute('data-lit');
    }
    for (const [entry, el] of clueEls) {
      if (lit && entry.number === lit.number && entry.dir === lit.dir) el.setAttribute('data-lit', '');
      else el.removeAttribute('data-lit');
    }
  };

  const markDone = () => {
    for (const [entry, el] of clueEls) {
      const solved = entry.cells.every((key) => (state.filled[key] || '') === byKey.get(key).letter);
      if (solved) el.setAttribute('data-done', ''); else el.removeAttribute('data-done');
    }
  };

  /** Move to the next cell along whichever entry is lit. */
  const advance = (key, step) => {
    if (!lit) return;
    const at = lit.cells.indexOf(key);
    const next = lit.cells[at + step];
    if (next && inputs.has(next)) inputs.get(next).focus();
  };

  for (let row0 = 0; row0 < puzzle.height; row0++) {
    for (let col = 0; col < puzzle.width; col++) {
      const key = `${row0},${col}`;
      const cell = byKey.get(key);
      if (!cell) { grid.appendChild(h('div', { class: 'xslot' })); continue; }

      const input = h('input', {
        type: 'text', inputmode: 'text', autocapitalize: 'characters',
        autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', maxlength: '1',
        'aria-label': `Row ${row0 + 1}, column ${col + 1}`,
        value: state.filled[key] || '',
      });

      const wrap = h('div', { class: 'xcell' },
        cell.number ? h('span', { class: 'xnum', text: String(cell.number) }) : null,
        input);
      if (state.given.includes(key)) wrap.setAttribute('data-given', '');

      input.addEventListener('focus', () => {
        // Prefer the entry already lit if this cell belongs to it, so typing
        // across a crossing does not keep flipping direction under the reader.
        const owning = puzzle.entries.filter((entry) => entry.cells.includes(key));
        if (!owning.length) return;
        if (!lit || !owning.some((entry) => entry === lit)) lit = owning[0];
        paintLit();
      });

      input.addEventListener('input', () => {
        const letter = String(input.value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
        input.value = letter;
        if (letter) state.filled[key] = letter; else delete state.filled[key];
        wrap.removeAttribute('data-wrong');
        saveState(state);
        markDone();
        if (letter) advance(key, 1);
        checkFinished();
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Backspace' && !input.value) { advance(key, -1); }
        else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); advance(key, 1); }
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); advance(key, -1); }
        else if (event.key === ' ') {
          // Space flips between the across and the down that cross here.
          event.preventDefault();
          const owning = puzzle.entries.filter((entry) => entry.cells.includes(key));
          if (owning.length > 1) { lit = owning.find((entry) => entry !== lit) || lit; paintLit(); }
        }
      });

      inputs.set(key, input);
      cellEls.set(key, wrap);
      grid.appendChild(wrap);
    }
  }

  // ── The clues ───────────────────────────────────────────────────────────
  const clueEls = new Map();
  const clueList = (dir) => {
    const list = puzzle.entries.filter((entry) => entry.dir === dir);
    return h('div', { class: 'clue-set' },
      h('p', { class: 'label', text: dir === 'across' ? 'Across' : 'Down' }),
      ...list.map((entry) => {
        const el = h('button', { class: 'clue', type: 'button', onclick: () => {
          lit = entry;
          paintLit();
          const first = entry.cells.find((key) => !(state.filled[key] || '')) || entry.cells[0];
          if (inputs.has(first)) inputs.get(first).focus();
        } },
          h('b', { text: String(entry.number) }),
          h('span', { text: `${entry.clue} (${entry.answer.length})` }));
        clueEls.set(entry, el);
        return el;
      }));
  };

  // ── Finishing ───────────────────────────────────────────────────────────
  const foot = h('div', { style: 'display:contents' });

  function checkFinished() {
    const result = build.score(puzzle, state.filled);
    if (!result.done) return;
    // Completion is recorded, once per day. There is no score and no streak —
    // this is a crossword, not a discipleship metric.
    if (!progress.isDone('crossword', state.day)) {
      progress.complete('crossword', state.day);
      toast('Finished. Come back tomorrow for a new one.');
    }
    ctx.refresh();
  }

  const done = build.score(puzzle, state.filled).done;

  parts.push(poster({ tone: done ? 'sunshine' : 'sky', tall: !done },
    h('div', { class: 'poster-head' },
      label(`Today’s crossword${run.days > 1 ? ` · day ${run.day} of ${run.days}` : ''}`),
      h('span', { class: 'tag', text: `${puzzle.entries.length} clues` })),
    h('div', {},
      done
        ? display('SOLVED.')
        : headline('NINE CLUES, DEALT THIS MORNING'),
      h('p', { class: 'body dim', style: 'margin-top:.8rem',
        text: done
          ? 'A new one is dealt at midnight, from a different part of the bank.'
          : bank.blurb })),
    h('div', { class: 'poster-foot' }, h('span'), art('star', { tone: done ? 'sunshine' : 'sky', size: 'sm' }))));

  parts.push(poster({ tone: 'paper' },
    h('div', { class: 'grid-scroll' }, grid),
    h('div', { class: 'poster-foot', style: 'gap:.6rem;flex-wrap:wrap' },
      pill('Check', () => {
        let wrong = 0;
        for (const [key, el] of cellEls) {
          const letter = state.filled[key] || '';
          if (letter && letter !== byKey.get(key).letter) { el.setAttribute('data-wrong', ''); wrong += 1; }
          else el.removeAttribute('data-wrong');
        }
        toast(wrong ? `${wrong} ${wrong === 1 ? 'letter is' : 'letters are'} wrong.` : 'Nothing wrong so far.');
      }, { quiet: true }),
      pill('Give me a letter', () => {
        // One letter, into the entry you are looking at. Deliberately not a
        // "reveal all": the puzzle is the point, and an adult who wanted the
        // answers would have stopped playing.
        // Prefer the entry being looked at, but fall back to the rest of the
        // grid: once that entry is complete, "give me a letter" must keep
        // working rather than reporting there is nothing left to give.
        const wrong = (keys) => keys.find((key) => (state.filled[key] || '') !== byKey.get(key).letter);
        const target = (lit && wrong(lit.cells)) || wrong(puzzle.cells.map((cell) => cell.key));
        if (!target) { toast('Nothing left to give away.'); return; }
        state.filled[target] = byKey.get(target).letter;
        if (!state.given.includes(target)) state.given.push(target);
        saveState(state);
        ctx.refresh();
      }, { quiet: true }),
      h('span'))));

  parts.push(poster({ tone: 'paper' }, clueList('across'), clueList('down')));

  parts.push(foot);

  // Painted after the clue elements exist, so the lit entry shows on both.
  paintLit();
  markDone();

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Crossword', el };
}
