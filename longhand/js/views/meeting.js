/**
 * The meeting.
 *
 * The screen this application is for: what was said, what it meant, and the
 * ability to check the second against the first. Sections are separated by
 * rules and headings rather than boxed into cards — the page should read
 * like a document, because that is what it is.
 */

import { h, icon } from '../core/dom.js';
import { clock, longDate, duration, timeOfDay, dueLabel, bytes } from '../core/format.js';
import {
  section, rows, button, tag, notice, empty, menu, confirm, promptDialog, toast, spinner, searchField,
} from '../core/ui.js';
import { SPEEDS, SKIP_SECONDS, segmentAt } from '../core/audio.js';
import { speakerMap } from '../core/intelligence.js';
import { chunkMeeting, Index } from '../core/retrieval.js';
import { moveToFolder } from '../core/folders.js';
import { ask } from '../core/memory.js';
import { meetingMarkdown, transcriptText, actionsCsv, download, fileStem, printDocument, escapeHtml } from '../core/exporters.js';

export async function render(app, route) {
  const db = app.db;
  const meetingId = route.params[0];
  const meeting = db.get('meetings', meetingId);
  if (!meeting) {
    return h('div.view', empty({
      title: 'That meeting is not on this device.',
      body: 'It may have been deleted, or recorded in a different browser.',
      action: h('a.btn', { href: '#/meetings' }, 'All meetings'),
    }));
  }

  const segments = db.where('segments', { meetingId }).sort((a, b) => a.start - b.start);
  const names = speakerMap(db, meetingId);
  const view = h('div.view.view--reading.stack-6');

  /* ── heading ───────────────────────────────────────────────────────────── */
  const participants = [...names.values()].filter(Boolean);
  view.appendChild(h('div.stack-2',
    h('div.row.row--between',
      h('h1.page-title', meeting.title),
      h('div.row.row--tight',
        meeting.favorite ? tag('Favourite', 'accent') : null,
        button('', { iconName: 'more', title: 'Meeting options', variant: 'quiet',
          onClick: (event) => meetingMenu(app, meeting, event.currentTarget) }))),
    h('p.meta', [
      longDate(meeting.startedAt),
      timeOfDay(meeting.startedAt),
      duration(meeting.durationSec),
      meeting.audioBytes ? bytes(meeting.audioBytes) : 'no audio kept',
      meeting.folderId && db.get('folders', meeting.folderId) ? db.get('folders', meeting.folderId).name : null,
    ].filter(Boolean).join(' · ')),
    participants.length
      ? h('p.meta', 'Participants: ', ...participants.map((name, i) => h('span', i ? ' · ' : '', name)))
      : null));

  if (meeting.error) {
    view.appendChild(notice({
      tone: meeting.status === 'failed' ? 'error' : 'attention',
      title: meeting.status === 'failed' ? 'This recording needs attention' : 'Something is missing',
      body: meeting.error,
      actions: [button('Try processing again', { onClick: () => reprocess(app, meetingId) })],
    }));
  }

  /* ── audio ─────────────────────────────────────────────────────────────── */
  const player = app.player;
  let audioReady = false;
  if (meeting.audioId) {
    const blob = await db.blobs.get(meeting.audioId);
    if (blob) { player.load(blob, meeting.durationSec); audioReady = true; }
  }

  /* ── summary and intelligence ──────────────────────────────────────────── */
  if (meeting.summary) {
    view.appendChild(section({ title: 'Summary' },
      h('p.answer__text', { style: { fontSize: '16px' } }, meeting.summary)));
  } else if (segments.length && meeting.status === 'ready') {
    view.appendChild(section({ title: 'Summary' },
      h('div.row', h('p.meta', 'No summary has been generated for this meeting.'),
        button('Generate', { size: 'sm', onClick: () => reprocess(app, meetingId, { retranscribe: false }) }))));
  }

  const jumpTo = (segmentIds) => {
    const first = segments.find((s) => segmentIds.includes(s.id));
    if (!first) return;
    if (audioReady) { player.seek(first.start); player.play(); }
    const node = document.getElementById(`seg-${first.id}`);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      node.classList.add('turn--active');
      setTimeout(() => node.classList.remove('turn--active'), 2400);
    }
  };

  const keyPoints = meeting.keyPoints || [];
  if (keyPoints.length) {
    view.appendChild(section({ title: 'Key points' },
      h('ul.stack-2', ...keyPoints.map((point) => h('li.row',
        h('span.grow', point.text),
        sourceButton(point.segmentIds, segments, jumpTo))))));
  }

  const decisions = db.where('decisions', { meetingId });
  if (decisions.length) {
    view.appendChild(section({ title: 'Decisions' },
      h('ol.stack', ...decisions.map((decision, i) => h('li.row', { style: { alignItems: 'flex-start' } },
        h('span.num.meta-sm', { style: { minWidth: '22px', paddingTop: '2px' } }, String(i + 1).padStart(2, '0')),
        h('span.grow.body', decision.text),
        sourceButton(decision.segmentIds, segments, jumpTo))))));
  }

  const actions = db.where('actions', { meetingId });
  if (actions.length) {
    view.appendChild(section(
      { title: 'Action items', aside: `${actions.filter((a) => a.status === 'open').length} open` },
      rows(...actions.map((action) => actionRow(app, action, segments, jumpTo)))));
  }

  const questions = db.where('questions', { meetingId });
  if (questions.length) {
    view.appendChild(section({ title: 'Open questions' },
      h('ul.stack-2', ...questions.map((question) => h('li.row',
        h('span.grow', question.text),
        sourceButton(question.segmentIds, segments, jumpTo))))));
  }

  const topics = db.where('topics', { meetingId });
  if (topics.length) {
    view.appendChild(section({ title: 'Topics' },
      h('div.row.row--tight', ...topics.map((topic) => h('button.suggestion', {
        type: 'button',
        onClick: () => jumpTo(topic.segmentIds),
      }, topic.name)))));
  }

  /* ── ask this meeting ──────────────────────────────────────────────────── */
  if (segments.length) view.appendChild(askSection(app, meeting, segments, names, jumpTo));

  /* ── transcript ────────────────────────────────────────────────────────── */
  view.appendChild(transcriptSection(app, meeting, segments, names, { player, audioReady }));

  if (audioReady) view.appendChild(playerBar(player));
  else if (meeting.audioId === null && segments.length) {
    view.appendChild(h('p.meta-sm', 'The audio for this meeting is not stored on this device. The transcript is unaffected.'));
  }

  // A link from Search or AI Memory carries the moment it is about.
  if (route.query.t || route.query.seg) {
    const at = Number(route.query.t);
    const target = route.query.seg || (segments.find((s) => s.start >= at) || {}).id;
    setTimeout(() => {
      if (audioReady && Number.isFinite(at)) player.seek(at);
      const node = target && document.getElementById(`seg-${target}`);
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        node.classList.add('turn--active');
        setTimeout(() => node.classList.remove('turn--active'), 2600);
      }
    }, 60);
  }

  if (!segments.length) {
    view.appendChild(empty({
      title: 'No transcript yet.',
      body: meeting.audioId
        ? 'The recording is saved. Transcribe it once a provider is configured in Settings.'
        : 'There is no audio and no transcript for this meeting.',
      action: meeting.audioId ? button('Transcribe now', { variant: 'primary', onClick: () => reprocess(app, meetingId) }) : null,
    }));
  }

  return view;
}

