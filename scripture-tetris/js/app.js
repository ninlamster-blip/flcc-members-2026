import { Game } from './engine.js';
import { BoardRenderer, renderMini } from './ui.js';
import { AudioEngine } from './audio.js';
import { VerseEngine, generateDevotional } from './verses.js';
import { loadStats, saveStats, loadSettings, saveSettings, favoriteCategory } from './storage.js';
import { ACHIEVEMENTS, checkAchievements } from './achievements.js';
import { todaysChallenge, evaluateProgress } from './dailyChallenge.js';

const $ = (id) => document.getElementById(id);
const todayKey = () => new Date().toISOString().slice(0, 10);

const boardCanvas = $('canvas-board');
const renderer = new BoardRenderer(boardCanvas);
const audio = new AudioEngine();

let stats = loadStats();
let settings = loadSettings();
let verseEngine = null;
let game = null;
let challenge = null;
let session = null;
let running = false;
let lastTime = 0;
let toastTimers = {};

// ---------------- settings ----------------
function applySettings() {
  const root = document.getElementById('st-root');
  root.classList.toggle('st-high-contrast', settings.highContrast);
  root.classList.toggle('st-large-text', settings.largeText);
  root.classList.toggle('st-reduced-motion', settings.reducedMotion);
  renderer.colorBlind = settings.colorBlind;
  renderer.highContrast = settings.highContrast;
  $('set-contrast').checked = settings.highContrast;
  $('set-colorblind').checked = settings.colorBlind;
  $('set-motion').checked = settings.reducedMotion;
  $('set-largetext').checked = settings.largeText;
  $('set-music').checked = audio.musicOn;
  $('set-sound').checked = !audio.muted;
  $('btn-mute').textContent = audio.muted ? '🔇' : '🔊';
}

function newSession() {
  session = {
    linesThisSession: 0,
    tetrisThisSession: 0,
    tSpinThisSession: 0,
    highestLevel: 1,
    streakCounter: 0,
    startedAt: performance.now(),
  };
}

// ---------------- toasts ----------------
function showToast(el, ms) {
  clearTimeout(toastTimers[el.id]);
  el.hidden = false;
  el.style.animation = 'none';
  // force reflow to restart the fade-in animation each time
  void el.offsetWidth;
  el.style.animation = '';
  toastTimers[el.id] = setTimeout(() => { el.hidden = true; }, ms);
}

function recordVerseViewed(verse) {
  stats.versesViewed += 1;
  stats.categoryCounts[verse.category] = (stats.categoryCounts[verse.category] || 0) + 1;
  saveStats(stats);
}

function showVerseToast(verse) {
  $('verse-toast-text').textContent = `"${verse.text}"`;
  $('verse-toast-ref').textContent = verse.reference;
  showToast($('verse-toast'), 2800);
  recordVerseViewed(verse);
}

function showCelebration(clearedCount, verse) {
  $('celebration-headline').textContent = `🔥 ${verseEngine.bigClearHeadline(clearedCount)}`;
  $('celebration-verse').textContent = `"${verse.text}"`;
  $('celebration-ref').textContent = verse.reference;
  showToast($('celebration'), 2600);
  recordVerseViewed(verse);
  audio.celebration();
  renderer.spawnLineClearParticles([0, 1, 2, 3]); // extra confetti burst
}

function showStreakToast(msg) {
  $('streak-toast-text').textContent = msg;
  showToast($('streak-toast'), 2400);
}

const achievementQueue = [];
let achievementShowing = false;
function queueAchievements(list) {
  achievementQueue.push(...list);
  if (!achievementShowing) drainAchievementQueue();
}
function drainAchievementQueue() {
  if (!achievementQueue.length) { achievementShowing = false; return; }
  achievementShowing = true;
  const a = achievementQueue.shift();
  $('achievement-icon').textContent = a.icon;
  $('achievement-title').textContent = a.title;
  $('achievement-desc').textContent = a.desc;
  const el = $('achievement-toast');
  el.hidden = false;
  audio.achievement();
  clearTimeout(toastTimers[el.id]);
  toastTimers[el.id] = setTimeout(() => {
    el.hidden = true;
    setTimeout(drainAchievementQueue, 400);
  }, 2600);
}

