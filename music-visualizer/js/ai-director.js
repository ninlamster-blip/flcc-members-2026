// AI Visual Director — no cloud model involved (this is a static site with
// no backend), just a small on-device heuristic scorer that reads the same
// features the visual engine does (energy, BPM, bass/treble balance,
// percussive hit-rate) and picks a mood/theme, crossfading into it instead
// of hard-cutting. Hues are 0..1 (THREE.Color#setHSL convention).

const THEMES = [
  {
    name: 'Worship', hue: 0.10, secondaryHue: 0.07, bgHue: 0.08, sat: 0.65, bgLight: 0.045,
    particleDensity: 0.7, cameraSpeed: 0.55, bloomBase: 1.05,
    score(s) { return clamp01(1 - Math.abs(s.energy - 0.35) * 1.2) * 0.6 + clamp01(1 - Math.abs((s.bpm || 80) - 78) / 60) * 0.4; },
  },
  {
    name: 'Rock', hue: 0.98, secondaryHue: 0.06, bgHue: 0.0, sat: 0.75, bgLight: 0.03,
    particleDensity: 1.1, cameraSpeed: 1.55, bloomBase: 1.25,
    score(s) { return clamp01(s.energy * 1.3) * 0.5 + clamp01(s.hitRate / 3) * 0.3 + clamp01(s.bassDominance) * 0.2; },
  },
  {
    name: 'Jazz', hue: 0.74, secondaryHue: 0.80, bgHue: 0.72, sat: 0.55, bgLight: 0.04,
    particleDensity: 0.5, cameraSpeed: 0.45, bloomBase: 0.95,
    score(s) { return clamp01(1 - s.energy) * 0.45 + clamp01(1 - s.hitRate / 2) * 0.35 + clamp01(s.trebleEnergy) * 0.2; },
  },
  {
    name: 'EDM', hue: 0.52, secondaryHue: 0.88, bgHue: 0.6, sat: 0.85, bgLight: 0.035,
    particleDensity: 1.7, cameraSpeed: 1.85, bloomBase: 1.55,
    score(s) { return clamp01(s.energy * 1.4) * 0.45 + clamp01(((s.bpm || 0) - 118) / 60) * 0.35 + clamp01(s.hitRate / 4) * 0.2; },
  },
  {
    name: 'Classical', hue: 0.58, secondaryHue: 0.11, bgHue: 0.6, sat: 0.35, bgLight: 0.05,
    particleDensity: 0.45, cameraSpeed: 0.4, bloomBase: 0.9,
    score(s) { return clamp01(1 - s.energy * 1.3) * 0.5 + clamp01(1 - s.hitRate / 1.5) * 0.35 + clamp01(1 - s.bassDominance) * 0.15; },
  },
  {
    name: 'Ambient', hue: 0.55, secondaryHue: 0.75, bgHue: 0.6, sat: 0.4, bgLight: 0.04,
    particleDensity: 0.65, cameraSpeed: 0.6, bloomBase: 1.0,
    score() { return 0.22; }, // quiet fallback so *something* always scores reasonably
  },
];

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpHue(a, b, t) {
  let diff = ((b - a + 0.5) % 1 + 1) % 1 - 0.5;
  return ((a + diff * t) % 1 + 1) % 1;
}

const STABLE_FRAMES_TO_SWITCH = 130; // ~2.2s at 60fps — avoids flicker between close scores mid-song
const FAST_LOCK_FRAMES = 10; // ~0.15s — used right after a new track starts, see reset()
const FAST_LOCK_MS = 3500; // how long after reset() the fast-lock window stays open
const PALETTE_LERP_RATE = 1.1; // per second

export class AIDirector {
  constructor() {
    this.currentTheme = THEMES[THEMES.length - 1];
    this.candidateTheme = null;
    this.candidateStableFrames = 0;

    this.palette = {
      hue: this.currentTheme.hue, secondaryHue: this.currentTheme.secondaryHue,
      bgHue: this.currentTheme.bgHue, sat: this.currentTheme.sat, bgLight: this.currentTheme.bgLight,
    };

    this._hitTimestamps = [];
    this._energyHistory = [];
    this._fastLockUntil = 0;
  }

  /** Call when a new track starts — lets the director snap to a fitting
   * theme almost immediately from the first second of audio, instead of
   * crawling there over the ~2s hysteresis window meant to prevent
   * mid-song flicker (which reads as sluggish right when a song begins). */
  reset() {
    this._hitTimestamps = [];
    this.candidateTheme = null;
    this.candidateStableFrames = 0;
    this._fastLockUntil = performance.now() + FAST_LOCK_MS;
  }

  update(features, dtSeconds) {
    const now = features.time;
    const { bands } = features;

    if (bands.kick.hit || bands.snare.hit) this._hitTimestamps.push(now);
    while (this._hitTimestamps.length && now - this._hitTimestamps[0] > 4000) this._hitTimestamps.shift();
    const hitRate = this._hitTimestamps.length / 4;

    const bassEnergy = (bands.kick.energy + bands.bass.energy) / 2;
    const trebleEnergy = (bands.hihat.energy + bands.cymbals.energy) / 2;
    const bassDominance = bassEnergy / (bassEnergy + trebleEnergy + 1e-6);

    const stats = {
      energy: features.overallEnergySmoothed,
      bpm: features.bpm,
      hitRate,
      bassDominance,
      trebleEnergy,
    };

    this._pickTheme(stats, now);
    this._advancePalette(dtSeconds, now < this._fastLockUntil);

    const energy = stats.energy;
    return {
      themeName: this.currentTheme.name,
      hue: this.palette.hue,
      secondaryHue: this.palette.secondaryHue,
      bgHue: this.palette.bgHue,
      sat: this.palette.sat,
      bgLight: this.palette.bgLight,
      particleDensity: this.currentTheme.particleDensity,
      cameraSpeed: this.currentTheme.cameraSpeed * (0.85 + energy * 0.35),
      bloomStrength: this.currentTheme.bloomBase + energy * 0.7,
      energy,
      bpm: stats.bpm,
    };
  }

  _pickTheme(stats, now) {
    let best = THEMES[0];
    let bestScore = -Infinity;
    for (const theme of THEMES) {
      const score = theme.score(stats);
      if (score > bestScore) { bestScore = score; best = theme; }
    }

    if (best === this.currentTheme) {
      this.candidateTheme = null;
      this.candidateStableFrames = 0;
      return;
    }

    if (best === this.candidateTheme) {
      this.candidateStableFrames++;
    } else {
      this.candidateTheme = best;
      this.candidateStableFrames = 1;
    }

    const framesNeeded = now < this._fastLockUntil ? FAST_LOCK_FRAMES : STABLE_FRAMES_TO_SWITCH;
    if (this.candidateStableFrames >= framesNeeded) {
      this.currentTheme = best;
      this.candidateTheme = null;
      this.candidateStableFrames = 0;
    }
  }

  _advancePalette(dtSeconds, fastLock) {
    const t = clamp01((fastLock ? PALETTE_LERP_RATE * 3 : PALETTE_LERP_RATE) * dtSeconds);
    const target = this.currentTheme;
    this.palette.hue = lerpHue(this.palette.hue, target.hue, t);
    this.palette.secondaryHue = lerpHue(this.palette.secondaryHue, target.secondaryHue, t);
    this.palette.bgHue = lerpHue(this.palette.bgHue, target.bgHue, t);
    this.palette.sat = lerp(this.palette.sat, target.sat, t);
    this.palette.bgLight = lerp(this.palette.bgLight, target.bgLight, t);
  }
}
