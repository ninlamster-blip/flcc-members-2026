/**
 * What happens after Stop.
 *
 * Four steps, each of which can be skipped, fail, or be run again on its own
 * without losing the ones before it. The recording is written to disk before
 * any of this starts, so every failure here is recoverable: the meeting sits
 * at "Needs attention" with a Try again button, and the audio is untouched.
 *
 *   1. Transcribing audio     full-file pass, better than the live one
 *   2. Identifying speakers   who spoke, as separate voices
 *   3. Finding key moments    decisions, actions, questions, topics
 *   4. Generating summary     written from the same evidence
 *
 * Steps 3 and 4 are one model call (intelligence.js) reported as two,
 * because that is how long each half actually takes to appear.
 */

import { analyseMeeting } from './intelligence.js';
import { ModelUnavailable } from './ai.js';
import { TranscriptionUnavailable } from './transcribe.js';

export const STEPS = [
  { key: 'transcribe', label: 'Transcribing audio' },
  { key: 'speakers',   label: 'Identifying speakers' },
  { key: 'analyse',    label: 'Finding key moments' },
  { key: 'summary',    label: 'Generating summary' },
];

/**
 * @param {object} options
 * @param {import('./db.js').Database} options.db
 * @param {string} options.meetingId
 * @param {{kind: string, endpoint: any}} options.provider
 * @param {import('./ai.js').ModelClient} options.client
 * @param {(step: {key: string, state: 'active'|'done'|'skipped'|'failed', detail?: string}) => void} [options.onStep]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.retranscribe]  redo the transcript even if one exists
 */
export async function processMeeting({ db, meetingId, provider, client, onStep = () => {}, signal, retranscribe = true }) {
  const meeting = db.get('meetings', meetingId);
  if (!meeting) throw new Error('That meeting no longer exists.');

  const problems = [];
  db.update('meetings', meetingId, { status: 'transcribing', error: null });

  /* 1 — transcript */
  onStep({ key: 'transcribe', state: 'active' });
  let segments = db.where('segments', { meetingId });
  const canTranscribe = provider && provider.kind === 'endpoint' && provider.endpoint && meeting.audioId;
  if (canTranscribe && (retranscribe || !segments.length)) {
    try {
      const audio = await db.blobs.get(meeting.audioId);
      if (!audio) throw new Error('The recording could not be read back from this device.');
      const { segments: fresh } = await provider.endpoint.transcribe(audio, { offsetSec: 0, diarize: true, signal });
      if (fresh.length) {
        replaceTranscript(db, meetingId, fresh);
        segments = db.where('segments', { meetingId });
        onStep({ key: 'transcribe', state: 'done', detail: `${segments.length} segments` });
      } else if (segments.length) {
        onStep({ key: 'transcribe', state: 'done', detail: 'kept the live transcript' });
      } else {
        problems.push('The transcription service returned no speech for this recording.');
        onStep({ key: 'transcribe', state: 'failed', detail: 'no speech found' });
      }
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      // The live transcript, if there is one, is still a transcript.
      if (segments.length) onStep({ key: 'transcribe', state: 'done', detail: 'kept the live transcript' });
      else onStep({ key: 'transcribe', state: 'failed', detail: err.message });
      problems.push(err instanceof TranscriptionUnavailable ? err.message : `Transcription failed: ${err.message}`);
    }
  } else if (segments.length) {
    onStep({ key: 'transcribe', state: 'done', detail: `${segments.length} segments` });
  } else {
    onStep({ key: 'transcribe', state: 'skipped', detail: provider && provider.reason ? provider.reason : 'no transcription provider' });
    problems.push(provider && provider.reason ? provider.reason : 'No transcription provider is configured.');
  }

  /* 2 — speakers */
  onStep({ key: 'speakers', state: 'active' });
  const speakers = db.where('speakers', { meetingId });
  if (speakers.length) {
    onStep({ key: 'speakers', state: 'done', detail: `${speakers.length} ${speakers.length === 1 ? 'voice' : 'voices'}` });
  } else {
    onStep({ key: 'speakers', state: 'skipped', detail: 'no transcript' });
  }

  /* 3 & 4 — intelligence */
  if (!segments.length) {
    onStep({ key: 'analyse', state: 'skipped', detail: 'no transcript' });
    onStep({ key: 'summary', state: 'skipped', detail: 'no transcript' });
    finish(db, meetingId, problems, 'failed');
    return { ok: false, problems };
  }

  if (!client || !client.available) {
    onStep({ key: 'analyse', state: 'skipped', detail: 'no intelligence endpoint' });
    onStep({ key: 'summary', state: 'skipped', detail: 'no intelligence endpoint' });
    problems.push('No intelligence endpoint is configured, so the transcript was saved without a summary.');
    finish(db, meetingId, problems, 'ready');
    return { ok: true, problems };
  }

  db.update('meetings', meetingId, { status: 'processing' });
  try {
    await analyseMeeting({
      db, meetingId, client, signal,
      onStep: (step) => {
        if (step.key === 'analyse') onStep({ key: 'analyse', state: step.state === 'done' ? 'done' : 'active', detail: step.detail });
        if (step.key === 'summary') onStep({ key: 'summary', state: 'active' });
        if (step.key === 'save') {
          onStep({ key: 'analyse', state: 'done' });
          onStep({ key: 'summary', state: step.state === 'done' ? 'done' : 'active' });
        }
      },
    });
    finish(db, meetingId, problems, 'ready');
    return { ok: true, problems };
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    onStep({ key: 'analyse', state: 'failed', detail: err.message });
    onStep({ key: 'summary', state: 'failed' });
    problems.push(err instanceof ModelUnavailable
      ? err.message
      : `The summary could not be generated: ${err.message}`);
    // A transcript with no summary is still worth keeping and searching.
    finish(db, meetingId, problems, segments.length ? 'ready' : 'failed');
    return { ok: false, problems };
  }
}

function replaceTranscript(db, meetingId, raw) {
  db.clearDerived(meetingId, { includeSegments: true });
  const speakers = new Map();
  const speakerFor = (label) => {
    if (speakers.has(label)) return speakers.get(label);
    const speaker = db.insert('speakers', { meetingId, label, order: speakers.size });
    speakers.set(label, speaker.id);
    return speaker.id;
  };
  db.insertMany('segments', raw.map((segment) => ({
    meetingId,
    speakerId: speakerFor(segment.speakerLabel || 'Speaker 1'),
    start: Math.max(0, Number(segment.start) || 0),
    end: Math.max(Number(segment.start) || 0, Number(segment.end) || 0),
    text: String(segment.text || '').trim(),
    confidence: segment.confidence ?? null,
  })).filter((row) => row.text));
}

function finish(db, meetingId, problems, status) {
  db.update('meetings', meetingId, {
    status,
    processedAt: new Date().toISOString(),
    error: problems.length ? problems.join(' ') : null,
  });
  db.flush().catch(() => {});
}
