// VisualEngine is loaded dynamically, below — it pulls in Three.js from a
// CDN, and a static import here would mean a slow/unreachable network takes
// the whole module (playback, file picker, mic — everything) down with it.
import { AudioEngine } from './js/audio-engine.js';
import { AIDirector } from './js/ai-director.js';
import { parseID3, guessFromFilename } from './js/id3.js';
// No CDN dependency (unlike VisualEngine) — safe to import statically.
import { analyzeStructure } from './js/structure-analyzer.js';
import { parseLyrics, estimateLyricsTiming, findActiveLineIndex } from './js/lyrics.js';
import {
  fingerprintTrack, loadMemory, saveMemory, withStructure, withDnaStats,
  recordPlaySession, averageCompletion, favoriteScene, SCENE_LABELS,
} from './js/fingerprint.js';
import { analyzeAudioStats, buildDnaVector, dnaPolygonPoints } from './js/visual-dna.js';
import { loadMoments, addMoment, updateMomentNote, removeMoment } from './js/memory-moments.js';

const $ = (sel) => document.querySelector(sel);

const root = $('#mv-root');
const canvas = $('#mv-canvas');
const ambientGlow = $('#mv-ambient-glow');
const screensaverEl = $('#mv-screensaver');
const screensaverArt = $('#mv-screensaver-art');
const screensaverText = $('#mv-screensaver-text');
const screensaverTitle = $('#mv-screensaver-title');
const screensaverArtist = $('#mv-screensaver-artist');
const dropHint = $('#mv-drop-hint');
const overlay = $('#mv-overlay');
const themePill = $('#mv-theme-pill');
const player = $('#mv-player');
const perfEl = $('#mv-perf');

const artImg = $('#mv-art');
const artFallback = $('#mv-art-fallback');
const titleEl = $('#mv-title');
const artistEl = $('#mv-artist');
const formatBadge = $('#mv-format-badge');
const memoryBadge = $('#mv-memory-badge');
const structureRow = $('#mv-structure-row');
const structureLabel = $('#mv-structure-label');
const structureBar = $('#mv-structure-bar');
const seekEl = $('#mv-seek');
const timeCurrentEl = $('#mv-time-current');
const timeRemainingEl = $('#mv-time-remaining');
const playPauseBtn = $('#mv-playpause');
const prevBtn = $('#mv-prev');
const nextBtn = $('#mv-next');
const volumeEl = $('#mv-volume');
const fileInput = $('#mv-file-input');

const pickFileBtn = $('#mv-pick-file');
const addMoreBtn = $('#mv-add-more');
const useMicBtn = $('#mv-use-mic');
const fullscreenBtn = $('#mv-fullscreen');
const performanceToggleBtn = $('#mv-performance-toggle');
const performanceLowerThird = $('#mv-performance-lowerthird');
const pfTitleEl = $('#mv-pf-title');
const pfArtistEl = $('#mv-pf-artist');
const pfNextEl = $('#mv-pf-next');
const performanceLyricsView = $('#mv-performance-lyrics');
const pfLyricsLinesEl = $('#mv-pf-lyrics-lines');
const dnaBadge = $('#mv-dna-badge');
const dnaBadgePoly = $('#mv-dna-badge-poly');
const dnaPanel = $('#mv-dna-panel');
const dnaCloseBtn = $('#mv-dna-close');
const dnaSvgPoly = $('#mv-dna-poly');
const dnaStatsEl = $('#mv-dna-stats');
const momentsToggleBtn = $('#mv-moments-toggle');
const momentsPanel = $('#mv-moments-panel');
const momentsAddBtn = $('#mv-moments-add');
const momentsCloseBtn = $('#mv-moments-close');
const momentsListEl = $('#mv-moments-list');

const queueToggleBtn = $('#mv-queue-toggle');
const queuePanel = $('#mv-queue-panel');
const queueList = $('#mv-queue-list');
const queueCloseBtn = $('#mv-queue-close');
const shuffleBtn = $('#mv-shuffle');
const repeatBtn = $('#mv-repeat');

const lyricsToggleBtn = $('#mv-lyrics-toggle');
const lyricsPanel = $('#mv-lyrics-panel');
const lyricsCloseBtn = $('#mv-lyrics-close');
const lyricsEditBtn = $('#mv-lyrics-edit');
const lyricsSyncBadge = $('#mv-lyrics-sync-badge');
const lyricsEmpty = $('#mv-lyrics-empty');
const lyricsEmptyHint = $('#mv-lyrics-empty-hint');
const lyricsTextarea = $('#mv-lyrics-textarea');
const lyricsFileInput = $('#mv-lyrics-file-input');
const lyricsSaveBtn = $('#mv-lyrics-save');
const lyricsRemoveBtn = $('#mv-lyrics-remove');
const lyricsLinesEl = $('#mv-lyrics-lines');

// -- Persistent playback graph: one <audio> element for the whole session,
// src swapped per track. createMediaElementSource can only bind once per
// element, so a fresh Audio() per track would leak/duplicate audio graphs.
const audioEl = new Audio();
audioEl.preload = 'auto';
audioEl.volume = parseFloat(volumeEl.value);

const audioEngine = new AudioEngine();
const director = new AIDirector();
let visualEngine = null;

const playlist = [];
let currentIndex = -1;
let isSeeking = false;
let liveBadge = null;
const objectUrls = new Set();

// 'off' | 'all' | 'one' — cycled by the repeat button.
let repeatMode = 'off';
let shuffleOn = false;
// Actually-played order, so "previous" during shuffle goes back to where
// you came from instead of jumping to array index - 1.
let playHistory = [];

// ---- Listening-session tracking, for song "memory" (fingerprint.js) ----
// Accumulated for whichever track is currently loaded, folded into that
// track's stored memory the moment a *different* track loads (or the page
// unloads) — see finalizeListeningSession().
let sessionFingerprint = null;
let sessionMaxTime = 0; // furthest currentTime reached, for completion %
let sessionSceneDurationsMs = {};
let sessionLastSceneMode = null;
let sessionLastSceneModeAt = 0;
let sessionMood = null;
let sessionThemeName = null;
let sessionBpm = null;
// Running averages for Visual DNA's "energy"/"vocal presence" axes — these
// deliberately reflect what's actually been heard so far this session, not
// a whole-file measurement, so the glyph settles in over the first several
// seconds of playback rather than jumping straight to a final shape.
let sessionEnergySum = 0;
let sessionVocalsSum = 0;
let sessionDnaSampleCount = 0;
let sessionHue = 0.069; // ~matches --mv-accent orange; updated live once the visual engine is running

function trackObjectUrl(url) { objectUrls.add(url); return url; }

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showDropHint() {
  dropHint.hidden = false;
  player.hidden = true;
  themePill.hidden = true;
  queuePanel.hidden = true;
  lyricsPanel.hidden = true;
  dnaPanel.hidden = true;
  momentsPanel.hidden = true;
  updatePerformanceView(); // no current track — hides the performance-mode overlays too
  renderDnaGlyph(null); // hides the DNA badge too
  hideScreensaver();
  hideLiveBadge();
}

