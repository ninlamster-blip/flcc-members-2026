// The games. Six of them, each a small self-contained round.
//
// Scores are never compared between children, and a game can always be left
// without losing anything.

import { h, poster, label, display, headline, art, pill, choice, track, note, toast, moment } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import { mode } from '../core/profile.js';
import * as crossword from '../games/crossword.js';
import { deal, pick as pickForDay, cycleOf, askOrder } from '../core/rotation.js';

const forAge = (rows, band) => rows.filter((row) => !row.ageGroup || row.ageGroup === 'both' || row.ageGroup === band);

/**
 * Questions carry a topic — `bible`, `jesus` or `flcc` — and a game says which
 * of them it deals. That is what lets Our Church be its own round without
 * a second file to keep in step with the first, and what keeps a question
 * about the BOTR network out of a round that calls itself a Bible quiz only
 * if the game asks for it.
 */
const forTopic = (rows, topics) =>
  (Array.isArray(topics) && topics.length ? rows.filter((row) => topics.includes(row.topic || 'bible')) : rows);

// Each game deals from its own bank on its own offset, so the quiz and the
// verse game do not march through their cycles in step.
const OFFSET = { quiz: 0, speed: 6, 'who-am-i': 2, 'verse-builder': 4, crossword: 1, church: 3 };

/** "Day 3 of 12" — how far into this bank's run today is. */
const runLine = (bank, count, game) => {
  const run = cycleOf(bank, { count, offset: OFFSET[game] || 0 });
  return run.days > 1 ? `Day ${run.day} of ${run.days}` : '';
};