/* ── pieces ──────────────────────────────────────────────────────────────── */

function sourceButton(segmentIds, segments, jumpTo) {
  const first = segments.find((s) => (segmentIds || []).includes(s.id));
  if (!first) return null;
  return h('button.turn__time.num', {
    type: 'button',
    title: 'Jump to this moment',
    'aria-label': `Jump to ${clock(first.start)}`,
    onClick: () => jumpTo(segmentIds),
  }, clock(first.start));
}

function actionRow(app, action, segments, jumpTo) {
  const done = action.status === 'done';
  const due = dueLabel(action.dueDate);
  const toggle = h('input', {
    type: 'checkbox', checked: done || null,
    'aria-label': `Mark "${action.task}" ${done ? 'open' : 'completed'}`,
    onChange: () => {
      app.db.update('actions', action.id, {
        status: done ? 'open' : 'done',
        completedAt: done ? null : new Date().toISOString(),
      });
      app.refresh();
    },
  });
  return h('div.row-item',
    h('label.checkbox', { style: { paddingTop: '2px' } }, toggle),
    h('div.row-item__main',
      h('span.row-item__title', { style: done ? { textDecoration: 'line-through', color: 'var(--ink-3)' } : null },
        action.ownerName ? h('strong', `${action.ownerName} — `) : null, action.task),
      action.context ? h('span.meta', action.context) : null),
    h('div.row-item__side',
      due ? tag(due, due === 'Overdue' && !done ? 'attention' : '') : null,
      done ? tag('Completed', 'done') : null,
      sourceButton(action.segmentIds, segments, jumpTo)));
}

