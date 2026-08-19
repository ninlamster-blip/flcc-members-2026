/* =============================================================================
   APP — the playable crossword.
   -----------------------------------------------------------------------------
   Everything the member touches. The rules live in engine.js, the facts in
   answers.js, what is remembered in storage.js, and the optional intelligence
   in ai.js — which is imported only if somebody actually asks for help, so a
   member who never taps a hint never downloads it.
   ========================================================================== */

import {
  allPuzzles, buildPuzzle, puzzleForDate, puzzleNumber, dayKey,
  firstOpenCell, nextCellIn, nextEntry, isEntryFilled, isEntryCorrect, isSolved, wrongCells,
} from './engine.js';
import * as store from './storage.js';

/* ── Scoring ──────────────────────────────────────────────────────────────── */

const SCORE = {
  answer: 100,
  complete: 500,
  noHints: 500,
  perfect: 1000,
  hint: -50,
  scripture: -100,
  reveal: -150,
  ask: -100,
};

/* ── State ────────────────────────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  puzzle: null,      // the raw record
  model: null,       // the built, playable model
  letters: {},       // "r,c" -> letter
  revealed: new Set(),
  solved: new Set(), // entry ids already scored
  help: {},          // entry id -> { hint, scripture, reveals, asked }
  wrongSeen: new Set(),
  score: 0,
  mistakes: 0,
  hintsUsed: 0,
  elapsed: 0,
  running: false,
  finished: false,
  review: false,
  cursor: [0, 0],
  dir: 'across',
  listDir: 'across',
  ticker: null,
  ai: null,          // the ai module, once someone needs it
};

/* ── Boot ─────────────────────────────────────────────────────────────────── */

function start() {
  const requested = new URLSearchParams(location.search).get('puzzle');
  const puzzle = (requested && allPuzzles().find((p) => p.id === requested)) || puzzleForDate();
  openPuzzle(puzzle);
  $('loading').hidden = true;
  $('game').hidden = false;
  wireControls();
}

function openPuzzle(puzzle) {
  stopTimer();
  state.puzzle = puzzle;
  state.model = buildPuzzle(puzzle);
  state.letters = {};
  state.revealed = new Set();
  state.solved = new Set();
  state.help = {};
  state.wrongSeen = new Set();
  state.score = 0;
  state.mistakes = 0;
  state.hintsUsed = 0;
  state.elapsed = 0;
  state.finished = false;
  state.review = false;

  const saved = store.loadProgress(puzzle.id);
  if (saved) {
    state.letters = saved.letters || {};
    state.revealed = new Set(saved.revealed || []);
    state.solved = new Set(saved.solved || []);
    state.help = saved.help || {};
    state.score = saved.score || 0;
    state.mistakes = saved.mistakes || 0;
    state.hintsUsed = saved.hintsUsed || 0;
    state.elapsed = saved.elapsed || 0;
  }

  const first = state.model.entries[0];
  state.dir = first.dir;
  state.cursor = firstOpenCell(first, state.letters);
  state.listDir = first.dir;

  drawGrid();
  renderHeader();
  renderAll();
  if (!isSolved(state.model, state.letters)) startTimer();
  else finishUp({ silent: true });
}

/* ── Header ───────────────────────────────────────────────────────────────── */

function renderHeader() {
  const { puzzle } = state;
  $('tag-difficulty').textContent = puzzle.difficulty;
  $('tag-category').textContent = puzzle.category;
  $('tag-puzzle').textContent = `Puzzle ${String(puzzleNumber(puzzle)).padStart(2, '0')}`;

  const streak = store.currentStreak(dayKey());
  const tag = $('tag-streak');
  tag.hidden = streak.count < 1;
  tag.textContent = `\u{1F525} ${streak.count} day${streak.count === 1 ? '' : 's'}`;

  const done = store.resultFor(puzzle.id);
  $('tag-solved').hidden = !done;
}

/* ── Grid ─────────────────────────────────────────────────────────────────── */

let cellEls = [];

