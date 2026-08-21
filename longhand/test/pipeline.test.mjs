/**
 * What happens after Stop, including every way it can go wrong. The property
 * that must hold in all of them: the recording survives and the meeting says
 * plainly what is missing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { processMeeting, STEPS } from '../js/core/pipeline.js';
import { freshDb, seedMeeting, fakeClient, SUPPLIER_MEETING } from './helpers.mjs';

const ANALYSIS = {
  summary: 'They agreed to stay with the supplier.',
  decisions: [{ text: 'Keep the current supplier for Q4', lines: [5] }],
  actions: [{ task: 'Confirm delivery', owner: 'John', due: '', context: '', lines: [6] }],
};

function endpointProvider(segments) {
  return {
    kind: 'endpoint',
    reason: '',
    endpoint: { async transcribe() { return { segments, text: segments.map((s) => s.text).join(' ') }; } },
  };
}

function trackSteps() {
  const seen = [];
  return { onStep: (step) => seen.push(step), seen, stateOf: (key) => seen.filter((s) => s.key === key).pop() };
}

test('the happy path: transcribed, speakers found, analysed, ready', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, { ...SUPPLIER_MEETING, status: 'transcribing' });
  db.update('meetings', meeting.id, { audioId: 'aud1' });
  await db.blobs.put('aud1', new Blob(['audio']));

  const fresh = SUPPLIER_MEETING.lines.map(([speakerLabel, text], i) => ({
    start: i * 20, end: i * 20 + 18, text, speakerLabel: `Speaker ${(i % 3) + 1}`,
  }));
  const steps = trackSteps();

  const result = await processMeeting({
    db, meetingId: meeting.id, provider: endpointProvider(fresh), client: fakeClient(ANALYSIS), onStep: steps.onStep,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.problems, []);
  assert.equal(db.get('meetings', meeting.id).status, 'ready');
  assert.equal(db.where('speakers', { meetingId: meeting.id }).length, 3, 'the full-file pass separated the voices');
  assert.equal(db.where('decisions', { meetingId: meeting.id }).length, 1);
  for (const step of STEPS) assert.equal(steps.stateOf(step.key).state, 'done', `${step.key} finished`);
});

test('with no transcription provider the recording is kept and the meeting says why', async () => {
  const db = await freshDb();
  const meeting = db.insert('meetings', { title: 'Untranscribed', startedAt: '2026-08-20T09:00:00Z', audioId: 'aud1' });
  await db.blobs.put('aud1', new Blob(['audio']));
  const steps = trackSteps();

  const result = await processMeeting({
    db, meetingId: meeting.id,
    provider: { kind: 'none', endpoint: null, reason: 'No transcription endpoint is set in Settings.' },
    client: fakeClient(ANALYSIS), onStep: steps.onStep,
  });

  assert.equal(result.ok, false);
  const saved = db.get('meetings', meeting.id);
  assert.equal(saved.status, 'failed');
  assert.match(saved.error, /No transcription endpoint/);
  assert.ok(await db.blobs.get('aud1'), 'the audio is still there to try again with');
  assert.equal(steps.stateOf('transcribe').state, 'skipped');
});

test('a transcription failure keeps whatever was transcribed live', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  db.update('meetings', meeting.id, { audioId: 'aud1' });
  await db.blobs.put('aud1', new Blob(['audio']));

  const failing = { kind: 'endpoint', reason: '', endpoint: { async transcribe() { throw new Error('The endpoint returned HTTP 502.'); } } };
  const steps = trackSteps();

  const result = await processMeeting({
    db, meetingId: meeting.id, provider: failing, client: fakeClient(ANALYSIS), onStep: steps.onStep,
  });

  assert.equal(db.count('segments'), 6, 'the live transcript was not thrown away');
  assert.equal(db.get('meetings', meeting.id).status, 'ready');
  assert.ok(result.problems.some((problem) => /502/.test(problem)));
  assert.equal(steps.stateOf('transcribe').detail, 'kept the live transcript');
});

test('no model endpoint means no summary, and the transcript still lands', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  const steps = trackSteps();

  const result = await processMeeting({
    db, meetingId: meeting.id,
    provider: { kind: 'browser', endpoint: null, reason: '' },
    client: { available: false }, onStep: steps.onStep,
  });

  assert.equal(result.ok, true);
  const saved = db.get('meetings', meeting.id);
  assert.equal(saved.status, 'ready', 'a transcript with no summary is still a usable meeting');
  assert.match(saved.error, /No intelligence endpoint/);
  assert.equal(steps.stateOf('summary').state, 'skipped');
});

test('a model that fails leaves the transcript searchable and says what happened', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  const steps = trackSteps();

  const result = await processMeeting({
    db, meetingId: meeting.id,
    provider: { kind: 'browser', endpoint: null, reason: '' },
    client: fakeClient(new Error('The endpoint returned HTTP 429.')), onStep: steps.onStep,
  });

  assert.equal(result.ok, false);
  assert.equal(db.get('meetings', meeting.id).status, 'ready');
  assert.equal(db.count('segments'), 6);
  assert.match(db.get('meetings', meeting.id).error, /429/);
  assert.equal(steps.stateOf('analyse').state, 'failed');
});

test('running again after a failure clears the earlier error', async () => {
  const db = await freshDb();
  const { meeting } = seedMeeting(db, SUPPLIER_MEETING);
  db.update('meetings', meeting.id, { status: 'failed', error: 'Something went wrong earlier.' });

  await processMeeting({
    db, meetingId: meeting.id,
    provider: { kind: 'browser', endpoint: null, reason: '' },
    client: fakeClient(ANALYSIS),
  });

  const saved = db.get('meetings', meeting.id);
  assert.equal(saved.error, null);
  assert.equal(saved.status, 'ready');
});