function hideDropHint() {
  dropHint.hidden = true;
}

function showLiveBadge() {
  if (!liveBadge) {
    liveBadge = document.createElement('button');
    liveBadge.type = 'button';
    liveBadge.id = 'mv-live-badge';
    liveBadge.className = 'mv-fade';
    Object.assign(liveBadge.style, {
      position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
      padding: '10px 18px', borderRadius: '999px', background: 'rgba(12,12,16,0.6)',
      border: '1px solid rgba(255,255,255,0.14)', color: '#F5F5F0', fontSize: '0.85rem',
      backdropFilter: 'blur(10px)', cursor: 'pointer', zIndex: '21',
    });
    liveBadge.textContent = '\u{1F534} Live audio input — tap to stop';
    liveBadge.addEventListener('click', () => {
      audioEngine.stopMicrophone();
      showDropHint();
    });
    overlay.appendChild(liveBadge);
  }
  liveBadge.hidden = false;
  titleEl.textContent = 'Live Audio Input';
  artistEl.textContent = 'Microphone / line-in';
}

function hideLiveBadge() {
  if (liveBadge) liveBadge.hidden = true;
}

function showVisualsUnavailableNotice() {
  const notice = document.createElement('div');
  Object.assign(notice.style, {
    position: 'fixed', top: '64px', left: '50%', transform: 'translateX(-50%)',
    padding: '8px 16px', borderRadius: '999px', background: 'rgba(12,12,16,0.6)',
    border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(245,245,240,0.75)',
    fontSize: '0.75rem', backdropFilter: 'blur(10px)', zIndex: '21', textAlign: 'center',
  });
  notice.textContent = "Visuals couldn't load (offline?) — audio still plays.";
  overlay.appendChild(notice);
}

// Some iOS/Android file sources (Files app document providers, cloud
// storage, etc.) report an empty or generic File.type even for perfectly
// valid audio. The <input accept="audio/*"> already scoped what the native
// picker allowed to be selected in the first place, so an unset type isn't
// grounds to reject it — only reject files we can positively tell are NOT
// audio, so drag-and-drop of a random non-audio file still gets caught.
function isLikelyAudio(file) {
  if (file.type.startsWith('audio/')) return true;
  if (/\.(mp3|wav|m4a|mp4|ogg|oga|opus|flac|aac|aiff?|caf|weba|webm)$/i.test(file.name)) return true;
  return !file.type;
}

async function addFiles(fileList) {
  const incoming = Array.from(fileList);
  if (!incoming.length) return;
  const files = incoming.filter(isLikelyAudio);
  if (!files.length) {
    alert("That doesn't look like an audio file — try MP3, WAV, M4A, OGG, FLAC, or AAC.");
    return;
  }

  const startIndex = playlist.length;
  for (const file of files) {
    playlist.push({ file, ready: false });
  }
  renderQueue();

  hideDropHint();
  if (currentIndex === -1) {
    currentIndex = startIndex;
    try {
      await loadTrack(currentIndex, { autoplay: true });
    } catch (err) {
      console.error('[music-visualizer] failed to load track', err);
      alert("Couldn't open that file. Try a different one, or reload the page and try again.");
    }
  }

  // Parse metadata in the background so the UI isn't blocked on large files.
  files.forEach(async (file, i) => {
    const track = playlist[startIndex + i];
    try {
      const buffer = await file.arrayBuffer();
      const tag = parseID3(buffer);
      const guess = guessFromFilename(file.name);
      track.title = tag.title || guess.title || file.name;
      track.artist = tag.artist || guess.artist || 'Unknown artist';
      track.album = tag.album || '';
      track.artUrl = tag.picture ? trackObjectUrl(URL.createObjectURL(tag.picture.blob)) : null;
    } catch {
      const guess = guessFromFilename(file.name);
      track.title = guess.title || file.name;
      track.artist = guess.artist || 'Unknown artist';
      track.album = '';
      track.artUrl = null;
    }
    track.ready = true;
    if (startIndex + i === currentIndex) applyTrackMeta(track);
  });
}

const FORMAT_LABELS = {
  mp3: 'MP3', wav: 'WAV', m4a: 'AAC', mp4: 'AAC', aac: 'AAC', ogg: 'OGG', oga: 'OGG',
  opus: 'Opus', flac: 'FLAC', aiff: 'AIFF', aif: 'AIFF', caf: 'CAF', weba: 'WebA', webm: 'WebM',
};

function formatLabelFromFilename(filename) {
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  return FORMAT_LABELS[ext] || (ext ? ext.toUpperCase() : 'Audio');
}

// Bitrate here is filesize/duration (the standard "average bitrate"
// estimate) not read from encoder headers — labeled with "~" so it doesn't
// read as more precise than it is, especially for VBR files.
function updateFormatBadge() {
  const track = playlist[currentIndex];
  if (!track) { formatBadge.textContent = ''; return; }
  const parts = [formatLabelFromFilename(track.file.name)];
  if (isFinite(audioEl.duration) && audioEl.duration > 0) {
    const kbps = Math.round((track.file.size * 8) / audioEl.duration / 1000);
    if (isFinite(kbps) && kbps > 0) parts.push(`~${kbps} kbps`);
  }
  if (audioEngine.context) parts.push(`${(audioEngine.context.sampleRate / 1000).toFixed(1)} kHz`);
  formatBadge.textContent = parts.join(' · ');
}

// ---- Song structure timeline ----
// Heuristic (repetition + position based) — see structure-analyzer.js for
// exactly what "Chorus"/"Verse"/"Bridge" do and don't mean here.

function structureSegColor(label) {
  if (label === 'Chorus') return 'var(--mv-accent)';
  if (label === 'Bridge') return 'hsl(280, 45%, 58%)';
  if (label.startsWith('Verse')) return 'hsl(205, 55%, 55%)';
  return 'rgba(255,255,255,0.22)'; // Intro / Outro
}

function renderStructureBar(track) {
  structureBar.innerHTML = '';
  const segments = track?.structure;
  if (!segments || !segments.length) {
    structureRow.hidden = true;
    structureBar.hidden = true;
    return;
  }
  structureRow.hidden = false;
  structureBar.hidden = false;
  for (const seg of segments) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mv-structure-seg';
    btn.style.flex = `${Math.max(0.001, seg.end - seg.start)} 0 0%`;
    btn.style.background = structureSegColor(seg.label);
    btn.title = `${seg.label} (${formatTime(seg.start)}–${formatTime(seg.end)})`;
    btn.dataset.start = String(seg.start);
    structureBar.appendChild(btn);
  }
  updateStructureHighlight(audioEl.currentTime);
}

