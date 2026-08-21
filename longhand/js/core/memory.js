/**
 * AI Memory — questions answered from the user's own recorded conversations.
 *
 * The pipeline, in one place:
 *
 *   question → understand (period, speaker) → retrieve chunks (retrieval.js)
 *            → rank → build evidence → model, constrained to that evidence
 *            → verify every citation resolves → answer + sources
 *
 * Two things this module will not do:
 *
 *   · Answer from nothing. If retrieval comes back empty, the model is never
 *     called and the user is told plainly that it is not in their recordings.
 *   · Keep a citation that does not resolve to a chunk that was actually
 *     retrieved. Sources are checked after generation, not trusted.
 */

import { understand, chunksOfMeeting, snippet, tokenize } from './retrieval.js';
import { ModelUnavailable } from './ai.js';

export const NOT_FOUND = "I couldn't find that in your recorded conversations.";

const SYSTEM = `You answer questions about meetings using ONLY the numbered excerpts supplied with the question. The excerpts are transcripts of the user's own recorded conversations.

Rules:
1. Use only the excerpts. If they do not contain the answer, say so and set "answered" to false. Never fill a gap from general knowledge.
2. Cite the excerpt number for every claim you make.
3. Separate what was said from what you are concluding. If you are reading between the lines, say "it sounds like" or "no one said this outright, but".
4. Be brief and specific. Name people, amounts, dates and decisions as they were said. Do not soften or upgrade what people committed to.
5. If excerpts disagree with each other, say so rather than picking one.

Reply with JSON only.`;

/**
 * @param {object} options
 * @param {import('./db.js').Database} options.db
 * @param {import('./retrieval.js').Index} options.index
 * @param {string} options.question
 * @param {import('./ai.js').ModelClient} options.client
 * @param {string|null} [options.meetingId]  confine to one meeting (Ask this meeting)
 * @param {Date} [options.now]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.save]
 */
export async function ask({ db, index, question, client, meetingId = null, now = new Date(), signal, save = true }) {
  const asked = String(question || '').trim();
  if (!asked) throw new Error('Ask a question first.');
  if (!client || !client.available) throw new ModelUnavailable();

  const people = db.all('people').map((p) => p.name);
  const filters = understand(asked, { now, people });
  let hits = index.search(asked, {
    limit: 10,
    meetingId,
    speaker: filters.speaker,
    from: filters.from,
    to: filters.to,
  });

  // A period or a speaker the user named can be wrong (they may have said
  // "last week" about a meeting nine days ago). Retry once without the
  // filters before concluding the recordings do not contain it.
  let relaxed = false;
  if (!hits.length && (filters.from || filters.to || filters.speaker)) {
    hits = index.search(asked, { limit: 10, meetingId });
    relaxed = hits.length > 0;
  }

  // Scoped to one meeting, "nothing matched" is not the same as "not in your
  // recordings": the user is pointing at a specific conversation, so that
  // conversation becomes the evidence. Across the whole library there is no
  // such pointer, and an unmatched question stays unanswered.
  let wholeMeeting = false;
  if (!hits.length && meetingId) {
    const terms = tokenize(asked);
    hits = chunksOfMeeting(index, meetingId).map((chunk) => ({ chunk, score: 0, terms, snippet: snippet(chunk.text, terms) }));
    wholeMeeting = hits.length > 0;
  }

  if (!hits.length) {
    return finish({ db, save, question: asked, meetingId, answer: NOT_FOUND, sources: [], answered: false, filters });
  }

  const evidence = hits.map((hit, position) => formatEvidence(hit, position + 1)).join('\n\n');
  const scope = describeScope(filters, relaxed, meetingId, db, wholeMeeting);

  const result = await client.completeJson({
    system: SYSTEM,
    prompt: `Question: ${asked}${scope ? `\n(${scope})` : ''}

Excerpts from the user's recordings:

${evidence}

Return JSON:
{
  "answer": "your answer in plain prose, 1-6 sentences. No headings, no bullet symbols.",
  "citations": [{ "ref": 1, "quote": "the words from that excerpt you are relying on, verbatim and short" }],
  "answered": true
}

Set "answered" to false and leave "citations" empty if the excerpts do not answer the question.`,
    maxTokens: 1200,
    signal,
  });

  const answered = result.answered !== false;
  const text = String(result.answer || '').trim();
  const sources = verifyCitations(result.citations, hits);

  if (!answered || !text) {
    return finish({ db, save, question: asked, meetingId, answer: NOT_FOUND, sources: [], answered: false, filters });
  }

  return finish({
    db, save, question: asked, meetingId, filters,
    answer: text,
    // An answer with no resolvable citation is still shown, but the caller
    // can see it stands on nothing and the UI labels it as unsupported.
    sources,
    answered: true,
    unsupported: sources.length === 0,
  });
}

function formatEvidence(hit, ref) {
  const { chunk } = hit;
  const when = new Date(chunk.meetingDate);
  const date = Number.isNaN(when.getTime()) ? '' : when.toISOString().slice(0, 10);
  return `[${ref}] ${chunk.meetingTitle} — ${date}, from ${timecode(chunk.start)}\n${chunk.text}`;
}

function timecode(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Keep only citations that point at an excerpt that was actually supplied. */
export function verifyCitations(citations, hits) {
  const out = [];
  for (const citation of Array.isArray(citations) ? citations : []) {
    const ref = Number(citation && citation.ref);
    if (!Number.isInteger(ref) || ref < 1 || ref > hits.length) continue;
    const { chunk } = hits[ref - 1];
    if (out.some((s) => s.chunkId === chunk.id)) continue;
    out.push({
      ref: out.length + 1,
      chunkId: chunk.id,
      meetingId: chunk.meetingId,
      meetingTitle: chunk.meetingTitle,
      meetingDate: chunk.meetingDate,
      start: chunk.start,
      segmentIds: chunk.segmentIds,
      quote: String(citation.quote || '').replace(/\s+/g, ' ').trim().slice(0, 240) || hits[ref - 1].snippet,
    });
  }
  return out;
}

function describeScope(filters, relaxed, meetingId, db, wholeMeeting = false) {
  const bits = [];
  if (meetingId) {
    const meeting = db.get('meetings', meetingId);
    if (meeting) bits.push(`the user is asking about the meeting "${meeting.title}"`);
  }
  if (wholeMeeting) bits.push('no passage matched their words, so these excerpts are simply the meeting itself');
  if (filters.period && !relaxed) bits.push(`they asked about ${filters.period}`);
  if (filters.speaker && !relaxed) bits.push(`they asked about what ${filters.speaker} said`);
  if (relaxed) bits.push('nothing matched the period they named, so these excerpts are from the whole library — say so if it matters');
  return bits.join('; ');
}

function finish({ db, save, question, meetingId, answer, sources, answered, unsupported = false, filters }) {
  const record = { question, answer, sources, meetingId, scope: meetingId ? 'meeting' : 'all' };
  let saved = null;
  if (save && db) {
    try { saved = db.insert('memory', record); } catch { /* memory is a convenience, never a blocker */ }
  }
  return { ...record, id: saved ? saved.id : null, answered, unsupported, filters };
}

/**
 * Which meetings a question touches, without calling a model — the "you
 * discussed this in three meetings" line above the answer.
 */
export function meetingsBehind(sources) {
  const seen = new Map();
  for (const source of sources) {
    if (!seen.has(source.meetingId)) {
      seen.set(source.meetingId, { meetingId: source.meetingId, title: source.meetingTitle, date: source.meetingDate, refs: [] });
    }
    seen.get(source.meetingId).refs.push(source.ref);
  }
  return [...seen.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