function drawGrid() {
  const grid = $('grid');
  grid.textContent = '';
  cellEls = [];
  const { model } = state;

  for (let r = 0; r < model.size; r++) {
    const row = [];
    for (let c = 0; c < model.size; c++) {
      const el = document.createElement('div');
      const block = model.grid[r][c] === '#';
      el.className = block ? 'cell block' : 'cell';
      if (block) {
        el.setAttribute('aria-hidden', 'true');
      } else {
        el.setAttribute('role', 'gridcell');
        el.dataset.r = String(r);
        el.dataset.c = String(c);
        const n = model.numbers[r][c];
        if (n) {
          const num = document.createElement('span');
          num.className = 'num';
          num.textContent = String(n);
          el.appendChild(num);
        }
        const letter = document.createElement('span');
        letter.className = 'letter';
        el.appendChild(letter);
      }
      grid.appendChild(el);
      row.push(el);
    }
    cellEls.push(row);
  }

  grid.addEventListener('pointerdown', onGridPointer);
}

function onGridPointer(event) {
  const el = event.target.closest('.cell');
  if (!el || !el.dataset.r) return;
  event.preventDefault();
  const r = Number(el.dataset.r);
  const c = Number(el.dataset.c);
  const same = state.cursor[0] === r && state.cursor[1] === c;
  if (same) toggleDirection();
  else {
    state.cursor = [r, c];
    // A cell with only one word through it belongs to that word, whatever
    // direction the player was in.
    if (!entryAt(r, c, state.dir)) state.dir = state.dir === 'across' ? 'down' : 'across';
  }
  focusInput();
  renderAll();
}

function entryAt(r, c, dir) {
  const owner = state.model.byCell[`${r},${c}`];
  return owner && owner[dir] ? state.model.entry(owner[dir]) : null;
}

function currentEntry() {
  const [r, c] = state.cursor;
  return entryAt(r, c, state.dir) || entryAt(r, c, state.dir === 'across' ? 'down' : 'across');
}

function toggleDirection() {
  const [r, c] = state.cursor;
  const other = state.dir === 'across' ? 'down' : 'across';
  if (entryAt(r, c, other)) {
    state.dir = other;
    state.listDir = other;
  }
}

/* ── Rendering ────────────────────────────────────────────────────────────── */

function renderAll() {
  renderGrid();
  renderCurrent();
  renderClueList();
  renderScore();
}

function renderGrid() {
  const entry = currentEntry();
  const inWord = new Set((entry ? entry.cells : []).map(([r, c]) => `${r},${c}`));
  const [cr, cc] = state.cursor;

  for (const [r, c] of state.model.letterCells) {
    const el = cellEls[r][c];
    const key = `${r},${c}`;
    const letter = state.letters[key] || '';
    el.querySelector('.letter').textContent = letter;
    el.classList.toggle('in-word', inWord.has(key));
    el.classList.toggle('selected', r === cr && c === cc);
    el.classList.toggle('revealed', state.revealed.has(key));
    el.classList.toggle('done', isCellSolved(r, c));
    const n = state.model.numbers[r][c];
    el.setAttribute('aria-label',
      `Row ${r + 1} column ${c + 1}${n ? `, clue ${n}` : ''}. ${letter ? `Letter ${letter}` : 'Empty'}`);
  }
}

function isCellSolved(r, c) {
  const owner = state.model.byCell[`${r},${c}`];
  if (!owner) return false;
  return ['across', 'down'].some((d) => owner[d] && state.solved.has(owner[d]));
}

function renderCurrent() {
  const entry = currentEntry();
  if (!entry) return;
  $('current-dir').textContent = entry.dir === 'across' ? 'Across' : 'Down';
  $('current-num').textContent = String(entry.number);
  $('current-clue').textContent = entry.clue;

  const help = state.help[entry.id] || {};
  const bits = [`${entry.len} letters`];
  if (state.solved.has(entry.id)) bits.push('solved');
  else if (help.reveals) bits.push(`${help.reveals} letter${help.reveals === 1 ? '' : 's'} revealed`);
  $('current-meta').textContent = bits.join(' · ');

  const solved = state.solved.has(entry.id) || state.review;
  $('btn-hint').disabled = !!help.hint || solved;
  $('btn-scripture').disabled = !!help.scripture || solved;
  $('btn-reveal').disabled = solved || entry.cells.every(([r, c]) => state.letters[`${r},${c}`] === state.model.grid[r][c]);
  // Ask AI is offered only once the clue has been attempted or the plain hint
  // has been spent — it is a deeper question, not a first resort.
  const attempted = !!help.hint || entry.cells.some(([r, c]) => state.letters[`${r},${c}`]);
  $('btn-ask').hidden = !(attempted || solved);
  $('btn-ask').disabled = false;

  renderInsights(entry);
  $('ghost').setAttribute('aria-label',
    `${entry.dir === 'across' ? 'Across' : 'Down'} ${entry.number}, ${entry.len} letters. ${entry.clue}`);
}