function updateStructureHighlight(currentTime) {
  const segments = playlist[currentIndex]?.structure;
  if (!segments) return;
  const idx = segments.findIndex((s) => currentTime >= s.start && currentTime < s.end);
  const seg = segments[idx];
  structureLabel.textContent = seg ? seg.label : '';
  const buttons = structureBar.children;
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle('mv-structure-seg-active', i === idx);
  }
}

structureBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.mv-structure-seg');
  if (!btn) return;
  audioEl.currentTime = parseFloat(btn.dataset.start);
});

// Runs the (CPU-heavier) structure analysis in the background once per
// track, lazily — only for whichever track is actually playing, not
// eagerly for the whole queue, so loading a big playlist doesn't burn
// battery analyzing songs that might never play.
async function analyzeTrackStructure(track) {
  if (track.structure !== undefined) return; // already analyzed (or attempted)
  track.structure = null; // mark "in progress" so we don't kick this off twice

  const fp = fingerprintTrack(track.file);
  const memory = loadMemory(fp);
  if (memory && memory.structure) {
    // Same file, played before — skip re-running the FFT pass entirely.
    track.structure = memory.structure;
    if (playlist[currentIndex] === track) renderStructureBar(track);
    return;
  }

  try {
    track.structure = await analyzeStructure(track.file);
    if (track.structure) saveMemory(fp, withStructure(memory, track.structure));
  } catch (err) {
    console.warn('[music-visualizer] structure analysis failed', err);
    track.structure = null;
  }
  if (playlist[currentIndex] === track) renderStructureBar(track);
}

// ---- Lyrics ----
// LRC time tags ([mm:ss.xx]) give real sync; plain pasted text has no
// timing at all, so it's spread evenly across the track (lyrics.js) and
// labeled "Estimated timing" rather than presented as if it were accurate.
// Saved lyrics persist in localStorage keyed by filename+size — a
// best-effort identifier, not a guaranteed-unique one, since there's no
// backend to key them by anything sturdier.

function lyricsStorageKey(track) {
  return `mv-lyrics::${track.file.name}::${track.file.size}`;
}

function loadStoredLyrics(track) {
  if (track.lyrics !== undefined) return; // already loaded/attempted this session
  try {
    const raw = localStorage.getItem(lyricsStorageKey(track));
    track.lyrics = raw ? JSON.parse(raw) : null;
  } catch {
    track.lyrics = null;
  }
}

function saveLyricsToStorage(track) {
  try {
    if (track.lyrics) localStorage.setItem(lyricsStorageKey(track), JSON.stringify(track.lyrics));
    else localStorage.removeItem(lyricsStorageKey(track));
  } catch { /* storage full/unavailable — lyrics still work for this session */ }
}

function showLyricsForm(track) {
  lyricsEmpty.hidden = false;
  lyricsLinesEl.hidden = true;
  lyricsEditBtn.hidden = true;
  lyricsSyncBadge.hidden = true;
  const has = track.lyrics && track.lyrics.lines?.length;
  lyricsTextarea.value = has ? track.lyrics.rawText || '' : '';
  lyricsEmptyHint.textContent = has
    ? 'Editing lyrics for this track.'
    : 'No lyrics for this track yet — paste them below, synced or plain.';
  lyricsRemoveBtn.hidden = !has;
}

function showLyricsDisplay(track) {
  lyricsEmpty.hidden = true;
  lyricsLinesEl.hidden = false;
  lyricsEditBtn.hidden = false;
  lyricsSyncBadge.hidden = false;
  lyricsSyncBadge.textContent = track.lyrics.synced ? 'Synced' : 'Estimated timing';
  lyricsSyncBadge.classList.toggle('mv-lyrics-synced', track.lyrics.synced);
  lyricsLinesEl.innerHTML = '';
  track.lyrics.lines.forEach((line, i) => {
    const li = document.createElement('li');
    li.textContent = line.text;
    li.dataset.index = String(i);
    lyricsLinesEl.appendChild(li);
  });
  updateLyricsHighlight(audioEl.currentTime);
}

function renderLyricsPanel() {
  const track = playlist[currentIndex];
  if (!track) return;
  loadStoredLyrics(track);
  const has = track.lyrics && track.lyrics.lines?.length;
  if (has) showLyricsDisplay(track);
  else showLyricsForm(track);
}

function updateLyricsHighlight(currentTime) {
  if (lyricsPanel.hidden) return; // no point scrolling a hidden panel
  const track = playlist[currentIndex];
  const lines = track?.lyrics?.lines;
  if (!lines || !lines.length) return;
  const idx = findActiveLineIndex(lines, currentTime);
  const items = lyricsLinesEl.children;
  for (let i = 0; i < items.length; i++) {
    items[i].classList.toggle('mv-lyrics-line-active', i === idx);
  }
  if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function saveLyricsFromTextarea() {
  const track = playlist[currentIndex];
  if (!track) return;
  const text = lyricsTextarea.value;
  if (!text.trim()) return;
  const parsed = parseLyrics(text);
  if (!parsed.lines.length) {
    alert("Couldn't find any lyric lines in that text.");
    return;
  }
  if (!parsed.synced) parsed.lines = estimateLyricsTiming(parsed.lines, audioEl.duration);
  track.lyrics = { ...parsed, rawText: text };
  saveLyricsToStorage(track);
  renderLyricsPanel();
  updatePerformanceView();
}

lyricsToggleBtn.addEventListener('click', () => {
  lyricsPanel.hidden = !lyricsPanel.hidden;
  if (!lyricsPanel.hidden) { queuePanel.hidden = true; dnaPanel.hidden = true; momentsPanel.hidden = true; renderLyricsPanel(); }
});
lyricsCloseBtn.addEventListener('click', () => { lyricsPanel.hidden = true; });
lyricsEditBtn.addEventListener('click', () => {
  const track = playlist[currentIndex];
  if (track) showLyricsForm(track);
});
lyricsRemoveBtn.addEventListener('click', () => {
  const track = playlist[currentIndex];
  if (!track) return;
  track.lyrics = null;
  saveLyricsToStorage(track);
  renderLyricsPanel();
  updatePerformanceView();
});
lyricsSaveBtn.addEventListener('click', saveLyricsFromTextarea);
lyricsFileInput.addEventListener('change', async () => {
  const file = lyricsFileInput.files[0];
  if (!file) return;
  lyricsTextarea.value = await file.text();
  lyricsFileInput.value = '';
});
lyricsLinesEl.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const track = playlist[currentIndex];
  const line = track?.lyrics?.lines?.[parseInt(li.dataset.index, 10)];
  if (line && isFinite(line.time)) audioEl.currentTime = line.time;
});

// ---- Song memory / fingerprinting ----
// Recognizes "this exact file, played again" (filename+size — see
// fingerprint.js) and remembers, per device: cached structure analysis (so
// a repeat play skips re-running the FFT pass), the mood/tempo last seen,
// how much of the track is typically listened to, and which camera scene
// mode has spent the most time on screen for it.

