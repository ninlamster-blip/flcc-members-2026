/**
 * Meeting intelligence: summary, key points, decisions, action items, open
 * questions, topics and key moments.
 *
 * The rule the whole module exists to enforce: **every generated object must
 * point at the transcript lines it came from.** The prompt asks for line
 * numbers, the parser drops anything whose line numbers do not resolve, and
 * the UI links each one back to the audio. A decision nobody said is a bug,
 * not a stylistic quibble, so it is filtered out here rather than explained
 * away in the interface.
 */

import { ModelUnavailable } from './ai.js';

/** How much transcript goes into one request. Long meetings are analysed in
 *  windows and merged, rather than truncated behind the user's back. */
const WINDOW_CHARS = 26000;

const SYSTEM = `You analyse transcripts of real meetings for a note-taking application.

Rules, in order of importance:
1. Use ONLY what the transcript says. Never add, assume, smooth over or infer beyond it.
2. Every item you return must cite the transcript line numbers it comes from.
3. If a category has nothing in the transcript, return an empty array. An empty
   array is a correct answer and is always better than an invented one.
4. Quote people's own wording where you can. Do not make the language more
   corporate, more decisive or more polite than it was.
5. A decision is something the participants settled. A discussion of options is
   not a decision. An action item has someone doing something; a topic being
   raised is not an action item.

Reply with JSON only. No commentary before or after.`;

/** @param {{lines: string, isWindow: boolean}} context */
function analysisPrompt({ lines, isWindow }) {
  return `Here is ${isWindow ? 'part of' : ''} a meeting transcript. Each line is numbered.

${lines}

Return JSON of exactly this shape:

{
  "summary": "2-4 sentences, plain and factual, of what this meeting was about and where it got to.",
  "keyPoints": [{ "text": "one substantive point discussed", "lines": [12, 13] }],
  "decisions": [{ "text": "what was decided, as decided", "lines": [40] }],
  "actions": [{ "task": "what someone is to do", "owner": "the person's name exactly as it appears, or empty", "due": "YYYY-MM-DD or a phrase like 'Friday' if stated, else empty", "context": "one sentence of why", "lines": [55, 56] }],
  "questions": [{ "text": "a question raised and left unresolved", "lines": [70] }],
  "topics": [{ "name": "2-3 word topic", "lines": [12, 40] }],
  "moments": [{ "label": "why this line matters, in under 8 words", "lines": [40] }]
}

"lines" must be numbers taken from the transcript above. Never invent one.`;
}

/**
 * @param {object} options
 * @param {import('./db.js').Database} options.db
 * @param {string} options.meetingId
 * @param {import('./ai.js').ModelClient} options.client
 * @param {(step: {key: string, state: string, detail?: string}) => void} [options.onStep]
 * @param {AbortSignal} [options.signal]
 */
export async function analyseMeeting({ db, meetingId, client, onStep = () => {}, signal }) {
  const meeting = db.get('meetings', meetingId);
  if (!meeting) throw new Error('That meeting no longer exists.');
  if (!client || !client.available) throw new ModelUnavailable();

  const segments = db.where('segments', { meetingId }).sort((a, b) => a.start - b.start);
  if (!segments.length) throw new Error('There is no transcript to analyse yet.');

  const speakerNames = speakerMap(db, meetingId);
  const windows = buildWindows(segments, speakerNames);

  onStep({ key: 'analyse', state: 'active', detail: windows.length > 1 ? `Reading ${windows.length} parts` : '' });

  const parts = [];
  for (let i = 0; i < windows.length; i++) {
    const result = await client.completeJson({
      system: SYSTEM,
      prompt: analysisPrompt({ lines: windows[i].lines, isWindow: windows.length > 1 }),
      maxTokens: 3000,
      signal,
    });
    parts.push(collect(result, segments));
    if (windows.length > 1) onStep({ key: 'analyse', state: 'active', detail: `Part ${i + 1} of ${windows.length}` });
  }

  const merged = mergeParts(parts);

  // With several windows each summary covers only its own part; one more
  // short pass turns them into the meeting's summary rather than a list.
  if (parts.length > 1) {
    onStep({ key: 'summary', state: 'active' });
    const joined = parts.map((p, i) => `Part ${i + 1}: ${p.summary}`).join('\n');
    const combined = await client.complete({
      system: SYSTEM,
      prompt: `These are summaries of consecutive parts of one meeting:\n\n${joined}\n\nWrite the meeting's summary in 3-5 sentences. Plain prose, no headings, no bullet points, nothing that was not in the parts.`,
      maxTokens: 500,
      signal,
    });
    merged.summary = combined.trim() || merged.summary;
  }

  onStep({ key: 'save', state: 'active' });
  const saved = persist({ db, meetingId, result: merged, segments });
  onStep({ key: 'save', state: 'done' });
  return saved;
}

/** Numbered transcript lines, split into windows that fit one request. */
export function buildWindows(segments, speakerNames = new Map()) {
  const windows = [];
  let lines = [];
  let size = 0;
  segments.forEach((segment, position) => {
    const speaker = speakerNames.get(segment.speakerId) || 'Speaker';
    const line = `[${position + 1}] ${timecode(segment.start)} ${speaker}: ${String(segment.text || '').trim()}`;
    if (size + line.length > WINDOW_CHARS && lines.length) {
      windows.push({ lines: lines.join('\n') });
      lines = [];
      size = 0;
    }
    lines.push(line);
    size += line.length + 1;
  });
  if (lines.length) windows.push({ lines: lines.join('\n') });
  return windows;
}

