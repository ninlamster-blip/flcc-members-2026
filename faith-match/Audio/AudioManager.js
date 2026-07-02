/**
 * AudioManager — lightweight, fully synthesized audio using the native
 * Web Audio API. No audio files are shipped (keeps the game tiny and
 * fully offline); every sound is generated from oscillators with a
 * short gain envelope. Respects SaveManager's settings.musicOn/sfxOn
 * and persists changes made through setMusicEnabled/setSfxEnabled.
 */
(function (global) {
  'use strict';

  class AudioManager {
    constructor() {
      this.ctx = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.musicNodes = [];
      this.musicPlaying = false;
      this._unlocked = false;
    }

    /** Web/mobile browsers require a user gesture before AudioContext can start; call on first pointerdown. */
    ensureUnlocked() {
      if (this._unlocked) return;
      this._unlocked = true;
      const Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = global.FM_SAVE.data.settings.musicOn ? global.FM_SAVE.data.settings.musicVolume : 0;
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = global.FM_SAVE.data.settings.sfxOn ? global.FM_SAVE.data.settings.sfxVolume : 0;
      this.sfxGain.connect(this.ctx.destination);
    }

    setMusicEnabled(enabled) {
      global.FM_SAVE.set('settings.musicOn', enabled);
      if (!this.ctx) return;
      const vol = enabled ? global.FM_SAVE.data.settings.musicVolume : 0;
      this.musicGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
      if (enabled && !this.musicPlaying) this.startAmbientMusic();
      if (!enabled) this.stopAmbientMusic();
    }

    setSfxEnabled(enabled) {
      global.FM_SAVE.set('settings.sfxOn', enabled);
      if (!this.ctx) return;
      const vol = enabled ? global.FM_SAVE.data.settings.sfxVolume : 0;
      this.sfxGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
    }

    // ---------------------------------------------------------------
    // Low-level tone helper
    // ---------------------------------------------------------------

    /**
     * Plays a single tone with a short attack/decay envelope.
     * @param {number} freq Hz
     * @param {number} duration seconds
     * @param {'sine'|'triangle'|'square'|'sawtooth'} type
     * @param {number} [startDelay] seconds from now
     * @param {number} [peakGain]
     */
    _tone(freq, duration, type, startDelay = 0, peakGain = 0.22) {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime + startDelay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.02, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }

    // ---------------------------------------------------------------
    // SFX
    // ---------------------------------------------------------------

    playTap() {
      this._tone(720, 0.06, 'sine', 0, 0.12);
    }

    playSwapInvalid() {
      this._tone(180, 0.12, 'square', 0, 0.15);
    }

    /** Match clear — pitch rises slightly with cascade depth for a satisfying escalating feel. */
    playMatch(cascadeDepth = 1) {
      const base = 440 + Math.min(cascadeDepth, 6) * 60;
      this._tone(base, 0.14, 'triangle', 0, 0.18);
      this._tone(base * 1.5, 0.14, 'triangle', 0.03, 0.12);
    }

    playSpecialActivate() {
      this._tone(300, 0.1, 'sawtooth', 0, 0.12);
      this._tone(600, 0.18, 'triangle', 0.05, 0.16);
      this._tone(900, 0.22, 'sine', 0.1, 0.14);
    }

    playCombo() {
      [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.16, 'triangle', i * 0.06, 0.16));
    }

    playPowerupUse() {
      this._tone(520, 0.08, 'square', 0, 0.14);
      this._tone(780, 0.12, 'sine', 0.05, 0.14);
    }

    /** Gentle completion sound for level win. */
    playWinFanfare() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => this._tone(f, 0.28, 'triangle', i * 0.11, 0.18));
    }

    playLose() {
      [392, 349, 294].forEach((f, i) => this._tone(f, 0.35, 'sine', i * 0.16, 0.16));
    }

    playAchievement() {
      [660, 880, 1100].forEach((f, i) => this._tone(f, 0.2, 'sine', i * 0.08, 0.18));
    }

    // ---------------------------------------------------------------
    // Ambient music (simple looping pad, purely synthesized)
    // ---------------------------------------------------------------

    startAmbientMusic() {
      if (!this.ctx || this.musicPlaying || !global.FM_SAVE.data.settings.musicOn) return;
      this.musicPlaying = true;
      const chord = [261.63, 329.63, 392.0]; // C major triad, soft pad
      chord.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value = i * 4;
        gain.gain.value = 0;
        gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 2);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        this.musicNodes.push({ osc, gain });
      });
    }

    stopAmbientMusic() {
      if (!this.ctx || !this.musicPlaying) return;
      this.musicPlaying = false;
      const now = this.ctx.currentTime;
      this.musicNodes.forEach(({ osc, gain }) => {
        gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.stop(now + 0.7);
      });
      this.musicNodes = [];
    }
  }

  global.AudioManager = global.AudioManager || new AudioManager();
})(window);
