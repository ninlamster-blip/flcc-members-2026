/**
 * Settings — endpoints, storage, and the plain truth about both.
 *
 * The privacy section is not marketing copy. It states where recordings
 * live, what leaves the device and when, and gives the three delete actions
 * a person is entitled to: the audio, one meeting, or everything.
 */

import { h } from '../core/dom.js';
import { bytes } from '../core/format.js';
import { section, button, field, notice, confirm, toast, spinner } from '../core/ui.js';
import { BrowserTranscriber } from '../core/transcribe.js';
import { download } from '../core/exporters.js';
import { DEFAULT_MODEL } from '../core/ai.js';

export async function render(app) {
  const db = app.db;
  const usage = await db.blobs.usage();

  const view = h('div.view.view--reading.stack-6',
    h('div.view__head', h('div.grow',
      h('h1.page-title', 'Settings'),
      h('p.lede', { style: { marginTop: '6px' } },
        'Longhand runs entirely in this browser. These settings say which services it may talk to, and what it does with what it has recorded.'))),
    endpointsSection(app),
    transcriptionSection(app),
    storageSection(app, usage),
    privacySection(app),
    aboutSection(app));

  return view;
}

/* ── endpoints ───────────────────────────────────────────────────────────── */

function endpointsSection(app) {
  const aiEndpoint = h('input.input', { type: 'url', value: app.setting('aiEndpoint'), placeholder: app.modelEndpoint || 'https://your-worker.example.workers.dev/proxy' });
  const sttEndpoint = h('input.input', { type: 'url', value: app.setting('sttEndpoint'), placeholder: app.sttEndpoint || 'https://your-worker.example.workers.dev/stt' });
  const secret = h('input.input', { type: 'password', value: app.setting('proxySecret'), autocomplete: 'off', placeholder: 'Only if your endpoint requires one' });
  const model = h('input.input', { type: 'text', value: app.setting('model') || DEFAULT_MODEL });
  const status = h('div');

  const save = button('Save', {
    variant: 'primary',
    onClick: () => {
      app.db.setSetting('aiEndpoint', aiEndpoint.value.trim());
      app.db.setSetting('sttEndpoint', sttEndpoint.value.trim());
      app.db.setSetting('proxySecret', secret.value);
      app.db.setSetting('model', model.value.trim() || DEFAULT_MODEL);
      toast('Saved.');
    },
  });

  const check = button('Check both endpoints', {
    onClick: async () => {
      status.replaceChildren(h('div.row.meta', spinner(), 'Checking…'));
      const results = await Promise.all([probeModel(app), probeStt(app)]);
      status.replaceChildren(h('div.stack',
        ...results.map((result) => notice({
          tone: result.ok ? 'ok' : 'error',
          title: result.title,
          body: result.body,
        }))));
    },
  });

  return section({ title: 'Endpoints' },
    h('p.meta', 'Neither the model key nor the transcription key is held in this browser. Both live as secrets on the endpoint you point at — this repository ships one (ask-proxy/worker.js) that does exactly that, and it is the default when the app is served from the same site.'),
    h('div.stack',
      field('Model endpoint', aiEndpoint, 'Receives the Anthropic Messages request. Leave blank to use this site’s own /proxy.'),
      field('Transcription endpoint', sttEndpoint, 'Receives audio and returns words with timings. Leave blank to use this site’s own /stt.'),
      field('Shared secret', secret, 'Sent as x-proxy-secret, if your endpoint checks one. Stored in this browser and never included in an export.'),
      field('Model', model, 'Any model your endpoint accepts.'),
      h('div.row', save, check),
      status));
}

async function probeModel(app) {
  const client = app.client;
  if (!client.available) return { ok: false, title: 'Model endpoint', body: 'No endpoint is set, and this page is not served from one.' };
  try {
    const text = await client.complete({ prompt: 'Reply with the single word: ready', maxTokens: 16 });
    return { ok: true, title: 'Model endpoint', body: `Answered from ${client.model}: “${text.slice(0, 60)}”.` };
  } catch (err) {
    return { ok: false, title: 'Model endpoint', body: err.message };
  }
}