/** Deterministic shuffle, used to scramble the words of a verse. */
function shuffle(list, seed) {
  const out = [...list];
  let value = seed;
  const next = () => (value = (value * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function finish({ ctx, game, score, total, tone }) {
  const result = progress.complete('game', `${game}:${progress.today()}`);
  if (result.first) toast(`+${progress.XP.game} XP`);
  moment({
    tone,
    eyebrow: 'Round complete',
    big: `${score} / ${total}`,
    line: score === total ? 'Every one. Well played.' : score >= total / 2 ? 'Good round. Come back tomorrow.' : 'Worth another go tomorrow.',
    action: 'Done',
    onclose: () => ctx.go('play'),
  });
}

// ── Bible quiz, and its fast cousin ────────────────────────────────────────
async function quizGame(ctx, { timed = false, game = 'quiz', tone = 'pink', title = 'Bible quiz', size = 10 } = {}) {
  const definition = (await content.games()).find((one) => one.id === game);
  const all = forTopic(forAge(await content.quiz(), mode()), definition && definition.topics);
  if (timed) size = 20;           // nobody answers 20 inside sixty seconds
  const rounds = deal(all, { count: size, offset: OFFSET[game] });
  const run = runLine(all, size, game);
  let index = 0;
  let score = 0;
  let remaining = 60;

  const el = h('div', { style: 'display:contents' });
  const block = poster({ tone, tall: true, className: 'full' });
  el.appendChild(block);

  let ticker = null;
  const stop = () => { if (ticker) clearInterval(ticker); ticker = null; };

  const draw = () => {
    if (index >= rounds.length || (timed && remaining <= 0)) {
      stop();
      finish({ ctx, game, score, total: timed ? index : rounds.length, tone });
      return;
    }
    const round = rounds[index];
    // The right answer is written first in the file. Shown first, it would be
    // the answer to every question in the game.
    const asked = askOrder(round.options, round.answer, round.q);
    const feedback = h('p', { class: 'body', style: 'margin-top:1rem' });
    const options = h('div', { class: 'choice-list', style: 'margin-top:1.4rem' },
      ...asked.options.map((text, option) => choice(text, () => {
        if (feedback.textContent) return;
        const right = option === asked.answer;
        if (right) score += 1;
        options.children[option].dataset[right ? 'right' : 'wrong'] = '';
        if (!right) options.children[asked.answer].dataset.right = '';
        feedback.textContent = round.why;
        setTimeout(() => { index += 1; draw(); }, timed ? 550 : 1100);
      })));

    block.replaceChildren(
      h('div', { class: 'poster-head' },
        label(timed ? `${remaining}s` : `Question ${index + 1} of ${rounds.length}`),
        label(run ? `${run} · Score ${score}` : `Score ${score}`)),
      h('div', {}, headline(round.q), options, feedback),
      h('div', {}, track(timed ? (remaining / 60) * 100 : (index / rounds.length) * 100)));
  };

  if (timed) {
    ticker = setInterval(() => {
      remaining -= 1;
      const readout = block.querySelector('.label');
      if (readout) readout.textContent = `${remaining}s`;
      if (remaining <= 0) draw();
    }, 1000);
  }

  draw();
  return { title, el };
}

// ── Who am I? ──────────────────────────────────────────────────────────────
async function whoAmIGame(ctx) {
  const all = forAge(await content.whoAmI(), mode());
  const rounds = deal(all, { count: 5, offset: OFFSET['who-am-i'] });
  const run = runLine(all, 5, 'who-am-i');
  const tone = 'sage';
  let index = 0;
  let score = 0;

  const el = h('div', { style: 'display:contents' });
  const block = poster({ tone, tall: true, className: 'full' });
  el.appendChild(block);

  const draw = () => {
    if (index >= rounds.length) { finish({ ctx, game: 'who-am-i', score, total: rounds.length, tone }); return; }
    const round = rounds[index];
    let shown = 1;                      // clues revealed so far — fewer is worth more
    const clues = h('div', { style: 'display:flex;flex-direction:column;gap:.7rem;margin-top:1.2rem' });
    const feedback = h('p', { class: 'body', style: 'margin-top:1rem' });

    const paintClues = () => clues.replaceChildren(
      ...round.clues.slice(0, shown).map((clue) => h('p', { class: 'lead', text: `“${clue}”` })));

    const asked = askOrder(round.options, round.options.indexOf(round.answer), round.answer);
    const options = h('div', { class: 'choice-list', style: 'margin-top:1.4rem' },
      ...asked.options.map((name, option) => choice(name, () => {
        if (feedback.textContent) return;
        const right = option === asked.answer;
        if (right) score += Math.max(1, 4 - shown);
        options.children[option].dataset[right ? 'right' : 'wrong'] = '';
        if (!right) options.children[asked.answer].dataset.right = '';
        feedback.textContent = round.fact;
        setTimeout(() => { index += 1; draw(); }, 1400);
      })));

    const another = pill('Another clue', () => {
      if (shown >= round.clues.length) return;
      shown += 1;
      paintClues();
      if (shown >= round.clues.length) another.disabled = true;
    }, { quiet: true });

    paintClues();
    block.replaceChildren(
      h('div', { class: 'poster-head' }, label(`Round ${index + 1} of ${rounds.length}`),
        label(run ? `${run} · Score ${score}` : `Score ${score}`)),
      h('div', {}, display('WHO AM I?'), clues, options, feedback),
      h('div', { class: 'poster-foot' }, another, art('mask', { tone, size: 'sm' })));
  };

  draw();
  return { title: 'Who am I?', el };
}

// ── Verse builder ──────────────────────────────────────────────────────────
async function verseGame(ctx) {
  const all = forAge(await content.verses(), mode());
  const rounds = deal(all, { count: 5, offset: OFFSET['verse-builder'] });
  const run = runLine(all, 5, 'verse-builder');
  const tone = 'cream';
  let index = 0;
  let score = 0;

  const el = h('div', { style: 'display:contents' });
  const block = poster({ tone, tall: true, className: 'full' });
  el.appendChild(block);

  const draw = () => {
    if (index >= rounds.length) { finish({ ctx, game: 'verse-builder', score, total: rounds.length, tone }); return; }
    const round = rounds[index];
    const words = round.text.split(' ');
    const picked = [];

    const line = h('p', { class: 'verse', style: 'margin-top:1.2rem;min-height:3.5rem' });
    const bank = h('div', { class: 'pill-row', style: 'margin-top:1.2rem' });
    const feedback = h('p', { class: 'body', style: 'margin-top:1rem' });

    const paint = () => {
      line.textContent = picked.length ? picked.join(' ') : '…';
      bank.replaceChildren(...shuffle(words, round.text.length).map((word) => {
        const used = picked.filter((w) => w === word).length >= words.filter((w) => w === word).length;
        return pill(word, () => {
          if (used || feedback.textContent) return;
          picked.push(word);
          if (picked.length === words.length) check();
          else paint();
        }, { quiet: true, ...(used ? { disabled: '' } : {}) });
      }));
    };

    const check = () => {
      const right = picked.join(' ') === round.text;
      if (right) score += 1;
      line.textContent = round.text;
      feedback.textContent = right ? `Exactly right — ${round.ref}.` : `Not quite. It reads: “${round.text}” (${round.ref}).`;
      setTimeout(() => { index += 1; draw(); }, 1800);
    };

    paint();
    block.replaceChildren(
      h('div', { class: 'poster-head' }, label(`Verse ${index + 1} of ${rounds.length}`),
        label(run ? `${run} · Score ${score}` : `Score ${score}`)),
      h('div', {}, display('BUILD THE VERSE'), line, bank, feedback),
      h('div', { class: 'poster-foot' },
        pill('Start again', () => { picked.length = 0; paint(); }, { quiet: true }),
        art('words', { tone, size: 'sm' })));
  };

  draw();
  return { title: 'Verse builder', el };
}


// ── Bible crossword ────────────────────────────────────────────────────────
//
// The grid is interlocked in code from the word list, so a puzzle is written
// as answers and clues. Everyone gets the same puzzle on the same day.

async function crosswordGame(ctx) {
  const band = mode();
  const all = await content.crosswords();
  const pool = forAge(all, band).length ? forAge(all, band) : all;
  const pick = pickForDay(pool, { offset: OFFSET.crossword });
  const puzzle = crossword.build(pick.words);
  const tone = 'ink';
  const helpful = band === 'kids';        // kids get an answer confirmed as they finish it

  const filled = Object.create(null);
  const inputs = new Map();
  let entry = puzzle.entries[0];
  let cursor = entry.cells[0];
  let revealed = 0;

  const across = puzzle.entries.filter((one) => one.dir === 'across');
  const down = puzzle.entries.filter((one) => one.dir === 'down');
  const entryAt = (key, dir) => puzzle.entries.find((one) => one.dir === dir && one.cells.includes(key));
  const solved = (one) => one.cells.every((key, i) => filled[key] === one.answer[i]);

  const clueLine = h('p', { class: 'body' });
  const grid = h('div', { class: 'xw', style: `grid-template-columns:repeat(${puzzle.width}, var(--xw-cell));--xw-cols:${puzzle.width}`,
    role: 'grid', 'aria-label': `${pick.title} crossword grid` });

  const paint = () => {
    for (const [key, input] of inputs) {
      input.value = filled[key] || '';
      delete input.dataset.active;
      delete input.dataset.cursor;
      delete input.dataset.locked;
      if (entry.cells.includes(key)) input.dataset.active = '';
      if (key === cursor) input.dataset.cursor = '';
    }
    if (helpful) {
      for (const one of puzzle.entries) {
        if (!solved(one)) continue;
        for (const key of one.cells) inputs.get(key).dataset.locked = '';
      }
    }
    clueLine.textContent = `${entry.number} ${entry.dir === 'across' ? 'Across' : 'Down'} — ${entry.clue}`;
    for (const button of list.querySelectorAll('button[data-entry]')) {
      const [number, dir] = button.dataset.entry.split(':');
      button.setAttribute('aria-current', String(Number(number) === entry.number && dir === entry.dir));
      const one = puzzle.entries.find((candidate) => candidate.number === Number(number) && candidate.dir === dir);
      if (helpful && solved(one)) button.dataset.solved = ''; else delete button.dataset.solved;
    }
  };

  // Select the square's contents, so typing over a letter that came from a
  // crossing answer replaces it instead of hitting maxlength and stalling.
  const focus = () => {
    const input = inputs.get(cursor);
    if (!input) return;
    input.focus({ preventScroll: true });
    input.select();
  };

  const select = (one, key = one.cells[0]) => { entry = one; cursor = key; paint(); focus(); };

  const step = (delta) => {
    const at = entry.cells.indexOf(cursor);
    const next = entry.cells[at + delta];
    if (next) { cursor = next; paint(); focus(); }
  };

  const stepEntry = (delta) => {
    const at = puzzle.entries.indexOf(entry);
    select(puzzle.entries[(at + delta + puzzle.entries.length) % puzzle.entries.length]);
  };

  const check = () => {
    const result = crossword.score(puzzle, filled);
    if (result.done) { done(); return; }
    let wrong = 0;
    for (const cell of puzzle.cells) {
      const input = inputs.get(cell.key);
      if (filled[cell.key] && filled[cell.key] !== cell.letter) { input.dataset.wrong = ''; wrong += 1; }
      else delete input.dataset.wrong;
    }
    toast(wrong ? `${wrong} letter${wrong === 1 ? '' : 's'} to look at again` : `${result.total - result.right} squares still empty`);
  };

  let over = false;
  const done = () => {
    if (over) return;
    over = true;
    finish({ ctx, game: 'crossword', score: puzzle.entries.length - revealed, total: puzzle.entries.length, tone });
  };

  const type = (key, letter) => {
    delete inputs.get(key).dataset.wrong;
    if (letter) filled[key] = letter; else delete filled[key];
    paint();
    if (crossword.score(puzzle, filled).done) { done(); return; }
    if (letter) step(1);
  };

  for (const cell of puzzle.cells) {
    const input = h('input', {
      class: 'xw-cell', type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters',
      spellcheck: 'false', maxlength: '1', 'aria-label': `Row ${cell.row + 1}, column ${cell.col + 1}`,
      style: `grid-row:${cell.row + 1};grid-column:${cell.col + 1}`,
      onfocus: () => {
        const same = entry.cells.includes(cell.key);
        const preferred = same ? entry : (entryAt(cell.key, 'across') || entryAt(cell.key, 'down'));
        select(preferred, cell.key);
      },
      onclick: () => {
        // A second tap on the same square turns the corner.
        if (cursor === cell.key && entryAt(cell.key, entry.dir === 'across' ? 'down' : 'across')) {
          select(entryAt(cell.key, entry.dir === 'across' ? 'down' : 'across'), cell.key);
        }
      },
      oninput: (event) => {
        const letter = (event.target.value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
        type(cell.key, letter);
      },
      onkeydown: (event) => {
        if (event.key === 'Backspace' && !filled[cell.key]) { event.preventDefault(); step(-1); }
        else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); step(1); }
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); step(-1); }
        else if (event.key === ' ') {
          event.preventDefault();
          const turn = entryAt(cell.key, entry.dir === 'across' ? 'down' : 'across');
          if (turn) select(turn, cell.key);
        }
      },
    });
    inputs.set(cell.key, input);
    grid.appendChild(h('div', { class: 'xw-holder', style: `grid-row:${cell.row + 1};grid-column:${cell.col + 1}` },
      input,
      cell.number ? h('span', { class: 'xw-num', text: String(cell.number) }) : null));
  }

  const clueList = (title, entries) => h('div', {},
    label(title),
    h('ol', {}, ...entries.map((one) => h('li', {},
      h('button', { type: 'button', dataset: { entry: `${one.number}:${one.dir}` }, onclick: () => select(one) },
        `${one.number}. ${one.clue}`)))));

  const list = h('div', { class: 'xw-list' }, clueList('Across', across), clueList('Down', down));

  const reveal = () => {
    const key = entry.cells.find((cellKey, i) => filled[cellKey] !== entry.answer[i]);
    if (!key) { toast('That one is already right'); return; }
    revealed += 1;
    filled[key] = puzzle.cells.find((cell) => cell.key === key).letter;
    delete inputs.get(key).dataset.wrong;
    paint();
    if (crossword.score(puzzle, filled).done) done();
  };

  const block = poster({ tone, tall: true, className: 'full' },
    h('div', { class: 'poster-head' }, label(pick.title),
      label(runLine(pool, 1, 'crossword') || `${puzzle.entries.length} answers`)),
    h('div', {},
      grid,
      h('div', { class: 'xw-clue' },
        h('button', { class: 'xw-step', type: 'button', 'aria-label': 'Previous clue', onclick: () => stepEntry(-1) }, '‹'),
        clueLine,
        h('button', { class: 'xw-step', type: 'button', 'aria-label': 'Next clue', onclick: () => stepEntry(1) }, '›')),
      list),
    h('div', { class: 'poster-foot' },
      h('div', { class: 'pill-row' }, pill('Check', check), pill('Reveal a letter', reveal, { quiet: true })),
      art('grid', { tone, size: 'sm' })));

  const el = h('div', { style: 'display:contents' }, block);
  paint();
  return { title: 'Crossword', el };
}

const GAMES = {
  quiz: (ctx) => quizGame(ctx),
  speed: (ctx) => quizGame(ctx, { timed: true, game: 'speed', tone: 'blue', title: 'Speed quiz' }),
  // A shorter round than the Bible quiz: the FLCC bank is the smallest one in
  // the app, and six a day makes it last five days rather than three.
  church: (ctx) => quizGame(ctx, { game: 'church', tone: 'sage', title: 'Our church', size: 6 }),
  'who-am-i': whoAmIGame,
  'verse-builder': verseGame,
  crossword: crosswordGame,
};

export default async function gameScreen(ctx) {
  const id = ctx.route.args[0];
  const play = GAMES[id];
  if (!play) return { title: 'Play', el: poster({ tone: 'paper', className: 'full' }, note('That game does not exist yet.')) };
  return play(ctx);
}