function flushSceneDwell(nowMs) {
  if (sessionLastSceneMode) {
    const elapsed = nowMs - sessionLastSceneModeAt;
    sessionSceneDurationsMs[sessionLastSceneMode] = (sessionSceneDurationsMs[sessionLastSceneMode] || 0) + elapsed;
  }
  sessionLastSceneModeAt = nowMs;
}

function trackSceneDwell(cameraMode, nowMs) {
  if (cameraMode === sessionLastSceneMode) return;
  flushSceneDwell(nowMs);
  sessionLastSceneMode = cameraMode;
}

function finalizeListeningSession() {
  if (!sessionFingerprint) return;
  flushSceneDwell(performance.now());
  const duration = audioEl.duration;
  const completionRatio = isFinite(duration) && duration > 0 ? sessionMaxTime / duration : 0;
  // Skip essentially-instant skips — not a meaningful "play" to remember.
  if (sessionMaxTime > 1) {
    const existing = loadMemory(sessionFingerprint);
    const memory = recordPlaySession(existing, {
      completionRatio,
      mood: sessionMood,
      themeName: sessionThemeName,
      bpm: sessionBpm,
      avgEnergy: sessionDnaSampleCount > 0 ? sessionEnergySum / sessionDnaSampleCount : null,
      avgVocalPresence: sessionDnaSampleCount > 0 ? sessionVocalsSum / sessionDnaSampleCount : null,
      sceneDurationsMs: sessionSceneDurationsMs,
    });
    saveMemory(sessionFingerprint, memory);
  }
  sessionFingerprint = null;
}

function startListeningSession(track) {
  sessionFingerprint = fingerprintTrack(track.file);
  sessionMaxTime = 0;
  sessionSceneDurationsMs = {};
  sessionLastSceneMode = null;
  sessionLastSceneModeAt = performance.now();
  sessionMood = null;
  sessionThemeName = null;
  sessionBpm = null;
  sessionEnergySum = 0;
  sessionVocalsSum = 0;
  sessionDnaSampleCount = 0;
}

function renderMemoryBadge(track) {
  const memory = loadMemory(fingerprintTrack(track.file));
  if (!memory || memory.playCount < 1) { memoryBadge.hidden = true; return; }
  const parts = ['\u{1F9E0} Recognized'];
  if (memory.mood) parts.push(`${memory.mood.emoji} ${memory.mood.label}`);
  if (memory.bpm) parts.push(`${memory.bpm} BPM`);
  const scene = favoriteScene(memory);
  if (scene) parts.push(SCENE_LABELS[scene] || scene);
  parts.push(`played ${memory.playCount}×`);
  parts.push(`~${Math.round(averageCompletion(memory) * 100)}% avg listen`);
  memoryBadge.textContent = parts.join(' · ');
  memoryBadge.hidden = false;
}

