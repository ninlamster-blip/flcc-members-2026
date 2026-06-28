// Flashcards — spaced-repetition review over the vocabulary deck.
import { ALL_VOCAB } from '../../data/vocab.js';
import { State, save, speak, addXp, touchActivity, el, esc } from '../core.js';
import { getCard, review, dueCards, srsStats } from '../srs.js';
import { checkMissions } from '../missions.js';

let deck = 'all';
let queue = [];
let current = null;
let flipped = false;
let reviewed = 0;

function deckIds() {
  let items = ALL_VOCAB;
  if (deck === 'fav') items = ALL_VOCAB.filter(v => State.favorites[v.id]);
  return items.map(v => v.id);
}

export function render(root) {
  const ids = deckIds();
  const st = srsStats(ids);
  root.innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">Practice · Spaced Repetition</div>
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">Flashcards</h1>
      <p class="muted" style="margin-bottom:20px;">Review cards just before you'd forget them. Rate each one honestly.</p>

      <div class="grid cols-4" style="margin-bottom:22px;">
        ${stat('Due now', st.due, 'var(--accent)')}
        ${stat('New', st.fresh, 'var(--indigo)')}
        ${stat('Learning', st.learning, 'var(--gold)')}
        ${stat('Mature', st.mature, 'var(--green)')}
      </div>

      <div class="spread" style="margin-bottom:18px;">
        <div class="seg" id="deckSeg">
          <button data-d="all" class="${deck === 'all' ? 'on' : ''}">All words</button>
          <button data-d="fav" class="${deck === 'fav' ? 'on' : ''}">Favorites</button>
        </div>
        <button class="btn accent" id="start">${st.due ? `Review ${Math.min(st.due, 20)} due` : 'Study ahead'} →</button>
      </div>

      <div class="card card-pad center muted">
        <p>Press <b>Start</b> to begin a session. Cards you find hard come back sooner;
        easy cards wait longer. Progress saves automatically.</p>
      </div>
    </div>`;

  root.querySelector('#deckSeg').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    deck = b.dataset.d; render(root);
  };
  root.querySelector('#start').onclick = () => startSession(root);
}

function stat(k, v, color) {
  return `<div class="card stat-card"><div class="k">${k}</div>
    <div class="v" style="color:${color}">${v}</div></div>`;
}

function startSession(root) {
  const ids = deckIds();
  if (!ids.length) { render(root); return; }
  let due = dueCards(ids);
  if (!due.length) due = ids.slice(); // study ahead
  queue = shuffle(due).slice(0, 20);
  reviewed = 0;
  nextCard(root);
}

function nextCard(root) {
  if (!queue.length) return finish(root);
  current = queue.shift();
  flipped = false;
  drawCard(root);
}

function drawCard(root) {
  const w = ALL_VOCAB.find(v => v.id === current);
  if (!w) return nextCard(root);
  root.innerHTML = `
    <div class="fade-in flash-wrap">
      <div class="spread" style="margin-bottom:18px;">
        <span class="chip">${reviewed + 1} reviewed</span>
        <span class="chip accent">${queue.length} left</span>
      </div>

      <div class="flash ${flipped ? 'flipped' : ''}" id="card">
        <div class="flash-inner">
          <div class="flash-face front">
            <div class="jp big">${esc(w.jp)}</div>
            <div class="muted">Tap to reveal</div>
          </div>
          <div class="flash-face back">
            <div class="romaji" style="font-size:16px;color:var(--text-tertiary);font-weight:600;">${esc(w.romaji)}</div>
            <div style="font-size:22px;font-weight:700;">${esc(w.en)}</div>
            <div class="jp" style="font-size:14px;color:var(--text-secondary);">${esc(w.ex.jp)}</div>
            <div class="tiny muted">${esc(w.ex.en)}</div>
          </div>
        </div>
      </div>

      <div id="controls" style="margin-top:18px;"></div>
    </div>`;

  const card = root.querySelector('#card');
  card.onclick = () => {
    flipped = !flipped;
    card.classList.toggle('flipped', flipped);
    if (flipped) { speak(w.kana || w.jp); showGrades(root, w); }
  };

  const controls = root.querySelector('#controls');
  if (!flipped) {
    controls.innerHTML = `<div class="center"><button class="btn ghost" id="rev">🔊 Hear it</button></div>`;
    controls.querySelector('#rev').onclick = (e) => { e.stopPropagation(); speak(w.kana || w.jp); };
  } else {
    showGrades(root, w);
  }
}

function showGrades(root, w) {
  const controls = root.querySelector('#controls');
  const c = getCard(w.id);
  const labels = [
    { g: 0, cls: 'srs-again', name: 'Again', when: '<1d' },
    { g: 1, cls: 'srs-hard', name: 'Hard', when: previewDays(c, 1) },
    { g: 2, cls: 'srs-good', name: 'Good', when: previewDays(c, 2) },
    { g: 3, cls: 'srs-easy', name: 'Easy', when: previewDays(c, 3) },
  ];
  controls.innerHTML = `<div class="srs-row">${labels.map(l =>
    `<button class="srs-btn ${l.cls}" data-g="${l.g}">${l.name}<small>${l.when}</small></button>`).join('')}</div>`;
  controls.querySelectorAll('.srs-btn').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      const grade = +b.dataset.g;
      review(w.id, grade);
      if (grade >= 2 && !State.vocabSeen[w.id]) {
        State.vocabSeen[w.id] = true;
        State.stats.wordsLearned = (State.stats.wordsLearned || 0) + 1;
      }
      reviewed++;
      addXp(grade === 0 ? 1 : 4);
      if (grade === 0) queue.push(w.id); // see again later this session
      save(); touchActivity(); checkMissions();
      nextCard(root);
    };
  });
}

function previewDays(c, grade) {
  // rough display of next interval without mutating state
  const reps = (c.reps || 0) + 1;
  let iv;
  if (reps === 1) iv = 1;
  else if (reps === 2) iv = grade === 1 ? 2 : 4;
  else iv = Math.round((c.interval || 1) * (c.ease || 2.5) * (grade === 1 ? 0.7 : 1));
  if (grade === 3) iv = Math.round(iv * 1.3);
  return iv <= 1 ? '1d' : iv < 30 ? iv + 'd' : Math.round(iv / 30) + 'mo';
}

function finish(root) {
  State.stats.lessonsDone = (State.stats.lessonsDone || 0);
  save(); touchActivity();
  root.innerHTML = `
    <div class="fade-in center" style="max-width:460px;margin:40px auto;">
      <div style="font-size:64px;">🎴</div>
      <h1 style="font-size:26px;font-weight:800;margin-top:8px;">Session complete</h1>
      <p class="muted">You reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}. Nicely done.</p>
      <div class="row" style="justify-content:center;gap:12px;margin-top:24px;">
        <button class="btn accent" id="more">Review more</button>
      </div>
    </div>`;
  root.querySelector('#more').onclick = () => render(root);
}

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
