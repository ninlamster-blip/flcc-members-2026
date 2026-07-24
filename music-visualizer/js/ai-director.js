// AI Visual Director — no cloud model involved (this is a static site with
// no backend), just a small on-device heuristic scorer that reads the same
// features the visual engine does (energy, BPM, bass/treble balance,
// percussive hit-rate) and picks a mood/theme, crossfading into it instead
// of hard-cutting. Hues are 0..1 (THREE.Color#setHSL convention).
//
// Two layers of "direction" happen here, both plain rule-based heuristics —
// no learning, no memory across songs, nothing that would justify calling
// this an ML agent:
//
// 1. Reactive: theme/mood scoring and camera-mode rotation, both driven by
//    the current moment's audio features (see THEMES and _pickSceneMode).
// 2. Anticipatory ("director agent"): a periodic self-check (_agentTick)
//    that asks "has anything happened lately?" and, when a track's song
//    structure has been analyzed (structure-analyzer.js), a lookahead
//    (_updateStructureAwareness) that ramps particle density / bloom /
//    camera speed up or down in the seconds before a section boundary,
//    based on whether the next section measures louder or quieter than the
//    current one. It's a smooth ramp, not a countdown — nothing is shown
//    on screen naming what's about to happen, it's just felt.

// reactivity scales how hard kick/snare hits actually punch the scene (core
// pulse, ring size/brightness, camera dolly, bloom flash) — this is what
// makes the same kick drum hit differently depending on what the director
// thinks the song is: a hard-hitting EDM/Rock drop should slam the camera,
// the same transient in a Classical passage should barely nudge it.
// Scores a BPM match without letting an *undetected* tempo (common for
// non-percussive genres — acoustic, classical, jazz ballads never lock a
// clean onset train) silently favor whichever theme's fallback number
// happens to equal its own target. Missing data gets a modest, deliberately
// sub-neutral credit instead of a free ride.
function bpmScore(bpm, target, spread) {
  if (bpm == null) return 0.3;
  return clamp01(1 - Math.abs(bpm - target) / spread);
}