function applyAchievementUnlocks() {
  const fresh = checkAchievements(stats);
  if (fresh.length) {
    stats.unlockedAchievements = [...(stats.unlockedAchievements || []), ...fresh.map((a) => a.id)];
    saveStats(stats);
    queueAchievements(fresh);
  }
}

// ---------------- daily challenge ----------------
function updateChallengeUI() {
  const progress = evaluateProgress(challenge, session);
  $('challenge-label').textContent = `${challenge.label} — ${Math.min(progress.value, challenge.goal)}/${challenge.goal}`;
  $('challenge-progress').style.width = `${Math.min(100, (progress.value / challenge.goal) * 100)}%`;
  if (progress.done && !(stats.dailyChallenge && stats.dailyChallenge.day === challenge.day && stats.dailyChallenge.done)) {
    stats.dailyChallenge = { day: challenge.day, goal: challenge.goal, done: true };
    saveStats(stats);
    const verse = verseEngine.random('Victory');
    showCelebration(4, verse);
  }
}

// ---------------- game event handling ----------------
function onGameEvent(evt) {
  if (evt.type === 'rotate') { audio.rotate(); return; }
  if (evt.type === 'hold') { audio.hold(); renderMini($('canvas-hold'), game.hold, { colorBlind: settings.colorBlind }); return; }
  if (evt.type === 'levelUp') {
    session.highestLevel = Math.max(session.highestLevel, evt.level);
    stats.highestLevelEver = Math.max(stats.highestLevelEver, evt.level);
    audio.levelUp();
    saveStats(stats);
    applyAchievementUnlocks();
    return;
  }
  if (evt.type === 'lock') {
    audio.lock();
    if (evt.clearedCount > 0) {
      audio.lineClear(evt.clearedCount);
      session.linesThisSession += evt.clearedCount;
      stats.totalLinesCleared += evt.clearedCount;
      if (evt.clearedCount === 4) { session.tetrisThisSession += 1; stats.tetrisCount += 1; }
      if (evt.tSpin) { session.tSpinThisSession += 1; stats.tSpinCount += 1; }
      stats.highestScore = Math.max(stats.highestScore, evt.score);
      saveStats(stats);

      // Big clears get the full-screen celebration (which already carries the
      // verse); smaller ones get the quiet top toast. Showing both at once
      // would stack duplicate text on screen.
      const verse = evt.tSpin ? verseEngine.forTSpin() : verseEngine.forLineClear(evt.clearedCount);
      if (evt.clearedCount >= 2) showCelebration(evt.clearedCount, verse);
      else showVerseToast(verse);

      session.streakCounter += evt.clearedCount;
      if (Math.floor(stats.totalLinesCleared / 5) > Math.floor((stats.totalLinesCleared - evt.clearedCount) / 5)) {
        showStreakToast(verseEngine.streakMessage());
      }
      applyAchievementUnlocks();
      updateChallengeUI();
    }
    updateHud(evt);
    return;
  }
  if (evt.type === 'gameOver') {
    onGameOver(evt);
  }
}

function updateHud(evt) {
  $('hud-score').textContent = (evt.score ?? game.score).toLocaleString();
  $('hud-level').textContent = evt.level ?? game.level;
  $('hud-lines').textContent = evt.lines ?? game.lines;
  const comboRow = $('hud-combo-row');
  if (game.combo > 0) {
    comboRow.hidden = false;
    $('hud-combo').textContent = game.combo + 1;
  } else {
    comboRow.hidden = true;
  }
}

function onGameOver(evt) {
  running = false;
  audio.gameOver();
  const elapsed = performance.now() - session.startedAt;
  stats.gamesPlayed += 1;
  stats.totalPlayTimeMs += elapsed;
  stats.longestSurvivalMs = Math.max(stats.longestSurvivalMs, elapsed);
  stats.highestScore = Math.max(stats.highestScore, evt.score);
  saveStats(stats);
  applyAchievementUnlocks();

  const verse = verseEngine.gameOverVerse();
  $('gameover-verse').textContent = `"${verse.text}"`;
  $('gameover-ref').textContent = verse.reference;
  $('gameover-score').textContent = evt.score.toLocaleString();
  $('gameover-lines').textContent = evt.lines;
  $('gameover-level').textContent = evt.level;
  $('overlay-gameover').hidden = false;
}

