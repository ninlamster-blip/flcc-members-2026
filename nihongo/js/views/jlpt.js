// JLPT Prep — level overview + a mixed recognition quiz built from app data.
import { ALL_VOCAB } from '../../data/vocab.js';
import { KANJI } from '../../data/kanji.js';
import { State, save, speak, addXp, touchActivity, el, esc } from '../core.js';
import { checkMissions } from '../missions.js';

const LEVELS = [
  { id: 'N5', color: '#2fae71', kanji: '~100', vocab: '~800', desc: 'Basic everyday phrases & hiragana/katakana.' },
  { id: 'N4', color: '#4f5bd5', kanji: '~300', vocab: '~1,500', desc: 'Everyday conversation at natural speed.' },
  { id: 'N3', color: '#e2a73e', kanji: '~650', vocab: '~3,700', desc: 'Bridge level — understand everyday topics.' },
  { id: 'N2', color: '#e8485f', kanji: '~1,000', vocab: '~6,000', desc: 'Newspapers, business, abstract topics.' },
  { id: 'N1', color: '#7b3fe4', kanji: '~2,000', vocab: '~10,000', desc: 'Near-native comprehension.' },
];
const SKILLS = ['Vocabulary', 'Grammar', 'Kanji', 'Reading', 'Listening'];

export function render(root) {
  root.innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">JLPT Preparation</div>
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">JLPT Prep</h1>
      <p class="muted" style="margin-bottom:20px;">Choose a level to see what it covers and take a quick recognition quiz.</p>

      <div class="grid cols-3" id="levels" style="margin-bottom:28px;"></div>
      <div id="panel"></div>
    </div>`;

  const wrap = root.querySelector('#levels');
  LEVELS.forEach(L => {
    const card = el(`
      <button class="tile" style="border-top:4px solid ${L.color};">
        <div class="spread">
          <div class="t-ico" style="background:${L.color}1a;color:${L.color};font-weight:800;">${L.id}</div>
          <span class="chip" style="background:${L.color}1a;color:${L.color};">Quiz</span>
        </div>
        <div class="t-name">JLPT ${L.id}</div>
        <div class="t-desc">${L.desc}</div>
        <div class="tiny muted">${L.kanji} kanji · ${L.vocab} words</div>
      </button>`);
    card.onclick = () => openLevel(root, L);
    wrap.appendChild(card);
  });

  openLevel(root, LEVELS[0]);
}

function poolFor(level) {
  const vocab = ALL_VOCAB.filter(v => v.level === level)
    .map(v => ({ q: v.jp, reading: v.kana, answer: v.en, choices: 'en' }));
  const kanji = KANJI.filter(k => k.level === level)
    .map(k => ({ q: k.c, reading: k.kun[0] || k.on[0], answer: k.meaning, choices: 'meaning' }));
  return [...vocab, ...kanji];
}

function openLevel(root, L) {
  const panel = root.querySelector('#panel');
  const pool = poolFor(L.id);
  panel.innerHTML = `
    <div class="card card-pad pop">
      <div class="spread" style="margin-bottom:16px;">
        <div>
          <div class="eyebrow" style="color:${L.color}">Level ${L.id}</div>
          <div style="font-size:18px;font-weight:800;">${L.desc}</div>
        </div>
      </div>
      <div class="row wrap" style="gap:8px;margin-bottom:18px;">
        ${SKILLS.map(s => `<span class="chip">${s}</span>`).join('')}
      </div>
      ${pool.length >= 4
        ? `<button class="btn accent" id="startQuiz">Start ${L.id} quiz (${pool.length} items)</button>`
        : `<div class="muted">Practice content for ${L.id} is expanding. Try the <b>N5</b> quiz to build your foundation first.</div>`}
    </div>`;

  const btn = panel.querySelector('#startQuiz');
  if (btn) btn.onclick = () => quiz(root, L, pool);
}

function quiz(root, L, pool) {
  let order = shuffle(pool).slice(0, 8);
  let i = 0, correct = 0;

  function ask() {
    if (i >= order.length) return done();
    const item = order[i];
    const distractPool = pool.filter(p => p.answer !== item.answer);
    const options = shuffle([item, ...shuffle(distractPool).slice(0, 3)]);
    root.innerHTML = `
      <div class="fade-in" style="max-width:540px;margin:0 auto;">
        <div class="spread" style="margin-bottom:18px;">
          <span class="chip" style="background:${L.color}1a;color:${L.color};">${L.id} · ${i + 1}/${order.length}</span>
          <span class="chip green">${correct} correct</span>
        </div>
        <div class="card card-pad center" style="padding:40px 20px;">
          <div class="jp" style="font-size:54px;">${esc(item.q)}</div>
          <button class="btn ghost sm" id="play" style="margin-top:14px;">🔊 ${esc(item.reading || '')}</button>
        </div>
        <p class="center muted" style="margin:18px 0 12px;">What does it mean?</p>
        <div class="grid cols-2" id="opts"></div>
      </div>`;
    root.querySelector('#play').onclick = () => speak(item.reading || item.q);
    const opts = root.querySelector('#opts');
    options.forEach(o => {
      const b = el(`<button class="btn ghost lg" style="text-align:center;">${esc(o.answer)}</button>`);
      b.onclick = () => {
        const ok = o.answer === item.answer;
        b.style.background = ok ? 'var(--green-soft)' : '#fdeaea';
        b.style.color = ok ? 'var(--green)' : '#d33';
        if (ok) { correct++; addXp(4); }
        else [...opts.children].forEach(c => { if (c.textContent === item.answer) {
          c.style.background = 'var(--green-soft)'; c.style.color = 'var(--green)'; } });
        opts.querySelectorAll('button').forEach(x => x.disabled = true);
        setTimeout(() => { i++; ask(); }, 700);
      };
      opts.appendChild(b);
    });
  }

  function done() {
    State.stats.lessonsDone = (State.stats.lessonsDone || 0) + 1;
    save(); touchActivity(); checkMissions();
    const pct = Math.round(correct / order.length * 100);
    root.innerHTML = `
      <div class="fade-in center" style="max-width:460px;margin:40px auto;">
        <div style="font-size:64px;">${pct >= 80 ? '🏆' : '📖'}</div>
        <h1 style="font-size:26px;font-weight:800;">${L.id}: ${pct}%</h1>
        <p class="muted">${correct} of ${order.length} correct.</p>
        <div class="row" style="justify-content:center;gap:12px;margin-top:22px;">
          <button class="btn ghost" id="retry">Try again</button>
          <button class="btn accent" id="back">Back to levels</button>
        </div>
      </div>`;
    root.querySelector('#retry').onclick = () => quiz(root, L, pool);
    root.querySelector('#back').onclick = () => render(root);
  }

  ask();
}

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