// A user-facing "mood" reframe of each theme, shown in the UI instead of
// the internal genre name — same underlying heuristic read, just labeled
// the way a listener thinks about it rather than how the code organizes it.
const THEMES = [
  {
    name: 'Worship', mood: { emoji: '\u{1F64F}', label: 'Worship' },
    hue: 0.10, secondaryHue: 0.07, bgHue: 0.08, sat: 0.65, bgLight: 0.045,
    particleDensity: 0.7, cameraSpeed: 0.55, bloomBase: 1.05, reactivity: 0.85,
    score(s) { return clamp01(1 - Math.abs(s.energy - 0.35) * 1.8) * 0.6 + bpmScore(s.bpm, 78, 60) * 0.4; },
  },
  {
    name: 'Rock', mood: { emoji: '⚡', label: 'Epic' },
    hue: 0.98, secondaryHue: 0.06, bgHue: 0.0, sat: 0.75, bgLight: 0.03,
    particleDensity: 1.1, cameraSpeed: 1.55, bloomBase: 1.25, reactivity: 1.3,
    score(s) { return clamp01(s.energy * 1.3) * 0.5 + clamp01(s.hitRate / 3) * 0.3 + clamp01(s.bassDominance) * 0.2; },
  },
  {
    name: 'Jazz', mood: { emoji: '\u{1F319}', label: 'Smooth' },
    hue: 0.74, secondaryHue: 0.80, bgHue: 0.72, sat: 0.55, bgLight: 0.04,
    particleDensity: 0.5, cameraSpeed: 0.45, bloomBase: 0.95, reactivity: 0.75,
    score(s) { return clamp01(1 - s.energy) * 0.3 + clamp01(1 - s.hitRate / 3) * 0.25 + clamp01(s.trebleEnergy * 1.8) * 0.45; },
  },
  {
    name: 'EDM', mood: { emoji: '\u{1F525}', label: 'Energetic' },
    hue: 0.52, secondaryHue: 0.88, bgHue: 0.6, sat: 0.85, bgLight: 0.035,
    particleDensity: 1.7, cameraSpeed: 1.85, bloomBase: 1.55, reactivity: 1.55,
    score(s) { return clamp01(s.energy * 1.4) * 0.45 + bpmScore(s.bpm, 128, 45) * 0.35 + clamp01(s.hitRate / 4) * 0.2; },
  },
  {
    name: 'Classical', mood: { emoji: '✨', label: 'Elegant' },
    hue: 0.58, secondaryHue: 0.11, bgHue: 0.6, sat: 0.35, bgLight: 0.05,
    particleDensity: 0.45, cameraSpeed: 0.4, bloomBase: 0.9, reactivity: 0.6,
    score(s) {
      return clamp01(1 - s.energy * 1.3) * 0.4
           + clamp01(1 - s.hitRate / 1.5) * 0.3
           + clamp01(1 - s.bassDominance) * 0.15
           + clamp01(1 - s.vocalsEnergy * 1.5) * 0.15;
    },
  },
  {
    // Acoustic: guitar/vocal centric, little to no drum kit, not bass-heavy.
    name: 'Acoustic', mood: { emoji: '\u{1F60A}', label: 'Joyful' },
    hue: 0.13, secondaryHue: 0.09, bgHue: 0.11, sat: 0.5, bgLight: 0.045,
    particleDensity: 0.55, cameraSpeed: 0.5, bloomBase: 0.95, reactivity: 0.7,
    score(s) {
      return clamp01(1 - Math.abs(s.energy - 0.28) * 2.2) * 0.3
           + clamp01(1 - s.hitRate / 1.2) * 0.3
           + clamp01(1 - s.bassDominance * 1.3) * 0.2
           + clamp01(s.vocalsEnergy * 1.3) * 0.2;
    },
  },
  {
    // R&B: slow-mid groove, bass-forward but smooth (not aggressive hits),
    // vocal-led.
    name: 'R&B', mood: { emoji: '❤️', label: 'Romantic' },
    hue: 0.83, secondaryHue: 0.90, bgHue: 0.85, sat: 0.65, bgLight: 0.035,
    particleDensity: 0.75, cameraSpeed: 0.6, bloomBase: 1.1, reactivity: 0.95,
    score(s) {
      return clamp01(1 - Math.abs(s.energy - 0.45) * 1.8) * 0.3
           + bpmScore(s.bpm, 82, 45) * 0.2
           + clamp01(s.bassDominance * 1.1) * 0.2
           + clamp01(s.vocalsEnergy * 1.3) * 0.3;
    },
  },
  {
    // Soft: ballads, ambient pop, intimate vocal-forward low-energy songs.
    name: 'Soft', mood: { emoji: '\u{1F327}️', label: 'Melancholy' },
    hue: 0.88, secondaryHue: 0.95, bgHue: 0.9, sat: 0.42, bgLight: 0.055,
    particleDensity: 0.4, cameraSpeed: 0.35, bloomBase: 0.85, reactivity: 0.55,
    score(s) {
      return clamp01(1 - s.energy * 2.2) * 0.3
           + bpmScore(s.bpm, 68, 40) * 0.15
           + clamp01(1 - s.hitRate / 0.8) * 0.2
           + clamp01(s.vocalsEnergy * 1.4) * 0.35;
    },
  },
  {
    name: 'Ambient', mood: { emoji: '\u{1F30C}', label: 'Ambient' },
    hue: 0.55, secondaryHue: 0.75, bgHue: 0.6, sat: 0.4, bgLight: 0.04,
    particleDensity: 0.65, cameraSpeed: 0.6, bloomBase: 1.0, reactivity: 0.8,
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

// Camera "moves" the director rotates between periodically, independent of
// the mood/theme cycle above — this is what keeps a single song from
// feeling like a looping animation instead of a directed performance. Each
// mode is a set of MOTION PARAMETERS, not a hard camera position, and
// sceneParams below is crossfaded toward whichever mode is current at
// SCENE_PARAM_LERP_RATE — slow and cinematic, so a mode change is a
// gradual drift into a different move, never a cut.
const CAMERA_MODES = {
  orbit:      { radiusBase: 7.2, radiusAmp: 0.0, radiusFreq: 0.00, thetaSpeedMult: 1.00, driftAmp: 0.0, fovBias: 0 },
  push:       { radiusBase: 6.4, radiusAmp: 2.0, radiusFreq: 0.045, thetaSpeedMult: 0.35, driftAmp: 0.0, fovBias: -2 },
  drift:      { radiusBase: 7.6, radiusAmp: 0.5, radiusFreq: 0.09, thetaSpeedMult: 0.55, driftAmp: 1.4, fovBias: 0 },
  flythrough: { radiusBase: 3.4, radiusAmp: 1.6, radiusFreq: 0.12, thetaSpeedMult: 1.40, driftAmp: 0.4, fovBias: 6 },
};
const CAMERA_MODE_NAMES = Object.keys(CAMERA_MODES);
const SCENE_CHANGE_MIN_MS = 7000;
const SCENE_CHANGE_MAX_MS = 13000;
const SCENE_PARAM_LERP_RATE = 0.35; // per second

// ---- Director agent: periodic self-check + structure lookahead ----
const AGENT_TICK_MS = 2600; // how often the agent "checks in" on itself
const MONOTONY_MS = 18000; // force a moment if nothing has visibly happened in this long
const MONOTONY_MIN_ENERGY = 0.12; // ...but not during a genuinely quiet passage
const ANTICIPATION_WINDOW_S = 6; // seconds before a segment boundary where build-up begins
const ANTICIPATION_ENERGY_DELTA = 0.015; // |energy delta| below this reads as "about the same," not louder/quieter
const ANTICIPATION_LERP_RATE = 2.5; // per second — smooth ramp, not a snap
const ARRIVAL_RESCHEDULE_MS = [250, 650]; // how soon a camera-mode change can land right on an "up" arrival

export class AIDirector {
  constructor() {
    this.currentTheme = THEMES[THEMES.length - 1];
    this.candidateTheme = null;
    this.candidateStableFrames = 0;

    this.palette = {
      hue: this.currentTheme.hue, secondaryHue: this.currentTheme.secondaryHue,
      bgHue: this.currentTheme.bgHue, sat: this.currentTheme.sat, bgLight: this.currentTheme.bgLight,
      reactivity: this.currentTheme.reactivity,
    };

    this._hitTimestamps = [];
    this._energyHistory = [];
    this._fastLockUntil = 0;

    this.cameraMode = 'orbit';
    this.sceneParams = { ...CAMERA_MODES.orbit };
    this._momentId = 0;
    this._momentType = null;
    // Public, externally settable — app.js's Focus/Party visual-mode presets
    // use this to rotate camera moves less often (Focus) or more often
    // (Party) without touching the rotation logic itself. 1 = unchanged.
    this.sceneChangeMultiplier = 1;
    this._nextSceneChangeAt = performance.now() + this._randomSceneInterval();

    // Director agent state — see the file header for what this layer does.
    this._lastMomentAt = performance.now();
    this._nextAgentTickAt = performance.now() + AGENT_TICK_MS;
    this._lastSegmentIndex = -1;
    this._anticipation = 0; // 0..1, how close to a predicted section boundary
    this._anticipationDirection = 0; // smoothed -1..1: heading into a quieter/louder section
  }

  _randomSceneInterval() {
    return (SCENE_CHANGE_MIN_MS + Math.random() * (SCENE_CHANGE_MAX_MS - SCENE_CHANGE_MIN_MS)) * this.sceneChangeMultiplier;
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
    // Every song opens on a calm, familiar orbit — scene variety kicks in
    // a while after that, not the instant a track starts.
    this.cameraMode = 'orbit';
    this._momentType = null;
    this._nextSceneChangeAt = performance.now() + this._randomSceneInterval();

    this._lastMomentAt = performance.now();
    this._nextAgentTickAt = performance.now() + AGENT_TICK_MS;
    this._lastSegmentIndex = -1;
    this._anticipation = 0;
    this._anticipationDirection = 0;
  }

  // `structureContext`, when given, is `{ currentTime, segments }` — the
  // playing track's song-structure segments (structure-analyzer.js) and the
  // current playback position in seconds. Omit it (no analysis yet, or none
  // found) and the agent simply has no lookahead to work with — everything
  // else behaves exactly as before.
  update(features, dtSeconds, structureContext) {
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
      vocalsEnergy: bands.vocals.energy,
    };

    this._pickTheme(stats, now);
    this._advancePalette(dtSeconds, now < this._fastLockUntil);
    this._pickSceneMode(now);
    this._advanceSceneParams(dtSeconds);
    this._updateStructureAwareness(structureContext, now, dtSeconds);
    this._agentTick(now, stats.energy);

    const energy = stats.energy;

    // Structure-aware build/settle: ramps toward an upcoming louder section
    // (denser particles, brighter bloom, quicker camera) or eases toward a
    // quieter one (the inverse), based on the real per-segment energy
    // measured during structure analysis — not a guess. Purely felt, no
    // on-screen countdown; capped modest so it shades the theme's own read
    // rather than overriding it.
    const anticipationBoost = this._anticipation * this._anticipationDirection;
    const particleDensity = this.currentTheme.particleDensity * (1 + anticipationBoost * 0.35);
    const cameraSpeedMult = (0.85 + energy * 0.35) * (1 + anticipationBoost * 0.25);
    const bloomStrength = this.currentTheme.bloomBase + energy * 0.7 + anticipationBoost * 0.5;

    return {
      themeName: this.currentTheme.name,
      mood: this.currentTheme.mood,
      hue: this.palette.hue,
      secondaryHue: this.palette.secondaryHue,
      bgHue: this.palette.bgHue,
      sat: this.palette.sat,
      bgLight: this.palette.bgLight,
      particleDensity,
      cameraSpeed: this.currentTheme.cameraSpeed * cameraSpeedMult,
      bloomStrength,
      reactivity: this.palette.reactivity,
      cameraMode: this.cameraMode,
      sceneParams: this.sceneParams,
      momentId: this._momentId,
      momentType: this._momentType,
      anticipation: anticipationBoost,
      energy,
      bpm: stats.bpm,
    };
  }

  // Periodically hands the camera a different "move" to crossfade into —
  // orbit/push/drift/flythrough — weighted by how energetic the current
  // theme read is, so a Rock/EDM passage is more likely to get a flythrough
  // and a Classical/Soft one drifts instead. Never during the fast-lock
  // window right as a song starts (too much already changing at once), and
  // never repeats the mode it's already in.
  _pickSceneMode(now) {
    if (now < this._nextSceneChangeAt) return;
    this._nextSceneChangeAt = now + this._randomSceneInterval();
    if (now < this._fastLockUntil) return;

    const reactivity = this.palette.reactivity;
    const weights = {
      orbit: 0.5,
      push: 0.45,
      drift: Math.max(0.15, 0.65 - reactivity * 0.35),
      flythrough: Math.max(0.1, reactivity * 0.55),
    };
    const candidates = CAMERA_MODE_NAMES.filter((m) => m !== this.cameraMode);
    const totalWeight = candidates.reduce((sum, m) => sum + weights[m], 0);
    let roll = Math.random() * totalWeight;
    let chosen = candidates[candidates.length - 1];
    for (const mode of candidates) {
      roll -= weights[mode];
      if (roll <= 0) { chosen = mode; break; }
    }
    this.cameraMode = chosen;

    // Occasionally punctuate a mode change with a one-shot particle burst —
    // not every time (that would itself become a repetitive pattern).
    if (Math.random() < 0.4) {
      this._momentId++;
      this._momentType = 'burst';
      this._lastMomentAt = now;
    }
  }

  // Structure lookahead: finds which segment is currently playing and, if
  // a next one exists, ramps _anticipation/_anticipationDirection toward it
  // over the final ANTICIPATION_WINDOW_S seconds. Also fires a "landing"
  // burst the instant playback actually crosses into a new segment, and —
  // only when arriving at a measurably louder section — pulls the next
  // scene-mode rotation forward so a camera change has a chance to land
  // right on the arrival instead of at its own unrelated schedule.
  _updateStructureAwareness(structureContext, now, dtSeconds) {
    let targetAnticipation = 0;
    let targetDirection = 0;

    if (structureContext && structureContext.segments && structureContext.segments.length) {
      const { segments, currentTime } = structureContext;
      const idx = segments.findIndex((s) => currentTime >= s.start && currentTime < s.end);

      if (idx !== -1 && idx !== this._lastSegmentIndex && this._lastSegmentIndex !== -1) {
        this._momentId++;
        this._momentType = 'burst';
        this._lastMomentAt = now;

        const arriving = segments[idx];
        const previous = segments[idx - 1];
        if (previous && arriving.energy - previous.energy > ANTICIPATION_ENERGY_DELTA
            && this._nextSceneChangeAt - now > 2500) {
          const [minMs, maxMs] = ARRIVAL_RESCHEDULE_MS;
          this._nextSceneChangeAt = now + minMs + Math.random() * (maxMs - minMs);
        }
      }
      this._lastSegmentIndex = idx;

      if (idx !== -1 && idx + 1 < segments.length) {
        const current = segments[idx];
        const next = segments[idx + 1];
        const timeToNext = current.end - currentTime;
        if (timeToNext > 0 && timeToNext <= ANTICIPATION_WINDOW_S
            && isFinite(current.energy) && isFinite(next.energy)) {
          targetAnticipation = clamp01(1 - timeToNext / ANTICIPATION_WINDOW_S);
          const delta = next.energy - current.energy;
          targetDirection = delta > ANTICIPATION_ENERGY_DELTA ? 1 : delta < -ANTICIPATION_ENERGY_DELTA ? -1 : 0;
        }
      }
    } else {
      this._lastSegmentIndex = -1;
    }

    const t = clamp01(ANTICIPATION_LERP_RATE * dtSeconds);
    this._anticipation = lerp(this._anticipation, targetAnticipation, t);
    this._anticipationDirection = lerp(this._anticipationDirection, targetDirection, t);
  }

  // "Is this getting repetitive?" — a periodic self-check independent of
  // both the theme scorer and the scene-mode rotation. If nothing has
  // visibly happened in a while (no scene change, no structure arrival) and
  // the track isn't just genuinely quiet, give the scene something to do
  // rather than waiting on the natural rotation's own dice roll.
  _agentTick(now, energy) {
    if (now < this._nextAgentTickAt) return;
    this._nextAgentTickAt = now + AGENT_TICK_MS * (0.85 + Math.random() * 0.3);

    if (now - this._lastMomentAt > MONOTONY_MS && energy > MONOTONY_MIN_ENERGY) {
      this._momentId++;
      this._momentType = 'burst';
      this._lastMomentAt = now;
    }
  }

  _advanceSceneParams(dtSeconds) {
    const t = clamp01(SCENE_PARAM_LERP_RATE * dtSeconds);
    const target = CAMERA_MODES[this.cameraMode];
    for (const key of Object.keys(target)) {
      this.sceneParams[key] = lerp(this.sceneParams[key], target[key], t);
    }
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
    this.palette.reactivity = lerp(this.palette.reactivity, target.reactivity, t);
  }
}
