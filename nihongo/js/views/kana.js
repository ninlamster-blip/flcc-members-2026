// Kana lesson view — Hiragana & Katakana, with study grid + quiz.
import { KANA_SETS, flatKana } from '../../data/kana.js';
import { State, save, speak, toast, addXp, touchActivity, el, esc } from '../core.js';

let script = 'hiragana';
let group = 'base';   // base | dakuten | yoon

export function render(root, params) {
  if (params && params.script) script = params.script;
  const set = KANA_SETS[script];
  const learnedCount = flatKana(script).filter(x => State.learnedKana[x.k]).length;
  const total = flatKana(script).length;

  root.innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">${script === 'hiragana' ? 'ひらがな' : 'カタカナ'} · Beginner</div>
      <div class="spread" style="align-items:flex-end; margin-bottom:18px;">
        <div>
          <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">
            ${script === 'hiragana' ? 'Hiragana' : 'Katakana'}</h1>
          <p class="muted">Tap any character to hear it and mark it learned.</p>
        </div>
        <div class="seg" id="scriptSeg">
          <button data-s="hiragana" class="${script === 'hiragana' ? 'on' : ''}">Hiragana</button>
          <button data-s="katakana" class="${script === 'katakana' ? 'on' : ''}">Katakana</button>
        </div>
      </div>

      <div class="card card-pad" style="margin-bottom:18px;">
        <div class="spread" style="margin-bottom:6px;">
          <span class="tiny muted">Progress</span>
          <span class="tiny muted"><b id="kCount">${learnedCount}</b> / ${total} learned</span>
        </div>
        <div class="bar green"><i id="kBar" style="width:${(learnedCount / total * 100).toFixed(1)}%"></i></div>
      </div>

      <div class="seg" id="groupSeg" style="margin-bottom:16px;">
        <button data-g="base" class="${group === 'base' ? 'on' : ''}">Basic · 46</button>
        <button data-g="dakuten" class="${group === 'dakuten' ? 'on' : ''}">Dakuten · 25</button>
        <button data-g="yoon" class="${group === 'yoon' ? 'on' : ''}">Combos · 33</button>
      </div>

      <div class="kana-grid" id="kanaGrid"></div>

      <div class="row" style="justify-content:center; gap:12px; margin-top:28px;">
        <button class="btn ghost" id="markAll">Mark group learned</button>
        <button class="btn accent" id="startQuiz">Start quiz →</button>
      </div>
    </div>`;

  const grid = root.querySelector('#kanaGrid');
  function drawGrid() {
    grid.innerHTML = '';
    const cols = group === 'yoon' ? 3 : 5;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    for (const item of set[group]) {
      if (!item) { grid.appendChild(el('<div class="kana-cell empty"></div>')); continue; }
      const learned = !!State.learnedKana[item.k];
      const cell = el(`
        <button class="kana-cell ${learned ? 'learned' : ''}">
          <span class="k-char jp">${item.k}</span>
          <span class="k-romaji">${item.r}</span>
        </button>`);
      cell.onclick = () => {
        speak(item.k);
        cell.classList.add('pop');
        setTimeout(() => cell.classList.remove('pop'), 300);
        if (!State.learnedKana[item.k]) {
          State.learnedKana[item.k] = true;
          cell.classList.add('learned');
          addXp(2); save(); touchActivity();
          updateProgress();
        }
      };
      grid.appendChild(cell);
    }
  }

  function updateProgress() {
    const lc = flatKana(script).filter(x => State.learnedKana[x.k]).length;
    root.querySelector('#kCount').textContent = lc;
    root.querySelector('#kBar').style.width = (lc / total * 100).toFixed(1) + '%';
  }

  root.querySelector('#scriptSeg').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    script = b.dataset.s; group = 'base';
    render(root, { script });
  };
  root.querySelector('#groupSeg').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    group = b.dataset.g;
    root.querySelectorAll('#groupSeg button').forEach(x => x.classList.toggle('on', x === b));
    drawGrid();
  };
  root.querySelector('#markAll').onclick = () => {
    set[group].filter(Boolean).forEach(x => { State.learnedKana[x.k] = true; });
    save(); touchActivity(); drawGrid(); updateProgress();
    toast('Group marked as learned');
  };
  root.querySelector('#startQuiz').onclick = () => startQuiz(root);

  drawGrid();
}

// ---- Quiz ----------------------------------------------------------------
function startQuiz(root) {
  const pool = flatKana(script);
  let order = shuffle([...pool]).slice(0, 12);
  let i = 0, correct = 0;

  function question() {
    if (i >= order.length) return finish();
    const q = order[i];
    const options = shuffle([q, ...shuffle(pool.filter(x => x.r !== q.r)).slice(0, 3)]);
    root.innerHTML = `
      <div class="fade-in" style="max-width:520px;margin:0 auto;">
        <div class="spread" style="margin-bottom:20px;">
          <span class="chip">Question ${i + 1} / ${order.length}</span>
          <span class="chip green">${correct} correct</span>
        </div>
        <div class="card card-pad center" style="padding:48px 20px;">
          <div class="jp" style="font-size:84px;line-height:1;">${q.k}</div>
          <button class="btn ghost sm" id="qPlay" style="margin-top:18px;">🔊 Play sound</button>
        </div>
        <p class="center muted" style="margin:20px 0 14px;">Which rōmaji is this?</p>
        <div class="grid cols-2" id="opts"></div>
      </div>`;
    root.querySelector('#qPlay').onclick = () => speak(q.k);
    speak(q.k);
    const opts = root.querySelector('#opts');
    options.forEach(o => {
      const b = el(`<button class="btn ghost lg">${o.r}</button>`);
      b.onclick = () => {
        if (o.r === q.r) {
          b.style.background = 'var(--green-soft)'; b.style.color = 'var(--green)';
          correct++; addXp(3);
        } else {
          b.style.background = '#fdeaea'; b.style.color = '#d33';
          [...opts.children].forEach(c => { if (c.textContent === q.r) {
            c.style.background = 'var(--green-soft)'; c.style.color = 'var(--green)'; } });
        }
        opts.querySelectorAll('button').forEach(x => x.disabled = true);
        State.learnedKana[q.k] = true; save();
        setTimeout(() => { i++; question(); }, 750);
      };
      opts.appendChild(b);
    });
  }

  function finish() {
    touchActivity();
    State.stats.lessonsDone = (State.stats.lessonsDone || 0) + 1; save();
    const pct = Math.round(correct / order.length * 100);
    root.innerHTML = `
      <div class="fade-in center" style="max-width:460px;margin:40px auto;">
        <div style="font-size:64px;">${pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</div>
        <h1 style="font-size:26px;font-weight:800;margin-top:8px;">${pct}% correct</h1>
        <p class="muted">You answered ${correct} of ${order.length} correctly.</p>
        <div class="row" style="justify-content:center;gap:12px;margin-top:24px;">
          <button class="btn ghost" id="again">Try again</button>
          <button class="btn accent" id="back">Back to chart</button>
        </div>
      </div>`;
    root.querySelector('#again').onclick = () => startQuiz(root);
    root.querySelector('#back').onclick = () => render(root, { script });
  }

  question();
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
