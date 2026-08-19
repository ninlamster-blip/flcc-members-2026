/* =============================================================================
   THE AI LAYER — optional, lazy-loaded, and never the source of a Bible fact.
   -----------------------------------------------------------------------------
   What the AI may do here: re-word a hint, add context around an answer the
   player has already been given, explain why a passage matters, and write the
   line at the end of a solved puzzle.

   What it may never do: supply an answer, a Scripture reference, or a fact the
   bank does not already contain. Every call is built from a record in
   js/answers.js and every call has a written fallback, so the whole feature
   degrades to the local text if there is no connection, no key, or no network.
   A failure here can slow a hint down. It cannot break the crossword.

   Connection: whatever the member already set up for Ask FLCC. Same
   localStorage keys, same shared Worker fallback, nothing new to configure and
   no environment variable to set. If none of it is there, everything below
   still returns good text — it just comes from this repository.

   Privacy: one clue goes out per request. No name, no score, no streak, no
   history, no other clue, nothing typed into the grid.
   ========================================================================== */

const ASK_KEY = 'flcc-claude-api-key-v1';
const ASK_PROXY_KEY = 'flcc-ask-proxy-url-v1';
const ASK_PROXY_SECRET_KEY = 'flcc-ask-proxy-secret-v1';
const MODEL = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 12000;

const SYSTEM = [
  'You help a member of a church crossword game understand a Bible answer they have already been shown.',
  'You are given the answer, the clue and the Scripture reference. Treat all three as settled fact.',
  'Never contradict them, never offer a different answer, and never cite a reference you were not given.',
  'Write plainly, 2-3 sentences, no greeting, no sign-off, no bullet points, no markdown.',
].join(' ');

/** Is there any connection at all? Used only to decide whether to show the
 *  "Ask AI" affordance — never to gate the hint ladder, which is always local. */
export function isConfigured() {
  return !!endpoint();
}

function endpoint() {
  let proxyUrl = '';
  let apiKey = '';
  try {
    proxyUrl = localStorage.getItem(ASK_PROXY_KEY) || '';
    apiKey = localStorage.getItem(ASK_KEY) || '';
  } catch { return null; }
  // The Worker that serves this site also answers on /proxy with the key held
  // server-side, so a member who has never opened Ask FLCC still gets this.
  if (!proxyUrl && !apiKey && /^https?:$/.test(location.protocol)) proxyUrl = location.origin;
  if (!proxyUrl && !apiKey) return null;
  return proxyUrl
    ? { url: proxyUrl.replace(/\/+$/, '') + '/proxy', proxied: true }
    : { url: 'https://api.anthropic.com/v1/messages', proxied: false, apiKey };
}

/* ── The five things the game can ask ─────────────────────────────────────── */

export const ACTIONS = [
  { id: 'person', label: 'Explain this answer', ask: 'Who or what is this, in two or three sentences?' },
  { id: 'context', label: 'Show the biblical context', ask: 'What was happening around this in the biblical story? Where does it sit in the timeline?' },
  { id: 'scripture', label: 'Explain the Scripture', ask: 'What is happening in the passage cited, and what does it say?' },
  { id: 'why', label: 'Why does this matter?', ask: 'Why is this worth a believer knowing today? Keep it grounded in the passage, not sentimental.' },
  { id: 'hint', label: 'Give me another hint', ask: 'Give one more hint that helps someone guess this, WITHOUT writing the answer itself anywhere in your reply.' },
];

/**
 * Ask about one clue. Always resolves — `{ text, source }` where source is
 * 'ai' when a live answer came back and 'local' when this file wrote it.
 */
export async function askAbout(actionId, entry) {
  const action = ACTIONS.find((a) => a.id === actionId) || ACTIONS[0];
  const fallback = localAnswer(action.id, entry);
  const target = endpoint();
  if (!target) return { text: fallback, source: 'local' };

  const headers = { 'Content-Type': 'application/json' };
  if (target.proxied) {
    try {
      const secret = localStorage.getItem(ASK_PROXY_SECRET_KEY) || '';
      if (secret) headers['x-proxy-secret'] = secret;
    } catch { /* nothing to add */ }
  } else {
    headers['x-api-key'] = target.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  // Exactly one clue's worth of information leaves the device.
  const prompt = [
    `Answer: ${entry.answer}`,
    `Crossword clue: ${entry.clue}`,
    `Scripture: ${entry.scripture}`,
    `Background already shown to the player: ${entry.explanation}`,
    '',
    action.ask,
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target.url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 320,
        system: SYSTEM,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = (data?.content?.[0]?.text || '').trim();
    if (!text) throw new Error('empty');
    if (action.id === 'hint' && text.toUpperCase().includes(entry.answer)) {
      // It gave the game away. The written hint is better than a spoiler.
      return { text: fallback, source: 'local' };
    }
    return { text, source: 'ai' };
  } catch (err) {
    return { text: fallback, source: 'local', error: true };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The closing line on the completion screen. Same rules: a live one if there
 * is a connection, a written one otherwise, and never a delay the player has
 * to sit through — the caller shows the local line first and swaps it if a
 * better one arrives.
 */
export async function completionLine(puzzle, { score, minutes, hintsUsed }) {
  const fallback = puzzle.category === 'Words of Jesus'
    ? 'You spent this puzzle in the words of Jesus. Take one of them with you into the day.'
    : `${puzzle.entries.length} answers on ${puzzle.category} — the corners of Scripture most readers skim past. Well done.`;
  const target = endpoint();
  if (!target) return { text: fallback, source: 'local' };

  const headers = { 'Content-Type': 'application/json' };
  if (target.proxied) {
    try {
      const secret = localStorage.getItem(ASK_PROXY_SECRET_KEY) || '';
      if (secret) headers['x-proxy-secret'] = secret;
    } catch { /* nothing to add */ }
  } else {
    headers['x-api-key'] = target.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(target.url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 160,
        system: 'You write one short, warm, biblically-grounded closing line for a Bible crossword a church member has just finished. One or two sentences. No greeting, no sign-off, no quotation marks, no emoji.',
        messages: [{
          role: 'user',
          content: [
            `They finished a hard 6x6 crossword on the theme "${puzzle.category}".`,
            `The answers were: ${puzzle.entries.map((e) => e.answer).join(', ')}.`,
            hintsUsed === 0 ? 'They used no hints at all.' : `They used ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}.`,
            `It took them about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
            'Write the closing line. Mention something specific from the theme.',
          ].join(' '),
        }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = (data?.content?.[0]?.text || '').trim();
    return text ? { text, source: 'ai' } : { text: fallback, source: 'local' };
  } catch {
    return { text: fallback, source: 'local', error: true };
  } finally {
    clearTimeout(timer);
  }
}

/* ── Written answers, used whenever the AI is unavailable ─────────────────── */

function localAnswer(actionId, entry) {
  switch (actionId) {
    case 'person':
      return entry.explanation;
    case 'context':
      return `${entry.hint} ${entry.explanation}`;
    case 'scripture':
      return `${entry.scripture} — ${entry.explanation}`;
    case 'why':
      return `${entry.explanation} It is the kind of detail that only turns up if you read past the famous chapters, which is exactly why it is here.`;
    case 'hint':
    default:
      return entry.hint;
  }
}