// ---------------- game loop ----------------
function loop(t) {
  if (!lastTime) lastTime = t;
  const dt = Math.min(50, t - lastTime);
  lastTime = t;
  if (running && game && !game.paused && !game.gameOver) {
    game.tick(dt);
  }
  if (game) renderer.render(game);
  requestAnimationFrame(loop);
}

function refreshNextPreviews() {
  const preview = game.nextPreview;
  for (let i = 0; i < 5; i++) {
    renderMini($(`canvas-next-${i}`), preview[i], { colorBlind: settings.colorBlind });
  }
  renderMini($('canvas-hold'), game.hold, { colorBlind: settings.colorBlind });
}

// ---------------- starting / restarting ----------------
function startGame() {
  audio.resume();
  audio.startMusic();
  game = new Game({ onEvent: onGameEvent });
  newSession();
  if (stats.lastDailyPlayDay !== todayKey()) {
    stats.dailyStreakDays = (stats.dailyStreakDays || 0) + 1;
    stats.lastDailyPlayDay = todayKey();
    saveStats(stats);
    applyAchievementUnlocks();
  }
  updateChallengeUI();
  updateHud({ score: 0, level: 1, lines: 0 });
  refreshNextPreviews();
  $('overlay-start').hidden = true;
  $('overlay-gameover').hidden = true;
  $('overlay-pause').hidden = true;
  running = true;
  lastTime = 0;
}

// ---------------- input ----------------
const REPEAT_DELAY = 160;
const REPEAT_RATE = 45;
const heldKeys = {};

function handleAction(action) {
  if (!game || game.gameOver) return;
  if (game.paused && action !== 'pause') return;
  switch (action) {
    case 'left': if (game.move(-1)) audio.move(); break;
    case 'right': if (game.move(1)) audio.move(); break;
    case 'softdrop': game.softDrop(); break;
    case 'harddrop': audio.hardDrop(); game.hardDrop(); refreshNextPreviews(); break;
    case 'rotateCW': game.rotate(1); break;
    case 'rotateCCW': game.rotate(-1); break;
    case 'hold': game.hold_(); refreshNextPreviews(); break;
    case 'pause': togglePause(); break;
    default: break;
  }
}

function togglePause() {
  if (!game || game.gameOver) return;
  game.togglePause();
  $('overlay-pause').hidden = !game.paused;
}

function startRepeat(action) {
  if (heldKeys[action]) return;
  handleAction(action);
  const timeout = setTimeout(() => {
    heldKeys[action].interval = setInterval(() => handleAction(action), REPEAT_RATE);
  }, REPEAT_DELAY);
  heldKeys[action] = { timeout };
}
function stopRepeat(action) {
  const h = heldKeys[action];
  if (!h) return;
  clearTimeout(h.timeout);
  if (h.interval) clearInterval(h.interval);
  delete heldKeys[action];
}

const KEY_MAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'softdrop',
  ArrowUp: 'rotateCW', KeyX: 'rotateCW', KeyZ: 'rotateCCW', ControlLeft: 'rotateCCW',
  Space: 'harddrop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
  KeyP: 'pause', Escape: 'pause',
};
const REPEATABLE = new Set(['left', 'right', 'softdrop']);

window.addEventListener('keydown', (e) => {
  const action = KEY_MAP[e.code];
  if (!action) return;
  e.preventDefault();
  if (e.repeat) return;
  if (REPEATABLE.has(action)) startRepeat(action); else handleAction(action);
});
window.addEventListener('keyup', (e) => {
  const action = KEY_MAP[e.code];
  if (action && REPEATABLE.has(action)) stopRepeat(action);
});

function wireTouch(id, action, repeatable) {
  const el = $(id);
  const start = (e) => { e.preventDefault(); audio.resume(); if (repeatable) startRepeat(action); else handleAction(action); };
  const end = (e) => { e.preventDefault(); if (repeatable) stopRepeat(action); };
  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end, { passive: false });
  el.addEventListener('touchcancel', end, { passive: false });
  el.addEventListener('mousedown', start);
  window.addEventListener('mouseup', end);
}
wireTouch('tc-left', 'left', true);
wireTouch('tc-right', 'right', true);
wireTouch('tc-softdrop', 'softdrop', true);
wireTouch('tc-rotate', 'rotateCW', false);
wireTouch('tc-hold', 'hold', false);
wireTouch('tc-harddrop', 'harddrop', false);