function askSection(app, meeting, segments, names, jumpTo) {
  const input = h('textarea', {
    rows: 1, placeholder: 'Ask about this meeting…', 'aria-label': 'Ask about this meeting',
    onInput: (event) => { event.target.style.height = 'auto'; event.target.style.height = `${event.target.scrollHeight}px`; },
    onKeydown: (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); run(); } },
  });
  const output = h('div');
  const send = button('Ask', { variant: 'primary', onClick: () => run() });

  const index = new Index(chunkMeeting(meeting, segments, names));

  async function run() {
    const question = input.value.trim();
    if (!question) { input.focus(); return; }
    output.replaceChildren(h('div.row.meta', spinner(), 'Reading the transcript…'));
    send.disabled = true;
    try {
      const result = await ask({
        db: app.db, index, question, client: app.client, meetingId: meeting.id, save: true,
      });
      output.replaceChildren(answerBlock(result, jumpTo));
    } catch (err) {
      output.replaceChildren(notice({
        tone: 'error',
        title: 'That question could not be answered',
        body: err.name === 'ModelUnavailable'
          ? 'No intelligence endpoint is configured. Set one in Settings — the transcript itself is unaffected.'
          : err.message,
        actions: [h('a.btn.btn--sm', { href: '#/settings' }, 'Settings')],
      }));
    } finally {
      send.disabled = false;
    }
  }

  const suggestions = ['What was decided?', 'What am I meant to do?', 'What was left unresolved?'];
  return section({ title: 'Ask this meeting' },
    h('div.stack',
      h('div.ask', input, send),
      h('div.suggestions', ...suggestions.map((text) => h('button.suggestion', {
        type: 'button',
        onClick: () => { input.value = text; run(); },
      }, text))),
      output));
}

export function answerBlock(result, jumpTo) {
  const block = h('div.answer', h('p.answer__text', result.answer));
  if (result.unsupported) {
    block.appendChild(h('p.meta-sm', 'No line of the transcript could be matched to this answer — treat it with care.'));
  }
  if (result.sources.length) {
    block.appendChild(h('div.sources',
      ...result.sources.map((source) => h('button.source', {
        type: 'button',
        onClick: () => jumpTo(source.segmentIds, source),
      },
      h('span.source__ref.num', clock(source.start)),
      h('span',
        h('span.source__quote', `“${source.quote}”`),
        h('span.source__where', ` — ${source.meetingTitle}`))))));
  }
  return block;
}

/* ── transcript ──────────────────────────────────────────────────────────── */

function transcriptSection(app, meeting, segments, names, { player, audioReady }) {
  const list = h('div');
  const count = h('span.meta-sm');
  let query = '';

  const paint = () => {
    list.replaceChildren();
    const terms = query.trim().toLowerCase();
    let shown = 0;
    let lastSpeaker = null;
    for (const segment of segments) {
      if (terms && !segment.text.toLowerCase().includes(terms)) { lastSpeaker = null; continue; }
      shown++;
      list.appendChild(turnNode(app, meeting, segment, names, {
        player, audioReady, highlight: terms,
        sameSpeaker: segment.speakerId === lastSpeaker,
        onChanged: paint,
      }));
      lastSpeaker = segment.speakerId;
    }
    count.textContent = terms
      ? `${shown} of ${segments.length} lines`
      : `${segments.length} lines · ${names.size} ${names.size === 1 ? 'voice' : 'voices'}`;
    if (terms && !shown) list.appendChild(h('p.meta', { style: { padding: 'var(--s4) 0' } }, 'Nothing in this transcript matches that.'));
  };

  const search = searchField({
    placeholder: 'Search this transcript',
    onInput: (value) => { query = value; paint(); },
  });
  search.style.maxWidth = '260px';

  paint();

  // Follow playback: the line being spoken is marked, and only that one.
  if (audioReady) {
    let currentId = null;
    player.addEventListener('time', () => {
      const active = segmentAt(segments, player.currentTime);
      if (!active || active.id === currentId) return;
      currentId = active.id;
      for (const node of list.querySelectorAll('.turn--active')) node.classList.remove('turn--active');
      const node = document.getElementById(`seg-${active.id}`);
      if (node) node.classList.add('turn--active');
    });
  }

  return section({ title: 'Transcript', actions: [search] },
    h('div.row.row--between', count,
      button('Copy all', { size: 'sm', variant: 'quiet', onClick: async () => {
        await navigator.clipboard.writeText(transcriptText({ meeting, segments, speakerNames: names }));
        toast('Transcript copied.');
      } })),
    list);
}