async function probeStt(app) {
  const provider = app.provider;
  if (provider.kind !== 'endpoint') {
    return { ok: false, title: 'Transcription endpoint', body: provider.reason || 'Not in use — the browser’s own speech recognition is selected.' };
  }
  try {
    // A one-sample WAV: enough for the endpoint to accept, reject or say it
    // is not configured, without recording anybody.
    const probe = silentWav();
    await provider.endpoint.transcribe(probe, { diarize: false });
    return { ok: true, title: 'Transcription endpoint', body: 'Accepted a test clip and answered.' };
  } catch (err) {
    return { ok: false, title: 'Transcription endpoint', body: err.message };
  }
}

/** 0.1s of silence, built by hand — no network, no microphone. */
function silentWav() {
  const rate = 8000;
  const samples = rate / 10;
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const text = (at, value) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples * 2, true);
  return new Blob([buffer], { type: 'audio/wav' });
}

/* ── transcription ───────────────────────────────────────────────────────── */

function transcriptionSection(app) {
  const provider = h('select.select',
    ...[
      { value: 'auto', label: 'Automatic — endpoint if available, otherwise the browser' },
      { value: 'endpoint', label: 'Transcription endpoint only' },
      { value: 'browser', label: "This browser's speech recognition only" },
    ].map((option) => h('option', { value: option.value, selected: app.setting('transcriptionProvider') === option.value || null }, option.label)));
  provider.addEventListener('change', () => { app.db.setSetting('transcriptionProvider', provider.value); toast('Saved.'); app.refresh(); });

  const chunk = h('select.select',
    ...[8, 12, 20, 30].map((seconds) => h('option', { value: seconds, selected: Number(app.setting('chunkSeconds')) === seconds || null }, `${seconds} seconds`)));
  chunk.addEventListener('change', () => { app.db.setSetting('chunkSeconds', Number(chunk.value)); toast('Saved.'); });

  const current = app.provider;
  return section({ title: 'Transcription' },
    h('div.stack',
      field('Provider', provider),
      field('Live clip length', chunk, 'Shorter clips appear on screen sooner; longer clips transcribe more accurately.'),
      notice({
        tone: current.kind === 'none' ? 'attention' : '',
        title: `Selected: ${current.kind === 'endpoint' ? 'transcription endpoint' : current.kind === 'browser' ? "the browser's speech recognition" : 'nothing'}`,
        body: current.kind === 'endpoint'
          ? 'Clips of audio are sent to your endpoint while recording, and the whole recording is sent once when you stop. Speakers are separated. Use “Check both endpoints” above to confirm it answers.'
          : current.kind === 'browser'
            ? `${BrowserTranscriber.supported ? 'Available in this browser.' : 'Not available in this browser.'} No audio leaves this device from Longhand, but speakers are not separated and the transcript cannot be re-run afterwards.`
            : current.reason,
      })));
}

/* ── storage ─────────────────────────────────────────────────────────────── */

