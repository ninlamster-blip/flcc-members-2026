// Kanji Explorer — browse kanji, view readings/meanings/examples, hear audio.
import { KANJI } from '../../data/kanji.js';
import { State, save, speak, addXp, touchActivity, el, esc } from '../core.js';

let selected = 0;

export function render(root) {
  root.innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">Kanji Explorer</div>
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">Kanji Explorer</h1>
      <p class="muted" style="margin-bottom:20px;">Tap a kanji to see its readings, meaning, and common words.</p>

      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:10px;margin-bottom:26px;" id="kgrid"></div>

      <div id="detail"></div>
    </div>`;

  const grid = root.querySelector('#kgrid');
  KANJI.forEach((k, i) => {
    const seen = State.kanjiSeen[k.c];
    const cell = el(`<button class="kana-cell ${seen ? 'learned' : ''}" style="aspect-ratio:1;">
      <span class="k-char jp" style="font-size:32px;">${k.c}</span></button>`);
    cell.onclick = () => { selected = i; openDetail(root); markSeen(k); };
    grid.appendChild(cell);
  });

  openDetail(root);
}

function markSeen(k) {
  if (!State.kanjiSeen[k.c]) {
    State.kanjiSeen[k.c] = true;
    addXp(3); save(); touchActivity();
  }
}

function openDetail(root) {
  const k = KANJI[selected];
  const detail = root.querySelector('#detail');
  detail.innerHTML = `
    <div class="card card-pad pop">
      <div class="grid cols-2" style="gap:28px;align-items:start;">
        <div class="center">
          <div class="kanji-hero jp" id="hero">${k.c}</div>
          <div class="row" style="justify-content:center;gap:8px;margin-top:14px;">
            <button class="btn ghost sm" id="say">🔊 Readings</button>
            <button class="btn ghost sm" id="trace">✎ Trace it</button>
          </div>
          <div class="tiny muted" style="margin-top:10px;">${k.strokes} strokes · ${k.level}</div>
        </div>
        <div>
          <div class="eyebrow" style="margin-bottom:4px;">Meaning</div>
          <div style="font-size:20px;font-weight:700;margin-bottom:16px;">${esc(k.meaning)}</div>

          <div class="row" style="gap:24px;margin-bottom:16px;">
            <div>
              <div class="eyebrow" style="margin-bottom:4px;">On'yomi</div>
              <div class="jp">${k.on.length ? k.on.join('、') : '—'}</div>
            </div>
            <div>
              <div class="eyebrow" style="margin-bottom:4px;">Kun'yomi</div>
              <div class="jp">${k.kun.length ? k.kun.join('、') : '—'}</div>
            </div>
          </div>

          <div class="eyebrow" style="margin-bottom:8px;">Common words</div>
          <div id="examples" style="display:flex;flex-direction:column;gap:8px;"></div>
        </div>
      </div>
    </div>`;

  const ex = detail.querySelector('#examples');
  k.examples.forEach(e => {
    const row = el(`<button class="mission" style="cursor:pointer;">
      <div class="jp" style="font-size:20px;min-width:90px;">${esc(e.w)}</div>
      <div style="flex:1;">
        <div class="tiny muted jp">${esc(e.r)}</div>
        <div style="font-weight:600;">${esc(e.m)}</div>
      </div>
      <span>🔊</span></button>`);
    row.onclick = () => speak(e.r);
    ex.appendChild(row);
  });

  detail.querySelector('#say').onclick = () => {
    const reading = (k.kun[0] || k.on[0] || k.c).replace(/\..*$/, '');
    speak(reading);
  };
  detail.querySelector('#trace').onclick = () => animateTrace(detail.querySelector('#hero'));
}

// A simple "draw-in" demonstration: the glyph wipes in to suggest writing motion.
function animateTrace(hero) {
  hero.style.transition = 'none';
  hero.style.clipPath = 'inset(0 100% 0 0)';
  hero.style.opacity = '1';
  // force reflow
  void hero.offsetWidth;
  hero.style.transition = 'clip-path 1.1s cubic-bezier(.4,0,.2,1)';
  hero.style.clipPath = 'inset(0 0 0 0)';
}