// Once the current track's structure is settled (from cache or freshly
// analyzed), gets a head start on the very next queued track — only one
// ahead, deliberately, so a long playlist doesn't burn battery analyzing
// songs that might never play. Uses idle time so it never competes with
// playback or UI responsiveness.
function schedulePreAnalysis() {
  const next = playlist[currentIndex + 1];
  if (!next) return;
  const run = () => {
    if (next.structure === undefined) analyzeTrackStructure(next);
    if (next.dnaStats === undefined) analyzeTrackDna(next);
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

// ---- Visual DNA ----
// A five-axis "fingerprint" glyph per track — see visual-dna.js for exactly
// what each axis means and where it comes from. Stereo width/dynamic range
// are measured once (cached like structure analysis); tempo/energy/vocal
// presence reflect what's actually been observed while playing, converging
// over the first several seconds rather than being computed all at once.

async function analyzeTrackDna(track) {
  if (track.dnaStats !== undefined) return; // already analyzed (or attempted)
  track.dnaStats = null; // mark "in progress"

  const fp = fingerprintTrack(track.file);
  const memory = loadMemory(fp);
  if (memory && memory.dnaStats) {
    track.dnaStats = memory.dnaStats;
    if (playlist[currentIndex] === track) renderDnaGlyph(track);
    return;
  }

  try {
    const stats = await analyzeAudioStats(track.file);
    track.dnaStats = stats;
    if (stats) saveMemory(fp, withDnaStats(memory, stats));
  } catch (err) {
    console.warn('[music-visualizer] visual DNA analysis failed', err);
    track.dnaStats = null;
  }
  if (playlist[currentIndex] === track) renderDnaGlyph(track);
}

function currentDnaVector(track) {
  const memory = loadMemory(fingerprintTrack(track.file));
  const bpm = sessionBpm ?? memory?.bpm ?? null;
  const energy = sessionDnaSampleCount > 0 ? sessionEnergySum / sessionDnaSampleCount : memory?.avgEnergy ?? null;
  const vocalPresence = sessionDnaSampleCount > 0 ? sessionVocalsSum / sessionDnaSampleCount : memory?.avgVocalPresence ?? null;
  const stats = track.dnaStats;
  return buildDnaVector({
    bpm, energy, vocalPresence,
    stereoWidth: stats?.stereoWidth ?? null,
    dynamicRangeDb: stats?.dynamicRangeDb ?? null,
  });
}

function renderDnaGlyph(track) {
  if (!track) { dnaBadge.hidden = true; dnaPanel.hidden = true; return; }
  const vector = currentDnaVector(track);
  const hueDeg = Math.round(sessionHue * 360);
  const color = `hsl(${hueDeg}, 70%, 62%)`;

  dnaBadgePoly.setAttribute('points', dnaPolygonPoints(vector, 8, 10, 10));
  dnaBadgePoly.style.fill = color;
  dnaBadgePoly.style.stroke = color;
  dnaBadge.hidden = false;

  if (!dnaPanel.hidden) renderDnaPanel(track, vector, color);
}

function renderDnaPanel(track, vector, color) {
  dnaSvgPoly.setAttribute('points', dnaPolygonPoints(vector, 40, 50, 50));
  dnaSvgPoly.style.fill = color.replace('hsl', 'hsla').replace(')', ', 0.35)');
  dnaSvgPoly.style.stroke = color;

  const stats = track.dnaStats;
  const bpmValue = sessionBpm ?? loadMemory(fingerprintTrack(track.file))?.bpm ?? null;
  const rows = [
    ['Tempo', bpmValue != null ? `${Math.round(bpmValue)} BPM` : 'Detecting…'],
    ['Energy', `${Math.round(vector.energy * 100)}%`],
    ['Stereo width', stats != null ? `${Math.round(vector.stereoWidth * 100)}%` : 'Analyzing…'],
    ['Dynamic range', stats && stats.dynamicRangeDb != null ? `${stats.dynamicRangeDb.toFixed(1)} dB` : stats != null ? 'N/A' : 'Analyzing…'],
    ['Vocal presence', `${Math.round(vector.vocalPresence * 100)}%`],
  ];
  dnaStatsEl.innerHTML = '';
  for (const [label, value] of rows) {
    const li = document.createElement('li');
    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    const valueStrong = document.createElement('strong');
    valueStrong.textContent = value;
    li.append(labelSpan, valueStrong);
    dnaStatsEl.appendChild(li);
  }
}

dnaBadge.addEventListener('click', () => {
  dnaPanel.hidden = !dnaPanel.hidden;
  if (!dnaPanel.hidden) {
    queuePanel.hidden = true;
    lyricsPanel.hidden = true;
    momentsPanel.hidden = true;
    const track = playlist[currentIndex];
    if (track) renderDnaGlyph(track);
  }
});
dnaCloseBtn.addEventListener('click', () => { dnaPanel.hidden = true; });

// ---- Memory Moments ----
// User-created bookmarks within a track — see memory-moments.js for exactly
// what's stored. The visual-state label describes what the AI Director was
// doing at capture time (mood/theme + camera move); it's not a promise that
// jumping back there recreates the same pixels, since the scene is
// genuinely reactive to whatever's actually playing.

function captureCanvasThumbnail(maxWidth = 160) {
  const source = visualEngine?.renderer?.domElement;
  if (!source || !source.width || !source.height) return null;
  try {
    const scale = maxWidth / source.width;
    const w = maxWidth;
    const h = Math.round(source.height * scale);
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    off.getContext('2d').drawImage(source, 0, 0, w, h);
    return off.toDataURL('image/jpeg', 0.6);
  } catch (err) {
    console.warn('[music-visualizer] could not capture a moment thumbnail', err);
    return null;
  }
}

function renderMomentsPanel(track) {
  momentsListEl.innerHTML = '';
  if (!track) return;
  const moments = loadMoments(fingerprintTrack(track.file));
  if (!moments.length) {
    const li = document.createElement('li');
    li.className = 'mv-moments-empty';
    li.textContent = 'No moments bookmarked yet — tap + while a part of the song stands out.';
    momentsListEl.appendChild(li);
    return;
  }
  for (const moment of moments) {
    const li = document.createElement('li');
    li.className = 'mv-moment-item';
    li.dataset.id = moment.id;

    const thumb = document.createElement('div');
    thumb.className = 'mv-moment-thumb';
    if (moment.thumbnail) {
      const img = document.createElement('img');
      img.src = moment.thumbnail;
      img.alt = '';
      thumb.appendChild(img);
    } else {
      thumb.textContent = '\u{1F516}';
    }

    const meta = document.createElement('div');
    meta.className = 'mv-moment-meta';
    const timeBtn = document.createElement('button');
    timeBtn.type = 'button';
    timeBtn.className = 'mv-moment-time';
    timeBtn.textContent = formatTime(moment.time);
    timeBtn.addEventListener('click', () => { audioEl.currentTime = moment.time; });
    const visualSpan = document.createElement('span');
    visualSpan.className = 'mv-moment-visual';
    visualSpan.textContent = moment.visualLabel || '';
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.className = 'mv-moment-note';
    noteInput.placeholder = 'Add a note…';
    noteInput.value = moment.note || '';
    noteInput.addEventListener('change', () => {
      const current = playlist[currentIndex];
      if (current) updateMomentNote(fingerprintTrack(current.file), moment.id, noteInput.value);
    });
    meta.append(timeBtn, visualSpan, noteInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'mv-moment-remove';
    removeBtn.innerHTML = '&times;';
    removeBtn.setAttribute('aria-label', 'Remove moment');
    removeBtn.addEventListener('click', () => {
      const current = playlist[currentIndex];
      if (!current) return;
      removeMoment(fingerprintTrack(current.file), moment.id);
      renderMomentsPanel(current);
    });

    li.append(thumb, meta, removeBtn);
    momentsListEl.appendChild(li);
  }
}

momentsToggleBtn.addEventListener('click', () => {
  momentsPanel.hidden = !momentsPanel.hidden;
  if (!momentsPanel.hidden) {
    queuePanel.hidden = true;
    lyricsPanel.hidden = true;
    dnaPanel.hidden = true;
    renderMomentsPanel(playlist[currentIndex]);
  }
});
momentsCloseBtn.addEventListener('click', () => { momentsPanel.hidden = true; });
momentsAddBtn.addEventListener('click', () => {
  const track = playlist[currentIndex];
  if (!track || !isFinite(audioEl.currentTime)) return;
  const visualLabelParts = [];
  if (sessionMood) visualLabelParts.push(`${sessionMood.emoji} ${sessionMood.label}`);
  else if (sessionThemeName) visualLabelParts.push(sessionThemeName);
  if (sessionLastSceneMode) visualLabelParts.push(SCENE_LABELS[sessionLastSceneMode] || sessionLastSceneMode);
  addMoment(fingerprintTrack(track.file), {
    time: audioEl.currentTime,
    visualLabel: visualLabelParts.join(' · '),
    thumbnail: captureCanvasThumbnail(),
  });
  renderMomentsPanel(track);
});

function applyTrackMeta(track) {
  titleEl.textContent = track.title || track.file.name;
  artistEl.textContent = track.artist || 'Unknown artist';
  if (track.artUrl) {
    artImg.src = track.artUrl;
    artImg.hidden = false;
    artFallback.style.display = 'none';
  } else {
    artImg.hidden = true;
    artFallback.style.display = 'flex';
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || track.file.name,
      artist: track.artist || '',
      album: track.album || '',
      artwork: track.artUrl ? [{ src: track.artUrl, sizes: '512x512', type: 'image/png' }] : [],
    });
  }
  updateFormatBadge();
  renderQueue();
}

async function loadTrack(index, { autoplay = false } = {}) {
  const track = playlist[index];
  if (!track) return;
  finalizeListeningSession(); // fold the outgoing track's play into its memory before switching
  currentIndex = index;
  startListeningSession(track);
  playHistory.push(index);
  if (playHistory.length > 200) playHistory.shift();
  director.reset(); // snap to a fitting theme quickly instead of drifting there
  renderQueue();

  if (!track.url) track.url = trackObjectUrl(URL.createObjectURL(track.file));
  audioEl.src = track.url;

  // Show the player and track info first — playback itself doesn't depend
  // on the analysis graph below, and this way a failure in that graph (seen
  // on some browsers' stricter Web Audio implementations) degrades to
  // "plays, but doesn't react visually" instead of "looks like nothing
  // happened at all."
  player.hidden = false;
  themePill.hidden = false;
  hideLiveBadge();

  if (track.ready) applyTrackMeta(track);
  else {
    titleEl.textContent = track.file.name;
    artistEl.textContent = '…';
    artImg.hidden = true;
    artFallback.style.display = 'flex';
  }
  updateFormatBadge();
  renderMemoryBadge(track);
  renderStructureBar(track); // shows a cached result immediately, or hides the bar
  analyzeTrackStructure(track); // no-op if already analyzed/in progress
  analyzeTrackDna(track); // no-op if already analyzed/in progress
  renderDnaGlyph(track);
  schedulePreAnalysis(); // get a head start on the next queued track while this one plays
  if (!lyricsPanel.hidden) renderLyricsPanel();
  if (!momentsPanel.hidden) renderMomentsPanel(track);
  updatePerformanceView();
  resetScreensaverTimer();

  try {
    audioEngine.connectAudioElement(audioEl);
    updateFormatBadge(); // sample rate becomes known once the context exists
  } catch (err) {
    console.warn('[music-visualizer] audio analysis unavailable, playback continues without visuals', err);
  }

  if (autoplay) {
    try { await audioEl.play(); } catch { /* awaiting a user gesture is fine */ }
  }
  updatePlayPauseIcon();
}

function updatePlayPauseIcon() {
  playPauseBtn.innerHTML = audioEl.paused ? '&#9654;' : '&#10074;&#10074;';
}

function pickNextIndex() {
  if (repeatMode === 'one') return currentIndex;
  if (shuffleOn) {
    if (playlist.length <= 1) return currentIndex;
    let next;
    do { next = Math.floor(Math.random() * playlist.length); } while (next === currentIndex);
    return next;
  }
  if (currentIndex < playlist.length - 1) return currentIndex + 1;
  return repeatMode === 'all' ? 0 : -1;
}

function playNext() {
  const next = pickNextIndex();
  if (next === -1) { updatePlayPauseIcon(); return; } // end of queue, nothing left to play
  if (next === currentIndex) { audioEl.currentTime = 0; audioEl.play().catch(() => {}); return; }
  loadTrack(next, { autoplay: true });
}

function playPrev() {
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  // Shuffle: go back to wherever we actually came from, not array index - 1.
  if (shuffleOn && playHistory.length > 1) {
    playHistory.pop(); // drop the current track
    const prev = playHistory.pop(); // this gets re-pushed by loadTrack()
    loadTrack(prev, { autoplay: true });
    return;
  }
  if (currentIndex > 0) loadTrack(currentIndex - 1, { autoplay: true });
  else audioEl.currentTime = 0;
}

function cycleRepeatMode() {
  repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
  repeatBtn.classList.toggle('mv-active', repeatMode !== 'off');
  repeatBtn.innerHTML = repeatMode === 'one' ? '&#128258;' : '&#128257;';
  repeatBtn.title = repeatMode === 'off' ? 'Repeat: off' : repeatMode === 'all' ? 'Repeat: all' : 'Repeat: one';
}

function toggleShuffle() {
  shuffleOn = !shuffleOn;
  shuffleBtn.classList.toggle('mv-active', shuffleOn);
  shuffleBtn.title = shuffleOn ? 'Shuffle: on' : 'Shuffle: off';
}

function renderQueue() {
  queueList.innerHTML = '';
  if (!playlist.length) {
    const li = document.createElement('li');
    li.className = 'mv-queue-empty';
    li.textContent = 'Nothing queued yet — add some tracks.';
    queueList.appendChild(li);
    return;
  }
  playlist.forEach((track, i) => {
    const li = document.createElement('li');
    li.className = 'mv-queue-item' + (i === currentIndex ? ' mv-queue-item-active' : '');
    li.dataset.index = String(i);

    const art = document.createElement('div');
    art.className = 'mv-queue-item-art';
    if (track.artUrl) {
      const img = document.createElement('img');
      img.src = track.artUrl;
      img.alt = '';
      art.appendChild(img);
    } else {
      art.textContent = '\u{1F3B5}';
    }

    const meta = document.createElement('div');
    meta.className = 'mv-queue-item-meta';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'mv-queue-item-title';
    titleDiv.textContent = track.title || track.file.name;
    const artistDiv = document.createElement('div');
    artistDiv.className = 'mv-queue-item-artist';
    artistDiv.textContent = track.artist || (track.ready ? 'Unknown artist' : '…');
    meta.append(titleDiv, artistDiv);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'mv-queue-item-remove';
    removeBtn.setAttribute('aria-label', `Remove ${track.title || track.file.name} from queue`);
    removeBtn.innerHTML = '&times;';

    li.append(art, meta, removeBtn);
    queueList.appendChild(li);
  });
}

function removeFromQueue(index) {
  const track = playlist[index];
  if (!track) return;
  const wasPlaying = index === currentIndex;
  if (track.url) objectUrls.delete(track.url); // still valid until beforeunload revokes it in bulk
  playlist.splice(index, 1);
  playHistory = playHistory.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i));

  if (!playlist.length) {
    finalizeListeningSession();
    currentIndex = -1;
    audioEl.pause();
    audioEl.removeAttribute('src');
    showDropHint();
    return;
  }

  if (index < currentIndex) currentIndex--;
  else if (wasPlaying) {
    const next = Math.min(index, playlist.length - 1);
    loadTrack(next, { autoplay: !audioEl.paused });
    return;
  }
  renderQueue();
}

