/**
 * A recording in progress.
 *
 * Owns the recorder, the live transcriber and the meeting record they are
 * filling in, so that navigating away from the Record screen does not stop
 * anything: the session lives on the app, not on the view.
 *
 * The meeting row exists from the first second, with status `recording`. If
 * the tab dies mid-meeting the row is still there afterwards, marked as
 * needing attention, rather than the whole thing vanishing.
 */

import { Recorder } from './recorder.js';
import { BrowserTranscriber, chooseProvider } from './transcribe.js';
import { id as newId } from './id.js';

export class RecordingSession extends EventTarget {
  /** @param {{db: import('./db.js').Database, provider: ReturnType<typeof chooseProvider>, chunkSeconds?: number}} options */
  constructor({ db, provider, chunkSeconds = 12, recorder }) {
    super();
    this.db = db;
    this.provider = provider;
    this.recorder = recorder || new Recorder({ chunkSeconds });
    this.browser = provider.kind === 'browser' ? new BrowserTranscriber() : null;
    this.meetingId = null;
    this.speakers = new Map();          // label → speaker record id
    this.interim = '';
    this.pending = 0;                   // chunks out at the transcriber
    this.transcriptionError = null;
    this.startedAt = null;
  }

  get state() { return this.recorder.state; }
  get active() { return this.recorder.state === 'recording' || this.recorder.state === 'paused'; }
  get elapsed() { return this.recorder.elapsed(); }

  /** @param {{title?: string}} [options] */
  async start({ title = '' } = {}) {
    this.startedAt = new Date();
    const meeting = this.db.insert('meetings', {
      title: title.trim() || defaultTitle(this.startedAt),
      startedAt: this.startedAt.toISOString(),
      status: 'recording',
      transcriptSource: this.provider.kind,
    });
    this.meetingId = meeting.id;

    this.recorder.addEventListener('chunk', (event) => this._onChunk(event.detail));
    this.recorder.addEventListener('error', (event) => this._fail(event.detail));
    this.recorder.addEventListener('state', () => this._emit('state'));

    try {
      await this.recorder.start();
    } catch (err) {
      this.db.update('meetings', this.meetingId, { status: 'failed', error: describeMicError(err) });
      throw new Error(describeMicError(err));
    }

    if (this.browser) {
      this.browser.addEventListener('segment', (event) => {
        this.interim = '';
        this.appendSegments([event.detail]);
      });
      this.browser.addEventListener('interim', (event) => {
        this.interim = event.detail.text;
        this._emit('interim');
      });
      this.browser.addEventListener('error', (event) => { this.transcriptionError = event.detail.message; this._emit('state'); });
      try { this.browser.start(() => this.recorder.elapsed()); } catch (err) { this.transcriptionError = err.message; }
    }
    this._emit('state');
    return meeting;
  }

  pause() {
    this.recorder.pause();
    if (this.browser) this.browser.stop();
  }

  resume() {
    this.recorder.resume();
    if (this.browser) { try { this.browser.start(() => this.recorder.elapsed()); } catch { /* unavailable */ } }
  }

  /**
   * Stop, keep the audio, and hand back the meeting. The transcript so far is
   * already saved; processing is a separate, resumable step (pipeline.js).
   */
  async stop() {
    if (this.browser) this.browser.stop();
    const { blob, mimeType, durationSec } = await this.recorder.stop();
    const audioId = newId('aud');
    let audioSaved = true;
    try {
      await this.db.blobs.put(audioId, blob);
    } catch {
      audioSaved = false;               // out of space: transcript still stands
    }
    this.db.update('meetings', this.meetingId, {
      durationSec: Math.round(durationSec),
      audioId: audioSaved ? audioId : null,
      audioType: mimeType,
      audioBytes: audioSaved ? blob.size : 0,
      status: 'transcribing',
      error: audioSaved ? null : 'This device ran out of space, so the audio could not be kept. The transcript was saved.',
    });
    await this.db.flush();
    this._emit('state');
    return { meetingId: this.meetingId, blob: audioSaved ? blob : null, durationSec };
  }

  /** Abandon everything, including the meeting row. */
  async discard() {
    if (this.browser) this.browser.stop();
    this.recorder.discard();
    if (this.meetingId) await this.db.deleteMeeting(this.meetingId);
    this.meetingId = null;
    this._emit('state');
  }

  /* ── transcript ────────────────────────────────────────────────────────── */

  async _onChunk({ blob, offsetSec }) {
    if (this.provider.kind !== 'endpoint' || !this.provider.endpoint) return;
    this.pending++;
    this._emit('state');
    try {
      const { segments } = await this.provider.endpoint.transcribe(blob, { offsetSec, diarize: true });
      this.transcriptionError = null;
      if (segments.length) this.appendSegments(segments);
    } catch (err) {
      // One failed chunk is a gap in the transcript, not a failed recording;
      // the full-file pass after stopping fills it in.
      this.transcriptionError = err.message;
    } finally {
      this.pending--;
      this._emit('state');
    }
  }

  /** @param {Array<{start: number, end: number, text: string, speakerLabel: string, confidence?: number|null}>} raw */
  appendSegments(raw) {
    const rows = raw
      .filter((segment) => String(segment.text || '').trim())
      .map((segment) => ({
        meetingId: this.meetingId,
        speakerId: this.speakerFor(segment.speakerLabel || 'Speaker 1'),
        start: Math.max(0, Number(segment.start) || 0),
        end: Math.max(Number(segment.start) || 0, Number(segment.end) || 0),
        text: String(segment.text).trim(),
        confidence: segment.confidence ?? null,
      }));
    if (!rows.length) return [];
    const inserted = this.db.insertMany('segments', rows);
    this._emit('transcript', { segments: inserted });
    return inserted;
  }

  speakerFor(label) {
    if (this.speakers.has(label)) return this.speakers.get(label);
    const existing = this.db.where('speakers', { meetingId: this.meetingId }).find((s) => s.label === label);
    const speaker = existing || this.db.insert('speakers', {
      meetingId: this.meetingId,
      label,
      order: this.speakers.size,
    });
    this.speakers.set(label, speaker.id);
    return speaker.id;
  }

  _fail(error) {
    this.transcriptionError = error.message;
    this._emit('state');
  }

  _emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { detail: { ...detail, session: this } }));
  }
}

export function defaultTitle(date = new Date()) {
  const hour = date.getHours();
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  return `${part} recording — ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

export function describeMicError(err) {
  const name = err && err.name ? err.name : '';
  if (name === 'NotAllowedError') return 'This browser blocked access to the microphone. Allow it in the address bar, then start again.';
  if (name === 'NotFoundError') return 'No microphone was found on this device.';
  if (name === 'NotReadableError') return 'The microphone is in use by another application.';
  return err && err.message ? err.message : 'The microphone could not be started.';
}
