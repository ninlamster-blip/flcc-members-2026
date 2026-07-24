// VisualEngine is loaded dynamically, below — it pulls in Three.js from a
// CDN, and a static import here would mean a slow/unreachable network takes
// the whole module (playback, file picker, mic — everything) down with it.
import { AudioEngine } from './js/audio-engine.js';
import { AIDirector } from './js/ai-director.js';
import { parseID3, guessFromFilename } from './js/id3.js';

const $ = (sel) => document.querySelector(sel);

const root = $('#mv-root');
const canvas = $('#mv-canvas');
const dropHint = $('#mv-drop-hint');
const overlay = $('#mv-overlay');
const themePill = $('#mv-theme-pill');
const player = $('#mv-player');
const perfEl = $('#mv-perf');

const artImg = $('#mv-art');
const artFallback = $('#mv-art-fallback');
const titleEl = $('#mv-title');
const artistEl = $('#mv-artist');
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

const queueToggleBtn = $('#mv-queue-toggle');
const queuePanel = $('#mv-queue-panel');
const queueList = $('#mv-queue-list');
const queueCloseBtn = $('#mv-queue-close');
const shuffleBtn = $('#mv-shuffle');
const repeatBtn = $('#mv-repeat');

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
  renderQueue();
}

async function loadTrack(index, { autoplay = false } = {}) {
  const track = playlist[index];
  if (!track) return;
  currentIndex = index;
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

  try {
    audioEngine.connectAudioElement(audioEl);
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
  if (!queuePanel.hidden) renderQueue();
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

// ---- Theme pill ----

let lastThemeName = null;
function updateThemePill(name) {
  if (name === lastThemeName) return;
  lastThemeName = name;
  themePill.innerHTML = `<span class="mv-theme-dot"></span>${name}`;
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
  const directorState = director.update(features, dt);
  visualEngine.setParticleBudget(BASE_PARTICLE_BUDGET * qualityScale * directorState.particleDensity);
  visualEngine.setBloomStrength(Math.min(2.6, directorState.bloomStrength));
  visualEngine.update(features, directorState);
  visualEngine.render();
  updateThemePill(directorState.themeName);
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
  for (const url of objectUrls) URL.revokeObjectURL(url);
});

// Toggle the small perf readout with "d" for anyone debugging on a shared
// worship-room laptop; hidden by default so it doesn't clutter the stage view.
window.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') perfEl.hidden = !perfEl.hidden;
});
