// Sentence Breakdown — pick a sentence and see each token's role + meaning.
import { SENTENCES } from '../../data/sentences.js';
import { State, save, speak, addXp, touchActivity, el, esc } from '../core.js';
import { checkMissions } from '../missions.js';

let idx = 0;

export function render(root) {
  root.innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">Grammar · Sentence Breakdown</div>
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">Sentence Breakdown</h1>
      <p class="muted" style="margin-bottom:18px;">See how a Japanese sentence is built, piece by piece. Tap any token to hear it.</p>

      <div class="row wrap" id="picker" style="gap:8px;margin-bottom:22px;"></div>
      <div id="stage"></div>
    </div>`;

  const picker = root.querySelector('#picker');
  SENTENCES.forEach((s, i) => {
    const chip = el(`<button class="chip ${i === idx ? 'accent' : ''}">${esc(s.en)}</button>`);
    chip.onclick = () => { idx = i; render(root); };
    picker.appendChild(chip);
  });

  drawStage(root.querySelector('#stage'), root);
}

function drawStage(stage, root) {
  const s = SENTENCES[idx];
  stage.innerHTML = `
    <div class="card card-pad" style="margin-bottom:18px;">
      <div class="spread">
        <div>
          <div class="jp" style="font-size:30px;">${esc(s.jp)}</div>
          <div class="muted" style="margin-top:4px;">${esc(s.romaji)}</div>
          <div style="margin-top:6px;font-weight:600;">${esc(s.en)}</div>
        </div>
        <div style="text-align:right;">
          <span class="chip">${s.level}</span>
          <button class="btn ghost sm" id="playFull" style="margin-top:10px;display:block;">🔊 Play</button>
        </div>
      </div>
    </div>

    <p class="tiny muted" style="margin:0 0 10px;">Word by word</p>
    <div class="row wrap" id="tokens" style="gap:10px;align-items:stretch;"></div>

    <div class="card card-pad" style="margin-top:20px;background:var(--indigo-soft);border-color:#dfe3ff;">
      <div class="row" style="gap:10px;align-items:flex-start;">
        <span style="font-size:18px;">💡</span>
        <div><b>Grammar note.</b> ${esc(s.note)}</div>
      </div>
    </div>

    <div class="row" style="justify-content:space-between;margin-top:24px;">
      <button class="btn ghost" id="prev">← Previous</button>
      <button class="btn accent" id="next">Next sentence →</button>
    </div>`;

  stage.querySelector('#playFull').onclick = () => {
    speak(s.jp);
    State.stats.sentencesRead = (State.stats.sentencesRead || 0) + 1;
    addXp(3); save(); touchActivity(); checkMissions();
  };

  const toks = stage.querySelector('#tokens');
  s.tokens.forEach(t => {
    const tk = el(`
      <button class="token">
        <span class="t-surface jp">${esc(t.s)}</span>
        <span class="t-role">${esc(t.role)}</span>
        <span class="t-mean">${esc(t.mean)}</span>
        <span class="tiny muted">${esc(t.r)}</span>
      </button>`);
    tk.onclick = () => speak(t.s);
    toks.appendChild(tk);
  });

  stage.querySelector('#prev').onclick = () => { idx = (idx - 1 + SENTENCES.length) % SENTENCES.length; render(root); };
  stage.querySelector('#next').onclick = () => { idx = (idx + 1) % SENTENCES.length; render(root); };
}
