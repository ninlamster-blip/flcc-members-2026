/**
 * Retrieval — the part of "AI Memory" that is not AI.
 *
 * Answers are only as trustworthy as the evidence handed to the model, so
 * the retrieval half is plain, inspectable code: transcript segments are
 * grouped into chunks, indexed, and ranked with BM25 plus a few signals that
 * matter for conversation (a chunk where the named speaker is talking, a
 * meeting whose title matches, a date the question asked for).
 *
 * There is no embedding model here. A device-local app cannot ship one
 * honestly, and BM25 over a person's own meetings — a corpus of hundreds of
 * chunks, not millions — is genuinely good at this. Where a vector index
 * would slot in is `Index.search()`, which is the only thing that ranks.
 */

const STOPWORDS = new Set(`a an and are as at be been but by can could did do does for from
had has have he her him his how i if in into is it its me my of on or our out said say says she
should so than that the their them then there these they this to too us was we were what when
where which who will with would you your about just like get got really very am pre`.split(/\s+/));

/** Words that carry the question's intent and must not be treated as content. */
const QUESTION_WORDS = new Set(['what', 'when', 'who', 'where', 'why', 'how', 'did', 'does', 'was', 'were', 'is', 'are', 'summarize', 'summarise', 'list', 'show', 'tell', 'find']);

/**
 * A small, deliberate thesaurus of meeting language.
 *
 * People ask "what did we decide?" about a conversation in which nobody said
 * the word "decide" — they said "let's keep the current supplier". Without
 * this, the most natural question in the product returns nothing.
 *
 * It expands the *question* only, never the transcript, and expansions are
 * scored at a fraction of an exact match, so a passage that really does use
 * the user's word still wins. Keys are stemmed forms (see `stem`).
 */
const EXPANSIONS = new Map(Object.entries({
  decid:   ['agree', 'agreed', 'decision', 'settl', 'conclud', 'go', 'keep', 'approv', 'sign'],
  decision:['agree', 'agreed', 'decid', 'settl', 'approv'],
  agree:   ['decid', 'decision', 'yes', 'settl', 'approv'],
  action:  ['task', 'responsibl', 'owner', 'follow', 'ill', 'assign'],
  task:    ['action', 'assign', 'responsibl'],
  commit:  ['promis', 'agree', 'undertak', 'ill', 'assign'],
  owe:     ['commit', 'action', 'assign'],
  deadlin: ['due', 'friday', 'monday', 'week', 'date'],
  due:     ['deadlin', 'date', 'week'],
  cost:    ['price', 'pricing', 'budget', 'quotation', 'quote', 'rate'],
  price:   ['cost', 'pricing', 'quotation', 'quote', 'budget'],
  budget:  ['cost', 'price', 'spend', 'fund'],
  problem: ['concern', 'issue', 'risk', 'worri'],
  concern: ['problem', 'issue', 'risk'],
  unresolv:['open', 'question', 'pending', 'unclear', 'undecid'],
  next:    ['follow', 'then', 'plan'],
  hire:    ['recruit', 'candidat', 'interview'],
}));

/** The question's terms, plus their weaker expansions. */
function expand(terms) {
  const weighted = terms.map((term) => ({ term, weight: 1 }));
  const already = new Set(terms);
  for (const term of terms) {
    for (const extra of EXPANSIONS.get(term) || []) {
      if (already.has(extra)) continue;
      already.add(extra);
      weighted.push({ term: extra, weight: 0.45 });
    }
  }
  return weighted;
}

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem);
}

/** Deliberately crude: plural and simple verb endings only. Over-stemming
 *  costs precision on a small corpus, and this corpus is always small. */
function stem(word) {
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && word.endsWith('sses')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  return word;
}

/* ── chunking ────────────────────────────────────────────────────────────── */

const CHUNK_CHARS = 700;
const CHUNK_MAX_GAP_SEC = 45;

/**
 * Group a meeting's segments into retrieval chunks.
 *
 * A chunk is a run of consecutive segments — one or several speakers — that
 * is long enough to carry an argument and short enough to quote. It keeps
 * every segment id it covers, which is how a citation gets back to audio.
 *
 * @param {{id: string, title: string, startedAt: string}} meeting
 * @param {Array<{id: string, start: number, end: number, text: string, speakerId: string}>} segments
 * @param {Map<string, string>} speakerNames  speakerId → display name
 */
