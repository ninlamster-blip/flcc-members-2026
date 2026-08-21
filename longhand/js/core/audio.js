/**
 * Playback.
 *
 * A thin wrapper over one <audio> element: the transcript needs to seek into
 * it, the player bar needs to scrub it, and both need the same current time.
 * Object URLs are revoked when the player is torn down — an hour of audio
 * left dangling is a real leak on a phone.
 */

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
export const SKIP_SECONDS = 5;

export class Player extends EventTarget {
  constructor() {
    super();
    this.element = typeof Audio === 'function' ? new Audio() : null;
    this.url = null;
    this.duration = 0;
    if (this.element) {
      this.element.preload = 'metadata';
      const relay = (name) => this.dispatchEvent(new CustomEvent(name, { detail: this.snapshot() }));
      this.element.addEventListener('timeupdate', () => relay('time'));
      this.element.addEventListener('play', () => relay('state'));
      this.element.addEventListener('pause', () => relay('state'));
      this.element.addEventListener('ended', () => relay('state'));
      this.element.addEventListener('ratechange', () => relay('state'));
      this.element.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(this.element.duration)) this.duration = this.element.duration;
        relay('state');
      });
      this.element.addEventListener('error', () => {
        this.dispatchEvent(new CustomEvent('failed', { detail: new Error('This recording could not be played back.') }));
      });
    }
  }

  get available() { return Boolean(this.element && this.url); }
  get playing() { return Boolean(this.element && !this.element.paused && !this.element.ended); }
  get currentTime() { return this.element ? this.element.currentTime : 0; }
  get rate() { return this.element ? this.element.playbackRate : 1; }

  snapshot() {
    return { time: this.currentTime, duration: this.duration, playing: this.playing, rate: this.rate };
  }

  /**
   * @param {Blob} blob
   * @param {number} [knownDuration] the recorder's own measurement, used
   *        because a WebM produced by MediaRecorder often reports Infinity.
   */
  load(blob, knownDuration = 0) {
    if (!this.element) return;
    this.unload();
    this.url = URL.createObjectURL(blob);
    this.element.src = this.url;
    this.duration = knownDuration || 0;
    this.element.load();
  }

  unload() {
    if (!this.element) return;
    this.element.pause();
    this.element.removeAttribute('src');
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
  }

  async play() { if (this.element && this.url) await this.element.play().catch(() => {}); }
  pause() { if (this.element) this.element.pause(); }
  async toggle() { if (this.playing) this.pause(); else await this.play(); }

  seek(seconds) {
    if (!this.element) return;
    const target = Math.max(0, Math.min(seconds, this.duration || seconds));
    try { this.element.currentTime = target; } catch { /* not seekable yet */ }
    this.dispatchEvent(new CustomEvent('time', { detail: this.snapshot() }));
  }

  skip(seconds) { this.seek(this.currentTime + seconds); }

  setRate(rate) { if (this.element) this.element.playbackRate = rate; }
}

/** The segment that covers `time` — what the transcript highlights. */
export function segmentAt(segments, time) {
  let found = null;
  for (const segment of segments) {
    if (segment.start <= time) found = segment;
    else break;
  }
  if (found && found.end && time > found.end + 2) return found;   // still the last thing said
  return found;
}
