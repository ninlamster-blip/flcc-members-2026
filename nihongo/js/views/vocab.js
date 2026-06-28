// Word Cards — browse vocabulary by category, hear audio, favorite items.
import { CATEGORIES, VOCAB, ALL_VOCAB } from '../../data/vocab.js';
import { State, save, speak, toast, addXp, touchActivity, el, esc, ICON } from '../core.js';
import { checkMissions } from '../missions.js';

let activeCat = 'greetings';
let favsOnly = false;

export function render(root, params, nav) {
  if (params && params.cat) activeCat = params.cat;

  root.innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">Vocabulary</div>
      <div class="spread" style="align-items:flex-end;margin-bottom:18px;">
        <div>
          <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">Word Cards</h1>
          <p class="muted">Tap 🔊 to hear native-style audio. Star words to review later.</p>
        </div>
        <button class="btn ghost sm" id="favToggle">${favsOnly ? '★ Showing favorites' : '☆ Favorites only'}</button>
      </div>

      <div class="row wrap" id="catRow" style="gap:8px;margin-bottom:22px;"></div>
      <div class="grid cols-3" id="cards"></div>
    </div>`;

  const catRow = root.querySelector('#catRow');
  CATEGORIES.forEach(c => {
    const count = VOCAB[c.id].length;
    const chip = el(`<button class="chip ${c.id === activeCat ? 'accent' : ''}" data-cat="${c.id}">
      <span class="jp">${c.icon}</span> ${c.name} <span class="muted">${count}</span></button>`);
    chip.onclick = () => { activeCat = c.id; favsOnly = false; render(root, { cat: c.id }, nav); };
    catRow.appendChild(chip);
  });

  root.querySelector('#favToggle').onclick = () => { favsOnly = !favsOnly; render(root, {}, nav); };

  drawCards(root.querySelector('#cards'));
}

function drawCards(wrap) {
  const items = favsOnly
    ? ALL_VOCAB.filter(v => State.favorites[v.id])
    : VOCAB[activeCat];

  if (!items.length) {
    wrap.outerHTML = `<div class="empty-state"><div class="big">☆</div>
      No favorites yet. Tap the heart on any card to save it.</div>`;
    return;
  }

  wrap.innerHTML = '';
  items.forEach(w => {
    const fav = !!State.favorites[w.id];
    const card = el(`
      <div class="word-card">
        <div class="card-actions">
          <button class="icon-btn fav-btn ${fav ? 'on' : ''}" title="Favorite">${ICON.heart(fav)}</button>
          <button class="icon-btn play-btn" title="Play">${ICON.play}</button>
        </div>
        <div class="jp jp-main">${esc(w.jp)}</div>
        <div class="romaji">${esc(w.romaji)} · <span class="jp">${esc(w.kana)}</span></div>
        <div class="en">${esc(w.en)}</div>
        <div class="row" style="gap:8px;margin-top:2px;">
          <span class="chip tiny">${w.level}</span>
          <span class="stars">${'★'.repeat(w.difficulty)}${'☆'.repeat(3 - w.difficulty)}</span>
        </div>
        <div class="ex">
          <div class="jp ex-jp">${esc(w.ex.jp)}</div>
          <div class="tiny muted" style="margin-top:2px;">${esc(w.ex.romaji)}</div>
          <div class="tiny" style="margin-top:2px;">${esc(w.ex.en)}</div>
        </div>
      </div>`);

    card.querySelector('.play-btn').onclick = () => {
      speak(w.kana || w.jp);
      if (!State.vocabSeen[w.id]) {
        State.vocabSeen[w.id] = true;
        State.stats.wordsLearned = (State.stats.wordsLearned || 0) + 1;
        addXp(2); save(); touchActivity(); checkMissions();
      }
    };
    const exBtn = el(`<button class="icon-btn play-btn" title="Play example">🔊 example</button>`);
    exBtn.style.width = 'auto'; exBtn.style.padding = '4px 12px'; exBtn.style.fontSize = '12px';
    exBtn.style.marginTop = '8px'; exBtn.style.alignSelf = 'flex-start';
    exBtn.onclick = () => speak(w.ex.jp);
    card.querySelector('.ex').appendChild(exBtn);

    const favBtn = card.querySelector('.fav-btn');
    favBtn.onclick = () => {
      const now = !State.favorites[w.id];
      if (now) State.favorites[w.id] = true; else delete State.favorites[w.id];
      save();
      favBtn.classList.toggle('on', now);
      favBtn.innerHTML = ICON.heart(now);
      toast(now ? 'Added to favorites ★' : 'Removed from favorites');
    };

    wrap.appendChild(card);
  });
}
