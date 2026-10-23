// The games: the rounds, and two arcade games that never end.
//
// Scores are never compared between children, and a game can always be left
// without losing anything.

import { h, poster, label, display, headline, art, pill, choice, track, note, toast, moment } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import { mode } from '../core/profile.js';
import * as crossword from '../games/crossword.js';
import * as galaga from '../games/galaga.js';
import * as hop from '../games/hopacross.js';
import * as hoops from '../games/hoops.js';
import * as claw from '../games/claw.js';
import * as vines from '../games/vines.js';
import { symbol as drawSymbol, TONE_HEX } from '../core/art.js';
import * as rewards from '../core/rewards.js';
import * as online from '../core/online.js';
import * as chiptune from '../games/chiptune.js';
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
        setTimeout(() => { if (!block.isConnected) return; index += 1; draw(); }, timed ? 550 : 1100);
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
      // Left the screen: stop the clock. A round nobody is playing must not
      // finish itself a minute later on some other screen, and award XP.
      if (!block.isConnected) { stop(); return; }
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
        setTimeout(() => { if (!block.isConnected) return; index += 1; draw(); }, 1400);
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
      setTimeout(() => { if (!block.isConnected) return; index += 1; draw(); }, 1800);
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
// brings a harder one. A finger on the field pulls the ship toward it — up,
// down and across — and fires it at once; the ◀ ▶ pads still fly it sideways.
// There is no fire button, so a whole run is played with one thumb.
// The best score stays on this device and is never compared with anybody's.
//
// Losing the last ship does not send anyone back to wave one. The wave reached
// and the score so far are kept on this device, and both the game-over card
// and the next visit offer to continue from there — or to start again.
//
// It plays retro sounds (`js/games/chiptune.js`, made in the browser — no
// audio files) for firing, hits and the moments between waves, with a mute
// button in the top bar that this phone remembers.
//
// From a room (js/screens/room.js) it is a race: every phone flies the room's
// seed, so the same waves, bosses and motherships, from wave one with no
// continuing. Once a second it tells the room the wave reached and the score,
// and reads back where that puts this ship.

/** The palette, read out of the stylesheet so no colour is written down twice. */
function palette() {
  const css = getComputedStyle(document.documentElement);
  const read = (name) => css.getPropertyValue(`--${name}`).trim();
  return {
    paper: read('paper'), ink: read('ink'), faint: read('ink-12'), captain: read('captain'),
    poppy: read('poppy'), rose: read('rose'), sunshine: read('sunshine'), sky: read('sky'),
  };
}

