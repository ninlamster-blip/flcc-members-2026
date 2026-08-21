/**
 * Record.
 *
 * Three states on one screen — ready, recording, processing — because they
 * are one continuous act. While recording, everything that is not the timer,
 * the level meter, the transcript and the two controls is removed.
 *
 * The recording indicator is never subtle and never absent: the browser
 * shows its own, and so does this.
 */

import { h, icon } from '../core/dom.js';
import { clock } from '../core/format.js';
import { button, notice, confirm, toast, announce } from '../core/ui.js';
import { drawMeter } from '../core/recorder.js';
import { processMeeting, STEPS } from '../core/pipeline.js';
import { defaultTitle } from '../core/session.js';

export async function render(app) {
  const host = h('div');
  if (app.session && app.session.active) renderRecording(app, host);
  else renderReady(app, host);
  return host;
}

/* ── ready ───────────────────────────────────────────────────────────────── */

function renderReady(app, host) {
  const provider = app.provider;
  const titleInput = h('input.input', {
    type: 'text',
    placeholder: defaultTitle(),
    'aria-label': 'Meeting title',
    style: { maxWidth: '420px' },
  });

  const start = button('Start recording', {
    variant: 'record', size: 'lg', iconName: 'mic',
    onClick: async () => {
      start.disabled = true;
      try {
        await app.startRecording({ title: titleInput.value });
        renderRecording(app, host);
      } catch (err) {
        start.disabled = false;
        host.prepend(notice({ tone: 'error', title: 'Recording could not start', body: err.message }));
      }
    },
  });

  host.replaceChildren(h('div.view.view--reading.stack-6',
    h('div',
      h('h1.page-title', 'Record'),
      h('p.lede', { style: { marginTop: '6px' } },
        'Audio is captured on this device. It is stored here, and sent nowhere except the transcription service you have configured.')),

    h('div.stack',
      h('div.field',
        h('label', { for: 'rec-title' }, 'Title'),
        Object.assign(titleInput, { id: 'rec-title' }),
        h('span.hint', 'Optional — a date-stamped title is used if you leave it blank.')),
      h('div.row', start)),

    providerNotice(app, provider),

    h('div.section',
      h('div.section__head', h('h2.subhead', 'What happens'), h('div.spacer')),
      h('ol.stack-2.meta', { style: { paddingLeft: '18px', listStyle: 'decimal' } },
        h('li', provider.kind === 'endpoint'
          ? 'Speech is transcribed as you talk, in short clips sent to your transcription endpoint.'
          : provider.kind === 'browser'
            ? "The browser's own speech recognition writes the transcript live. It does not separate speakers."
            : 'The recording is saved. No transcript is produced until a transcription provider is set up.'),
        h('li', 'When you stop, the whole recording is transcribed again — more accurately, and with speakers separated where the provider supports it.'),
        h('li', 'Decisions, action items, open questions and a summary are then pulled out of the transcript, each linked to the lines it came from.'))),
  ));
}

function providerNotice(app, provider) {
  if (provider.kind === 'endpoint') {
    // "Set up", not "working": nothing has been sent yet, and claiming an
    // endpoint is up before it has answered once is exactly the kind of
    // reassurance that turns out to be false at the worst moment.
    return notice({
      tone: '',
      title: 'Live transcription is set up',
      body: `Clips will be sent to ${short(app.sttEndpoint)} as you record, with speakers separated. If that endpoint cannot be reached, the recording is still kept and can be transcribed later.`,
      actions: [h('a.btn.btn--sm', { href: '#/settings' }, 'Check it')],
    });
  }
  if (provider.kind === 'browser') {
    return notice({
      tone: '',
      title: "Using the browser's speech recognition",
      body: 'No audio leaves this device from Longhand, but speakers are not separated and accuracy is lower. A transcription endpoint can be set in Settings.',
      actions: [h('a.btn.btn--sm', { href: '#/settings' }, 'Open settings')],
    });
  }
  return notice({
    tone: 'attention',
    title: 'No transcription provider',
    body: `${provider.reason} You can still record — the audio is kept, and can be transcribed later once a provider is configured.`,
    actions: [h('a.btn.btn--sm', { href: '#/settings' }, 'Open settings')],
  });
}