function storageSection(app, usage) {
  const db = app.db;
  const meetings = db.all('meetings');
  const segments = db.count('segments');
  const withAudio = meetings.filter((m) => m.audioId).length;

  return section({ title: 'Storage on this device' },
    h('dl.kv',
      h('dt', 'Meetings'), h('dd', `${meetings.length}`),
      h('dt', 'Transcript lines'), h('dd', `${segments}`),
      h('dt', 'Recordings kept'), h('dd', `${withAudio} · ${bytes(usage.bytes)}`),
      h('dt', 'Where'), h('dd', 'This browser: records in localStorage, audio in IndexedDB. Clearing site data deletes all of it.')),
    h('div.row',
      button('Export everything (JSON)', {
        iconName: 'download',
        onClick: async () => {
          const snapshot = await db.exportAll();
          download(`longhand-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot, null, 2), 'application/json');
          toast('Exported. Audio is not included — export recordings from each meeting.');
        },
      }),
      importButton(app)));
}

function importButton(app) {
  const input = h('input', { type: 'file', accept: 'application/json', hidden: true });
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!await confirm({
      title: 'Replace everything on this device?',
      body: 'Importing replaces the meetings, transcripts and tasks currently stored here. Recordings already on this device are kept but may no longer belong to any meeting.',
      confirmLabel: 'Import', danger: true,
    })) { input.value = ''; return; }
    try {
      await app.db.importAll(JSON.parse(await file.text()));
      toast('Imported.');
      app.refresh();
    } catch (err) {
      toast(err.message);
    }
    input.value = '';
  });
  return h('span', button('Import a previous export', { onClick: () => input.click() }), input);
}

/* ── privacy ─────────────────────────────────────────────────────────────── */

function privacySection(app) {
  const db = app.db;
  return section({ title: 'Recordings and privacy' },
    h('div.stack',
      h('p.body', 'Recordings are of people talking, often without a second thought about where the audio ends up. So, plainly:'),
      h('ul.stack-2.meta', { style: { paddingLeft: '18px', listStyle: 'disc' } },
        h('li', 'Everything is stored in this browser on this device. There is no account, no server holding your meetings, and no copy anywhere else.'),
        h('li', 'Audio leaves this device only when a transcription endpoint is configured, and then only the clip being transcribed.'),
        h('li', 'Transcript text is sent to the model endpoint when a meeting is processed or a question is asked — never audio.'),
        h('li', 'Anyone who can open this browser profile can read these meetings. Longhand does not encrypt them, and does not pretend to.'),
        h('li', 'Recording is never silent: the screen shows a red indicator and a running timer, and the browser shows its own.')),
      h('div.row',
        button('Delete every recording, keep transcripts', {
          variant: 'danger',
          onClick: async () => {
            const withAudio = db.all('meetings').filter((m) => m.audioId);
            if (!withAudio.length) { toast('There are no recordings stored.'); return; }
            if (await confirm({
              title: `Delete ${withAudio.length} ${withAudio.length === 1 ? 'recording' : 'recordings'}?`,
              body: 'The audio is permanently deleted from this device. Transcripts, summaries and action items are kept.',
              confirmLabel: 'Delete recordings', danger: true,
            })) {
              for (const meeting of withAudio) await db.deleteAudio(meeting.id);
              toast('Recordings deleted.');
              app.refresh();
            }
          },
        }),
        button('Delete everything', {
          variant: 'danger',
          onClick: async () => {
            if (await confirm({
              title: 'Delete everything?',
              body: 'Every meeting, recording, transcript, task and setting is permanently deleted from this device. Export first if you want a copy.',
              confirmLabel: 'Delete everything', danger: true,
            })) {
              await db.deleteEverything();
              toast('Everything deleted.');
              app.go('home');
            }
          },
        }))));
}

/* ── about ───────────────────────────────────────────────────────────────── */

function aboutSection(app) {
  const dropped = app.db.setting('droppedItems', 0);
  return section({ title: 'How the intelligence works' },
    h('div.stack',
      h('p.body', 'Summaries, decisions, action items and answers are generated from the transcript and nothing else. Each one records the transcript lines it came from; anything the model returns that cannot be traced to a line is discarded before it reaches the screen, which is why a meeting occasionally shows fewer items than were talked about.'),
      h('p.body', 'AI Memory searches your transcripts first, then asks the model to answer only from the passages it found. If the search finds nothing, the model is not called at all and the app says the recordings do not contain it.'),
      dropped ? h('p.meta-sm', `${dropped} untraceable items have been discarded so far.`) : null));
}