// ---- Playback UI wiring ----

playPauseBtn.addEventListener('click', () => {
  if (audioEl.paused) audioEl.play().catch(() => {});
  else audioEl.pause();
});
audioEl.addEventListener('play', updatePlayPauseIcon);
audioEl.addEventListener('pause', updatePlayPauseIcon);
audioEl.addEventListener('ended', playNext);
audioEl.addEventListener('loadedmetadata', updateFormatBadge); // duration wasn't known until now — refresh the bitrate estimate
audioEl.addEventListener('error', () => {
  // MediaError codes: 1 aborted, 2 network, 3 decode, 4 src not supported.
  const err = audioEl.error;
  const track = playlist[currentIndex];
  const name = track ? (track.title || track.file.name) : 'this track';
  console.warn('[music-visualizer] audio error', err?.code, err?.message);
  alert(`Couldn't play ${name} — the file may be corrupted or in a format this browser can't decode.`);
});

prevBtn.addEventListener('click', playPrev);
nextBtn.addEventListener('click', playNext);

audioEl.addEventListener('timeupdate', () => {
  updateStructureHighlight(audioEl.currentTime);
  updateLyricsHighlight(audioEl.currentTime);
  updatePerformanceLyricsHighlight(audioEl.currentTime);
  updateNextCue();
  if (playlist[currentIndex]) renderDnaGlyph(playlist[currentIndex]);
  if (audioEl.currentTime > sessionMaxTime) sessionMaxTime = audioEl.currentTime;
  if (isSeeking || !isFinite(audioEl.duration)) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 1000;
  seekEl.value = String(pct);
  timeCurrentEl.textContent = formatTime(audioEl.currentTime);
  timeRemainingEl.textContent = `-${formatTime(audioEl.duration - audioEl.currentTime)}`;
});
seekEl.addEventListener('pointerdown', () => { isSeeking = true; });
seekEl.addEventListener('input', () => {
  if (!isFinite(audioEl.duration)) return;
  const t = (parseFloat(seekEl.value) / 1000) * audioEl.duration;
  timeCurrentEl.textContent = formatTime(t);
});
seekEl.addEventListener('change', () => {
  if (isFinite(audioEl.duration)) audioEl.currentTime = (parseFloat(seekEl.value) / 1000) * audioEl.duration;
  isSeeking = false;
});

