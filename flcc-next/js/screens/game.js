// The games. Six of them, each a small self-contained round.
//
// Scores are never compared between children, and a game can always be left
// without losing anything.

import { h, poster, label, display, headline, art, pill, choice, track, note, toast, moment } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import { mode } from '../core/profile.js';
import * as crossword from '../games/crossword.js';
import * as galaga from '../games/galaga.js';
import * as store from '../core/storage.js';
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
async function quizGame(ctx, { timed = false, game = 'quiz', tone = 'rose', title = 'Bible quiz', size = 10 } = {}) {
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
  const tone = 'captain';
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
  const tone = 'sunshine';
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

// ── Galaga ──────────────────────────────────────────────────────────────────
//
// The arcade classic, and the one game here with no end: every wave cleared
// brings a harder one. Holding left or right flies the ship and fires it at
// once — there is no fire button — so a whole run is played with one thumb.
// The best score stays on this device and is never compared with anybody's.
//
// Losing the last ship does not send anyone back to wave one. The wave reached
// and the score so far are kept on this device, and both the game-over card
// and the next visit offer to continue from there — or to start again.

/** The palette, read out of the stylesheet so no colour is written down twice. */
function palette() {
  const css = getComputedStyle(document.documentElement);
  const read = (name) => css.getPropertyValue(`--${name}`).trim();
  return {
    paper: read('paper'), ink: read('ink'), faint: read('ink-12'), captain: read('captain'),
    poppy: read('poppy'), rose: read('rose'), sunshine: read('sunshine'), sky: read('sky'),
  };
}

function galagaGame(ctx) {
  // The game-over card. Sunshine, not captain: navy type sits on it cleanly.
  const tone = 'sunshine';
  const arcade = () => store.read(store.KEYS.arcade, {}) || {};
  const keep = (patch) => store.write(store.KEYS.arcade, { ...arcade(), ...patch });
  const best = () => arcade().galaga || 0;
  // Where a continued run picks up: the wave reached and the score so far.
  const saved = () => {
    const resume = arcade().galagaResume || {};
    return { wave: Math.max(1, Math.trunc(resume.wave) || 1), score: Math.max(0, Math.trunc(resume.score) || 0) };
  };
  const seed = () => Date.now() % 2147483647;
  let state = galaga.create(seed(), saved());
  const held = { left: false, right: false };
  let raf = 0;
  let last = 0;
  let attached = false;
  let shown = null;                 // the game-over moment, if one is open
  let gone = false;
  const home = location.hash;       // this screen's route, to notice leaving it

  const canvas = h('canvas', { 'aria-label': 'Galaga. Hold left or right to fly and fire.', role: 'img' });
  const g = canvas.getContext('2d');
  const colors = palette();

  const scoreEl = h('p', { class: 'headline', text: '0' });
  const waveEl = h('p', { class: 'label', text: 'Wave 1' });
  const livesEl = h('p', { class: 'label dim', text: '' });

  const paintNumbers = () => {
    scoreEl.textContent = String(state.score);
    waveEl.textContent = `Wave ${state.wave}`;
    livesEl.textContent = `${state.lives} ${state.lives === 1 ? 'ship' : 'ships'} · ${best() ? `best ${best()}` : 'no best yet'}`;
  };

  const size = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    if (width && canvas.width !== width) {
      canvas.width = width;
      canvas.height = Math.round(width * galaga.HEIGHT / galaga.WIDTH);
    }
    return ratio;
  };

  const draw = () => {
    const ratio = size();
    if (canvas.width) galaga.paint(g, state, { colors, scale: canvas.width / galaga.WIDTH, edge: 3 * ratio });
  };

  /**
   * A card with two ways out: carry on from `wave`, or start again from one.
   * The kit's moment has one action, so the second is a quiet pill beside it
   * that picks "fresh" and then presses the first — which keeps every close
   * path (the button, Escape, leaving the screen) going through one place.
   */
  const choose = ({ eyebrow, big, line }) => {
    let fresh = false;
    const { wave } = saved();
    shown = moment({
      tone, eyebrow, big, line,
      action: `Continue from wave ${wave}`,
      onclose: () => begin(fresh),
    });
    const main = shown.querySelector('.pill');
    main.parentElement.classList.add('pill-row');
    main.parentElement.appendChild(pill('Start from wave 1', () => { fresh = true; main.click(); }, { quiet: true }));
  };

  const over = () => {
    const record = state.score > best();
    if (record) keep({ galaga: state.score });
    keep({ galagaResume: { wave: state.wave, score: state.score } });
    // The XP goes in the card's eyebrow rather than a toast: a toast sits
    // exactly where the Continue button is, and would swallow the tap.
    const result = progress.complete('game', `galaga:${progress.today()}`);
    const xp = result.first ? ` · +${progress.XP.game} XP` : '';
    paintNumbers();
    if (state.wave === 1) {
      shown = moment({
        tone,
        eyebrow: `Game over · wave 1${xp}`,
        big: String(state.score),
        line: record ? 'A new best on this phone.' : `Your best is ${best()}. One more go?`,
        action: 'Play again',
        onclose: () => begin(true),
      });
      return;
    }
    choose({
      eyebrow: `Game over · wave ${state.wave}${xp}`,
      big: String(state.score),
      line: `${record ? 'A new best on this phone. ' : ''}Carry on from wave ${state.wave} with three new ships and your score, or start again.`,
    });
  };

  const frame = (now) => {
    raf = 0;
    if (!canvas.isConnected) { if (attached) { teardown(); return; } raf = requestAnimationFrame(frame); return; }
    if (!attached) document.body.toggleAttribute('data-arcade', true);
    attached = true;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const events = galaga.step(state, held, dt);
    if (events.some((one) => one !== 'fire')) paintNumbers();
    if (events.includes('life')) toast('A spare ship.');
    // Every new wave is a place to come back to, even if the game is simply closed.
    if (events.includes('wave')) keep({ galagaResume: { wave: state.wave, score: state.score } });
    draw();
    if (state.over) { over(); return; }
    raf = requestAnimationFrame(frame);
  };

  function begin(fresh) {
    if (fresh) keep({ galagaResume: { wave: 1, score: 0 } });
    state = galaga.create(seed(), saved());
    last = 0;
    paintNumbers();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const press = (side, on) => {
    held[side] = on;
    pads[side].toggleAttribute('data-held', on);
  };

  const hold = (side, symbolText, name) => h('button', {
    type: 'button', 'aria-label': name, text: symbolText,
    onpointerdown: (event) => { event.preventDefault(); press(side, true); },
    onpointerup: () => press(side, false),
    onpointerleave: () => press(side, false),
    onpointercancel: () => press(side, false),
    oncontextmenu: (event) => event.preventDefault(),
  });
  const pads = { left: hold('left', '◀', 'Fly left and fire'), right: hold('right', '▶', 'Fly right and fire') };

  // The field itself is a pad too: the left half flies left, the right half right.
  const fieldSide = (event) => (event.offsetX < canvas.clientWidth / 2 ? 'left' : 'right');
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    press(fieldSide(event), true);
  });
  const lift = () => { press('left', false); press('right', false); };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  const KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const onKey = (event) => {
    if (!canvas.isConnected) { teardown(); return; }
    if (event.key === 'Escape' && event.type === 'keydown' && !document.querySelector('.moment')) { leave(); return; }
    const side = KEYS[event.key];
    if (!side || document.querySelector('.moment')) return;
    event.preventDefault();
    press(side, event.type === 'keydown');
  };
  const onHide = () => { if (document.hidden) lift(); };
  // The back button leaves without a click anywhere in here, and after a game
  // over the loop is not running to notice — so watch the route as well.
  const onRoute = () => { if (location.hash !== home) teardown(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('hashchange', onRoute);
  function teardown() {
    if (gone) return;
    gone = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('hashchange', onRoute);
    document.body.removeAttribute('data-arcade');
    if (shown && shown.isConnected) shown.remove();
  }
  const leave = () => { teardown(); ctx.go('play'); };

  // The whole screen, while the game is open: numbers in a thin bar, the
  // field as large as the window allows, the pads under the thumbs.
  const stage = h('div', { class: 'arcade-stage', role: 'application', 'aria-label': 'Galaga' },
    h('div', { class: 'arcade-bar' },
      h('button', { class: 'arcade-close', type: 'button', 'aria-label': 'Close Galaga', text: '✕', onclick: leave }),
      h('div', {}, scoreEl, h('p', { class: 'label dim', text: 'score' })),
      h('span', { class: 'grow' }),
      h('div', { class: 'stat' }, waveEl, livesEl)),
    h('div', { class: 'arcade-well' }, h('div', { class: 'arcade' }, canvas)),
    h('div', { class: 'arcade-pad' }, pads.left, pads.right));

  const el = h('div', { style: 'display:contents' }, stage);
  paintNumbers();
  raf = requestAnimationFrame(frame);
  if (saved().wave > 1) {
    choose({
      eyebrow: 'Galaga',
      big: `WAVE ${saved().wave}.`,
      line: `Pick up where you left off${saved().score ? `, with ${saved().score} points` : ''} — or start again from wave 1.`,
    });
  }
  return { title: 'Galaga', el };
}

const GAMES = {
  quiz: (ctx) => quizGame(ctx),
  speed: (ctx) => quizGame(ctx, { timed: true, game: 'speed', tone: 'sky', title: 'Speed quiz' }),
  // A shorter round than the Bible quiz: the FLCC bank is the smallest in the
  // app, and five a day is what makes it last a week for kids as well as teens.
  church: (ctx) => quizGame(ctx, { game: 'church', tone: 'captain', title: 'Our church', size: 5 }),
  'who-am-i': whoAmIGame,
  'verse-builder': verseGame,
  crossword: crosswordGame,
  galaga: galagaGame,
};

export default async function gameScreen(ctx) {
  const id = ctx.route.args[0];
  const play = GAMES[id];
  if (!play) return { title: 'Play', el: poster({ tone: 'paper', className: 'full' }, note('That game does not exist yet.')) };
  return play(ctx);
}