function renderInsights(entry) {
  const box = $('insights');
  box.textContent = '';
  const help = state.help[entry.id] || {};

  if (help.hint) {
    box.appendChild(insight('ai', '✦ AI Hint', entry.hint, help.hintCost));
  }
  if (help.scripture) {
    box.appendChild(insight('scripture', 'Scripture Insight', entry.scripture, help.scriptureCost, true));
  }
  if (state.solved.has(entry.id) || state.review) {
    box.appendChild(insight('explain', '✦ AI Explains', entry.explanation, null));
  }
}

function insight(kind, label, text, cost, mono = false) {
  const el = document.createElement('div');
  el.className = `insight is-${kind === 'ai' ? 'ai' : kind}`;
  const lab = document.createElement('div');
  lab.className = 'insight-label';
  lab.textContent = label;
  const p = document.createElement('p');
  if (mono) p.className = 'ref';
  p.textContent = text;
  el.append(lab, p);
  if (cost) {
    const c = document.createElement('div');
    c.className = 'cost';
    c.textContent = `Hint used · ${cost < 0 ? '\u2212' : '+'}${Math.abs(cost)} pts`;
    el.appendChild(c);
  }
  return el;
}

function renderClueList() {
  const list = $('clue-list');
  list.textContent = '';
  const entry = currentEntry();
  const entries = state.listDir === 'across' ? state.model.across : state.model.down;

  for (const e of entries) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'clue-item' + (state.solved.has(e.id) ? ' solved' : '');
    if (entry && e.id === entry.id) btn.setAttribute('aria-current', 'true');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(e.number);
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = e.clue;
    btn.append(n, t);
    btn.addEventListener('click', () => goToEntry(e));
    li.appendChild(btn);
    list.appendChild(li);
  }

  $('sw-across').setAttribute('aria-pressed', String(state.listDir === 'across'));
  $('sw-down').setAttribute('aria-pressed', String(state.listDir === 'down'));
}

function renderScore() {
  const answers = state.model.entries.length;
  $('score').textContent = state.score.toLocaleString();
  $('progress').textContent = `${state.solved.size}/${answers}`;
  $('timer').textContent = clock(state.elapsed);
}

function clock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ── Moving about ─────────────────────────────────────────────────────────── */

function goToEntry(entry) {
  state.dir = entry.dir;
  state.listDir = entry.dir;
  state.cursor = firstOpenCell(entry, state.letters);
  focusInput();
  renderAll();
  announce(`${entry.dir === 'across' ? 'Across' : 'Down'} ${entry.number}. ${entry.clue}`);
}

function move(dr, dc) {
  const { model } = state;
  let [r, c] = state.cursor;
  for (let step = 0; step < model.size; step++) {
    r += dr; c += dc;
    if (r < 0 || c < 0 || r >= model.size || c >= model.size) return;
    if (model.grid[r][c] !== '#') {
      state.cursor = [r, c];
      const wanted = dr === 0 ? 'across' : 'down';
      if (entryAt(r, c, wanted)) { state.dir = wanted; state.listDir = wanted; }
      renderAll();
      return;
    }
  }
}

/* ── Typing ───────────────────────────────────────────────────────────────── */

function typeLetter(ch) {
  if (state.finished || state.review) return;
  const entry = currentEntry();
  if (!entry) return;
  const [r, c] = state.cursor;
  const key = `${r},${c}`;
  if (state.solved.has(entry.id) && state.letters[key] === state.model.grid[r][c]) {
    advance(entry, r, c);
    return;
  }
  state.letters[key] = ch;
  state.revealed.delete(key);
  beep(660);
  const scored = scoreEntriesTouching(r, c);
  advance(entry, r, c);
  renderAll();
  persist();
  if (scored) maybeFinish();
}

function advance(entry, r, c) {
  const i = entry.cells.findIndex(([er, ec]) => er === r && ec === c);
  const next = nextCellIn(entry, i);
  if (next) { state.cursor = next; return; }
  // End of the word: jump to the next unfinished clue rather than stalling.
  const following = firstUnsolvedAfter(entry);
  if (following) { state.dir = following.dir; state.listDir = following.dir; state.cursor = firstOpenCell(following, state.letters); }
}

