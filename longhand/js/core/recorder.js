/**
 * Recording.
 *
 * Two recorders run on the same microphone stream, on purpose:
 *
 *   · `master` records continuously and produces the file that is kept.
 *   · `slicer` restarts every few seconds, producing small, self-contained
 *     clips for live transcription.
 *
 * The second one exists because a MediaRecorder timeslice does not give you
 * decodable pieces — only the first chunk carries the container header, so
 * posting chunk #7 to a transcription service returns nothing. Restarting a
 * recorder gives a complete little file every time.
 *
 * Nothing is recorded until start() is called, the browser shows its own
 * recording indicator throughout, and stop() releases every track.
 */

const DEFAULT_CHUNK_SECONDS = 12;

export class Recorder extends EventTarget {
  /**
   * @param {{chunkSeconds?: number, mimeType?: string, media?: MediaDevices,
   *          recorderImpl?: typeof MediaRecorder}} [options]
   *        `media` and `recorderImpl` exist so the suite can run this class
   *        for real against a stubbed microphone; the app passes neither.
   */
  constructor({ chunkSeconds = DEFAULT_CHUNK_SECONDS, mimeType = '', media, recorderImpl } = {}) {
    super();
    this.chunkSeconds = chunkSeconds;
    this.media = media || (typeof navigator !== 'undefined' ? navigator.mediaDevices : null);
    this.Recorder = recorderImpl || (typeof MediaRecorder !== 'undefined' ? MediaRecorder : null);
    this.preferredType = mimeType || pickMimeType(this.Recorder);
    this.state = 'idle';           // idle | recording | paused | stopped
    this.stream = null;
    this.master = null;
    this.slicer = null;
    this.masterChunks = [];
    this.sliceIndex = 0;
    this.audioContext = null;
    this.analyser = null;
    this.levelData = null;
    this._elapsedBefore = 0;
    this._startedAt = 0;
    this._sliceTimer = null;
  }

  get supported() {
    return Boolean(this.Recorder && this.media && this.media.getUserMedia);
  }

  /** Seconds of audio captured so far, pauses excluded. */
  elapsed() {
    if (this.state !== 'recording') return this._elapsedBefore;
    return this._elapsedBefore + (now() - this._startedAt) / 1000;
  }

  /** 0–1 short-term loudness, for the level meter. */
  level() {
    if (!this.analyser || this.state !== 'recording') return 0;
    this.analyser.getByteTimeDomainData(this.levelData);
    let sum = 0;
    for (const value of this.levelData) {
      const centred = (value - 128) / 128;
      sum += centred * centred;
    }
    return Math.min(1, Math.sqrt(sum / this.levelData.length) * 3.2);
  }