/** The mute button's two faces, drawn in currentColor so they follow the ink. */
const SPEAKER = {
  on: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 010 6M18.5 6.5a8 8 0 010 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
};

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
  const race = ctx.route.params.room ? { code: ctx.route.params.room, seed: Number(ctx.route.params.seed) || 1, place: '' } : null;
  const seed = () => Date.now() % 2147483647;
  let state = race ? galaga.create(race.seed) : galaga.create(seed(), saved());
  // Sound is on unless this phone has been told otherwise.
  const sound = chiptune.player({ muted: Boolean(arcade().galagaMuted) });
  const held = { left: false, right: false, up: false, down: false, to: null };
  let raf = 0;
  let last = 0;
  let attached = false;
  let shown = null;                 // the game-over moment, if one is open
  let gone = false;
  const home = location.hash;       // this screen's route, to notice leaving it

  const canvas = h('canvas', { 'aria-label': 'Galaga. Touch and drag on the field to fly anywhere and fire, or hold left or right.', role: 'img' });
  const g = canvas.getContext('2d');
  const colors = palette();
  // The ship colour a streak has earned (js/core/rewards.js), if one is worn.
  const shipTone = rewards.wearing('galagaShip', arcade().galagaShip, progress.getProgress().streak.best) || 'captain';

  const scoreEl = h('p', { class: 'headline', text: '0' });
  const waveEl = h('p', { class: 'label', text: 'Wave 1' });
  const livesEl = h('p', { class: 'label dim', text: '' });

  const paintNumbers = () => {
    scoreEl.textContent = String(state.score);
    waveEl.textContent = `Wave ${state.wave}`;
    const fleet = `${state.lives} ${state.lives === 1 ? 'ship' : 'ships'}${state.wingmen ? ` +${state.wingmen} wing` : ''}`;
    livesEl.textContent = race
      ? `${fleet} · race ${race.code}${race.place ? ` · ${race.place}` : ''}`
      : `${fleet} · ${best() ? `best ${best()}` : 'no best yet'}`;
  };

  // In a race: tell the room the wave and the score once a second, and read
  // back where that puts this ship. The last report, on the way out, says "out".
  let raceTimer = 0;
  const report = async (alive) => {
    if (!race) return;
    await online.race(race.code, state.wave, alive, state.score);
    const room = await online.room(race.code);
    if (room && room.players) {
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      const at = sorted.findIndex((p) => p.you);
      const flying = room.players.filter((p) => p.alive).length;
      race.place = `${['1st', '2nd', '3rd'][at] || `${at + 1}th`} of ${sorted.length}${flying ? ` · ${flying} flying` : ''}`;
      paintNumbers();
    }
  };
  if (race) raceTimer = setInterval(() => { if (!gone && !state.over && state.started) report(true); }, 1000);

  // The field fills its whole well: 100 units across, and as tall as the
  // screen makes that — so a tall phone gets more sky, not an empty band.
  const fieldHeight = () => (canvas.width ? canvas.height / (canvas.width / galaga.WIDTH) : galaga.HEIGHT);
  const size = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
      galaga.resize(state, fieldHeight());
    }
    return ratio;
  };

  const draw = () => {
    const ratio = size();
    if (canvas.width) galaga.paint(g, state, { colors, scale: canvas.width / galaga.WIDTH, edge: 3 * ratio, ship: shipTone });
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
    online.submit('galaga', state.score, mode());   // only if this phone has joined online play
    if (race) {
      clearInterval(raceTimer);
      report(false);
      const result = progress.complete('game', `galaga:${progress.today()}`);
      paintNumbers();
      shown = moment({
        tone,
        eyebrow: `Game over · wave ${state.wave} · race ${race.code}${result.first ? ` · +${progress.XP.game} XP` : ''}`,
        big: String(state.score),
        line: 'Out of the race. See how everyone else does — the room shows the final places.',
        action: 'See the race', onclose: () => ctx.go(`room?code=${race.code}`),
      });
      return;
    }
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
    sound.play(events);
    if (events.some((one) => one !== 'fire')) paintNumbers();
    if (events.includes('rescue')) toast('Ship rescued! It flies beside you now.');
    else if (events.includes('wingman')) toast('Mothership down! A wingman joins you.');
    else if (events.includes('life')) toast('A spare ship.');
    if (events.includes('captured')) toast('Captured! Shoot that boss to get your ship back.');
    // Every new wave is a place to come back to, even if the game is simply closed.
    if (events.includes('wave') && !race) keep({ galagaResume: { wave: state.wave, score: state.score } });
    draw();
    if (state.over) { over(); return; }
    raf = requestAnimationFrame(frame);
  };

  function begin(fresh) {
    if (fresh) keep({ galagaResume: { wave: 1, score: 0 } });
    state = galaga.create(seed(), { ...saved(), height: fieldHeight() });
    last = 0;
    paintNumbers();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const press = (side, on) => {
    if (on) sound.wake();
    held[side] = on;
    pads[side]?.toggleAttribute('data-held', on);
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

  // The field itself is the stick: a finger on it pulls the ship toward that
  // point — up and down as well as across — and fires while it stays down.
  // The ship aims a little above the fingertip so the thumb does not hide it.
  const LIFT = 10;                  // field units between fingertip and ship
  let finger = null;
  const aim = (event) => {
    const box = canvas.getBoundingClientRect();
    if (!box.width) return;
    const units = galaga.WIDTH / box.width;   // the field is scaled evenly both ways
    held.to = { x: (event.clientX - box.left) * units, y: (event.clientY - box.top) * units - LIFT };
  };
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    sound.wake();
    finger = event.pointerId;
    aim(event);
  });
  canvas.addEventListener('pointermove', (event) => { if (event.pointerId === finger) aim(event); });
  const lift = () => {
    finger = null;
    held.to = null;
    for (const side of ['left', 'right', 'up', 'down']) press(side, false);
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  const KEYS = {
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  };
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
    clearInterval(raceTimer);
    // Closing a race half-way is being out of it, or the room would wait for ever.
    if (race && !state.over) online.race(race.code, state.wave, false, state.score);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('hashchange', onRoute);
    document.body.removeAttribute('data-arcade');
    sound.close();
    if (shown && shown.isConnected) shown.remove();
  }
  const leave = () => { teardown(); ctx.go('play'); };

  // The mute button. Tapping it is a press too, so it can wake the sound.
  const mute = h('button', { class: 'arcade-close', type: 'button' });
  const paintMute = () => {
    mute.innerHTML = sound.muted ? SPEAKER.off : SPEAKER.on;
    mute.setAttribute('aria-label', sound.muted ? 'Turn sound on' : 'Turn sound off');
    mute.setAttribute('aria-pressed', String(sound.muted));
  };
  mute.addEventListener('click', () => {
    sound.muted = !sound.muted;
    keep({ galagaMuted: sound.muted });
    if (!sound.muted) sound.wake();
    paintMute();
  });
  paintMute();

  // The whole screen, while the game is open: numbers in a thin bar, the
  // field as large as the window allows, the pads under the thumbs.
  const stage = h('div', { class: 'arcade-stage', role: 'application', 'aria-label': 'Galaga' },
    h('div', { class: 'arcade-bar' },
      h('button', { class: 'arcade-close', type: 'button', 'aria-label': 'Close Galaga', text: '✕', onclick: leave }),
      h('div', {}, scoreEl, h('p', { class: 'label dim', text: 'score' })),
      h('span', { class: 'grow' }),
      h('div', { class: 'stat' }, waveEl, livesEl),
      mute),
    h('div', { class: 'arcade-well' }, h('div', { class: 'arcade', dataset: { shape: 'fill' } }, canvas)),
    h('div', { class: 'arcade-pad' }, pads.left, pads.right));

  const el = h('div', { style: 'display:contents' }, stage);
  paintNumbers();
  raf = requestAnimationFrame(frame);
  if (!race && saved().wave > 1) {
    choose({
      eyebrow: 'Galaga',
      big: `WAVE ${saved().wave}.`,
      line: `Pick up where you left off${saved().score ? `, with ${saved().score} points` : ''} — or start again from wave 1.`,
    });
  }
  return { title: 'Galaga', el };
}

// ── Hop Across ──────────────────────────────────────────────────────────────
//
// A chicken crossing roads, rivers and railway lines, one lane at a time. Like
// Galaga it has no end: every twenty rows is a harder level. A tap on the field
// hops forward and a swipe hops that way; the four pads under the field and the
// arrow keys do the same. The best distance stays on this device and is never
// compared with anybody's, and its sound can be switched off like Galaga's.