function turnNode(app, meeting, segment, names, { player, audioReady, highlight, sameSpeaker, onChanged }) {
  const text = h('div.turn__text', { id: `text-${segment.id}` });
  paintText(text, segment.text, highlight);

  const note = app.db.where('notes', { segmentId: segment.id })[0];

  const body = h('div',
    sameSpeaker ? null : h('button.turn__speaker', {
      type: 'button',
      title: 'Rename this speaker',
      onClick: () => renameSpeaker(app, meeting, segment.speakerId, names.get(segment.speakerId) || 'Speaker'),
    }, names.get(segment.speakerId) || 'Speaker'),
    text,
    note ? h('p.turn__note', note.text) : null,
    h('div.turn__tools',
      toolButton('edit', 'Edit this line', () => startEditing(app, segment, text, onChanged)),
      toolButton('note', 'Add a note', async () => {
        const value = await promptDialog({
          title: 'Note on this line', label: 'Note', value: note ? note.text : '', multiline: true,
        });
        if (value == null) return;
        if (note) app.db.update('notes', note.id, { text: value });
        else app.db.insert('notes', { meetingId: meeting.id, segmentId: segment.id, text: value });
        onChanged();
      }),
      toolButton('bookmark', 'Bookmark this moment', () => {
        app.db.insert('moments', {
          meetingId: meeting.id, label: segment.text.slice(0, 80), segmentIds: [segment.id], bookmarked: true,
        });
        toast('Moment bookmarked.');
      }),
      toolButton('quote', 'Copy this line', async () => {
        await navigator.clipboard.writeText(`${clock(segment.start)} ${names.get(segment.speakerId) || 'Speaker'}: ${segment.text}`);
        toast('Line copied.');
      })));

  return h('div.turn', { id: `seg-${segment.id}` },
    h('button.turn__time.num', {
      type: 'button',
      title: audioReady ? 'Play from here' : 'No audio stored for this meeting',
      'aria-label': `Play from ${clock(segment.start)}`,
      disabled: !audioReady || null,
      onClick: () => { player.seek(segment.start); player.play(); },
    }, clock(segment.start)),
    body);
}

function toolButton(iconName, label, onClick) {
  return h('button.btn.btn--quiet.btn--sm', { type: 'button', title: label, 'aria-label': label, onClick },
    icon(iconName, { size: 14 }));
}

function paintText(node, value, highlight) {
  node.replaceChildren();
  if (!highlight) { node.textContent = value; return; }
  const lower = value.toLowerCase();
  let at = 0;
  let found = lower.indexOf(highlight);
  while (found >= 0) {
    node.appendChild(document.createTextNode(value.slice(at, found)));
    node.appendChild(h('mark', value.slice(found, found + highlight.length)));
    at = found + highlight.length;
    found = lower.indexOf(highlight, at);
  }
  node.appendChild(document.createTextNode(value.slice(at)));
}

function startEditing(app, segment, node, onChanged) {
  node.setAttribute('contenteditable', 'true');
  node.focus();
  const original = segment.text;
  const finish = (save) => {
    node.removeAttribute('contenteditable');
    const value = node.textContent.trim();
    if (save && value && value !== original) {
      app.db.update('segments', segment.id, { text: value, edited: true });
      toast('Line corrected.');
    }
    onChanged();
  };
  node.addEventListener('blur', () => finish(true), { once: true });
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); node.blur(); }
    if (event.key === 'Escape') { node.textContent = original; node.blur(); }
  });
}