export function chunkMeeting(meeting, segments, speakerNames = new Map()) {
  const ordered = [...segments].sort((a, b) => a.start - b.start);
  const chunks = [];
  let current = null;

  for (const segment of ordered) {
    const text = String(segment.text || '').trim();
    if (!text) continue;
    const speaker = speakerNames.get(segment.speakerId) || segment.speakerId || 'Unknown';
    const tooLong = current && current.text.length + text.length > CHUNK_CHARS;
    const bigGap = current && segment.start - current.end > CHUNK_MAX_GAP_SEC;
    if (!current || tooLong || bigGap) {
      current = {
        id: `${meeting.id}:${chunks.length}`,
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        meetingDate: meeting.startedAt,
        start: segment.start,
        end: segment.end,
        segmentIds: [],
        speakers: [],
        lines: [],
        text: '',
      };
      chunks.push(current);
    }
    current.end = Math.max(current.end, segment.end);
    current.segmentIds.push(segment.id);
    if (!current.speakers.includes(speaker)) current.speakers.push(speaker);
    current.lines.push({ speaker, text, start: segment.start, segmentId: segment.id });
    current.text = current.text ? `${current.text}\n${speaker}: ${text}` : `${speaker}: ${text}`;
  }
  return chunks;
}

/* ── index ───────────────────────────────────────────────────────────────── */

const K1 = 1.4;
const B = 0.72;

export class Index {
  constructor(chunks = []) {
    this.chunks = [];
    this.postings = new Map();   // term → Map(chunkIndex → count)
    this.lengths = [];
    this.avgLength = 0;
    this.add(chunks);
  }

  add(chunks) {
    for (const chunk of chunks) {
      const position = this.chunks.length;
      this.chunks.push(chunk);
      const terms = tokenize(`${chunk.meetingTitle} ${chunk.text}`);
      this.lengths[position] = terms.length || 1;
      for (const term of terms) {
        let posting = this.postings.get(term);
        if (!posting) { posting = new Map(); this.postings.set(term, posting); }
        posting.set(position, (posting.get(position) || 0) + 1);
      }
    }
    const total = this.lengths.reduce((sum, n) => sum + n, 0);
    this.avgLength = this.chunks.length ? total / this.chunks.length : 0;
    return this;
  }

  get size() { return this.chunks.length; }

  /**
   * @param {string} query
   * @param {{limit?: number, meetingId?: string|null, speaker?: string|null,
   *          from?: string|null, to?: string|null, minScore?: number}} [options]
   */
  search(query, options = {}) {
    const { limit = 8, meetingId = null, speaker = null, from = null, to = null, minScore = 0.15 } = options;
    const terms = tokenize(query).filter((t) => !QUESTION_WORDS.has(t));
    if (!terms.length || !this.chunks.length) return [];

    const scores = new Map();
    for (const { term, weight } of expand(terms)) {
      const posting = this.postings.get(term);
      if (!posting) continue;
      const idf = Math.log(1 + (this.chunks.length - posting.size + 0.5) / (posting.size + 0.5));
      for (const [position, count] of posting) {
        const length = this.lengths[position];
        const tf = (count * (K1 + 1)) / (count + K1 * (1 - B + B * (length / (this.avgLength || 1))));
        scores.set(position, (scores.get(position) || 0) + idf * tf * weight);
      }
    }

    const results = [];
    for (const [position, raw] of scores) {
      const chunk = this.chunks[position];
      if (meetingId && chunk.meetingId !== meetingId) continue;
      if (from && chunk.meetingDate < from) continue;
      if (to && chunk.meetingDate > to) continue;
      let score = raw;
      // A question that names a speaker means the chunk where that speaker
      // is talking, not merely a chunk where their name is mentioned.
      if (speaker) {
        const spoke = chunk.speakers.some((name) => sameName(name, speaker));
        if (!spoke) score *= 0.35; else score *= 1.6;
      }
      results.push({ chunk, score, terms });
    }

    const best = results.sort((a, b) => b.score - a.score).slice(0, limit);
    const top = best.length ? best[0].score : 0;
    // Scores are relative; a corpus-wide floor would reject everything on a
    // small library and nothing on a large one. Keep what is close to the best.
    return best
      .filter((hit) => top > 0 && hit.score / top >= minScore)
      .map((hit) => ({ ...hit, snippet: snippet(hit.chunk.text, terms) }));
  }
}

function sameName(a, b) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.split(/\s+/)[0] === y.split(/\s+/)[0];
}

