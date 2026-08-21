/**
 * The two-recorder arrangement, on a stubbed MediaRecorder.
 *
 * The bug this suite exists for: `stop()` is asynchronous, so the next clip
 * opens before the previous clip's `onstop` runs. Holding a clip's parts and
 * start time on the session hands every finished clip the *next* clip's data
 * and the next clip's timestamp — which puts every line of the live
 * transcript in the wrong place in the recording.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Recorder } from '../js/core/recorder.js';

/** A MediaRecorder that produces one blob per second of "recording". */
class FakeMediaRecorder {
  static instances = [];
  static isTypeSupported() { return true; }
  constructor(stream) {
    this.stream = stream;
    this.state = 'inactive';
    FakeMediaRecorder.instances.push(this);
  }
  start() { this.state = 'recording'; }
  pause() { this.state = 'paused'; }
  resume() { this.state = 'recording'; }
  /** Deliver data as the browser would, then stop asynchronously. */
  feed(text) {
    if (this.ondataavailable) this.ondataavailable({ data: new Blob([text.padEnd(4096, ' ')]) });
  }
  stop() {
    this.state = 'inactive';
    // The real thing fires onstop on a later task. That delay is the bug.
    queueMicrotask(() => { if (this.onstop) this.onstop(); });
  }
}

/** A microphone that produces whatever the test feeds it. */
function fakeMedia() {
  const tracks = [{ stop() {}, addEventListener() {} }];
  return { async getUserMedia() { return { getAudioTracks: () => tracks, getTracks: () => tracks }; } };
}

function newRecorder(options = {}) {
  FakeMediaRecorder.instances = [];
  return new Recorder({ chunkSeconds: 1000, media: fakeMedia(), recorderImpl: FakeMediaRecorder, mimeType: 'audio/webm', ...options });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('each clip carries its own audio and its own place in the recording', async () => {
  {
    const recorder = newRecorder();          // slice on demand, not on a timer
    const chunks = [];
    recorder.addEventListener('chunk', (event) => chunks.push(event.detail));
    await recorder.start();

    const [, firstSlice] = FakeMediaRecorder.instances;      // [0] is the master
    firstSlice.feed('first clip');
    recorder._elapsedBefore = 12;                            // pretend twelve seconds passed
    recorder._startedAt = 0;
    recorder.state = 'paused';                               // freeze elapsed() at 12
    recorder._stopSlice(true);
    recorder._openSlicer();

    const secondSlice = FakeMediaRecorder.instances[2];
    secondSlice.feed('second clip');
    recorder._elapsedBefore = 24;
    recorder._stopSlice(true);
    await settle();

    assert.equal(chunks.length, 2);
    assert.ok(chunks[0].offsetSec < 0.5, 'the first clip starts at the beginning');
    assert.equal(chunks[1].offsetSec, 12, 'the second starts where it was cut, not where the first was');
    assert.equal(await chunks[0].blob.text().then((t) => t.trim()), 'first clip');
    assert.equal(await chunks[1].blob.text().then((t) => t.trim()), 'second clip');
    recorder.discard();
  }
});

test('a discarded clip is not transcribed', async () => {
  {
    const recorder = newRecorder();
    const chunks = [];
    recorder.addEventListener('chunk', (event) => chunks.push(event.detail));
    await recorder.start();

    FakeMediaRecorder.instances[1].feed('this clip is being thrown away');
    recorder._stopSlice(false);
    await settle();

    assert.equal(chunks.length, 0);
    recorder.discard();
  }
});

test('pausing stops the clock and the clips; resuming starts both again', async () => {
  {
    const recorder = newRecorder();
    await recorder.start();
    recorder._elapsedBefore = 5;
    recorder._startedAt = 0;

    recorder.pause();
    assert.equal(recorder.state, 'paused');
    const frozen = recorder.elapsed();
    await settle();
    assert.equal(recorder.elapsed(), frozen, 'a paused recording does not keep counting');
    assert.equal(FakeMediaRecorder.instances[0].state, 'paused', 'and the master recorder is paused too');

    recorder.resume();
    assert.equal(recorder.state, 'recording');
    assert.equal(FakeMediaRecorder.instances[0].state, 'recording');
    // Pausing and resuming must leave exactly one clip timer running; two
    // would cut overlapping clips out of the same microphone.
    assert.ok(recorder._sliceTimer, 'clips resume');
    recorder.discard();
  }
});

test('stopping returns the whole recording and releases the microphone', async () => {
  {
    const recorder = newRecorder();
    await recorder.start();
    FakeMediaRecorder.instances[0].feed('the whole meeting');
    recorder._elapsedBefore = 42;
    recorder._startedAt = 0;
    recorder.state = 'paused';

    const result = await recorder.stop();

    assert.equal(Math.round(result.durationSec), 42);
    assert.ok(result.blob.size > 0);
    assert.equal(recorder.stream, null, 'the microphone is let go');
    assert.equal(recorder.state, 'stopped');
  }
});