async function renameSpeaker(app, meeting, speakerId, current) {
  const name = await promptDialog({
    title: 'Rename speaker',
    label: 'Name',
    value: current.startsWith('Speaker ') ? '' : current,
    hint: 'Every line by this voice is relabelled, and the person is added to your People index.',
    confirmLabel: 'Rename',
  });
  if (!name) return;
  let person = app.db.all('people').find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!person) person = app.db.insert('people', { name });
  app.db.update('speakers', speakerId, { label: name, personId: person.id });

  const participantIds = [...new Set([...(meeting.participantIds || []), person.id])];
  app.db.update('meetings', meeting.id, { participantIds });
  toast(`Renamed to ${name}.`);
  app.refresh();
}

/* ── player bar ──────────────────────────────────────────────────────────── */

function playerBar(player) {
  const playButton = h('button.btn.btn--icon', { type: 'button', 'aria-label': 'Play', onClick: () => player.toggle() }, icon('play', { size: 16 }));
  const elapsed = h('span.player__time.num', '0:00');
  const remaining = h('span.player__time.num', '-0:00');
  const scrub = h('input.scrub', {
    type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Seek',
    onInput: (event) => player.seek((event.target.value / 1000) * (player.duration || 0)),
  });
  const speed = h('button.btn.btn--sm', { type: 'button', title: 'Playback speed' }, '1x');
  speed.addEventListener('click', () => {
    menu(speed, SPEEDS.map((rate) => ({
      label: `${rate}x`,
      onSelect: () => { player.setRate(rate); speed.textContent = `${rate}x`; },
    })));
  });

  const paint = () => {
    const { time, duration: total, playing } = player.snapshot();
    elapsed.textContent = clock(time);
    remaining.textContent = `-${clock(Math.max(0, (total || 0) - time))}`;
    if (total) scrub.value = String(Math.round((time / total) * 1000));
    playButton.replaceChildren(icon(playing ? 'pause' : 'play', { size: 16 }));
    playButton.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };
  player.addEventListener('time', paint);
  player.addEventListener('state', paint);
  paint();

  return h('div.player', { role: 'group', 'aria-label': 'Audio player' },
    h('button.btn.btn--icon', { type: 'button', 'aria-label': `Back ${SKIP_SECONDS} seconds`, onClick: () => player.skip(-SKIP_SECONDS) }, icon('back5', { size: 16 })),
    playButton,
    h('button.btn.btn--icon', { type: 'button', 'aria-label': `Forward ${SKIP_SECONDS} seconds`, onClick: () => player.skip(SKIP_SECONDS) }, icon('fwd5', { size: 16 })),
    elapsed, scrub, remaining, speed);
}

/* ── menu, export, reprocess ─────────────────────────────────────────────── */

function meetingMenu(app, meeting, anchor) {
  menu(anchor, [
    { label: 'Rename', iconName: 'edit', onSelect: async () => {
      const title = await promptDialog({ title: 'Rename meeting', label: 'Title', value: meeting.title });
      if (title) { app.db.update('meetings', meeting.id, { title }); app.refresh(); }
    } },
    { label: meeting.favorite ? 'Remove from favourites' : 'Add to favourites', iconName: 'star', onSelect: () => {
      app.db.update('meetings', meeting.id, { favorite: !meeting.favorite });
      app.refresh();
    } },
    { label: 'Move to folder…', iconName: 'folder', onSelect: async () => {
      if (await moveToFolder(app, meeting.id)) app.refresh();
    } },
    { label: meeting.archived ? 'Unarchive' : 'Archive', iconName: 'bookmark', onSelect: () => {
      app.db.update('meetings', meeting.id, { archived: !meeting.archived });
      toast(meeting.archived ? 'Unarchived.' : 'Archived.');
      app.refresh();
    } },
    '-',
    { label: 'Export…', iconName: 'download', onSelect: () => exportDialog(app, meeting) },
    { label: 'Process again', iconName: 'record', onSelect: () => reprocess(app, meeting.id) },
    '-',
    { label: 'Delete the audio only', iconName: 'trash', danger: true, onSelect: async () => {
      if (await confirm({
        title: 'Delete the audio?',
        body: 'The recording is removed from this device. The transcript, summary and action items stay.',
        confirmLabel: 'Delete audio', danger: true,
      })) {
        await app.db.deleteAudio(meeting.id);
        toast('Audio deleted.');
        app.refresh();
      }
    } },
    { label: 'Delete the meeting', iconName: 'trash', danger: true, onSelect: async () => {
      if (await confirm({
        title: `Delete “${meeting.title}”?`,
        body: 'The recording, transcript, summary and action items are permanently deleted from this device.',
        confirmLabel: 'Delete', danger: true,
      })) {
        await app.db.deleteMeeting(meeting.id);
        toast('Meeting deleted.');
        app.go('meetings');
      }
    } },
  ]);
}

