// Progress dashboard — stats, level, streak, achievements, data reset.
import { State, save, level, resetProgress, toast, el } from '../core.js';
import { ACHIEVEMENTS, evaluateAchievements } from '../achievements.js';
import { flatKana } from '../../data/kana.js';
import { ALL_VOCAB } from '../../data/vocab.js';
import { KANJI } from '../../data/kanji.js';

export function render(root, params, nav) {
  evaluateAchievements();

  const kanaLearned = Object.keys(State.learnedKana).length;
  const kanaTotal = flatKana('hiragana').length + flatKana('katakana').length;
  const words = State.stats.wordsLearned || 0;
  const kanjiSeen = Object.keys(State.kanjiSeen).length;
  const xpInLevel = State.xp % 100;
  const earned = Object.keys(State.achievements).length;

  root.innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">Your Progress</div>
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">Progress</h1>
      <p class="muted" style="margin-bottom:22px;">Everything you've learned, saved on this device.</p>

      <div class="card card-pad" style="margin-bottom:22px;background:radial-gradient(120% 160% at 0% 0%, #fff1f3, #fff);">
        <div class="spread wrap" style="gap:18px;">
          <div>
            <div class="eyebrow">Level</div>
            <div style="font-size:40px;font-weight:800;letter-spacing:-1px;">Lv. ${level()}</div>
            <div class="bar" style="width:200px;margin-top:8px;"><i style="width:${xpInLevel}%"></i></div>
            <div class="tiny muted" style="margin-top:4px;">${xpInLevel} / 100 XP to next level · ${State.xp} total</div>
          </div>
          <div class="center">
            <div style="font-size:40px;">🔥</div>
            <div style="font-size:24px;font-weight:800;">${State.streak || 0}</div>
            <div class="tiny muted">day streak</div>
          </div>
        </div>
      </div>

      <div class="grid cols-4" style="margin-bottom:28px;">
        ${prog('Kana learned', kanaLearned, kanaTotal)}
        ${prog('Words learned', words, ALL_VOCAB.length)}
        ${prog('Kanji explored', kanjiSeen, KANJI.length)}
        ${prog('Sentences read', State.stats.sentencesRead || 0, 8)}
      </div>

      <div class="spread" style="margin-bottom:12px;">
        <h2 style="font-size:18px;font-weight:800;">Achievements</h2>
        <span class="chip accent">${earned} / ${ACHIEVEMENTS.length}</span>
      </div>
      <div class="grid cols-3" id="ach" style="margin-bottom:30px;"></div>

      <div class="card card-pad spread wrap" style="gap:12px;">
        <div>
          <div style="font-weight:700;">Reset progress</div>
          <div class="tiny muted">Clears all learning data on this device. This can't be undone.</div>
        </div>
        <button class="btn ghost" id="reset">Reset</button>
      </div>
    </div>`;

  const achWrap = root.querySelector('#ach');
  ACHIEVEMENTS.forEach(a => {
    const got = !!State.achievements[a.id];
    const card = el(`
      <div class="card card-pad" style="display:flex;gap:14px;align-items:center;${got ? '' : 'opacity:.5;'}">
        <div class="t-ico jp" style="background:${got ? 'var(--accent-soft)' : 'var(--bg-sunken)'};
          ${got ? '' : 'filter:grayscale(1);'}">${a.icon}</div>
        <div>
          <div style="font-weight:700;">${a.name} ${got ? '✓' : '🔒'}</div>
          <div class="tiny muted">${a.desc}</div>
        </div>
      </div>`);
    achWrap.appendChild(card);
  });

  root.querySelector('#reset').onclick = () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      resetProgress();
      toast('Progress reset');
      render(root, params, nav);
    }
  };
}

function prog(label, v, total) {
  const pct = total ? Math.min(100, Math.round(v / total * 100)) : 0;
  return `<div class="card stat-card">
    <div class="k">${label}</div>
    <div class="v">${v}<small> / ${total}</small></div>
    <div class="bar green" style="margin-top:10px;"><i style="width:${pct}%"></i></div>
  </div>`;
}