function short(url) {
  try { const u = new URL(url); return u.host + u.pathname; } catch { return url; }
}

/* ── recording ───────────────────────────────────────────────────────────── */

function renderRecording(app, host) {
  const session = app.session;
  const state = h('div.record__state', h('span.dot.dot--record'), 'Recording');
  const timer = h('div.record__timer.num', { role: 'timer', 'aria-label': 'Elapsed recording time' }, '00:00');
  const meta = h('div.record__meta');
  const canvas = h('canvas.wave', { 'aria-hidden': 'true' });
  const live = h('div.live', { 'aria-live': 'off' });
  const interim = h('div.turn.turn--pending', { hidden: true },
    h('div.turn__time'), h('div', h('div.turn__text')));

  const pauseButton = button('Pause', {
    iconName: 'pause', size: 'lg',
    onClick: () => {
      if (session.state === 'recording') { session.pause(); announce('Recording paused'); }
      else { session.resume(); announce('Recording resumed'); }
      paintState();
    },
  });

  const stopButton = button('Stop recording', {
    variant: 'record', size: 'lg', iconName: 'stop',
    onClick: async () => {
      stopButton.disabled = true;
      pauseButton.disabled = true;
      clearInterval(tick);
      cancelAnimationFrame(frame);
      const { meetingId } = await session.stop();
      app.endRecording();
      renderProcessing(app, host, meetingId);
    },
  });

  host.replaceChildren(h('div.record',
    h('div.record__top', state, timer, meta),
    h('div', canvas,
      h('div.section__head', { style: { marginTop: 'var(--s5)' } }, h('h2.subhead', 'Live transcript'), h('div.spacer'),
        h('span.meta-sm', session.provider.kind === 'endpoint' ? 'Speakers separated'
          : session.provider.kind === 'browser' ? 'One speaker — the browser cannot separate voices'
          : 'No transcription provider')),
      live, interim),
    h('div.record__controls', pauseButton, stopButton,
      button('Discard', {
        variant: 'quiet',
        onClick: async () => {
          if (await confirm({
            title: 'Discard this recording?',
            body: 'The audio and everything transcribed so far are deleted from this device. This cannot be undone.',
            confirmLabel: 'Discard', danger: true,
          })) {
            clearInterval(tick);
            cancelAnimationFrame(frame);
            await session.discard();
            app.endRecording();
            toast('Recording discarded.');
            renderReady(app, host);
          }
        },
      }))));

  /* transcript, appended as it arrives */
  const seen = new Set();
  const paintTranscript = () => {
    const segments = app.db.where('segments', { meetingId: session.meetingId }).sort((a, b) => a.start - b.start);
    const names = speakerNames(app, session.meetingId);
    let lastSpeaker = null;
    for (const segment of segments) {
      if (seen.has(segment.id)) { lastSpeaker = segment.speakerId; continue; }
      seen.add(segment.id);
      const sameSpeaker = segment.speakerId === lastSpeaker;
      live.appendChild(h('div.turn',
        h('span.turn__time.num', clock(segment.start)),
        h('div',
          sameSpeaker ? null : h('div.turn__speaker', names.get(segment.speakerId) || 'Speaker'),
          h('div.turn__text', segment.text))));
      lastSpeaker = segment.speakerId;
    }
    if (segments.length) live.scrollTop = live.scrollHeight;
  };

  session.addEventListener('transcript', paintTranscript);
  session.addEventListener('interim', () => {
    const text = session.interim;
    interim.hidden = !text;
    interim.querySelector('.turn__text').textContent = text;
    live.scrollTop = live.scrollHeight;
  });

  const paintState = () => {
    const recording = session.state === 'recording';
    state.replaceChildren(
      h(recording ? 'span.dot.dot--record' : 'span.dot'),
      recording ? 'Recording' : 'Paused');
    pauseButton.replaceChildren(icon(recording ? 'pause' : 'play', { size: 16 }), recording ? 'Pause' : 'Resume');
    const bits = [];
    if (session.pending) bits.push(`${session.pending} clip${session.pending === 1 ? '' : 's'} transcribing`);
    if (session.transcriptionError) bits.push(session.transcriptionError);
    meta.textContent = bits.join(' · ');
    meta.style.color = session.transcriptionError ? 'var(--attention)' : '';
  };
  session.addEventListener('state', paintState);

  // Paint the elapsed time before the first tick: coming back to this screen
  // mid-meeting must never flash 00:00 at someone who is still recording.
  timer.textContent = clock(session.elapsed);
  const tick = setInterval(() => { timer.textContent = clock(session.elapsed); }, 250);
  const history = [];
  let frame = 0;
  const paintMeter = () => {
    history.push(session.state === 'recording' ? app.session.recorder.level() : 0);
    if (history.length > 400) history.shift();
    drawMeter(canvas, history);
    frame = requestAnimationFrame(paintMeter);
  };
  canvas.style.setProperty('--meter-colour', getComputedStyle(document.documentElement).getPropertyValue('--record'));
  paintMeter();
  paintState();
  paintTranscript();
  announce('Recording started');

  // Leaving the screen must not stop the meeting; the timers must stop.
  const observer = new MutationObserver(() => {
    if (!document.body.contains(canvas)) {
      clearInterval(tick);
      cancelAnimationFrame(frame);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function speakerNames(app, meetingId) {
  const map = new Map();
  for (const speaker of app.db.where('speakers', { meetingId })) {
    const person = speaker.personId ? app.db.get('people', speaker.personId) : null;
    map.set(speaker.id, person ? person.name : speaker.label);
  }
  return map;
}

/* ── processing ──────────────────────────────────────────────────────────── */

function renderProcessing(app, host, meetingId, { retranscribe = true } = {}) {
  const meeting = app.db.get('meetings', meetingId);
  const stepNodes = new Map();
  const list = h('div.steps');
  for (const step of STEPS) {
    const node = h('div.step.step--pending',
      h('span.step__mark', icon('circle', { size: 14 })),
      h('span', step.label),
      h('span.meta-sm'));
    stepNodes.set(step.key, node);
    list.appendChild(node);
  }

  const footer = h('div.row');
  host.replaceChildren(h('div.view.view--reading.stack-6',
    h('div',
      h('h1.page-title', 'Processing recording'),
      h('p.lede', { style: { marginTop: '6px' } },
        `${meeting.title} — ${clock(meeting.durationSec)} recorded and saved to this device.`)),
    list,
    footer));

  const onStep = ({ key, state, detail }) => {
    const node = stepNodes.get(key);
    if (!node) return;
    node.className = `step step--${state === 'active' ? 'active' : state}`;
    const mark = node.querySelector('.step__mark');
    mark.replaceChildren(
      state === 'done' ? icon('check', { size: 15 })
        : state === 'failed' ? icon('alert', { size: 15 })
        : state === 'skipped' ? icon('close', { size: 14 })
        : h('svg.spin', { viewBox: '0 0 24 24', width: 15, height: 15, fill: 'none' },
            h('circle', { cx: 12, cy: 12, r: 9, stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-opacity': .25 }),
            h('path', { d: 'M21 12a9 9 0 0 0-9-9', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round' })));
    node.querySelector('.meta-sm').textContent = detail || '';
  };

  processMeeting({ db: app.db, meetingId, provider: app.provider, client: app.client, onStep, retranscribe })
    .then(({ ok, problems }) => {
      if (ok && !problems.length) {
        app.go('meeting', [meetingId]);
        return;
      }
      footer.replaceChildren(
        h('div.stack',
          notice({
            tone: ok ? 'attention' : 'error',
            title: ok ? 'Saved, with something missing' : "That recording couldn't be fully processed",
            body: `${problems.join(' ')} Your recording is safe on this device.`,
          }),
          h('div.row',
            button('Try again', {
              variant: 'primary',
              onClick: () => renderProcessing(app, host, meetingId, { retranscribe }),
            }),
            h('a.btn', { href: `#/meeting/${meetingId}` }, 'Open the meeting'))));
    })
    .catch((err) => {
      footer.replaceChildren(h('div.stack',
        notice({ tone: 'error', title: 'Processing stopped', body: `${err.message} Your recording is safe on this device.` }),
        h('div.row',
          button('Try again', { variant: 'primary', onClick: () => renderProcessing(app, host, meetingId, { retranscribe }) }),
          h('a.btn', { href: `#/meeting/${meetingId}` }, 'Open the meeting'))));
    });
}

/** Exported for the meeting screen's "process again". */
export { renderProcessing };