  async start() {
    if (!this.supported) throw new Error('This browser cannot record audio.');
    if (this.state === 'recording') return;

    this.stream = await this.media.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (AudioCtx) {
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.levelData = new Uint8Array(this.analyser.fftSize);
      source.connect(this.analyser);
    }

    this.master = new this.Recorder(this.stream, this.preferredType ? { mimeType: this.preferredType } : undefined);
    this.masterChunks = [];
    this.master.ondataavailable = (event) => { if (event.data && event.data.size) this.masterChunks.push(event.data); };
    this.master.start();

    this._elapsedBefore = 0;
    this._startedAt = now();
    this.state = 'recording';
    this._startSlice();
    this.dispatchEvent(new CustomEvent('state', { detail: { state: this.state } }));

    // A device unplugged mid-meeting is a real failure, not a silent one.
    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener('ended', () => {
        this.dispatchEvent(new CustomEvent('error', { detail: new Error('The microphone stopped. The recording so far is safe.') }));
      });
    }
  }

  pause() {
    if (this.state !== 'recording') return;
    this._elapsedBefore = this.elapsed();
    this.state = 'paused';
    this._stopTimer();
    this._stopSlice(true);
    if (this.master && this.master.state === 'recording') this.master.pause();
    this.dispatchEvent(new CustomEvent('state', { detail: { state: this.state } }));
  }

  resume() {
    if (this.state !== 'paused') return;
    this._startedAt = now();
    this.state = 'recording';
    if (this.master && this.master.state === 'paused') this.master.resume();
    this._startSlice();
    this.dispatchEvent(new CustomEvent('state', { detail: { state: this.state } }));
  }

  /** @returns {Promise<{blob: Blob, mimeType: string, durationSec: number}>} */
  async stop() {
    if (this.state === 'idle' || this.state === 'stopped') throw new Error('Nothing is being recorded.');
    const durationSec = this.elapsed();
    this._elapsedBefore = durationSec;
    this.state = 'stopped';
    this._stopTimer();
    this._stopSlice(true);

    const blob = await new Promise((resolve) => {
      if (!this.master || this.master.state === 'inactive') { resolve(new Blob(this.masterChunks, { type: this.preferredType })); return; }
      this.master.onstop = () => resolve(new Blob(this.masterChunks, { type: this.preferredType || this.master.mimeType }));
      this.master.stop();
    });

    this._release();
    this.dispatchEvent(new CustomEvent('state', { detail: { state: this.state } }));
    return { blob, mimeType: blob.type || this.preferredType, durationSec };
  }

  /** Give up on the recording entirely — nothing is kept. */
  discard() {
    try { if (this.master && this.master.state !== 'inactive') this.master.stop(); } catch { /* already stopped */ }
    this._stopTimer();
    this._stopSlice(false);
    this.masterChunks = [];
    this.state = 'stopped';
    this._release();
  }

  _release() {
    this._stopTimer();
    if (this.stream) for (const track of this.stream.getTracks()) track.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close().catch(() => {});
    this.stream = null;
    this.analyser = null;
  }

  /* Slices: one standalone clip every `chunkSeconds`, emitted as a `chunk`
     event carrying where in the recording it starts.

     Everything a slice needs — its parts, its start time, whether it should
     be emitted — belongs to that slice's own recorder, not to the session.
     `stop()` is asynchronous: the next slice opens before the previous one's
     `onstop` fires, and instance fields would hand the finished clip the next
     clip's array and the next clip's start time. */
  _startSlice() {
    if (!this.stream) return;
    // Resuming must not leave the interval from before the pause running: two
    // timers would cut two sets of clips out of one microphone.
    this._stopTimer();
    this._openSlicer();
    this._sliceTimer = setInterval(() => {
      if (this.state !== 'recording') return;
      this._stopSlice(true);
      this._openSlicer();
    }, this.chunkSeconds * 1000);
  }

  _openSlicer() {
    let recorder;
    try {
      recorder = new this.Recorder(this.stream, this.preferredType ? { mimeType: this.preferredType } : undefined);
    } catch {
      this.slicer = null;                 // live transcript unavailable; the recording is unaffected
      return;
    }
    const startedAt = this.elapsed();
    const parts = [];
    recorder.keep = true;
    this.slicer = recorder;
    recorder.ondataavailable = (event) => { if (event.data && event.data.size) parts.push(event.data); };
    recorder.onstop = () => {
      if (!recorder.keep || !parts.length) return;
      const blob = new Blob(parts, { type: this.preferredType });
      if (blob.size < 2048) return;       // a fraction of a second of silence
      this.dispatchEvent(new CustomEvent('chunk', {
        detail: { blob, index: this.sliceIndex++, offsetSec: startedAt, endSec: this.elapsed() },
      }));
    };
    recorder.start();
  }

  _stopTimer() {
    if (this._sliceTimer) { clearInterval(this._sliceTimer); this._sliceTimer = null; }
  }

  _stopSlice(emit) {
    const recorder = this.slicer;
    if (!recorder) return;
    recorder.keep = emit;
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch { /* already stopped */ }
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Opus in WebM where possible; Safari records MP4/AAC and that is fine too. */
export function pickMimeType(impl = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null) {
  if (!impl || !impl.isTypeSupported) return '';
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (impl.isTypeSupported(type)) return type;
  }
  return '';
}

/** Draw the level meter. A row of bars scrolling left: enough to show the
 *  microphone is hearing you, and deliberately not a music visualiser. */
export function drawMeter(canvas, history) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const ratio = globalThis.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) {
    canvas.width = width * ratio;
    canvas.height = height * ratio;
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  const barWidth = 2;
  const gap = 2;
  const count = Math.floor(width / (barWidth + gap));
  const values = history.slice(-count);
  const middle = height / 2;
  const style = getComputedStyle(canvas);
  context.fillStyle = style.getPropertyValue('--meter-colour') || '#B32B25';
  for (let i = 0; i < values.length; i++) {
    const level = Math.max(0.02, values[i]);
    const barHeight = Math.max(1.5, level * (height - 8));
    const x = width - (values.length - i) * (barWidth + gap);
    context.globalAlpha = 0.35 + level * 0.65;
    context.fillRect(x, middle - barHeight / 2, barWidth, barHeight);
  }
  context.globalAlpha = 1;
}
