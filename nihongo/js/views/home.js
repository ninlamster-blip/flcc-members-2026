// Home dashboard — greeting, stats, daily missions, feature tiles.
import { State, save, today, level, el } from '../core.js';
import { getMissions, missionProgress } from '../missions.js';

const TILES = [
  { icon: 'あ', route: 'kana?script=hiragana', name: 'Hiragana & Katakana', desc: 'Master the two core syllabaries.' },
  { icon: '📇', route: 'vocab', name: 'Word Cards', desc: 'Vocabulary with audio & examples.' },
  { icon: '🔁', route: 'flash', name: 'Flashcards', desc: 'Spaced repetition review.' },
  { icon: '🧩', route: 'breakdown', name: 'Sentence Breakdown', desc: 'See how sentences fit together.' },
  { icon: '漢', route: 'kanji', name: 'Kanji Explorer', desc: 'Readings, meanings, examples.' },
  { icon: '💬', route: 'chat', name: 'AI Conversation', desc: 'Practice with a patient tutor.' },
  { icon: '🎙️', route: 'speak', name: 'Pronunciation', desc: 'Record & get instant feedback.' },
  { icon: '🎓', route: 'jlpt', name: 'JLPT Prep', desc: 'N5–N1 focused practice.' },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 11) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function render(root, params, nav) {
  const s = State.stats;
  root.innerHTML = `
    <div class="fade-in">
      <div class="hero" style="margin-bottom:22px;">
        <div class="eyebrow">${greeting()} · ${today()}</div>
        <h1>Your Japanese journey<br>continues. <span class="jp">頑張って！</span></h1>
        <p class="lead">A little every day adds up. You're on a
          <b>${State.streak || 0}-day</b> streak — keep the momentum going.</p>
        <button class="btn accent" id="cta" style="margin-top:18px;">Start today's review</button>
      </div>

      <div class="grid cols-4" style="margin-bottom:26px;">
        ${statCard('Words learned', s.wordsLearned || 0)}
        ${statCard('Kanji seen', Object.keys(State.kanjiSeen).length)}
        ${statCard('Lessons done', s.lessonsDone || 0)}
        ${statCard('Level', level(), `${State.xp % 100}/100 XP`)}
      </div>

      <h2 style="font-size:18px;font-weight:800;margin-bottom:12px;">Today's missions</h2>
      <div class="card card-pad" style="margin-bottom:30px;">
        <div id="missions" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>

      <h2 style="font-size:18px;font-weight:800;margin-bottom:12px;">Explore</h2>
      <div class="grid cols-4" id="tiles"></div>
    </div>`;

  // Missions
  const mwrap = root.querySelector('#missions');
  const missions = getMissions();
  missions.forEach(m => {
    const { value, done } = missionProgress(m);
    const row = el(`
      <div class="mission ${done ? 'done' : ''}">
        <div class="tick">${done ? '✓' : ''}</div>
        <div style="flex:1;">
          <div class="m-title">${m.label}</div>
          <div class="m-prog">${Math.min(value, m.goal)} / ${m.goal} ${m.unit}</div>
        </div>
        <div class="chip ${done ? 'green' : ''}">+${m.xp} XP</div>
      </div>`);
    mwrap.appendChild(row);
  });

  // Tiles
  const tw = root.querySelector('#tiles');
  TILES.forEach(t => {
    const tile = el(`
      <button class="tile">
        <div class="t-ico jp">${t.icon}</div>
        <div class="t-name">${t.name}</div>
        <div class="t-desc">${t.desc}</div>
      </button>`);
    tile.onclick = () => nav(t.route);
    tw.appendChild(tile);
  });

  root.querySelector('#cta').onclick = () => nav('flash');
}

function statCard(k, v, sub) {
  return `<div class="card stat-card">
    <div class="k">${k}</div>
    <div class="v">${v}${sub ? ` <small>${sub}</small>` : ''}</div>
  </div>`;
}
