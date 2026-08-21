/**
 * Transcription.
 *
 * Two real providers, chosen in Settings, and no third that pretends:
 *
 *   endpoint  — posts audio to the site's own Worker (`POST /stt`), which
 *               holds the speech-to-text key as a server secret and returns
 *               word timings and speaker ids. This is the good path: it
 *               transcribes live while recording AND re-transcribes the
 *               finished file with diarization across the whole meeting.
 *
 *   browser   — the browser's own speech recognition. Live, free, no key, no
 *               audio upload from this app, but it gives no speaker
 *               separation, no word timings worth the name, and only some
 *               browsers have it. It is offered honestly on those terms.
 *
 * With neither configured the app still records, still stores, still plays
 * back and still lets a transcript be typed or pasted; the meeting sits at
 * "Needs attention" with a Transcribe button rather than a fake transcript.
 */

/** @typedef {{start: number, end: number, text: string, speakerLabel: string, confidence: number|null}} RawSegment */

const SENTENCE_END = /[.!?]["')\]]?$/;
const MAX_SEGMENT_SECONDS = 18;

export class TranscriptionUnavailable extends Error {
  constructor(message = 'No transcription provider is configured.') {
    super(message);
    this.name = 'TranscriptionUnavailable';
  }
}

/* ── endpoint provider ───────────────────────────────────────────────────── */

export class EndpointTranscriber {
  /** @param {{url: string, secret?: string, fetchImpl?: typeof fetch}} config */
  constructor({ url, secret = '', fetchImpl } = {}) {
    this.url = String(url || '').trim();
    this.secret = secret;
    this.fetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  }

  get available() { return Boolean(this.url && this.fetch); }
  get live() { return true; }
  get diarizes() { return true; }
  get name() { return 'Transcription endpoint'; }

  /**
   * @param {Blob} blob
   * @param {{offsetSec?: number, diarize?: boolean, signal?: AbortSignal}} [options]
   * @returns {Promise<{segments: RawSegment[], text: string}>}
   */
  async transcribe(blob, { offsetSec = 0, diarize = true, signal } = {}) {
    if (!this.available) throw new TranscriptionUnavailable();
    const url = new URL(this.url);
    if (diarize) url.searchParams.set('diarize', '1');
    url.searchParams.set('timestamps', '1');

    let response;
    try {
      response = await this.fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'audio/webm',
          ...(this.secret ? { 'x-proxy-secret': this.secret } : {}),
        },
        body: blob,
        signal,
      });
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      throw new Error(`Could not reach the transcription endpoint: ${err && err.message ? err.message : err}`);
    }
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.error?.message || ''; } catch { /* not JSON */ }
      throw new Error(detail || `The transcription endpoint returned HTTP ${response.status}.`);
    }
    const data = await response.json();
    const text = String(data.text || '').trim();
    const segments = Array.isArray(data.words) && data.words.length
      ? segmentsFromWords(data.words, offsetSec)
      : (text ? [{ start: offsetSec, end: offsetSec + estimateSeconds(text), text, speakerLabel: 'Speaker 1', confidence: null }] : []);
    return { segments, text };
  }
}

/**
 * Turn word-level timings into speaker turns.
 *
 * A turn breaks when the speaker changes, when a sentence ends and enough
 * has accumulated to be worth its own line, or when a line has run long
 * enough that a reader would lose the thread.
 *
 * @param {Array<{text?: string, word?: string, start?: number, end?: number, speaker_id?: string, type?: string}>} words
 * @param {number} offsetSec
 * @returns {RawSegment[]}
 */
export function segmentsFromWords(words, offsetSec = 0) {
  const segments = [];
  let current = null;

  for (const word of words) {
    if (word && word.type === 'audio_event') continue;      // [laughter] and friends
    const text = String((word && (word.text ?? word.word)) || '');
    if (!text.trim()) {
      if (current) current.text += text.includes('\n') ? ' ' : text;   // spacing token
      continue;
    }
    const speaker = speakerLabel(word && word.speaker_id);
    const start = offsetSec + numberOr(word && word.start, current ? current.end - offsetSec : 0);
    const end = offsetSec + numberOr(word && word.end, (word && word.start) || 0);

    const speakerChanged = current && current.speakerLabel !== speaker;
    const ranLong = current && end - current.start > MAX_SEGMENT_SECONDS;
    const sentenceDone = current && SENTENCE_END.test(current.text.trim()) && current.text.trim().length > 60;

    if (!current || speakerChanged || ranLong || sentenceDone) {
      current = { start, end, text: '', speakerLabel: speaker, confidence: null };
      segments.push(current);
    }
    current.text += (current.text && !/\s$/.test(current.text) ? ' ' : '') + text.trim();
    current.end = Math.max(current.end, end);
  }

  return segments
    .map((segment) => ({ ...segment, text: segment.text.replace(/\s+/g, ' ').trim() }))
    .filter((segment) => segment.text);
}

