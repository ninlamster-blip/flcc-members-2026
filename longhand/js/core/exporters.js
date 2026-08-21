/**
 * Export.
 *
 * Text, Markdown and CSV are produced here as strings — pure functions, so
 * the test suite can read what a user would get. PDF goes through the
 * browser's own print dialogue, which is the only way a static app can make
 * a real PDF without shipping a rendering library that would be larger than
 * the rest of the code put together. Choosing "Save as PDF" in that dialogue
 * is the step, and the UI says so instead of implying a silent download.
 */

import { clock, longDate, duration } from './format.js';

/** @param {{meeting: object, segments: object[], speakerNames: Map<string,string>}} bundle */
export function transcriptText({ meeting, segments, speakerNames }) {
  const lines = [
    meeting.title,
    `${longDate(meeting.startedAt)} · ${duration(meeting.durationSec)}`,
    '',
  ];
  for (const segment of segments) {
    lines.push(`${clock(segment.start)}  ${speakerNames.get(segment.speakerId) || 'Speaker'}`);
    lines.push(segment.text);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * The whole meeting as Markdown: what someone pastes into their own notes.
 * @param {{meeting: object, segments: object[], speakerNames: Map<string,string>,
 *          decisions: object[], actions: object[], questions: object[], topics: object[],
 *          include?: {summary?: boolean, decisions?: boolean, actions?: boolean, transcript?: boolean}}} bundle
 */
export function meetingMarkdown(bundle) {
  const { meeting, segments, speakerNames, decisions = [], actions = [], questions = [], topics = [] } = bundle;
  const include = { summary: true, decisions: true, actions: true, transcript: true, ...(bundle.include || {}) };
  const out = [`# ${meeting.title}`, '', `${longDate(meeting.startedAt)} · ${duration(meeting.durationSec)}`];

  const participants = [...new Set(segments.map((s) => speakerNames.get(s.speakerId)).filter(Boolean))];
  if (participants.length) out.push('', `Participants: ${participants.join(' · ')}`);

  if (include.summary && meeting.summary) out.push('', '## Summary', '', meeting.summary);

  if (include.summary && (meeting.keyPoints || []).length) {
    out.push('', '## Key points', '');
    for (const point of meeting.keyPoints) out.push(`- ${point.text}`);
  }

  if (include.decisions && decisions.length) {
    out.push('', '## Decisions', '');
    decisions.forEach((decision, i) => out.push(`${String(i + 1).padStart(2, '0')}. ${decision.text}`));
  }

  if (include.actions && actions.length) {
    out.push('', '## Action items', '');
    for (const action of actions) {
      const owner = action.ownerName ? `**${action.ownerName}** — ` : '';
      const due = action.dueDate ? ` (due ${action.dueDate})` : '';
      out.push(`- [${action.status === 'done' ? 'x' : ' '}] ${owner}${action.task}${due}`);
    }
  }

  if (questions.length) {
    out.push('', '## Open questions', '');
    for (const question of questions) out.push(`- ${question.text}`);
  }

  if (topics.length) out.push('', `Topics: ${topics.map((t) => t.name).join(', ')}`);

  if (include.transcript && segments.length) {
    out.push('', '## Transcript', '');
    for (const segment of segments) {
      out.push(`**${clock(segment.start)} ${speakerNames.get(segment.speakerId) || 'Speaker'}**`, '', segment.text, '');
    }
  }
  return out.join('\n');
}

const CSV_COLUMNS = ['Task', 'Owner', 'Due', 'Status', 'Meeting', 'Date', 'Context'];

/** @param {Array<{action: object, meeting: object}>} rows */
export function actionsCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const { action, meeting } of rows) {
    lines.push([
      action.task,
      action.ownerName || '',
      action.dueDate || '',
      action.status === 'done' ? 'Completed' : 'Open',
      meeting ? meeting.title : '',
      meeting ? String(meeting.startedAt).slice(0, 10) : '',
      action.context || '',
    ].map(csvCell).join(','));
  }
  return lines.join('\n');
}

/** A leading =, +, - or @ makes a spreadsheet treat text as a formula. */
function csvCell(value) {
  const text = String(value == null ? '' : value).replace(/\r?\n/g, ' ');
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function download(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function fileStem(meeting) {
  const date = String(meeting.startedAt || '').slice(0, 10);
  const name = String(meeting.title || 'meeting').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${date}-${name || 'meeting'}`;
}

/**
 * Open a plain, printable rendering in its own window. The user chooses
 * "Save as PDF" there — the app does not claim to have written a PDF.
 */
export function printDocument(title, bodyHtml) {
  const frame = document.createElement('iframe');
  frame.setAttribute('title', `${title} (print)`);
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font: 15px/1.6 -apple-system, 'Segoe UI', system-ui, sans-serif; color: #171717; margin: 40px; max-width: 40em; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #6B6B6B; margin: 28px 0 8px; }
  .meta { color: #6B6B6B; font-size: 13px; margin-bottom: 24px; }
  .turn { display: grid; grid-template-columns: 56px 1fr; gap: 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .t { color: #93918C; font-size: 12px; font-variant-numeric: tabular-nums; }
  .s { font-weight: 600; font-size: 13px; }
  ol, ul { padding-left: 20px; margin: 0; }
  li { margin-bottom: 6px; }
</style></head><body>${bodyHtml}</body></html>`);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1000);
}

export function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
