// Lightweight WebAudio synth — every sound is generated at runtime so the
// game needs no audio assets (keeps the PWA small and instantly offline-able).
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('st_muted') === '1';
    this.musicOn = localStorage.getItem('st_music') !== '0';
    this.master = null;
    this.musicGain = null;
    this._musicNodes = [];
    this._musicTimer = null;
  }

  _ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = (this.muted || !this.musicOn) ? 0 : 0.12;
    this.musicGain.connect(this.ctx.destination);
  }

  resume() {
    this._ensure();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('st_muted', muted ? '1' : '0');
    if (this.master) this.master.gain.value = muted ? 0 : 0.55;
    if (this.musicGain) this.musicGain.gain.value = (muted || !this.musicOn) ? 0 : 0.12;
  }

  setMusicOn(on) {
    this.musicOn = on;
    localStorage.setItem('st_music', on ? '1' : '0');
    if (this.musicGain) this.musicGain.gain.value = (this.muted || !on) ? 0 : 0.12;
    if (on) this.startMusic(); else this.stopMusic();
  }

  _tone({ freq, duration = 0.12, type = 'sine', gain = 0.5, glideTo = null, delay = 0 }) {
    if (this.muted) return;
    this._ensure();
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  move() { this._tone({ freq: 320, duration: 0.045, type: 'sine', gain: 0.18 }); }
  rotate() { this._tone({ freq: 420, duration: 0.06, type: 'triangle', gain: 0.22 }); }
  softDrop() { this._tone({ freq: 200, duration: 0.04, type: 'sine', gain: 0.15 }); }
  hardDrop() { this._tone({ freq: 140, duration: 0.09, type: 'sine', gain: 0.3, glideTo: 60 }); }
  hold() { this._tone({ freq: 500, duration: 0.08, type: 'sine', gain: 0.2 }); }
  lock() { this._tone({ freq: 220, duration: 0.05, type: 'sine', gain: 0.15 }); }

  lineClear(count) {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    const n = Math.min(count, notes.length);
    for (let i = 0; i < n; i++) {
      this._tone({ freq: notes[i], duration: 0.28, type: 'sine', gain: 0.28, delay: i * 0.05 });
    }
  }

  celebration() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this._tone({ freq: f, duration: 0.4, type: 'triangle', gain: 0.22, delay: i * 0.07 }));
  }

  levelUp() {
    [440, 554.37, 659.25, 880].forEach((f, i) =>
      this._tone({ freq: f, duration: 0.22, type: 'sine', gain: 0.25, delay: i * 0.06 }));
  }

  achievement() {
    [659.25, 830.61, 987.77].forEach((f, i) =>
      this._tone({ freq: f, duration: 0.3, type: 'sine', gain: 0.25, delay: i * 0.08 }));
  }

  gameOver() {
    [392, 349.23, 293.66, 220].forEach((f, i) =>
      this._tone({ freq: f, duration: 0.35, type: 'sine', gain: 0.22, delay: i * 0.14 }));
  }

  // Gentle looping ambient pad — a few slow, softly detuned sine tones.
  startMusic() {
    if (this.muted || !this.musicOn) return;
    this._ensure();
    if (this._musicTimer) return;
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0]; // C major pentatonic
    const playPad = () => {
      const freq = scale[Math.floor(Math.random() * scale.length)] / 2;
      const t0 = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(1, t0 + 2.5);
      g.gain.linearRampToValueAtTime(0, t0 + 7);
      osc.connect(g);
      g.connect(this.musicGain);
      osc.start(t0);
      osc.stop(t0 + 7.2);
    };
    playPad();
    this._musicTimer = setInterval(playPad, 4000);
  }

  stopMusic() {
    if (this._musicTimer) {
      clearInterval(this._musicTimer);
      this._musicTimer = null;
    }
  }
}