function timecode(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function speakerMap(db, meetingId) {
  const map = new Map();
  for (const speaker of db.where('speakers', { meetingId })) {
    const person = speaker.personId ? db.get('people', speaker.personId) : null;
    map.set(speaker.id, person ? person.name : speaker.label);
  }
  return map;
}

/**
 * Turn one model reply into records, keeping only what cites real lines.
 * Exported because this is the piece worth testing on its own.
 */
export function collect(result, segments) {
  const refs = (lines) => (Array.isArray(lines) ? lines : [lines])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= segments.length)
    .map((n) => segments[n - 1].id)
    .filter((v, i, all) => all.indexOf(v) === i);

  const grounded = (rows, map) => (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const segmentIds = refs(row && row.lines);
      if (!segmentIds.length) return null;      // ungrounded: dropped, not shown
      const built = map(row, segmentIds);
      return built && String(built.text || built.task || built.name || built.label || '').trim() ? built : null;
    })
    .filter(Boolean);

  return {
    summary: String(result && result.summary || '').trim(),
    keyPoints: grounded(result && result.keyPoints, (row, segmentIds) => ({ text: clean(row.text), segmentIds })),
    decisions: grounded(result && result.decisions, (row, segmentIds) => ({ text: clean(row.text), segmentIds })),
    actions: grounded(result && result.actions, (row, segmentIds) => ({
      task: clean(row.task),
      ownerName: clean(row.owner).slice(0, 60),
      dueDate: parseDue(row.due),
      context: clean(row.context),
      segmentIds,
    })),
    questions: grounded(result && result.questions, (row, segmentIds) => ({ text: clean(row.text), segmentIds })),
    topics: grounded(result && result.topics, (row, segmentIds) => ({ name: clean(row.name).slice(0, 48), segmentIds })),
    moments: grounded(result && result.moments, (row, segmentIds) => ({ label: clean(row.label).slice(0, 90), segmentIds })),
    dropped: countDropped(result, segments),
  };
}

/** How many items the model returned that could not be traced to a line.
 *  Surfaced in Settings → Diagnostics; a rising number means a bad prompt. */
function countDropped(result, segments) {
  let dropped = 0;
  for (const key of ['keyPoints', 'decisions', 'actions', 'questions', 'topics', 'moments']) {
    for (const row of (Array.isArray(result && result[key]) ? result[key] : [])) {
      const valid = (Array.isArray(row && row.lines) ? row.lines : []).some(
        (n) => Number.isInteger(Number(n)) && Number(n) >= 1 && Number(n) <= segments.length);
      if (!valid) dropped++;
    }
  }
  return dropped;
}

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

/** Only an unambiguous date becomes a date. "Friday" stays in the context
 *  line, where it is honest, instead of becoming a wrong deadline. */
export function parseDue(value) {
  const text = clean(value);
  if (!text) return null;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!iso) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : text;
}

function mergeParts(parts) {
  if (parts.length === 1) return parts[0];
  const merged = {
    summary: parts.map((p) => p.summary).filter(Boolean).join(' '),
    keyPoints: [], decisions: [], actions: [], questions: [], topics: [], moments: [],
    dropped: parts.reduce((sum, p) => sum + p.dropped, 0),
  };
  for (const part of parts) {
    for (const key of ['keyPoints', 'decisions', 'actions', 'questions', 'moments']) merged[key].push(...part[key]);
    for (const topic of part.topics) {
      const existing = merged.topics.find((t) => t.name.toLowerCase() === topic.name.toLowerCase());
      if (existing) existing.segmentIds = [...new Set([...existing.segmentIds, ...topic.segmentIds])];
      else merged.topics.push(topic);
    }
  }
  return merged;
}

function persist({ db, meetingId, result, segments }) {
  db.clearDerived(meetingId);
  db.update('meetings', meetingId, {
    summary: result.summary,
    keyPoints: result.keyPoints,
    status: 'ready',
    processedAt: new Date().toISOString(),
    error: null,
  });

  for (const row of result.decisions) db.insert('decisions', { meetingId, ...row });
  for (const row of result.questions) db.insert('questions', { meetingId, ...row });
  for (const row of result.topics) db.insert('topics', { meetingId, ...row });
  for (const row of result.moments) db.insert('moments', { meetingId, ...row });
  for (const row of result.actions) {
    db.insert('actions', { meetingId, ...row, personId: matchPerson(db, row.ownerName) });
  }

  // Speakers who turned out to be named people become participants, so the
  // People index is built from the meetings themselves rather than typed in.
  const participantIds = [];
  for (const speaker of db.where('speakers', { meetingId })) {
    if (speaker.personId && !participantIds.includes(speaker.personId)) participantIds.push(speaker.personId);
  }
  db.update('meetings', meetingId, { participantIds });
  return { ...result, segmentCount: segments.length };
}

function matchPerson(db, name) {
  const wanted = String(name || '').trim().toLowerCase();
  if (!wanted) return null;
  const person = db.all('people').find((p) => {
    const names = [p.name, ...(p.aliases || [])].map((n) => String(n).toLowerCase());
    return names.includes(wanted) || names.some((n) => n.split(/\s+/)[0] === wanted.split(/\s+/)[0]);
  });
  return person ? person.id : null;
}