function speakerLabel(rawId) {
  if (rawId == null || rawId === '') return 'Speaker 1';
  const match = String(rawId).match(/(\d+)/);
  // Providers number speakers from zero (`speaker_0`); people count from one.
  return match ? `Speaker ${Number(match[1]) + 1}` : `Speaker ${rawId}`;
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Reading pace, used only when a provider gives text with no timings. */
export function estimateSeconds(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 150) * 60));
}

/* ── browser provider ────────────────────────────────────────────────────── */

const SpeechRecognitionImpl = typeof globalThis !== 'undefined'
  ? (globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition)
  : null;

export class BrowserTranscriber extends EventTarget {
  constructor({ language = 'en-US' } = {}) {
    super();
    this.language = language;
    this.recognition = null;
    this.startedAt = 0;
    this.lastEnd = 0;
    this.running = false;
  }

  static get supported() { return Boolean(SpeechRecognitionImpl); }
  get available() { return BrowserTranscriber.supported; }
  get live() { return true; }
  get diarizes() { return false; }
  get name() { return 'Browser speech recognition'; }

  /** @param {() => number} elapsed  seconds recorded so far, from the Recorder */
  start(elapsed) {
    if (!this.available) throw new TranscriptionUnavailable('This browser has no built-in speech recognition.');
    const recognition = new SpeechRecognitionImpl();
    recognition.lang = this.language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    this.recognition = recognition;
    this.running = true;

    let interimStart = elapsed();
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = String(result[0] && result[0].transcript || '').trim();
        if (!text) continue;
        const at = elapsed();
        if (result.isFinal) {
          this.dispatchEvent(new CustomEvent('segment', {
            detail: {
              start: Math.max(0, interimStart),
              end: at,
              text,
              speakerLabel: 'Speaker 1',
              confidence: Number.isFinite(result[0].confidence) ? result[0].confidence : null,
            },
          }));
          interimStart = at;
        } else {
          this.dispatchEvent(new CustomEvent('interim', { detail: { text, start: interimStart, end: at } }));
        }
      }
    };
    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are ordinary during a quiet stretch.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      this.dispatchEvent(new CustomEvent('error', { detail: new Error(describeSpeechError(event.error)) }));
    };
    recognition.onend = () => {
      // Browsers stop it on their own schedule; restart while recording.
      if (this.running) { try { recognition.start(); } catch { /* mid-restart */ } }
    };
    try { recognition.start(); } catch { /* already started */ }
  }

  stop() {
    this.running = false;
    if (this.recognition) { try { this.recognition.stop(); } catch { /* already stopped */ } }
    this.recognition = null;
  }
}

function describeSpeechError(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed': return 'The browser blocked speech recognition. The recording itself is unaffected.';
    case 'network': return 'Speech recognition lost its connection. The recording is still running.';
    case 'audio-capture': return 'No microphone was available to speech recognition.';
    default: return `Speech recognition stopped: ${code}.`;
  }
}

/* ── choosing one ────────────────────────────────────────────────────────── */

/**
 * @param {{provider?: string, sttUrl?: string, secret?: string, language?: string, fetchImpl?: typeof fetch}} settings
 * @returns {{kind: 'endpoint'|'browser'|'none', endpoint: EndpointTranscriber|null, reason: string}}
 */
export function chooseProvider({ provider = 'auto', sttUrl = '', secret = '', fetchImpl } = {}) {
  const endpoint = sttUrl ? new EndpointTranscriber({ url: sttUrl, secret, fetchImpl }) : null;
  if (provider === 'browser') {
    return BrowserTranscriber.supported
      ? { kind: 'browser', endpoint: null, reason: '' }
      : { kind: 'none', endpoint: null, reason: 'This browser has no built-in speech recognition.' };
  }
  if (provider === 'endpoint' || provider === 'auto') {
    if (endpoint && endpoint.available) return { kind: 'endpoint', endpoint, reason: '' };
    if (provider === 'endpoint') return { kind: 'none', endpoint: null, reason: 'No transcription endpoint is set in Settings.' };
  }
  if (BrowserTranscriber.supported) return { kind: 'browser', endpoint: null, reason: '' };
  return { kind: 'none', endpoint: null, reason: 'No transcription endpoint is set, and this browser has no built-in speech recognition.' };
}
