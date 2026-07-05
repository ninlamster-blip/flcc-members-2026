/**
 * AudioManager — subtle, fully synthesized sound via the native Web Audio
 * API (no audio files shipped, works fully offline). Every cue is a soft
 * tone or filtered-noise burst, envelope-shaped to stay gentle — never
 * arcade-like. Respects SaveManager settings.soundOn.
 */
(function (global) {
  'use strict';

  class AudioManager {
    constructor() {
      this.ctx = null;
      this.master = null;
      this._unlocked = false;
    }

    ensureUnlocked() {
      if (this._unlocked) return;
      this._unlocked = true;
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = global.DB_SAVE.data.settings.soundOn ? 0.5 : 0;
      this.master.connect(this.ctx.destination);
    }

    setEnabled(enabled) {
      global.DB_SAVE.data.settings.soundOn = enabled;
      global.DB_SAVE.save();
      if (this.master) this.master.gain.setTargetAtTime(enabled ? 0.5 : 0, this.ctx.currentTime, 0.05);
    }

    isEnabled() { return global.DB_SAVE.data.settings.soundOn; }

    _tone(freq, duration, opts) {
      opts = opts || {};
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + (opts.delay || 0);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = opts.type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + duration);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(opts.peak || 0.18, t0 + Math.min(0.05, duration * 0.3));
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    }

    _noiseBurst(duration, opts) {
      opts = opts || {};
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + (opts.delay || 0);
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = opts.freq || 1200;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(opts.peak || 0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    }

    /** Soft paper/box rustle as the lid begins to lift. */
    playOpen() {
      this.ensureUnlocked();
      this._noiseBurst(0.5, { freq: 900, peak: 0.1 });
      this._tone(220, 1.4, { type: 'sine', glideTo: 330, peak: 0.08, delay: 0.1 });
    }

    /** Warm ascending chime as light/particles reveal the card. */
    playReveal(rarity) {
      this.ensureUnlocked();
      const notes = { common: [523], rare: [523, 659], epic: [523, 659, 784], legendary: [523, 659, 784, 988], miracle: [523, 659, 784, 988, 1318] };
      const seq = notes[rarity] || notes.common;
      seq.forEach((freq, i) => this._tone(freq, 0.9, { type: 'sine', peak: 0.14, delay: i * 0.09 }));
    }

    /** Gentle glass tick for coin/xp counters ticking up. */
    playTick() {
      this.ensureUnlocked();
      this._tone(880, 0.08, { type: 'triangle', peak: 0.05 });
    }

    /** Warm chime for milestone/collection celebrations. */
    playCelebrate() {
      this.ensureUnlocked();
      [523, 659, 784, 1046].forEach((freq, i) => this._tone(freq, 1.1, { type: 'sine', peak: 0.16, delay: i * 0.11 }));
    }

    /** Soft UI tap for navigation/buttons. */
    playTap() {
      this.ensureUnlocked();
      this._tone(392, 0.12, { type: 'sine', peak: 0.06 });
    }
  }

  global.DB_AUDIO = new AudioManager();
})(window);
