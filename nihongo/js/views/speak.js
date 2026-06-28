// Pronunciation Practice — speak a target phrase, get an accuracy estimate.
// Uses the Web Speech Recognition API (ja-JP) when available; otherwise falls
// back to a self-assessment flow so the feature still works everywhere.
import { ALL_VOCAB } from '../../data/vocab.js';
import { State, save, speak, addXp, touchActivity, el, esc, toast } from '../core.js';
import { checkMissions } from '../missions.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// Curated short, speakable targets.
const TARGETS = [
  { jp: 'こんにちは', r: 'konnichiwa', en: 'Hello' },
  { jp: 'ありがとう', r: 'arigatō', en: 'Thank you' },
  { jp: 'おはようございます', r: 'ohayō gozaimasu', en: 'Good morning' },
  { jp: 'すみません', r: 'sumimasen', en: 'Excuse me' },
  { jp: 'はじめまして', r: 'hajimemashite', en: 'Nice to meet you' },
  { jp: 'いただきます', r: 'itadakimasu', en: 'Before eating' },
  ...ALL_VOCAB.filter(v => v.cat === 'food' || v.cat === 'travel').slice(0, 6)
    .map(v => ({ jp: v.kana, r: v.romaji, en: v.en })),
];

let idx = 0;

export function render(root) {
  const t = TARGETS[idx];
  root.innerHTML = `
    <div class="fade-in" style="max-width:560px;margin:0 auto;">
      <div class="eyebrow">Practice · Pronunciation</div>
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">Pronunciation</h1>
      <p class="muted" style="margin-bottom:20px;">Listen, then say the phrase aloud. ${SR ? "We'll score how close you got." : 'Your browser lacks speech recognition — rate yourself honestly.'}</p>

      <div class="card card-pad center">
        <div class="jp" style="font-size:40px;">${esc(t.jp)}</div>
        <div class="muted" style="margin-top:6px;">${esc(t.r)} — ${esc(t.en)}</div>
        <button class="btn ghost sm" id="listen" style="margin-top:16px;">🔊 Listen</button>

        <div id="mic" style="margin-top:26px;"></div>
        <div id="result" style="margin-top:18px;min-height:24px;"></div>
      </div>

      <div class="row" style="justify-content:space-between;margin-top:22px;">
        <button class="btn ghost" id="prev">← Previous</button>
        <span class="chip">${idx + 1} / ${TARGETS.length}</span>
        <button class="btn accent" id="next">Next →</button>
      </div>
    </div>`;

  root.querySelector('#listen').onclick = () => speak(t.jp);
  root.querySelector('#prev').onclick = () => { idx = (idx - 1 + TARGETS.length) % TARGETS.length; render(root); };
  root.querySelector('#next').onclick = () => { idx = (idx + 1) % TARGETS.length; render(root); };

  if (SR) setupRecognition(root, t); else setupSelfRate(root, t);
}

function recordRep() {
  State.stats.speakReps = (State.stats.speakReps || 0) + 1;
  addXp(4); save(); touchActivity(); checkMissions();
}

function setupRecognition(root, t) {
  const mic = root.querySelector('#mic');
  const result = root.querySelector('#result');
  const btn = el(`<button class="btn accent lg" id="rec">🎙️ Tap & speak</button>`);
  mic.appendChild(btn);

  btn.onclick = () => {
    const rec = new SR();
    rec.lang = 'ja-JP'; rec.interimResults = false; rec.maxAlternatives = 3;
    btn.textContent = '● Listening…'; btn.disabled = true;
    result.innerHTML = '';
    rec.onresult = (e) => {
      const alts = [...e.results[0]].map(a => a.transcript);
      const score = bestScore(t.jp, t.r, alts);
      showScore(result, score, alts[0]);
      recordRep();
    };
    rec.onerror = () => { result.innerHTML = `<span class="muted">Didn't catch that — try again.</span>`; };
    rec.onend = () => { btn.textContent = '🎙️ Tap & speak'; btn.disabled = false; };
    try { rec.start(); } catch { btn.textContent = '🎙️ Tap & speak'; btn.disabled = false; }
  };
}

function setupSelfRate(root, t) {
  const mic = root.querySelector('#mic');
  mic.innerHTML = `<p class="muted tiny" style="margin-bottom:10px;">After saying it aloud, rate yourself:</p>`;
  const row = el(`<div class="row" style="gap:8px;justify-content:center;"></div>`);
  [['Again', '#ef5350'], ['Okay', '#f0a23e'], ['Good', '#2fae71']].forEach(([label, c], i) => {
    const b = el(`<button class="btn" style="background:${c}">${label}</button>`);
    b.onclick = () => { showScore(root.querySelector('#result'), [55, 78, 95][i], '(self-rated)'); recordRep(); };
    row.appendChild(b);
  });
  mic.appendChild(row);
}

// Compare recognized Japanese against the target by normalized similarity.
function bestScore(targetJp, targetRomaji, alts) {
  let best = 0;
  for (const a of alts) {
    const s = similarity(strip(a), strip(targetJp));
    if (s > best) best = s;
  }
  return Math.round(40 + best * 60); // floor of 40 so effort is rewarded
}

function strip(s) { return (s || '').replace(/[、。！？\s]/g, ''); }

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const d = levenshtein(a, b);
  return 1 - d / Math.max(a.length, b.length);
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
      dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

function showScore(result, score, heard) {
  const color = score >= 85 ? 'var(--green)' : score >= 65 ? 'var(--gold)' : 'var(--accent)';
  const tip = score >= 85 ? 'Excellent — very natural!' :
              score >= 65 ? 'Good. Keep the rhythm even and steady.' :
              'Keep practicing — listen again and match the pitch.';
  result.innerHTML = `
    <div class="pop">
      <div style="font-size:34px;font-weight:800;color:${color}">${score}%</div>
      <div class="bar ${score >= 85 ? 'green' : ''}" style="max-width:240px;margin:8px auto;"><i style="width:${score}%"></i></div>
      <div class="muted tiny">Heard: <span class="jp">${esc(heard)}</span></div>
      <div style="margin-top:6px;font-weight:600;">${tip}</div>
    </div>`;
}