function firstUnsolvedAfter(entry) {
  let candidate = entry;
  for (let i = 0; i < state.model.entries.length; i++) {
    candidate = nextEntry(state.model, candidate.id, 1);
    if (!isEntryFilled(candidate, state.letters)) return candidate;
  }
  return null;
}

function backspace() {
  if (state.finished || state.review) return;
  const entry = currentEntry();
  const [r, c] = state.cursor;
  const key = `${r},${c}`;
  if (state.letters[key]) {
    delete state.letters[key];
    state.revealed.delete(key);
  } else if (entry) {
    const i = entry.cells.findIndex(([er, ec]) => er === r && ec === c);
    if (i > 0) {
      const [pr, pc] = entry.cells[i - 1];
      state.cursor = [pr, pc];
      delete state.letters[`${pr},${pc}`];
      state.revealed.delete(`${pr},${pc}`);
    }
  }
  renderAll();
  persist();
}

/**
 * Score the words that run through a cell. A word scores once, the moment it
 * is both full and right. A word that is full and wrong shakes and counts as
 * one mistake — the grid never marks a single letter red as it is typed,
 * because that would answer the clue for you.
 */
function scoreEntriesTouching(r, c) {
  const owner = state.model.byCell[`${r},${c}`];
  if (!owner) return false;
  let changed = false;
  for (const dir of ['across', 'down']) {
    const id = owner[dir];
    if (!id || state.solved.has(id)) continue;
    const entry = state.model.entry(id);
    if (!isEntryFilled(entry, state.letters)) continue;
    if (isEntryCorrect(entry, state.letters)) {
      state.solved.add(id);
      addScore(SCORE.answer);
      changed = true;
      beep(880);
      announce(`${entry.answer} is correct.`);
    } else {
      const signature = `${id}:${entry.cells.map(([er, ec]) => state.letters[`${er},${ec}`]).join('')}`;
      if (!state.wrongSeen.has(signature)) {
        state.wrongSeen.add(signature);
        state.mistakes++;
        shake(entry);
        beep(220);
      }
    }
  }
  return changed;
}

function shake(entry) {
  if (reducedMotion()) return;
  for (const [r, c] of entry.cells) {
    const el = cellEls[r][c];
    el.classList.remove('wrong');
    void el.offsetWidth;
    el.classList.add('wrong');
    setTimeout(() => el.classList.remove('wrong'), 340);
  }
}