/** A window of the chunk around the densest run of query terms. */
export function snippet(text, terms, width = 220) {
  const plain = String(text || '').replace(/\n/g, ' ');
  const lower = plain.toLowerCase();
  const termSet = new Set(terms);
  let bestAt = 0;
  let bestHits = -1;
  for (let at = 0; at < plain.length; at += 40) {
    const window = lower.slice(at, at + width);
    let hits = 0;
    for (const word of window.split(/[^a-z0-9]+/)) if (termSet.has(stem(word))) hits++;
    if (hits > bestHits) { bestHits = hits; bestAt = at; }
  }
  const start = Math.max(0, bestAt - 20);
  const cut = plain.slice(start, start + width).trim();
  return `${start > 0 ? '…' : ''}${cut}${start + width < plain.length ? '…' : ''}`;
}

/* ── query understanding ─────────────────────────────────────────────────── */

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december'];

/**
 * Pull the filters a question states in words: a period ("last week", "in
 * July", "this month") and a speaker ("what did John say"). Everything else
 * is left to ranking.
 *
 * @param {string} question
 * @param {{now?: Date, people?: string[]}} [options]
 * @returns {{from: string|null, to: string|null, speaker: string|null, period: string|null}}
 */
export function understand(question, { now = new Date(), people = [] } = {}) {
  const text = String(question || '').toLowerCase();
  const out = { from: null, to: null, speaker: null, period: null };

  const day = 86400000;
  const iso = (d) => new Date(d).toISOString();
  const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

  if (/\btoday\b/.test(text)) {
    out.from = iso(startOfDay(now)); out.period = 'today';
  } else if (/\byesterday\b/.test(text)) {
    out.from = iso(startOfDay(now.getTime() - day));
    out.to = iso(startOfDay(now));
    out.period = 'yesterday';
  } else if (/\b(this|past|last)\s+week\b/.test(text)) {
    out.from = iso(startOfDay(now.getTime() - 7 * day)); out.period = 'the last week';
  } else if (/\b(this|past|last)\s+month\b/.test(text)) {
    out.from = iso(startOfDay(now.getTime() - 31 * day)); out.period = 'the last month';
  } else if (/\b(this|past|last)\s+(quarter|three months)\b/.test(text)) {
    out.from = iso(startOfDay(now.getTime() - 92 * day)); out.period = 'the last quarter';
  } else {
    const month = MONTHS.findIndex((name) => new RegExp(`\\b(in|during|from)\\s+${name}\\b`).test(text));
    if (month >= 0) {
      const year = now.getMonth() < month ? now.getFullYear() - 1 : now.getFullYear();
      out.from = new Date(Date.UTC(year, month, 1)).toISOString();
      out.to = new Date(Date.UTC(month === 11 ? year + 1 : year, (month + 1) % 12, 1)).toISOString();
      out.period = `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}`;
    }
  }

  // "what did John say", "did Sarah mention", "John's action items"
  const named = people.find((name) => {
    const first = String(name || '').trim().split(/\s+/)[0].toLowerCase();
    return first.length > 2 && new RegExp(`\\b${escapeRegExp(first)}\\b`).test(text);
  });
  if (named) out.speaker = named;
  else {
    const match = text.match(/\bdid\s+([a-z][a-z'-]+)\s+(say|mention|think|agree|ask|promise|commit)/);
    if (match) out.speaker = match[1][0].toUpperCase() + match[1].slice(1);
  }
  return out;
}

function escapeRegExp(text) { return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Every chunk this index holds for one meeting, in order. Used when a
 *  question is scoped to a single meeting and matches none of its words:
 *  the meeting itself is then the evidence, which is still evidence. */
export function chunksOfMeeting(index, meetingId, limit = 10) {
  const chunks = index.chunks.filter((chunk) => chunk.meetingId === meetingId);
  if (chunks.length <= limit) return chunks;
  // Spread the sample across the meeting rather than taking the opening.
  const step = chunks.length / limit;
  return Array.from({ length: limit }, (_, i) => chunks[Math.floor(i * step)]);
}

/** Build an index over every meeting the database holds. */
export function indexDatabase(db) {
  const speakerNames = new Map();
  for (const speaker of db.all('speakers')) {
    const person = speaker.personId ? db.get('people', speaker.personId) : null;
    speakerNames.set(speaker.id, person ? person.name : speaker.label);
  }
  const index = new Index();
  for (const meeting of db.all('meetings')) {
    if (meeting.archived) continue;
    const segments = db.where('segments', { meetingId: meeting.id });
    if (!segments.length) continue;
    index.add(chunkMeeting(meeting, segments, speakerNames));
  }
  return index;
}