function hopGame(ctx) {
  const tone = 'sunshine';
  const arcade = () => store.read(store.KEYS.arcade, {}) || {};
  const keep = (patch) => store.write(store.KEYS.arcade, { ...arcade(), ...patch });
  const best = () => arcade().hop || 0;
  // A race (from a room, js/screens/room.js) plays the room's road: every
  // racer gets the same seed, so the same cars, logs and trains.
  const race = ctx.route.params.room ? { code: ctx.route.params.room, seed: Number(ctx.route.params.seed) || 1, place: '' } : null;
  const seed = () => (race ? race.seed : Date.now() % 2147483647);
  let state = hop.create(seed());
  const sound = chiptune.player({ muted: Boolean(arcade().hopMuted), sounds: hop.SOUNDS });
  let raf = 0;
  let last = 0;
  let attached = false;
  let shown = null;
  let gone = false;
  const home = location.hash;

  const canvas = h('canvas', { 'aria-label': 'Hop Across. Tap to hop forward, swipe to hop any way.', role: 'img' });
  const g = canvas.getContext('2d');
  const colors = palette();
  // The hat a streak has earned (js/core/rewards.js), if one is worn.
  const hat = rewards.wearing('hopHat', arcade().hopHat, progress.getProgress().streak.best);

  const scoreEl = h('p', { class: 'headline', text: '0' });
  const levelEl = h('p', { class: 'label', text: 'Level 1' });
  const coinsEl = h('p', { class: 'label dim', text: '' });

  const paintNumbers = () => {
    scoreEl.textContent = String(state.score);
    levelEl.textContent = `Level ${state.level}`;
    coinsEl.textContent = race
      ? `Race ${race.code}${race.place ? ` · ${race.place}` : ''}`
      : `${state.coins} ${state.coins === 1 ? 'coin' : 'coins'} · ${best() ? `best ${best()}` : 'no best yet'}`;
  };

  // In a race: tell the room how far this chicken is, once a second, and read
  // back where that puts it. The last report, on the way out, says "out".
  let raceTimer = 0;
  const report = async (alive) => {
    if (!race) return;
    await online.race(race.code, state.score, alive);
    const room = await online.room(race.code);
    if (room && room.players) {
      const sorted = [...room.players].sort((a, b) => b.progress - a.progress);
      const at = sorted.findIndex((p) => p.you);
      const running = room.players.filter((p) => p.alive).length;
      race.place = `${['1st', '2nd', '3rd'][at] || `${at + 1}th`} of ${sorted.length}${running ? ` · ${running} running` : ''}`;
      paintNumbers();
    }
  };
  if (race) raceTimer = setInterval(() => { if (!gone && !state.over) report(true); }, 1000);

  const size = () => {
    const ratio = window.devicePixelRatio || 1;
    // The field fills its well, so its height follows the screen, not the width.
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
    }
    return ratio;
  };

  const draw = () => {
    const ratio = size();
    if (canvas.width) hop.paint(g, state, { colors, scale: canvas.width / hop.COLS, edge: 3 * ratio, hat, rows: canvas.height / (canvas.width / hop.COLS) });
  };

  const over = () => {
    const record = state.score > best();
    if (record) keep({ hop: state.score });
    online.submit('hop', state.score, mode());      // only if this phone has joined online play
    // As in Galaga, the XP rides in the eyebrow: a toast would sit on the button.
    const result = progress.complete('game', `hop:${progress.today()}`);
    const xp = result.first ? ` · +${progress.XP.game} XP` : '';
    const [title, why] = hop.CAUSES[state.cause] || hop.CAUSES.car;
    paintNumbers();
    if (race) {
      clearInterval(raceTimer);
      report(false);
      shown = moment({
        tone, eyebrow: `${title} · race ${race.code}${xp}`,
        big: `${state.score} ${state.score === 1 ? 'ROW' : 'ROWS'}`,
        line: 'Out of the race. See how everyone else does — the room shows the final places.',
        action: 'See the race', onclose: () => ctx.go(`room?code=${race.code}`),
      });
      return;
    }
    shown = moment({
      tone,
      eyebrow: `${title} · level ${state.level}${xp}`,
      big: `${state.score} ${state.score === 1 ? 'ROW' : 'ROWS'}`,
      line: `${why} ${record && state.score ? 'A new best on this phone.' : `Your best is ${best()}.`}`,
      action: 'Play again',
      onclose: begin,
    });
  };

  const frame = (now) => {
    raf = 0;
    if (!canvas.isConnected) { if (attached) { teardown(); return; } raf = requestAnimationFrame(frame); return; }
    if (!attached) document.body.toggleAttribute('data-arcade', true);
    attached = true;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const events = hop.step(state, dt);
    sound.play(events);
    if (events.length) paintNumbers();
    draw();
    if (state.over) { over(); return; }
    raf = requestAnimationFrame(frame);
  };

  function begin() {
    state = hop.create(seed());
    last = 0;
    paintNumbers();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const go = (dx, dy) => {
    if (document.querySelector('.moment')) return;
    sound.wake();
    const events = hop.move(state, dx, dy);
    sound.play(events);
  };

  const pad = (dx, dy, text, name) => h('button', {
    type: 'button', 'aria-label': name, text,
    onpointerdown: (event) => { event.preventDefault(); go(dx, dy); },
    // A keyboard press on a focused pad arrives as a click with no pointer.
    onclick: (event) => { if (event.detail === 0) go(dx, dy); },
    oncontextmenu: (event) => event.preventDefault(),
  });

  // The field: a tap hops forward, a swipe hops the way it went.
  let touch = null;
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    touch = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!touch) return;
    const dx = event.clientX - touch.x;
    const dy = event.clientY - touch.y;
    touch = null;
    if (Math.hypot(dx, dy) < 24) go(0, 1);
    else if (Math.abs(dx) > Math.abs(dy)) go(dx > 0 ? 1 : -1, 0);
    else go(0, dy < 0 ? 1 : -1);
  });
  canvas.addEventListener('pointercancel', () => { touch = null; });

  const KEYS = {
    ArrowUp: [0, 1], w: [0, 1], W: [0, 1], ' ': [0, 1],
    ArrowDown: [0, -1], s: [0, -1], S: [0, -1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };
  const onKey = (event) => {
    if (!canvas.isConnected) { teardown(); return; }
    if (document.querySelector('.moment')) return;
    if (event.key === 'Escape') { leave(); return; }
    const way = KEYS[event.key];
    // Space on a focused button is that button's own press.
    if (!way || (event.key === ' ' && event.target.closest?.('button'))) return;
    event.preventDefault();
    if (!event.repeat) go(way[0], way[1]);
  };
  const onRoute = () => { if (location.hash !== home) teardown(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', onRoute);
  function teardown() {
    if (gone) return;
    gone = true;
    clearInterval(raceTimer);
    // Closing a race half-way is being out of it, or the room would wait for ever.
    if (race && !state.over) online.race(race.code, state.score, false);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', onRoute);
    document.body.removeAttribute('data-arcade');
    sound.close();
    if (shown && shown.isConnected) shown.remove();
  }
  const leave = () => { teardown(); ctx.go('play'); };

  const mute = h('button', { class: 'arcade-close', type: 'button' });
  const paintMute = () => {
    mute.innerHTML = sound.muted ? SPEAKER.off : SPEAKER.on;
    mute.setAttribute('aria-label', sound.muted ? 'Turn sound on' : 'Turn sound off');
    mute.setAttribute('aria-pressed', String(sound.muted));
  };
  mute.addEventListener('click', () => {
    sound.muted = !sound.muted;
    keep({ hopMuted: sound.muted });
    if (!sound.muted) sound.wake();
    paintMute();
  });
  paintMute();

  const stage = h('div', { class: 'arcade-stage', role: 'application', 'aria-label': 'Hop Across' },
    h('div', { class: 'arcade-bar' },
      h('button', { class: 'arcade-close', type: 'button', 'aria-label': 'Close Hop Across', text: '✕', onclick: leave }),
      h('div', {}, scoreEl, h('p', { class: 'label dim', text: 'rows' })),
      h('span', { class: 'grow' }),
      h('div', { class: 'stat' }, levelEl, coinsEl),
      mute),
    h('div', { class: 'arcade-well' }, h('div', { class: 'arcade', dataset: { shape: 'hop' } }, canvas)),
    h('div', { class: 'arcade-pad', dataset: { pads: '4' } },
      pad(-1, 0, '◀', 'Hop left'), pad(0, 1, '▲', 'Hop forward'),
      pad(0, -1, '▼', 'Hop back'), pad(1, 0, '▶', 'Hop right')));

  const el = h('div', { style: 'display:contents' }, stage);
  paintNumbers();
  raf = requestAnimationFrame(frame);
  return { title: 'Hop Across', el };
}

// ── Hoops ───────────────────────────────────────────────────────────────────
//
// A basketball shoot-out against hoops that slide along a rail. A swipe up
// throws — its direction is the aim, its length the strength — and the ball
// has to drop through a rim. Each level asks for so many baskets from so many
// balls; missing the target replays that level, never level one. The best
// level reached stays on this device. Like Galaga and Hop Across it plays
// chiptune sounds with a mute button this phone remembers.
//
// From a room (js/screens/room.js) it is a race: every phone shoots at the
// room's seed — the same hoops, wind and defender — from level one, and a
// missed target is the end of that racer's run rather than a retry.

function hoopsGame(ctx) {
  const tone = 'sky';
  const arcade = () => store.read(store.KEYS.arcade, {}) || {};
  const keep = (patch) => store.write(store.KEYS.arcade, { ...arcade(), ...patch });
  const best = () => arcade().hoops || 0;
  const saved = () => {
    const resume = arcade().hoopsResume || {};
    return { level: Math.max(1, Math.trunc(resume.level) || 1), score: Math.max(0, Math.trunc(resume.score) || 0) };
  };
  const race = ctx.route.params.room ? { code: ctx.route.params.room, seed: Number(ctx.route.params.seed) || 1, place: '' } : null;
  const seed = () => (race ? race.seed : Date.now() % 2147483647);
  let state = race ? hoops.create(race.seed) : hoops.create(seed(), saved());
  const sound = chiptune.player({ muted: Boolean(arcade().hoopsMuted), sounds: hoops.SOUNDS });
  let raf = 0;
  let last = 0;
  let attached = false;
  let shown = null;
  let gone = false;
  const home = location.hash;

  const canvas = h('canvas', { 'aria-label': 'Hoops. Swipe up on the field to shoot; the direction aims and the length is the strength.', role: 'img' });
  const g = canvas.getContext('2d');
  const colors = palette();

  const scoreEl = h('p', { class: 'headline', text: '0' });
  const levelEl = h('p', { class: 'label', text: 'Level 1' });
  const infoEl = h('p', { class: 'label dim', text: '' });

  const paintNumbers = () => {
    scoreEl.textContent = String(state.score);
    levelEl.textContent = `Level ${state.level}`;
    infoEl.textContent = race
      ? `Race ${race.code}${race.place ? ` · ${race.place}` : ''}`
      : best() ? `best: level ${best()}` : 'no best yet';
  };

  // In a race: tell the room the level reached and the score once a second.
  let raceTimer = 0;
  const report = async (alive) => {
    if (!race) return;
    await online.race(race.code, state.level, alive, state.score);
    const room = await online.room(race.code);
    if (room && room.players) {
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      const at = sorted.findIndex((p) => p.you);
      const shooting = room.players.filter((p) => p.alive).length;
      race.place = `${['1st', '2nd', '3rd'][at] || `${at + 1}th`} of ${sorted.length}${shooting ? ` · ${shooting} shooting` : ''}`;
      paintNumbers();
    }
  };
  if (race) raceTimer = setInterval(() => { if (!gone && !state.over && state.started) report(true); }, 1000);

  const fieldHeight = () => (canvas.width ? canvas.height / (canvas.width / hoops.WIDTH) : hoops.HEIGHT);
  const size = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
      hoops.resize(state, fieldHeight());
    }
    return ratio;
  };

  let aim = null;                   // the swipe being drawn, in field units
  const draw = () => {
    const ratio = size();
    if (canvas.width) hoops.paint(g, state, { colors, scale: canvas.width / hoops.WIDTH, edge: 3 * ratio, aim });
  };

  const over = () => {
    const record = state.level > best();
    if (record) keep({ hoops: state.level });
    const result = progress.complete('game', `hoops:${progress.today()}`);
    const xp = result.first ? ` · +${progress.XP.game} XP` : '';
    paintNumbers();
    if (race) {
      clearInterval(raceTimer);
      report(false);
      shown = moment({
        tone, eyebrow: `Out of balls · race ${race.code}${xp}`,
        big: String(state.score),
        line: `You reached level ${state.level}. See how everyone else does — the room shows the final places.`,
        action: 'See the race', onclose: () => ctx.go(`room?code=${race.code}`),
      });
      return;
    }
    // A missed target replays the same level, with the score it started with.
    keep({ hoopsResume: { level: state.level, score: state.levelScore } });
    let fresh = false;
    shown = moment({
      tone,
      eyebrow: `Level ${state.level} · ${state.made} of ${state.config.target}${xp}`,
      big: 'SO CLOSE.',
      line: `${record ? 'Your furthest level yet. ' : ''}Try level ${state.level} again — you keep the ${state.levelScore} points you came in with.`,
      action: `Try level ${state.level} again`,
      onclose: () => begin(fresh),
    });
    if (state.level > 1) {
      const main = shown.querySelector('.pill');
      main.parentElement.classList.add('pill-row');
      main.parentElement.appendChild(pill('Start from level 1', () => { fresh = true; main.click(); }, { quiet: true }));
    }
  };

  const frame = (now) => {
    raf = 0;
    if (!canvas.isConnected) { if (attached) { teardown(); return; } raf = requestAnimationFrame(frame); return; }
    if (!attached) document.body.toggleAttribute('data-arcade', true);
    attached = true;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const events = hoops.step(state, dt);
    sound.play(events);
    if (events.length) paintNumbers();
    if (events.includes('level')) {
      if (state.level >= best()) keep({ hoops: state.level + 1 });
      if (!race) keep({ hoopsResume: { level: state.level + 1, score: state.score } });
      progress.complete('game', `hoops:${progress.today()}`);
    }
    draw();
    if (state.over) { over(); return; }
    raf = requestAnimationFrame(frame);
  };

  function begin(fresh) {
    if (fresh) keep({ hoopsResume: { level: 1, score: 0 } });
    state = hoops.create(seed(), { ...saved(), height: fieldHeight() });
    last = 0;
    aim = null;
    paintNumbers();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const shoot = (swipe) => {
    if (document.querySelector('.moment')) return;
    sound.wake();
    sound.play(hoops.shoot(state, swipe));
    paintNumbers();
  };

  // The field: put a finger down anywhere, draw the throw upward, let go.
  let touch = null;
  const point = (event) => {
    const box = canvas.getBoundingClientRect();
    const units = hoops.WIDTH / (box.width || 1);
    return { x: (event.clientX - box.left) * units, y: (event.clientY - box.top) * units };
  };
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    sound.wake();
    touch = { id: event.pointerId, ...point(event) };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!touch || event.pointerId !== touch.id) return;
    const at = point(event);
    aim = { dx: at.x - touch.x, dy: at.y - touch.y };
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!touch || event.pointerId !== touch.id) return;
    const at = point(event);
    const swipe = { dx: at.x - touch.x, dy: at.y - touch.y };
    touch = null;
    aim = null;
    shoot(swipe);
  });
  canvas.addEventListener('pointercancel', () => { touch = null; aim = null; });

  // Keys: ◀ ▶ lean the aim, ▲ or Space shoots it at a medium strength,
  // held longer for a stronger throw.
  let lean = 0;
  let charging = 0;
  const onKey = (event) => {
    if (!canvas.isConnected) { teardown(); return; }
    if (document.querySelector('.moment')) return;
    if (event.key === 'Escape' && event.type === 'keydown') { leave(); return; }
    if (event.key === ' ' && event.target.closest?.('button')) return;
    if (event.type === 'keydown' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      lean = Math.max(-30, Math.min(30, lean + (event.key === 'ArrowLeft' ? -3 : 3)));
      aim = { dx: lean, dy: -60 };
    } else if (event.key === 'ArrowUp' || event.key === ' ') {
      event.preventDefault();
      if (event.type === 'keydown' && !event.repeat) charging = performance.now();
      if (event.type === 'keyup' && charging) {
        const held = Math.min(1.2, (performance.now() - charging) / 1000);
        charging = 0;
        aim = null;
        shoot({ dx: lean, dy: -(45 + held * 40) });
      }
    }
  };
  const onRoute = () => { if (location.hash !== home) teardown(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('hashchange', onRoute);
  function teardown() {
    if (gone) return;
    gone = true;
    clearInterval(raceTimer);
    // Closing a race half-way is being out of it, or the room would wait for ever.
    if (race && !state.over) online.race(race.code, state.level, false, state.score);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('hashchange', onRoute);
    document.body.removeAttribute('data-arcade');
    sound.close();
    if (shown && shown.isConnected) shown.remove();
  }
  const leave = () => { teardown(); ctx.go('play'); };

  const mute = h('button', { class: 'arcade-close', type: 'button' });
  const paintMute = () => {
    mute.innerHTML = sound.muted ? SPEAKER.off : SPEAKER.on;
    mute.setAttribute('aria-label', sound.muted ? 'Turn sound on' : 'Turn sound off');
    mute.setAttribute('aria-pressed', String(sound.muted));
  };
  mute.addEventListener('click', () => {
    sound.muted = !sound.muted;
    keep({ hoopsMuted: sound.muted });
    if (!sound.muted) sound.wake();
    paintMute();
  });
  paintMute();

  const stage = h('div', { class: 'arcade-stage', role: 'application', 'aria-label': 'Hoops' },
    h('div', { class: 'arcade-bar' },
      h('button', { class: 'arcade-close', type: 'button', 'aria-label': 'Close Hoops', text: '✕', onclick: leave }),
      h('div', {}, scoreEl, h('p', { class: 'label dim', text: 'points' })),
      h('span', { class: 'grow' }),
      h('div', { class: 'stat' }, levelEl, infoEl),
      mute),
    h('div', { class: 'arcade-well' }, h('div', { class: 'arcade', dataset: { shape: 'fill' } }, canvas)));

  const el = h('div', { style: 'display:contents' }, stage);
  paintNumbers();
  raf = requestAnimationFrame(frame);
  return { title: 'Hoops', el };
}

// ── Claw ────────────────────────────────────────────────────────────────────
//
// A prize machine that is not rigged: drag along the glass (or hold ◀ ▶) to
// move the claw, press DROP, and whether it holds is decided by how centred
// the grab was. Each level asks for so many prizes from so many tries;
// missing the target replays that level, never level one. The prizes are
// toys drawn in the app's own style, and every one won goes on a shelf kept
// on this phone.
//
// From a room (js/screens/room.js) it is a race on the room's seed, from
// level one, and a missed target is the end of that racer's run.

function clawGame(ctx) {
  const tone = 'rose';
  const arcade = () => store.read(store.KEYS.arcade, {}) || {};
  const keep = (patch) => store.write(store.KEYS.arcade, { ...arcade(), ...patch });
  const best = () => arcade().claw || 0;
  const shelf = () => arcade().clawShelf || {};
  const shelfCount = () => Object.values(shelf()).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const saved = () => {
    const resume = arcade().clawResume || {};
    return { level: Math.max(1, Math.trunc(resume.level) || 1), score: Math.max(0, Math.trunc(resume.score) || 0) };
  };
  const race = ctx.route.params.room ? { code: ctx.route.params.room, seed: Number(ctx.route.params.seed) || 1, place: '' } : null;
  const seed = () => (race ? race.seed : Date.now() % 2147483647);
  let state = race ? claw.create(race.seed) : claw.create(seed(), saved());
  const sound = chiptune.player({ muted: Boolean(arcade().clawMuted), sounds: claw.SOUNDS });
  const held = { left: false, right: false, to: null };
  let raf = 0;
  let last = 0;
  let attached = false;
  let shown = null;
  let gone = false;
  const home = location.hash;

  const canvas = h('canvas', { 'aria-label': 'Claw machine. Drag along the field to move the claw, then press Drop.', role: 'img' });
  const g = canvas.getContext('2d');
  const colors = palette();

  // The toys are art.js drawings, turned into images once each.
  const sprites = new Map();
  const sprite = (kind, fill) => {
    const key = `${kind}:${fill}`;
    if (!sprites.has(key)) {
      const image = new Image();
      const svg = drawSymbol(kind, { fill: TONE_HEX[fill] || TONE_HEX.rose })
        .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" ');
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      sprites.set(key, image);
    }
    const image = sprites.get(key);
    return image.complete && image.naturalWidth ? image : null;
  };

  const scoreEl = h('p', { class: 'headline', text: '0' });
  const levelEl = h('p', { class: 'label', text: 'Level 1' });
  const infoEl = h('p', { class: 'label dim', text: '' });

  const paintNumbers = () => {
    scoreEl.textContent = String(state.score);
    levelEl.textContent = `Level ${state.level}`;
    infoEl.textContent = race
      ? `Race ${race.code}${race.place ? ` · ${race.place}` : ''}`
      : `shelf: ${shelfCount()} ${shelfCount() === 1 ? 'toy' : 'toys'}`;
  };

  // In a race: tell the room the level reached and the score once a second.
  let raceTimer = 0;
  const report = async (alive) => {
    if (!race) return;
    await online.race(race.code, state.level, alive, state.score);
    const room = await online.room(race.code);
    if (room && room.players) {
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      const at = sorted.findIndex((p) => p.you);
      const playing = room.players.filter((p) => p.alive).length;
      race.place = `${['1st', '2nd', '3rd'][at] || `${at + 1}th`} of ${sorted.length}${playing ? ` · ${playing} playing` : ''}`;
      paintNumbers();
    }
  };
  if (race) raceTimer = setInterval(() => { if (!gone && !state.over && state.started) report(true); }, 1000);

  const fieldHeight = () => (canvas.width ? canvas.height / (canvas.width / claw.WIDTH) : claw.HEIGHT);
  const size = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
      claw.resize(state, fieldHeight());
    }
    return ratio;
  };
  const draw = () => {
    const ratio = size();
    if (canvas.width) claw.paint(g, state, { colors, scale: canvas.width / claw.WIDTH, edge: 3 * ratio, sprite });
  };

  const over = () => {
    const record = state.level > best();
    if (record) keep({ claw: state.level });
    const result = progress.complete('game', `claw:${progress.today()}`);
    const xp = result.first ? ` · +${progress.XP.game} XP` : '';
    paintNumbers();
    if (race) {
      clearInterval(raceTimer);
      report(false);
      shown = moment({
        tone, eyebrow: `Out of tries · race ${race.code}${xp}`,
        big: String(state.score),
        line: `You reached level ${state.level}. See how everyone else does — the room shows the final places.`,
        action: 'See the race', onclose: () => ctx.go(`room?code=${race.code}`),
      });
      return;
    }
    keep({ clawResume: { level: state.level, score: state.levelScore } });
    let fresh = false;
    shown = moment({
      tone,
      eyebrow: `Level ${state.level} · ${state.won} of ${state.config.target}${xp}`,
      big: 'SO CLOSE.',
      line: `${record ? 'Your furthest level yet. ' : ''}Try level ${state.level} again — you keep the ${state.levelScore} points you came in with. ${shelfCount()} toys on your shelf.`,
      action: `Try level ${state.level} again`,
      onclose: () => begin(fresh),
    });
    if (state.level > 1) {
      const main = shown.querySelector('.pill');
      main.parentElement.classList.add('pill-row');
      main.parentElement.appendChild(pill('Start from level 1', () => { fresh = true; main.click(); }, { quiet: true }));
    }
  };

  const frame = (now) => {
    raf = 0;
    if (!canvas.isConnected) { if (attached) { teardown(); return; } raf = requestAnimationFrame(frame); return; }
    if (!attached) document.body.toggleAttribute('data-arcade', true);
    attached = true;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const events = claw.step(state, held, dt);
    sound.play(events);
    if (events.includes('prize') && state.lastPrize) {
      const kept = shelf();
      keep({ clawShelf: { ...kept, [state.lastPrize.kind]: (kept[state.lastPrize.kind] || 0) + 1 } });
    }
    if (events.includes('level')) {
      if (state.level >= best()) keep({ claw: state.level + 1 });
      if (!race) keep({ clawResume: { level: state.level + 1, score: state.score } });
      progress.complete('game', `claw:${progress.today()}`);
    }
    if (events.length) paintNumbers();
    draw();
    if (state.over) { over(); return; }
    raf = requestAnimationFrame(frame);
  };

  function begin(fresh) {
    if (fresh) keep({ clawResume: { level: 1, score: 0 } });
    state = claw.create(seed(), { ...saved(), height: fieldHeight() });
    last = 0;
    paintNumbers();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const dropNow = () => {
    if (document.querySelector('.moment')) return;
    sound.wake();
    sound.play(claw.drop(state));
    paintNumbers();
  };

  const press = (side, on) => {
    if (on) sound.wake();
    held[side] = on;
    pads[side]?.toggleAttribute('data-held', on);
  };
  const hold = (side, text, name) => h('button', {
    type: 'button', 'aria-label': name, text,
    onpointerdown: (event) => { event.preventDefault(); press(side, true); },
    onpointerup: () => press(side, false),
    onpointerleave: () => press(side, false),
    onpointercancel: () => press(side, false),
    oncontextmenu: (event) => event.preventDefault(),
  });
  const pads = { left: hold('left', '◀', 'Move the claw left'), right: hold('right', '▶', 'Move the claw right') };
  const dropButton = h('button', {
    type: 'button', 'aria-label': 'Drop the claw', text: 'DROP',
    onpointerdown: (event) => { event.preventDefault(); dropNow(); },
    onclick: (event) => { if (event.detail === 0) dropNow(); },
    oncontextmenu: (event) => event.preventDefault(),
  });

  // The glass itself is the stick: a finger on it pulls the claw over that spot.
  let finger = null;
  const aim = (event) => {
    const box = canvas.getBoundingClientRect();
    if (box.width) held.to = (event.clientX - box.left) * (claw.WIDTH / box.width);
  };
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    sound.wake();
    finger = event.pointerId;
    aim(event);
  });
  canvas.addEventListener('pointermove', (event) => { if (event.pointerId === finger) aim(event); });
  const lift = () => { finger = null; held.to = null; press('left', false); press('right', false); };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  const KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const onKey = (event) => {
    if (!canvas.isConnected) { teardown(); return; }
    if (document.querySelector('.moment')) return;
    if (event.key === 'Escape' && event.type === 'keydown') { leave(); return; }
    if ((event.key === ' ' || event.key === 'ArrowDown' || event.key === 'Enter') && !event.target.closest?.('button')) {
      event.preventDefault();
      if (event.type === 'keydown' && !event.repeat) dropNow();
      return;
    }
    const side = KEYS[event.key];
    if (!side) return;
    event.preventDefault();
    press(side, event.type === 'keydown');
  };
  const onHide = () => { if (document.hidden) lift(); };
  const onRoute = () => { if (location.hash !== home) teardown(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('hashchange', onRoute);
  function teardown() {
    if (gone) return;
    gone = true;
    clearInterval(raceTimer);
    // Closing a race half-way is being out of it, or the room would wait for ever.
    if (race && !state.over) online.race(race.code, state.level, false, state.score);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('hashchange', onRoute);
    document.body.removeAttribute('data-arcade');
    sound.close();
    if (shown && shown.isConnected) shown.remove();
  }
  const leave = () => { teardown(); ctx.go('play'); };

  const mute = h('button', { class: 'arcade-close', type: 'button' });
  const paintMute = () => {
    mute.innerHTML = sound.muted ? SPEAKER.off : SPEAKER.on;
    mute.setAttribute('aria-label', sound.muted ? 'Turn sound on' : 'Turn sound off');
    mute.setAttribute('aria-pressed', String(sound.muted));
  };
  mute.addEventListener('click', () => {
    sound.muted = !sound.muted;
    keep({ clawMuted: sound.muted });
    if (!sound.muted) sound.wake();
    paintMute();
  });
  paintMute();

  const stage = h('div', { class: 'arcade-stage', role: 'application', 'aria-label': 'Claw machine' },
    h('div', { class: 'arcade-bar' },
      h('button', { class: 'arcade-close', type: 'button', 'aria-label': 'Close the claw machine', text: '✕', onclick: leave }),
      h('div', {}, scoreEl, h('p', { class: 'label dim', text: 'points' })),
      h('span', { class: 'grow' }),
      h('div', { class: 'stat' }, levelEl, infoEl),
      mute),
    h('div', { class: 'arcade-well' }, h('div', { class: 'arcade', dataset: { shape: 'fill' } }, canvas)),
    h('div', { class: 'arcade-pad', dataset: { pads: '3' } }, pads.left, dropButton, pads.right));

  const el = h('div', { style: 'display:contents' }, stage);
  paintNumbers();
  raf = requestAnimationFrame(frame);
  return { title: 'Claw machine', el };
}

// ── Monkey Climb ────────────────────────────────────────────────────────────
//
// A vine-climbing game: the little monkey climbs the jungle vines to fetch the
// key and free papa from his cage, dodging lizards, birds and coconuts and
// knocking fruit down onto them. One finger steers: put it down anywhere on
// the jungle and drag the way to go — up and down to climb, left and right to
// run, swing and grab — and a quick tap jumps. Each level gives three lives;
// losing them replays that level, never level one. The best level reached
// stays on this device.
//
// From a room (js/screens/room.js) it is a race on the room's seed, from
// level one, and running out of lives is the end of that racer's run.

function vinesGame(ctx) {
  const tone = 'sky';
  const arcade = () => store.read(store.KEYS.arcade, {}) || {};
  const keep = (patch) => store.write(store.KEYS.arcade, { ...arcade(), ...patch });
  const best = () => arcade().vines || 0;
  const saved = () => {
    const resume = arcade().vinesResume || {};
    return { level: Math.max(1, Math.trunc(resume.level) || 1), score: Math.max(0, Math.trunc(resume.score) || 0) };
  };
  const race = ctx.route.params.room ? { code: ctx.route.params.room, seed: Number(ctx.route.params.seed) || 1, place: '' } : null;
  const seed = () => (race ? race.seed : Date.now() % 2147483647);
  let state = race ? vines.create(race.seed) : vines.create(seed(), saved());
  const sound = chiptune.player({ muted: Boolean(arcade().vinesMuted), sounds: vines.SOUNDS });
  const held = { left: false, right: false, up: false, down: false, jump: false };
  let raf = 0;
  let last = 0;
  let attached = false;
  let shown = null;
  let gone = false;
  const home = location.hash;

  const canvas = h('canvas', { 'aria-label': 'Monkey Climb. Drag on the jungle to climb and run, tap to jump. Arrow keys and Space work too.', role: 'img' });
  const g = canvas.getContext('2d');
  const colors = palette();

  const scoreEl = h('p', { class: 'headline', text: '0' });
  const levelEl = h('p', { class: 'label', text: 'Level 1' });
  const infoEl = h('p', { class: 'label dim', text: '' });
  const paintNumbers = () => {
    scoreEl.textContent = String(state.score);
    levelEl.textContent = `Level ${state.level}`;
    infoEl.textContent = race
      ? `Race ${race.code}${race.place ? ` · ${race.place}` : ''}`
      : best() ? `best: level ${best()}` : 'no best yet';
  };

  // In a race: tell the room the level reached and the score once a second.
  let raceTimer = 0;
  const report = async (alive) => {
    if (!race) return;
    await online.race(race.code, state.level, alive, state.score);
    const room = await online.room(race.code);
    if (room && room.players) {
      const sorted = [...room.players].sort((a, b) => b.score - a.score);
      const at = sorted.findIndex((p) => p.you);
      const climbing = room.players.filter((p) => p.alive).length;
      race.place = `${['1st', '2nd', '3rd'][at] || `${at + 1}th`} of ${sorted.length}${climbing ? ` · ${climbing} climbing` : ''}`;
      paintNumbers();
    }
  };
  if (race) raceTimer = setInterval(() => { if (!gone && !state.over && state.started) report(true); }, 1000);

  const size = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width && (canvas.width !== width || canvas.height !== height)) { canvas.width = width; canvas.height = height; }
    return ratio;
  };
  let stick = null;                 // where a finger went down, and how far it has dragged
  const draw = () => {
    const ratio = size();
    if (canvas.width) vines.paint(g, state, { colors, scale: canvas.width / vines.WIDTH, edge: 3 * ratio, stick });
  };

  const over = () => {
    const record = state.level > best();
    if (record) keep({ vines: state.level });
    const result = progress.complete('game', `vines:${progress.today()}`);
    const xp = result.first ? ` · +${progress.XP.game} XP` : '';
    paintNumbers();
    if (race) {
      clearInterval(raceTimer);
      report(false);
      shown = moment({
        tone, eyebrow: `Out of lives · race ${race.code}${xp}`,
        big: String(state.score),
        line: `You reached level ${state.level}. See how everyone else does — the room shows the final places.`,
        action: 'See the race', onclose: () => ctx.go(`room?code=${race.code}`),
      });
      return;
    }
    keep({ vinesResume: { level: state.level, score: state.levelScore } });
    let fresh = false;
    shown = moment({
      tone,
      eyebrow: `Level ${state.level}${xp}`,
      big: 'KEEP CLIMBING.',
      line: `${record ? 'Your furthest level yet. ' : ''}Try level ${state.level} again — you keep the ${state.levelScore} points you came in with.`,
      action: `Try level ${state.level} again`,
      onclose: () => begin(fresh),
    });
    if (state.level > 1) {
      const main = shown.querySelector('.pill');
      main.parentElement.classList.add('pill-row');
      main.parentElement.appendChild(pill('Start from level 1', () => { fresh = true; main.click(); }, { quiet: true }));
    }
  };

  let tap = false;                  // a tap jumps for exactly one frame
  const frame = (now) => {
    raf = 0;
    if (!canvas.isConnected) { if (attached) { teardown(); return; } raf = requestAnimationFrame(frame); return; }
    if (!attached) document.body.toggleAttribute('data-arcade', true);
    attached = true;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const events = vines.step(state, { ...held, jump: held.jump || tap }, dt);
    tap = false;
    sound.play(events);
    if (events.includes('level')) {
      if (state.level >= best()) keep({ vines: state.level + 1 });
      if (!race) keep({ vinesResume: { level: state.level + 1, score: state.score } });
      progress.complete('game', `vines:${progress.today()}`);
    }
    if (events.length) paintNumbers();
    draw();
    if (state.over) { over(); return; }
    raf = requestAnimationFrame(frame);
  };

  function begin(fresh) {
    if (fresh) keep({ vinesResume: { level: 1, score: 0 } });
    state = vines.create(seed(), saved());
    last = 0;
    paintNumbers();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // One finger steers. It goes down anywhere; dragging past a small dead zone
  // holds that direction — both at once on a diagonal — and lifting a finger
  // that barely moved, quickly, is a jump.
  const DEAD = 4;                   // field units of drag before a direction counts
  const point = (event) => {
    const box = canvas.getBoundingClientRect();
    const units = vines.WIDTH / (box.width || 1);
    return { x: (event.clientX - box.left) * units, y: (event.clientY - box.top) * units };
  };
  const steer = () => {
    held.left = stick ? stick.dx < -DEAD : false;
    held.right = stick ? stick.dx > DEAD : false;
    held.up = stick ? stick.dy < -DEAD : false;
    held.down = stick ? stick.dy > DEAD : false;
  };
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    sound.wake();
    const at = point(event);
    stick = { id: event.pointerId, x: at.x, y: at.y, dx: 0, dy: 0, since: performance.now(), far: 0 };
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!stick || event.pointerId !== stick.id) return;
    const at = point(event);
    stick.dx = at.x - stick.x;
    stick.dy = at.y - stick.y;
    stick.far = Math.max(stick.far, Math.hypot(stick.dx, stick.dy));
    steer();
  });
  const lift = (event) => {
    if (!stick || (event && event.pointerId !== stick.id)) return;
    if (event && stick.far < DEAD && performance.now() - stick.since < 300) tap = true;
    stick = null;
    steer();
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', () => { stick = null; steer(); });

  const KEYS = {
    ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ' ': 'jump',
  };
  const onKey = (event) => {
    if (!canvas.isConnected) { teardown(); return; }
    if (document.querySelector('.moment')) return;
    if (event.key === 'Escape' && event.type === 'keydown') { leave(); return; }
    const key = KEYS[event.key];
    if (!key || (event.key === ' ' && event.target.closest?.('button'))) return;
    event.preventDefault();
    if (event.type === 'keydown') sound.wake();
    held[key] = event.type === 'keydown';
  };
  const onHide = () => { if (document.hidden) { stick = null; for (const key of Object.keys(held)) held[key] = false; } };
  const onRoute = () => { if (location.hash !== home) teardown(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('hashchange', onRoute);
  function teardown() {
    if (gone) return;
    gone = true;
    clearInterval(raceTimer);
    // Closing a race half-way is being out of it, or the room would wait for ever.
    if (race && !state.over) online.race(race.code, state.level, false, state.score);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('hashchange', onRoute);
    document.body.removeAttribute('data-arcade');
    sound.close();
    if (shown && shown.isConnected) shown.remove();
  }
  const leave = () => { teardown(); ctx.go('play'); };

  const mute = h('button', { class: 'arcade-close', type: 'button' });
  const paintMute = () => {
    mute.innerHTML = sound.muted ? SPEAKER.off : SPEAKER.on;
    mute.setAttribute('aria-label', sound.muted ? 'Turn sound on' : 'Turn sound off');
    mute.setAttribute('aria-pressed', String(sound.muted));
  };
  mute.addEventListener('click', () => {
    sound.muted = !sound.muted;
    keep({ vinesMuted: sound.muted });
    if (!sound.muted) sound.wake();
    paintMute();
  });
  paintMute();

  const stage = h('div', { class: 'arcade-stage', role: 'application', 'aria-label': 'Monkey Climb' },
    h('div', { class: 'arcade-bar' },
      h('button', { class: 'arcade-close', type: 'button', 'aria-label': 'Close Monkey Climb', text: '✕', onclick: leave }),
      h('div', {}, scoreEl, h('p', { class: 'label dim', text: 'points' })),
      h('span', { class: 'grow' }),
      h('div', { class: 'stat' }, levelEl, infoEl),
      mute),
    h('div', { class: 'arcade-well' }, h('div', { class: 'arcade' }, canvas)));

  const el = h('div', { style: 'display:contents' }, stage);
  paintNumbers();
  raf = requestAnimationFrame(frame);
  return { title: 'Monkey Climb', el };
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
  hop: hopGame,
  hoops: hoopsGame,
  claw: clawGame,
  vines: vinesGame,
};

export default async function gameScreen(ctx) {
  const id = ctx.route.args[0];
  const play = GAMES[id];
  if (!play) return { title: 'Play', el: poster({ tone: 'paper', className: 'full' }, note('That game does not exist yet.')) };
  return play(ctx);
}