function addScore(delta) {
  // Deliberately not floored while playing: if the first thing you do is buy a
  // hint, the scoreboard should say -50 rather than pretend it was free. Only
  // the score that gets *recorded* is floored at zero, on the way out.
  state.score += delta;
  const el = $('score');
  el.textContent = state.score.toLocaleString();
  if (reducedMotion()) return;
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

/* ── Help ladder ──────────────────────────────────────────────────────────── */

function helpFor(entry) { return (state.help[entry.id] ||= {}); }

function useHint() {
  const entry = currentEntry();
  const help = helpFor(entry);
  if (help.hint) return;
  help.hint = true;
  help.hintCost = SCORE.hint;
  state.hintsUsed++;
  addScore(SCORE.hint);
  renderAll();
  persist();
  announce(`Hint: ${entry.hint}`);
}

function useScripture() {
  const entry = currentEntry();
  const help = helpFor(entry);
  if (help.scripture) return;
  help.scripture = true;
  help.scriptureCost = SCORE.scripture;
  state.hintsUsed++;
  addScore(SCORE.scripture);
  renderAll();
  persist();
  announce(`Scripture: ${entry.scripture}`);
}

function revealLetter() {
  const entry = currentEntry();
  const target = entry.cells.find(([r, c]) => state.letters[`${r},${c}`] !== state.model.grid[r][c]);
  if (!target) return;
  const [r, c] = target;
  state.letters[`${r},${c}`] = state.model.grid[r][c];
  state.revealed.add(`${r},${c}`);
  const help = helpFor(entry);
  help.reveals = (help.reveals || 0) + 1;
  state.hintsUsed++;
  addScore(SCORE.reveal);
  state.cursor = [r, c];
  const scored = scoreEntriesTouching(r, c);
  renderAll();
  persist();
  toast(`Letter revealed · \u2212${Math.abs(SCORE.reveal)} pts`);
  if (scored) maybeFinish();
}

/* ── Ask AI ───────────────────────────────────────────────────────────────── */

async function loadAI() {
  if (!state.ai) state.ai = await import('./ai.js');
  return state.ai;
}

async function openAsk() {
  const entry = currentEntry();
  const ai = await loadAI();
  $('ask-clue').textContent = `${entry.dir === 'across' ? 'Across' : 'Down'} ${entry.number} — ${entry.clue}`;

  const actions = $('ask-actions');
  actions.textContent = '';
  for (const action of ai.ACTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = action.label;
    btn.addEventListener('click', () => runAsk(action.id, entry, btn));
    actions.appendChild(btn);
  }
  $('ask-answer').textContent = '';
  openOverlay('ask-overlay');
}

async function runAsk(actionId, entry, button) {
  const ai = await loadAI();
  const box = $('ask-answer');
  box.textContent = '';
  const pending = document.createElement('div');
  pending.className = 'ask-answer';
  pending.innerHTML = '<p><span class="thinking"><i></i><i></i><i></i></span> Thinking through the clue&hellip;</p>';
  box.appendChild(pending);
  [...$('ask-actions').children].forEach((b) => { b.disabled = true; });

  // Charged once per clue, however many questions are asked about it.
  const help = helpFor(entry);
  if (!help.asked) {
    help.asked = true;
    state.hintsUsed++;
    addScore(SCORE.ask);
    persist();
  }

  const { text, source, error } = await ai.askAbout(actionId, entry);
  box.textContent = '';
  const card = document.createElement('div');
  card.className = 'ask-answer';
  const label = document.createElement('div');
  label.className = 'insight-label';
  label.textContent = source === 'ai' ? '✦ AI Explains' : 'From the FLCC puzzle notes';
  const p = document.createElement('p');
  p.textContent = text;
  card.append(label, p);
  if (error) {
    const note = document.createElement('p');
    note.className = 'ask-note';
    note.textContent = 'AI assistance is temporarily unavailable, so this came from the puzzle notes. Your crossword is still fully playable.';
    card.appendChild(note);
  }
  box.appendChild(card);
  [...$('ask-actions').children].forEach((b) => { b.disabled = false; });
  renderScore();
}

/* ── Check and reset ──────────────────────────────────────────────────────── */

function checkAnswers() {
  const wrong = wrongCells(state.model, state.letters);
  if (!wrong.length) {
    toast(state.solved.size === state.model.entries.length ? 'All correct.' : 'Nothing wrong so far.');
    return;
  }
  for (const [r, c] of wrong) {
    const el = cellEls[r][c];
    el.classList.add('wrong');
    setTimeout(() => el.classList.remove('wrong'), 900);
  }
  toast(`${wrong.length} letter${wrong.length === 1 ? '' : 's'} in the wrong place.`);
  announce(`${wrong.length} letters are wrong.`);
}

function resetPuzzle() {
  store.clearProgress(state.puzzle.id);
  openPuzzle(state.puzzle);
  toast('Puzzle reset.');
}

/* ── Finishing ────────────────────────────────────────────────────────────── */

function maybeFinish() {
  if (state.finished) return;
  if (!isSolved(state.model, state.letters)) return;
  finishUp({ silent: false });
}

function finishUp({ silent }) {
  state.finished = true;
  stopTimer();

  if (!silent) {
    addScore(SCORE.complete);
    if (state.hintsUsed === 0) addScore(SCORE.noHints);
    if (state.hintsUsed === 0 && state.mistakes === 0) addScore(SCORE.perfect);
    state.score = Math.max(0, state.score);
    renderScore();

    store.recordResult({
      puzzleId: state.puzzle.id,
      category: state.puzzle.category,
      difficulty: state.puzzle.difficulty,
      score: state.score,
      seconds: state.elapsed,
      hintsUsed: state.hintsUsed,
      mistakes: state.mistakes,
      answers: state.model.entries.length,
      date: dayKey(),
    }, dayKey());
  }

  renderHeader();
  renderAll();
  if (!silent) showCompletion();
}

function showCompletion() {
  const answers = state.model.entries.length;
  $('done-title').textContent = state.mistakes === 0 && state.hintsUsed === 0 ? 'Flawless.' : 'Well done.';
  $('done-sub').textContent = `${state.puzzle.difficulty} · ${state.puzzle.category}`;
  $('done-score').textContent = state.score.toLocaleString();
  $('done-time').textContent = clock(state.elapsed);
  $('done-answers').textContent = `${answers}/${answers}`;
  $('done-hints').textContent = String(state.hintsUsed);

  // The Scripture on the completion screen is one of the puzzle's own
  // references, chosen by the day so everybody sees the same one.
  const longest = [...state.model.entries].sort((a, b) => b.len - a.len)[0];
  $('done-scripture').textContent = `${longest.scripture} — ${longest.explanation}`;

  const learn = $('done-learn');
  learn.textContent = `${answers} answers on ${state.puzzle.category}, and the one worth keeping is ${longest.answer} — ${longest.hint}`;
  openOverlay('done-overlay');

  // A live closing line, if there is a connection. The written one is already
  // on screen, so a failure here changes nothing.
  loadAI().then((ai) => ai.completionLine(
    { category: state.puzzle.category, entries: state.model.entries },
    { score: state.score, minutes: Math.max(1, Math.round(state.elapsed / 60)), hintsUsed: state.hintsUsed },
  )).then(({ text, source }) => {
    if (source === 'ai' && text) learn.textContent = text;
  }).catch(() => { /* the written line stands */ });
}

function shareResult() {
  const answers = state.model.entries.length;
  const text = [
    'I completed today’s FLCC Bible Crossword!',
    '',
    `Score: ${state.score.toLocaleString()}`,
    `Difficulty: ${state.puzzle.difficulty} · ${state.puzzle.category}`,
    `Time: ${clock(state.elapsed)}`,
    `Answers: ${answers}/${answers}`,
    '',
    'Can you beat me?',
  ].join('\n');

  if (navigator.share) {
    navigator.share({ title: 'FLCC Bible Crossword', text }).catch(() => { /* dismissed */ });
    return;
  }
  navigator.clipboard?.writeText(text)
    .then(() => toast('Result copied to your clipboard.'))
    .catch(() => toast('Could not copy on this device.'));
}

function reviewAnswers() {
  state.review = true;
  for (const [r, c] of state.model.letterCells) state.letters[`${r},${c}`] = state.model.grid[r][c];
  state.model.entries.forEach((e) => state.solved.add(e.id));
  closeOverlay('done-overlay');
  renderAll();
  toast('Tap any clue to see what it was about.');
}

function nextChallenge() {
  const puzzles = allPuzzles();
  const i = puzzles.findIndex((p) => p.id === state.puzzle.id);
  const unfinished = puzzles.slice(i + 1).concat(puzzles.slice(0, i)).find((p) => !store.resultFor(p.id));
  closeOverlay('done-overlay');
  openPuzzle(unfinished || puzzles[(i + 1) % puzzles.length]);
  window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/* ── Archive ──────────────────────────────────────────────────────────────── */

function openArchive() {
  const list = $('archive-list');
  list.textContent = '';
  const today = puzzleForDate();

  allPuzzles().forEach((p, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'archive-item';
    if (p.id === state.puzzle.id) btn.setAttribute('aria-current', 'true');

    const n = document.createElement('span');
    n.className = 'archive-n';
    n.textContent = String(i + 1).padStart(2, '0');

    const body = document.createElement('div');
    body.className = 'archive-body';
    const b = document.createElement('b');
    b.textContent = p.category;
    const s = document.createElement('span');
    s.textContent = p.id === today.id ? 'Today’s challenge · Hard' : 'Hard';
    body.append(b, s);

    const result = store.resultFor(p.id);
    const score = document.createElement('span');
    score.className = 'archive-score';
    score.textContent = result ? `${result.score.toLocaleString()} pts` : '';

    btn.append(n, body, score);
    btn.addEventListener('click', () => { closeOverlay('archive-overlay'); openPuzzle(p); });
    li.appendChild(btn);
    list.appendChild(li);
  });

  openOverlay('archive-overlay');
}

/* ── Timer ────────────────────────────────────────────────────────────────── */

function startTimer() {
  if (state.ticker) return;
  state.running = true;
  state.ticker = setInterval(() => {
    if (document.hidden || state.finished) return;
    state.elapsed++;
    $('timer').textContent = clock(state.elapsed);
    if (state.elapsed % 10 === 0) persist();
  }, 1000);
}

function stopTimer() {
  state.running = false;
  if (state.ticker) clearInterval(state.ticker);
  state.ticker = null;
}

/* ── Persistence ──────────────────────────────────────────────────────────── */

function persist() {
  if (state.finished || state.review) return;
  store.saveProgress(state.puzzle.id, {
    letters: state.letters,
    revealed: [...state.revealed],
    solved: [...state.solved],
    help: state.help,
    score: state.score,
    mistakes: state.mistakes,
    hintsUsed: state.hintsUsed,
    elapsed: state.elapsed,
  });
}

/* ── Sound (off by default, and it stays off unless asked) ────────────────── */

let audio = null;
function beep(frequency) {
  if (!store.settings().sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.05, audio.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.12);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.13);
  } catch { /* no audio on this device */ }
}

