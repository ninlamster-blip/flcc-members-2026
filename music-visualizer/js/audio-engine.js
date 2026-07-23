// Real-time audio analysis over the Web Audio API. No ML instrument
// separation here — just honest frequency-band energy + per-band onset
// (transient) detection, which is what a browser can actually give you.
// Bands follow the classic mix-engineering ranges: kick/bass/low-mid
// (guitar-ish) sit below the vocal presence range, snare/hihat/cymbal
// above it. "Vocals", "guitar" etc. below are band *labels*, not claims
// of true source separation.

const BAND_DEFS = [
  { key: 'kick',      lo: 20,   hi: 60,    percussive: true,  refractoryMs: 110 },
  { key: 'bass',      lo: 60,   hi: 250,   percussive: false },
  { key: 'lowGuitar', lo: 250,  hi: 500,   percussive: false },
  { key: 'vocals',    lo: 500,  hi: 2000,  percussive: false },
  { key: 'snare',     lo: 2000, hi: 4000,  percussive: true,  refractoryMs: 90 },
  { key: 'hihat',     lo: 4000, hi: 8000,  percussive: true,  refractoryMs: 55 },
  { key: 'cymbals',   lo: 8000, hi: 16000, percussive: false },
];

const HISTORY_LEN = 45; // ~0.75s at 60fps, used for adaptive onset thresholds
const BPM_WINDOW_MS = 8000;
const MIN_ONSET_INTERVAL_S = 0.28; // ~214 BPM ceiling
const MAX_ONSET_INTERVAL_S = 1.10; // ~55 BPM floor

export class AudioEngine {
  constructor() {
    this.context = null;
    this.analyser = null;
    this.freqData = null;
    this.fileSource = null;
    this.micSource = null;
    this.micStream = null;
    this.mode = null; // 'file' | 'mic'

    this._bandHistory = new Map();
    for (const b of BAND_DEFS) this._bandHistory.set(b.key, []);
    this._lastHitAt = new Map();
    this._onsetTimestamps = [];
    this._bpmSmoothed = null;
    this._energySmoothed = 0;
  }

  _ensureContext() {
    if (this.context) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.context = new Ctx();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.75;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  /** Bind to a single, persistent <audio> element (created once, src swapped per track). */
  connectAudioElement(audioEl) {
    this._ensureContext();
    if (this.context.state === 'suspended') this.context.resume();
    if (!this.fileSource) {
      this.fileSource = this.context.createMediaElementSource(audioEl);
    }
    this._activateFileMode();
  }

  _activateFileMode() {
    if (this.mode === 'file') return;
    if (this.micSource) { try { this.micSource.disconnect(); } catch {} }
    try { this.fileSource.disconnect(); } catch {}
    this.fileSource.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    this.mode = 'file';
  }

  async connectMicrophone() {
    this._ensureContext();
    if (this.context.state === 'suspended') await this.context.resume();
    if (!this.micStream) {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      this.micSource = this.context.createMediaStreamSource(this.micStream);
    }
    if (this.fileSource) { try { this.fileSource.disconnect(); } catch {} }
    try { this.analyser.disconnect(); } catch {}
    this.micSource.connect(this.analyser);
    // Deliberately NOT connected to destination — avoids feedback howl.
    this.mode = 'mic';
  }

  stopMicrophone() {
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) track.stop();
      this.micStream = null;
      this.micSource = null;
    }
  }

  get sampleRate() { return this.context ? this.context.sampleRate : 44100; }

  _binForHz(hz) {
    const binHz = this.sampleRate / this.analyser.fftSize;
    return Math.min(this.freqData.length - 1, Math.max(0, Math.round(hz / binHz)));
  }

  /** Call once per animation frame. Returns a features snapshot. */
  update() {
    if (!this.analyser) return this._emptyFeatures();
    this.analyser.getByteFrequencyData(this.freqData);

    const now = performance.now();
    const bands = {};
    let overallSum = 0;
    let overallCount = 0;

    for (const def of BAND_DEFS) {
      const loBin = this._binForHz(def.lo);
      const hiBin = Math.max(loBin + 1, this._binForHz(def.hi));
      let sum = 0;
      for (let i = loBin; i < hiBin; i++) sum += this.freqData[i];
      const avg = sum / ((hiBin - loBin) * 255);
      overallSum += sum;
      overallCount += (hiBin - loBin);

      const hist = this._bandHistory.get(def.key);
      hist.push(avg);
      if (hist.length > HISTORY_LEN) hist.shift();

      let hit = false;
      if (def.percussive && hist.length >= 8) {
        const mean = hist.reduce((a, v) => a + v, 0) / hist.length;
        const threshold = Math.max(0.06, mean * 1.55);
        const lastHit = this._lastHitAt.get(def.key) || 0;
        if (avg > threshold && (now - lastHit) > def.refractoryMs) {
          hit = true;
          this._lastHitAt.set(def.key, now);
          if (def.key === 'kick' || def.key === 'snare') {
            this._onsetTimestamps.push(now);
          }
        }
      }

      bands[def.key] = { energy: avg, hit, strength: hit ? avg : 0 };
    }

    const overallEnergy = overallCount ? (overallSum / (overallCount * 255)) : 0;
    this._energySmoothed += (overallEnergy - this._energySmoothed) * 0.15;

    this._pruneOnsets(now);
    const bpm = this._estimateBpm(now);

    return {
      bands,
      overallEnergy,
      overallEnergySmoothed: this._energySmoothed,
      bpm,
      mode: this.mode,
      time: now,
    };
  }

  _pruneOnsets(now) {
    while (this._onsetTimestamps.length && now - this._onsetTimestamps[0] > BPM_WINDOW_MS) {
      this._onsetTimestamps.shift();
    }
  }

  _estimateBpm(now) {
    const stamps = this._onsetTimestamps;
    if (stamps.length < 4) return this._bpmSmoothed;

    const intervals = [];
    for (let i = 1; i < stamps.length; i++) {
      const s = (stamps[i] - stamps[i - 1]) / 1000;
      if (s >= MIN_ONSET_INTERVAL_S && s <= MAX_ONSET_INTERVAL_S) intervals.push(s);
    }
    if (intervals.length < 3) return this._bpmSmoothed;

    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    const bpm = 60 / median;
    if (bpm >= 55 && bpm <= 220) {
      this._bpmSmoothed = this._bpmSmoothed == null ? bpm : this._bpmSmoothed + (bpm - this._bpmSmoothed) * 0.12;
    }
    return this._bpmSmoothed;
  }

  _emptyFeatures() {
    const bands = {};
    for (const def of BAND_DEFS) bands[def.key] = { energy: 0, hit: false, strength: 0 };
    return { bands, overallEnergy: 0, overallEnergySmoothed: 0, bpm: null, mode: this.mode, time: performance.now() };
  }
}

export { BAND_DEFS };
