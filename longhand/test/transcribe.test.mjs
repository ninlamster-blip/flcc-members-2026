/**
 * Turning a provider's words into a transcript people can read, and being
 * honest about which provider (if any) is actually available.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { segmentsFromWords, EndpointTranscriber, chooseProvider, estimateSeconds } from '../js/core/transcribe.js';

const WORDS = [
  { text: 'We', start: 0.0, end: 0.3, type: 'word', speaker_id: 'speaker_0' },
  { text: ' ', start: 0.3, end: 0.3, type: 'spacing' },
  { text: 'need', start: 0.3, end: 0.6, type: 'word', speaker_id: 'speaker_0' },
  { text: 'to', start: 0.6, end: 0.8, type: 'word', speaker_id: 'speaker_0' },
  { text: 'review.', start: 0.8, end: 1.2, type: 'word', speaker_id: 'speaker_0' },
  { text: 'I', start: 1.5, end: 1.7, type: 'word', speaker_id: 'speaker_1' },
  { text: 'agree.', start: 1.7, end: 2.1, type: 'word', speaker_id: 'speaker_1' },
];

test('a change of speaker starts a new line', () => {
  const segments = segmentsFromWords(WORDS);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].speakerLabel, 'Speaker 1', 'speaker_0 is the first speaker, not the zeroth');
  assert.equal(segments[0].text, 'We need to review.');
  assert.equal(segments[1].speakerLabel, 'Speaker 2');
  assert.equal(segments[1].text, 'I agree.');
});

test('timings are shifted by where the clip sits in the recording', () => {
  const segments = segmentsFromWords(WORDS, 120);
  assert.equal(segments[0].start, 120);
  assert.ok(Math.abs(segments[1].start - 121.5) < 0.001);
});

test('audio events and empty words do not become transcript lines', () => {
  const segments = segmentsFromWords([
    { text: '(laughter)', start: 0, end: 1, type: 'audio_event' },
    { text: '  ', start: 1, end: 1, type: 'spacing' },
  ]);
  assert.deepEqual(segments, []);
});

test('one speaker talking for a long time is still broken into readable lines', () => {
  const words = Array.from({ length: 400 }, (_, i) => ({
    text: `word${i}`, start: i * 0.3, end: i * 0.3 + 0.25, type: 'word', speaker_id: 'speaker_0',
  }));
  const segments = segmentsFromWords(words);
  assert.ok(segments.length > 1, 'a two-minute monologue is not one paragraph');
  assert.ok(segments.every((segment) => segment.end - segment.start <= 25));
});

test('a provider that returns text but no timings still produces one usable line', async () => {
  const transcriber = new EndpointTranscriber({
    url: 'https://example.test/stt',
    fetchImpl: async () => ({ ok: true, json: async () => ({ text: 'Hello there.' }) }),
  });
  const { segments } = await transcriber.transcribe(new Blob(['x']), { offsetSec: 10 });
  assert.equal(segments.length, 1);
  assert.equal(segments[0].start, 10);
  assert.ok(segments[0].end > 10);
});

test('the endpoint is asked for diarization and timings, and told the audio type', async () => {
  let seen = null;
  const transcriber = new EndpointTranscriber({
    url: 'https://example.test/stt',
    secret: 'shh',
    fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ text: '' }) }; },
  });
  await transcriber.transcribe(new Blob(['x'], { type: 'audio/webm' }), { diarize: true });

  assert.match(seen.url, /diarize=1/);
  assert.match(seen.url, /timestamps=1/);
  assert.equal(seen.init.headers['x-proxy-secret'], 'shh');
  assert.equal(seen.init.headers['Content-Type'], 'audio/webm');
});

test("an endpoint's own explanation of a failure is what the user gets", async () => {
  const transcriber = new EndpointTranscriber({
    url: 'https://example.test/stt',
    fetchImpl: async () => ({ ok: false, status: 501, json: async () => ({ error: { message: 'Voice input not configured on this Worker.' } }) }),
  });
  await assert.rejects(() => transcriber.transcribe(new Blob(['x'])), /not configured on this Worker/);
});

test('choosing a provider never claims one that is not there', () => {
  const withEndpoint = chooseProvider({ provider: 'auto', sttUrl: 'https://example.test/stt', fetchImpl: async () => ({}) });
  assert.equal(withEndpoint.kind, 'endpoint');

  const demanded = chooseProvider({ provider: 'endpoint', sttUrl: '' });
  assert.equal(demanded.kind, 'none');
  assert.match(demanded.reason, /No transcription endpoint/);

  const browserOnly = chooseProvider({ provider: 'browser' });
  assert.equal(browserOnly.kind, 'none', 'node has no speech recognition, and the app says so rather than pretending');
  assert.match(browserOnly.reason, /no built-in speech recognition/);
});

test('estimateSeconds is a reading pace, not a guess dressed as a measurement', () => {
  assert.equal(estimateSeconds(''), 1);
  assert.equal(estimateSeconds(Array(150).fill('word').join(' ')), 60);
});