function bundleFor(app, meeting) {
  const db = app.db;
  return {
    meeting,
    segments: db.where('segments', { meetingId: meeting.id }).sort((a, b) => a.start - b.start),
    speakerNames: speakerMap(db, meeting.id),
    decisions: db.where('decisions', { meetingId: meeting.id }),
    actions: db.where('actions', { meetingId: meeting.id }),
    questions: db.where('questions', { meetingId: meeting.id }),
    topics: db.where('topics', { meetingId: meeting.id }),
  };
}

async function exportDialog(app, meeting) {
  const bundle = bundleFor(app, meeting);
  const stem = fileStem(meeting);
  const choose = (include) => ({ ...bundle, include });

  const options = [
    { label: 'Meeting notes (Markdown)', run: () => download(`${stem}.md`, meetingMarkdown(choose({ transcript: false })), 'text/markdown') },
    { label: 'Everything (Markdown)', run: () => download(`${stem}-full.md`, meetingMarkdown(bundle), 'text/markdown') },
    { label: 'Transcript (plain text)', run: () => download(`${stem}-transcript.txt`, transcriptText(bundle)) },
    { label: 'Action items (CSV)', run: () => download(`${stem}-actions.csv`,
        actionsCsv(bundle.actions.map((action) => ({ action, meeting }))), 'text/csv') },
    { label: 'Print or save as PDF', run: () => printDocument(meeting.title, printableHtml(bundle)) },
  ];

  const list = h('div.rows', ...options.map((option) => h('button.row-item', {
    type: 'button',
    onClick: () => { option.run(); close(); },
  }, h('div.row-item__main', h('span.row-item__title', option.label)), h('div.row-item__side', icon('chevron', { size: 15 })))));

  let close = () => {};
  const { dialog } = await import('../core/ui.js');
  await dialog({
    title: 'Export',
    body: h('div.stack', list, h('p.meta-sm', 'PDF is produced by your browser’s print dialogue — choose “Save as PDF” there.')),
    actions: (done) => { close = () => done(null); return [button('Close', { onClick: () => done(null) })]; },
  });
}

function printableHtml({ meeting, segments, speakerNames, decisions, actions, questions }) {
  const parts = [
    `<h1>${escapeHtml(meeting.title)}</h1>`,
    `<div class="meta">${escapeHtml(longDate(meeting.startedAt))} · ${escapeHtml(duration(meeting.durationSec))}</div>`,
  ];
  if (meeting.summary) parts.push('<h2>Summary</h2>', `<p>${escapeHtml(meeting.summary)}</p>`);
  if (decisions.length) {
    parts.push('<h2>Decisions</h2><ol>', ...decisions.map((d) => `<li>${escapeHtml(d.text)}</li>`), '</ol>');
  }
  if (actions.length) {
    parts.push('<h2>Action items</h2><ul>', ...actions.map((a) =>
      `<li>${a.ownerName ? `<strong>${escapeHtml(a.ownerName)}</strong> — ` : ''}${escapeHtml(a.task)}${a.dueDate ? ` (due ${escapeHtml(a.dueDate)})` : ''}</li>`), '</ul>');
  }
  if (questions.length) {
    parts.push('<h2>Open questions</h2><ul>', ...questions.map((q) => `<li>${escapeHtml(q.text)}</li>`), '</ul>');
  }
  if (segments.length) {
    parts.push('<h2>Transcript</h2>', ...segments.map((segment) =>
      `<div class="turn"><div class="t">${clock(segment.start)}</div><div><div class="s">${escapeHtml(speakerNames.get(segment.speakerId) || 'Speaker')}</div>${escapeHtml(segment.text)}</div></div>`));
  }
  return parts.join('\n');
}

async function reprocess(app, meetingId, { retranscribe = true } = {}) {
  const { renderProcessing } = await import('./record.js');
  const host = h('div');
  app.viewHost.replaceChildren(host);
  renderProcessing(app, host, meetingId, { retranscribe });
}

export { reprocess };
