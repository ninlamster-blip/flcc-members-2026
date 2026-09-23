// Galaga's sounds: retro bleeps made in the browser, with no audio files.
//
// Every sound is a recipe — a few square or triangle tones that slide in
// pitch, and sometimes a burst of filtered noise — played through the Web
// Audio API. Nothing is downloaded, so the game stays small and works offline,
// and the recipes are plain data so a test can hold them to a few rules
// without a browser:
//
//   · Firing is the quietest sound in the game. It plays about four times a
//     second for as long as a button is held, and anything louder would wear.
//   · Nothing is long. The longest sound is the game-over tune, under a second.
//   · One sound per kind per frame: three ships destroyed in the same frame is
//     one crunch, not three stacked on top of each other.
//
// The player is silent until the first press, because a browser will not let
// a page make sound before the person has touched it, and it stays silent
// where there is no Web Audio at all.

/** Each sound: tones `{ type, from, to, at, dur, gain }` and noise `{ noise, cutFrom, cutTo, at, dur, gain }`. */
export const SOUNDS = {
  // A soft pew, falling an octave.
  fire: [{ type: 'square', from: 880, to: 440, at: 0, dur: 0.07, gain: 0.035 }],
  // An armoured ship taking its first hit: a short metallic clink.
  dent: [{ type: 'triangle', from: 1400, to: 1000, at: 0, dur: 0.06, gain: 0.08 }],
  // An enemy destroyed: a crunch of noise with a falling tone under it.
  kill: [
    { noise: true, cutFrom: 4000, cutTo: 300, at: 0, dur: 0.18, gain: 0.12 },
    { type: 'square', from: 320, to: 70, at: 0, dur: 0.14, gain: 0.05 },
  ],
  // Your ship hit: a longer, deeper boom.
  hit: [
    { noise: true, cutFrom: 1800, cutTo: 80, at: 0, dur: 0.5, gain: 0.2 },
    { type: 'sawtooth', from: 180, to: 35, at: 0, dur: 0.45, gain: 0.07 },
  ],
  // A wave cleared: a quick rising arpeggio.
  cleared: [523, 659, 784, 1047].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.07, dur: 0.08, gain: 0.05 })),
  // A spare ship: two bright notes.
  life: [
    { type: 'triangle', from: 784, to: 784, at: 0, dur: 0.1, gain: 0.1 },
    { type: 'triangle', from: 1175, to: 1175, at: 0.1, dur: 0.16, gain: 0.1 },
  ],
  // Game over: a falling four-note tune.
  over: [523, 440, 349, 262].map((hz, i) => ({ type: 'square', from: hz, to: hz * (i === 3 ? 0.9 : 1), at: i * 0.16, dur: i === 3 ? 0.34 : 0.14, gain: 0.06 })),
};

/** How long a recipe lasts, in seconds. */
export const length = (recipe) => Math.max(...recipe.map((part) => part.at + part.dur));

/** Which sounds a frame's engine events call for, once each, in the order to play them. */
export function cue(events) {
  const wanted = new Set(events);
  return Object.keys(SOUNDS).filter((name) => wanted.has(name));
}

/**
 * A player for one screen. `wake()` must be called from a press (a tap or a
 * key) before anything is heard; `play(events)` then plays what a frame calls
 * for. Muting takes effect at once, including on a sound already playing.
 */
export function player({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let noise = null;
  let quiet = Boolean(muted);

  const level = () => (quiet ? 0 : 1);

  function wake() {
    if (!ctx) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return null;
      try { ctx = new Audio(); } catch { return null; }
      master = ctx.createGain();
      master.gain.value = level();
      master.connect(ctx.destination);
      // One second of white noise, made once and reused for every burst.
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function part(recipe, start) {
    for (const one of recipe) {
      const t0 = start + one.at;
      const t1 = t0 + one.dur;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(one.gain, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      gain.connect(master);
      let source;
      if (one.noise) {
        source = ctx.createBufferSource();
        source.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(one.cutFrom, t0);
        filter.frequency.exponentialRampToValueAtTime(one.cutTo, t1);
        source.connect(filter);
        filter.connect(gain);
      } else {
        source = ctx.createOscillator();
        source.type = one.type;
        source.frequency.setValueAtTime(one.from, t0);
        if (one.to !== one.from) source.frequency.exponentialRampToValueAtTime(one.to, t1);
        source.connect(gain);
      }
      source.start(t0);
      source.stop(t1 + 0.02);
    }
  }

  return {
    wake,
    play(events) {
      if (quiet || !ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      for (const name of cue(events)) part(SOUNDS[name], now);
    },
    get muted() { return quiet; },
    set muted(value) {
      quiet = Boolean(value);
      if (master) master.gain.setValueAtTime(level(), ctx.currentTime);
    },
    close() {
      if (ctx) ctx.close().catch(() => {});
      ctx = null;
    },
  };
}