volumeEl.addEventListener('input', () => { audioEl.volume = parseFloat(volumeEl.value); });

// ---- Up Next queue ----

queueToggleBtn.addEventListener('click', () => {
  queuePanel.hidden = !queuePanel.hidden;
  if (!queuePanel.hidden) { lyricsPanel.hidden = true; dnaPanel.hidden = true; momentsPanel.hidden = true; renderQueue(); }
});
queueCloseBtn.addEventListener('click', () => { queuePanel.hidden = true; });
shuffleBtn.addEventListener('click', toggleShuffle);
repeatBtn.addEventListener('click', cycleRepeatMode);

queueList.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.mv-queue-item-remove');
  const item = e.target.closest('.mv-queue-item');
  if (!item) return;
  const index = parseInt(item.dataset.index, 10);
  if (removeBtn) {
    removeFromQueue(index);
  } else if (index !== currentIndex) {
    loadTrack(index, { autoplay: true });
  }
});

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => audioEl.play().catch(() => {}));
  navigator.mediaSession.setActionHandler('pause', () => audioEl.pause());
  navigator.mediaSession.setActionHandler('previoustrack', playPrev);
  navigator.mediaSession.setActionHandler('nexttrack', playNext);
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) audioEl.currentTime = details.seekTime;
  });
}

// ---- File input / drag & drop ----

pickFileBtn.addEventListener('click', () => fileInput.click());
addMoreBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

['dragenter', 'dragover'].forEach((evt) => {
  root.addEventListener(evt, (e) => { e.preventDefault(); root.classList.add('mv-dragover'); });
});
['dragleave', 'dragend'].forEach((evt) => {
  root.addEventListener(evt, () => root.classList.remove('mv-dragover'));
});
root.addEventListener('drop', (e) => {
  e.preventDefault();
  root.classList.remove('mv-dragover');
  if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
});

// ---- Microphone / live input ----

useMicBtn.addEventListener('click', async () => {
  try {
    await audioEngine.connectMicrophone();
    director.reset();
    hideDropHint();
    player.hidden = true;
    themePill.hidden = false;
    showLiveBadge();
  } catch (err) {
    alert('Could not access the microphone. Check the browser permission prompt and try again.');
  }
});

// ---- Fullscreen ----

fullscreenBtn.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else root.requestFullscreen().catch(() => {});
});

// ---- Performance mode ----
// For projecting during a live set: strips the player chrome down to just
// transport controls, shows a clean lower-third instead of the normal
// title/artist block, and — when the current track has lyrics saved — a
// big, high-contrast, auto-scrolling lyrics view takes over the center of
// the screen. See style.css for the layout; this is just the state/data
// side of it.

// Cached so the "Next: …" cue doesn't re-roll a different track every tick
// while shuffle is on — computed once when the cue window is entered, not
// on every timeupdate.
let cachedNextCueForTrackIndex = -1;
let cachedNextCueIndex = -1;

function renderPerformanceLyrics(track) {
  pfLyricsLinesEl.innerHTML = '';
  track.lyrics.lines.forEach((line, i) => {
    const div = document.createElement('div');
    div.className = 'mv-pf-lyrics-line';
    div.textContent = line.text;
    div.dataset.index = String(i);
    pfLyricsLinesEl.appendChild(div);
  });
  updatePerformanceLyricsHighlight(audioEl.currentTime);
}

function updatePerformanceLyricsHighlight(currentTime) {
  if (performanceLyricsView.hidden) return;
  const track = playlist[currentIndex];
  const lines = track?.lyrics?.lines;
  if (!lines || !lines.length) return;
  const idx = findActiveLineIndex(lines, currentTime);
  const items = pfLyricsLinesEl.children;
  for (let i = 0; i < items.length; i++) {
    items[i].classList.toggle('mv-pf-lyrics-line-active', i === idx);
  }
  if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// Re-derives what performance mode should currently be showing for the
// loaded track — call whenever the track changes, lyrics are saved/removed
// for it, or performance mode itself is toggled.
function updatePerformanceView() {
  const active = root.classList.contains('mv-performance-mode');
  const track = playlist[currentIndex];
  if (!active || !track) {
    performanceLowerThird.hidden = true;
    performanceLyricsView.hidden = true;
    return;
  }
  performanceLowerThird.hidden = false;
  pfTitleEl.textContent = track.title || track.file.name;
  pfArtistEl.textContent = track.artist || '';

  const hasLyrics = track.lyrics && track.lyrics.lines && track.lyrics.lines.length;
  performanceLyricsView.hidden = !hasLyrics;
  if (hasLyrics) renderPerformanceLyrics(track);
}

// A small "Next: <title>" cue in the final stretch of a track, so whoever's
// running sound/slides gets a heads-up before the transition — not an
// exact prediction of a section change (that's the AI Director's job),
// just "the queue is about to advance."
function updateNextCue() {
  if (!root.classList.contains('mv-performance-mode') || !isFinite(audioEl.duration)) {
    pfNextEl.hidden = true;
    cachedNextCueForTrackIndex = -1;
    return;
  }
  const remaining = audioEl.duration - audioEl.currentTime;
  if (remaining > 6 || remaining <= 0) {
    pfNextEl.hidden = true;
    cachedNextCueForTrackIndex = -1;
    return;
  }
  if (cachedNextCueForTrackIndex !== currentIndex) {
    cachedNextCueForTrackIndex = currentIndex;
    cachedNextCueIndex = pickNextIndex();
  }
  const nextTrack = cachedNextCueIndex !== -1 && cachedNextCueIndex !== currentIndex ? playlist[cachedNextCueIndex] : null;
  if (nextTrack) {
    pfNextEl.hidden = false;
    pfNextEl.textContent = `Next: ${nextTrack.title || nextTrack.file.name}`;
  } else {
    pfNextEl.hidden = true;
  }
}

function togglePerformanceMode() {
  const active = root.classList.toggle('mv-performance-mode');
  performanceToggleBtn.classList.toggle('mv-active', active);
  performanceToggleBtn.title = active ? 'Exit performance mode' : 'Performance mode';
  if (active) { root.requestFullscreen?.().catch(() => {}); hideScreensaver(); }
  else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  updatePerformanceView();
  resetIdleTimer();
}
performanceToggleBtn.addEventListener('click', togglePerformanceMode);

// If the operator exits fullscreen some other way (Esc, browser chrome),
// drop performance mode too rather than leaving it in a stripped-down
// non-fullscreen state that doesn't match either mode's expectations.
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && root.classList.contains('mv-performance-mode')) {
    root.classList.remove('mv-performance-mode');
    performanceToggleBtn.classList.remove('mv-active');
    performanceToggleBtn.title = 'Performance mode';
    updatePerformanceView();
  }
});