// ---------------- modal & button wiring ----------------
function openModal(id) { $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; }
document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

$('btn-start').addEventListener('click', startGame);
$('btn-play-again').addEventListener('click', startGame);
$('btn-restart').addEventListener('click', startGame);
$('btn-restart-from-pause').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', togglePause);
$('btn-pause').addEventListener('click', togglePause);

$('btn-mute').addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  if (!audio.muted) audio.startMusic(); else audio.stopMusic();
  applySettings();
});

$('btn-settings').addEventListener('click', () => openModal('modal-settings'));
$('btn-stats').addEventListener('click', () => { renderStatsModal(); openModal('modal-stats'); });
$('btn-devotional').addEventListener('click', () => { renderDevotional(); openModal('modal-devotional'); });

$('set-contrast').addEventListener('change', (e) => { settings.highContrast = e.target.checked; saveSettings(settings); applySettings(); });
$('set-colorblind').addEventListener('change', (e) => { settings.colorBlind = e.target.checked; saveSettings(settings); applySettings(); refreshNextPreviews(); });
$('set-motion').addEventListener('change', (e) => { settings.reducedMotion = e.target.checked; saveSettings(settings); applySettings(); });
$('set-largetext').addEventListener('change', (e) => { settings.largeText = e.target.checked; saveSettings(settings); applySettings(); });
$('set-music').addEventListener('change', (e) => { audio.setMusicOn(e.target.checked); applySettings(); });
$('set-sound').addEventListener('change', (e) => { audio.setMuted(!e.target.checked); applySettings(); });

function renderStatsModal() {
  const grid = $('stats-grid');
  const tiles = [
    ['Highest Score', stats.highestScore.toLocaleString()],
    ['Longest Survival', formatDuration(stats.longestSurvivalMs)],
    ['Lines Cleared', stats.totalLinesCleared],
    ['Verses Viewed', stats.versesViewed],
    ['Favorite Category', favoriteCategory(stats) || '—'],
    ['Current Streak', `${stats.dailyStreakDays || 0} day${stats.dailyStreakDays === 1 ? '' : 's'}`],
    ['Games Played', stats.gamesPlayed],
    ['Play Time', formatDuration(stats.totalPlayTimeMs)],
  ];
  grid.innerHTML = tiles.map(([label, value]) => `
    <div class="st-stat-tile"><span>${label}</span><strong>${value}</strong></div>
  `).join('');

  const unlocked = new Set(stats.unlockedAchievements || []);
  $('achievements-grid').innerHTML = ACHIEVEMENTS.map((a) => `
    <div class="st-achievement-tile ${unlocked.has(a.id) ? 'unlocked' : ''}">
      <span class="icon">${a.icon}</span>
      <div>${a.title}</div>
    </div>
  `).join('');
}

function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function renderDevotional() {
  const verse = verseEngine.dailyVerse();
  const devo = generateDevotional(verse);
  $('devo-verse-text').textContent = `"${verse.text}"`;
  $('devo-verse-ref').textContent = verse.reference;
  $('devo-body').textContent = devo.body;
  $('devo-prayer').textContent = devo.prayer;
  $('devo-question').textContent = devo.question;
}

// ---------------- boot ----------------
function syncTouchControlsVisibility() {
  const anyOverlayOpen = ['overlay-start', 'overlay-pause', 'overlay-gameover'].some((id) => !$(id).hidden);
  document.getElementById('st-root').classList.toggle('st-hide-touch', anyOverlayOpen);
}

async function boot() {
  verseEngine = await VerseEngine.load();
  const daily = verseEngine.dailyVerse();
  $('start-daily-verse-text').textContent = `"${daily.text}"`;
  $('start-daily-verse-ref').textContent = daily.reference;
  challenge = todaysChallenge();
  newSession();
  updateChallengeUI();
  applySettings();
  requestAnimationFrame(loop);

  new MutationObserver(syncTouchControlsVisibility).observe($('overlay-start'), { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(syncTouchControlsVisibility).observe($('overlay-pause'), { attributes: true, attributeFilter: ['hidden'] });
  new MutationObserver(syncTouchControlsVisibility).observe($('overlay-gameover'), { attributes: true, attributeFilter: ['hidden'] });
  syncTouchControlsVisibility();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