/* ── Chrome ───────────────────────────────────────────────────────────────── */

let toastTimer = null;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function announce(message) { $('live').textContent = message; }

function openOverlay(id) {
  const el = $(id);
  el.hidden = false;
  const focusable = el.querySelector('button, [href], input');
  focusable?.focus();
}

function closeOverlay(id) {
  $(id).hidden = true;
  focusInput();
}

function focusInput() {
  const input = $('ghost');
  input.value = '';
  input.focus({ preventScroll: true });
}

/* ── Input ────────────────────────────────────────────────────────────────── */

function wireControls() {
  const input = $('ghost');

  // Desktop keyboards, and iOS hardware keyboards, come through here.
  input.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); move(0, -1); return;
      case 'ArrowRight': e.preventDefault(); move(0, 1); return;
      case 'ArrowUp': e.preventDefault(); move(-1, 0); return;
      case 'ArrowDown': e.preventDefault(); move(1, 0); return;
      case 'Backspace': e.preventDefault(); backspace(); return;
      case 'Delete': e.preventDefault(); backspace(); return;
      case ' ': e.preventDefault(); toggleDirection(); renderAll(); return;
      case 'Tab': {
        e.preventDefault();
        const entry = currentEntry();
        if (entry) goToEntry(nextEntry(state.model, entry.id, e.shiftKey ? -1 : 1));
        return;
      }
      default: break;
    }
    if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); typeLetter(e.key.toUpperCase()); }
  });

  // Soft keyboards do not always fire keydown for letters or backspace, so the
  // real source of truth on a phone is the input event.
  input.addEventListener('input', () => {
    const value = input.value;
    input.value = '';
    const letters = value.replace(/[^a-zA-Z]/g, '').toUpperCase();
    for (const ch of letters) typeLetter(ch);
  });
  input.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'deleteContentBackward') { e.preventDefault(); backspace(); }
  });

  $('btn-prev').addEventListener('click', () => {
    const entry = currentEntry();
    if (entry) goToEntry(nextEntry(state.model, entry.id, -1));
  });
  $('btn-next').addEventListener('click', () => {
    const entry = currentEntry();
    if (entry) goToEntry(nextEntry(state.model, entry.id, 1));
  });

  $('btn-hint').addEventListener('click', useHint);
  $('btn-scripture').addEventListener('click', useScripture);
  $('btn-reveal').addEventListener('click', revealLetter);
  $('btn-ask').addEventListener('click', openAsk);
  $('btn-check').addEventListener('click', checkAnswers);
  $('btn-reset').addEventListener('click', resetPuzzle);

  $('sw-across').addEventListener('click', () => { state.listDir = 'across'; renderClueList(); });
  $('sw-down').addEventListener('click', () => { state.listDir = 'down'; renderClueList(); });

  $('btn-archive').addEventListener('click', openArchive);
  $('btn-how').addEventListener('click', () => openOverlay('how-overlay'));
  $('btn-next-challenge').addEventListener('click', nextChallenge);
  $('btn-review').addEventListener('click', reviewAnswers);
  $('btn-share').addEventListener('click', shareResult);

  const soundBtn = $('btn-sound');
  const paintSound = () => {
    const on = store.settings().sound;
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.textContent = on ? '\u{1F509}' : '\u{1F507}';
    soundBtn.setAttribute('aria-label', `Sound effects, currently ${on ? 'on' : 'off'}`);
  };
  soundBtn.addEventListener('click', () => { store.setSetting('sound', !store.settings().sound); paintSound(); });
  paintSound();

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeOverlay(btn.dataset.close));
  });
  document.querySelectorAll('.overlay').forEach((overlay) => {
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) closeOverlay(overlay.id); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.overlay')].find((o) => !o.hidden);
    if (open) closeOverlay(open.id);
  });

  window.addEventListener('beforeunload', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
}

start();