// ---- Theme pill (shown as a "mood" — same underlying read, framed the
// way a listener thinks about it rather than the internal genre name) ----

let lastThemeName = null;
function updateThemePill(themeName, mood) {
  if (themeName === lastThemeName) return;
  lastThemeName = themeName;
  const label = mood ? `${mood.emoji} ${mood.label}` : themeName;
  themePill.innerHTML = `<span class="mv-theme-dot"></span>${label}`;
}

// ---- Ambient edge glow (Ambilight-style) ----
// Driven only by the director's current hue/saturation and the already-
// smoothed overall energy — never a per-hit impulse — so it drifts gently
// rather than flashing along with the boom/vibrate reactions elsewhere.

function updateAmbientGlow(directorState, energySmoothed) {
  const hueDeg = Math.round(directorState.hue * 360);
  const sat = Math.round(directorState.sat * 100);
  const light = 35 + Math.round(energySmoothed * 15);
  ambientGlow.style.setProperty('--mv-glow-color', `hsl(${hueDeg}, ${sat}%, ${light}%)`);
  ambientGlow.style.opacity = String(Math.min(0.55, 0.15 + energySmoothed * 0.4));
}

// ---- Adaptive performance monitor ----

const BASE_PARTICLE_BUDGET = 1800;
let qualityScale = 1;
let frameTimes = [];
let lastPerfCheck = performance.now();

function trackFrameTime(ms) {
  frameTimes.push(ms);
  if (frameTimes.length > 45) frameTimes.shift();
  const now = performance.now();
  if (now - lastPerfCheck < 1000 || frameTimes.length < 20) return;
  lastPerfCheck = now;
  const avg = frameTimes.reduce((a, v) => a + v, 0) / frameTimes.length;
  if (avg > 22 && qualityScale > 0.4) qualityScale = Math.max(0.4, qualityScale - 0.12);
  else if (avg < 13 && qualityScale < 1) qualityScale = Math.min(1, qualityScale + 0.08);
  visualEngine.setPixelRatioScale(0.55 + qualityScale * 0.45);
  if (perfEl.hidden === false) {
    perfEl.textContent = `${(1000 / avg).toFixed(0)} fps · q${qualityScale.toFixed(2)}`;
  }
}

// ---- Main loop (only runs once the visual engine is up — audio playback
// and all the controls above work regardless, whether or not it ever is) ----

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  const features = audioEngine.update();
  const track = playlist[currentIndex];
  const structureContext = track?.structure ? { currentTime: audioEl.currentTime, segments: track.structure } : null;
  const directorState = director.update(features, dt, structureContext);
  visualEngine.setParticleBudget(BASE_PARTICLE_BUDGET * qualityScale * directorState.particleDensity);
  visualEngine.setBloomStrength(Math.min(2.6, directorState.bloomStrength));
  visualEngine.update(features, directorState);
  visualEngine.render();
  updateThemePill(directorState.themeName, directorState.mood);
  updateAmbientGlow(directorState, features.overallEnergySmoothed);
  trackSceneDwell(directorState.cameraMode, performance.now());
  sessionMood = directorState.mood;
  sessionThemeName = directorState.themeName;
  if (directorState.bpm != null) sessionBpm = directorState.bpm;
  if (directorState.hue != null) sessionHue = directorState.hue;
  sessionEnergySum += features.overallEnergySmoothed;
  sessionVocalsSum += features.bands.vocals.energy;
  sessionDnaSampleCount++;
  trackFrameTime((performance.now() - now) || 1);

  requestAnimationFrame(frame);
}

(async () => {
  try {
    const { VisualEngine } = await import('./js/visual-engine.js');
    visualEngine = new VisualEngine(canvas);
    await visualEngine.initPostFX();
    requestAnimationFrame(frame);
  } catch (err) {
    console.warn('[music-visualizer] visual engine unavailable, continuing audio-only', err);
    showVisualsUnavailableNotice();
  }
})();

window.addEventListener('beforeunload', () => {
  finalizeListeningSession();
  for (const url of objectUrls) URL.revokeObjectURL(url);
});

// Toggle the small perf readout with "d" for anyone debugging on a shared
// worship-room laptop; hidden by default so it doesn't clutter the stage view.
window.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') perfEl.hidden = !perfEl.hidden;
});

// The format/bitrate detail line fades out after a few seconds of no
// interaction — genuinely useful once, not worth permanently competing with
// title/artist for attention. Only this one small line, not the whole
// player bar, since this app also runs unattended on a projector during a
// service, where dimming the actual controls would be the wrong call.
let idleTimer = null;
function resetIdleTimer() {
  formatBadge.classList.remove('mv-idle');
  memoryBadge.classList.remove('mv-idle');
  root.classList.remove('mv-idle'); // only visibly affects anything while in performance mode — see style.css
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    formatBadge.classList.add('mv-idle');
    memoryBadge.classList.add('mv-idle');
    root.classList.add('mv-idle');
  }, 4500);
}
// ---- Idle screensaver ----
// After a much longer stretch of no interaction — and only while a track
// is actually playing, not paused — hides all UI chrome and shows a
// slowly drifting, oversized piece of album art (or, lacking that, an
// equally oversized title/artist typographic treatment) over the
// already-running, already-audio-reactive Three.js scene. See style.css
// for the visual side; this is just the show/hide/schedule logic. Doesn't
// engage during Performance Mode, which already has its own idle behavior
// suited to a live-event context rather than an unattended display.

const SCREENSAVER_DELAY_MS = 60000;
let screensaverTimer = null;

function showScreensaver() {
  const track = playlist[currentIndex];
  if (!track || audioEl.paused || root.classList.contains('mv-performance-mode')) return;
  if (track.artUrl) {
    screensaverArt.src = track.artUrl;
    screensaverArt.hidden = false;
    screensaverText.hidden = true;
  } else {
    screensaverTitle.textContent = track.title || track.file.name;
    screensaverArtist.textContent = track.artist || '';
    screensaverText.hidden = false;
    screensaverArt.hidden = true;
  }
  screensaverEl.hidden = false;
  root.classList.add('mv-screensaver');
}

function hideScreensaver() {
  screensaverEl.hidden = true;
  root.classList.remove('mv-screensaver');
}

function resetScreensaverTimer() {
  hideScreensaver();
  clearTimeout(screensaverTimer);
  screensaverTimer = setTimeout(showScreensaver, SCREENSAVER_DELAY_MS);
}

audioEl.addEventListener('pause', hideScreensaver);
audioEl.addEventListener('play', resetScreensaverTimer);

['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, resetIdleTimer, { passive: true });
  window.addEventListener(evt, resetScreensaverTimer, { passive: true });
});
resetIdleTimer();
resetScreensaverTimer();
