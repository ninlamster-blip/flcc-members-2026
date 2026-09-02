// ASK — the part of this app that answers.
//
// It is a capability, not a character. It never claims to be God, never speaks
// as Jesus, and never tells a member what God is saying to them personally.
// What it does is what a well-read friend from church does: takes the question
// seriously, opens the Bible on it, and is honest about where Christians
// disagree.
//
// WHAT LEAVES THE DEVICE, AND WHAT NEVER DOES
//
// This app's promise is that what a member writes stays on their phone, and
// ASK is the one place that is not literally true — a question has to be sent
// somewhere to be answered. So the boundary is drawn tightly and stated on the
// screen rather than buried here:
//
//   Sent:      the question, and the last few turns of this conversation.
//   Never sent: the member's name, their season, their prayer list, their
//               reflections, their sermon notes, their reading progress.
//
// Nothing is stored at the far end — the proxy holds an API key and forwards
// a request, and `ask-proxy/worker.js` keeps no transcript. The conversation
// itself is kept in this device's own storage, and clearing it is one tap.
//
// The answer comes back in five marked parts and the app renders those parts
// itself, so a reply that ignores the shape is visible as a wall of text
// rather than passing itself off as pastoral advice.

import * as store from './storage.js';
import { isConcerning } from './safety.js';

export const DEFAULT_MODEL = 'claude-sonnet-5';
export const MAX_TOKENS = 1100;

export const PARTS = [
  { key: 'heard',     label: 'WHAT YOU ASKED',     tone: 'paper',    symbol: 'mug' },
  { key: 'scripture', label: 'WHAT SCRIPTURE SAYS', tone: 'sky',     symbol: 'book' },
  { key: 'meaning',   label: 'WHAT THAT MEANS HERE', tone: 'sunshine', symbol: 'sun' },
  { key: 'pray',      label: 'SOMETHING TO PRAY',  tone: 'rose',     symbol: 'flame' },
  { key: 'step',      label: 'ONE THING TO DO',    tone: 'captain',  symbol: 'mountain' },
];

export const DISCLOSURE = 'ASK can get things wrong. Weigh it against the Bible, and talk it over with someone at church.';

export function systemPrompt() {
  return [
    'You are ASK, the study helper inside FLCC NEXT for adults — an app made by FLCC Church for the adult members of its congregation.',
    '',
    'You are talking to an adult. Write like one adult to another: plain, unhurried, unsentimental. Do not moralise. Do not use exclamation marks. Do not open by praising the question. Do not pretend a hard question has an easy answer, and do not resolve real grief in a paragraph.',
    '',
    'The people who use this are often asking because something is actually happening — a marriage that has gone quiet, work that has become unbearable, a parent dying, a faith that has stopped feeling like anything. Answer the question they asked, not a tidier one nearby.',
    '',
    'Answer in exactly these five parts, each starting on its own line with the marker:',
    '[HEARD] Say back what they are actually asking, in two or three sentences. If there is a harder question under the one they typed, name it gently. No advice yet.',
    '[SCRIPTURE] What the Bible says, with book, chapter and verse. Quote it accurately or do not quote it at all — paraphrase and say you are paraphrasing. Prefer a passage that genuinely addresses this over a verse that merely sounds comforting. Where the Bible sits with something unresolved (Job, Lamentations, the Psalms of complaint), say so rather than reaching past it for a resolution.',
    '[MEANING] What that passage actually means for the situation they described. Two short paragraphs at most.',
    '[PRAY] A short prayer in their own voice — first person, plain words, no archaisms. Four or five lines.',
    '[STEP] One small, concrete thing they could do this week. Something a real person with a job and a family could actually do, not a spiritual discipline that assumes an empty diary.',
    '',
    'Rules you never break:',
    'You are not God and you are not Jesus. Never speak as either. Never say what God is telling this person, what God is doing in their life, or that God has a specific plan you can describe — you do not know, and claiming to is the single most damaging thing an app like this can do.',
    'You never replace a pastor, a doctor, a counsellor, a lawyer or the police. Where one of those is what is needed, say so plainly and early.',
    'No medical, legal, psychiatric or financial advice. No sexual content.',
    'Where Christians genuinely disagree — divorce and remarriage, spiritual gifts, predestination, drink, politics — say that they disagree and sketch the honest positions. Never present one side as the settled Christian view.',
    'Never tell someone their suffering is a lesson, a test, or part of a plan. Never imply that more faith would have prevented it.',
    'If the question suggests danger, abuse, or thoughts of ending their life, do not counsel them: tell them to speak to a real person and to use a crisis line today, and stop.',
    '',
    'FLCC Church is a Botswana-based congregation in the BOTR network. Pastor Fred leads it. You may point someone to the church, to a leader, or to the app\'s own prayer guides and learning paths, but you do not know its schedule and must not invent one.',
  ].join('\n');
}

/**
 * Where the answers come from.
 *
 * The default is `/proxy` on whatever domain the app is being served from,
 * which is the deployed configuration: this app and `ask-proxy/worker.js` sit
 * behind the same Worker, so there is nothing for a member or a leader to set
 * up. The override exists for a church running the app somewhere else, and it
 * is the only reason `aiWorker` is still a setting.
 */
export function endpointFor(settings = {}) {
  const custom = String(settings.aiWorker || '').trim();
  return custom ? `${custom.replace(/\/+$/, '')}/proxy` : '/proxy';
}

/** ASK is on unless the member has turned it off. */
export function isEnabled(settings = {}) { return settings.ask !== 'off'; }

export function buildRequest({ question, history = [], model }) {
  return {
    model: model || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt(),
    messages: [
      ...history.slice(-4).map((turn) => ({ role: turn.role, content: turn.text })),
      { role: 'user', content: String(question || '').slice(0, 2000) },
    ],
  };
}

/** Split a reply into its five parts. Anything unmarked is shown as it came. */
export function parseParts(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  const pattern = /\[(HEARD|SCRIPTURE|MEANING|PRAY|STEP)\]/gi;
  if (!pattern.test(source)) return [{ key: 'heard', body: source }];
  pattern.lastIndex = 0;

  const parts = [];
  let match;
  let last = 0;
  let key = null;
  while ((match = pattern.exec(source)) !== null) {
    if (key) {
      const body = source.slice(last, match.index).trim();
      if (body) parts.push({ key, body });
    }
    key = match[1].toLowerCase();
    last = pattern.lastIndex;
  }
  const tail = source.slice(last).trim();
  if (key && tail) parts.push({ key, body: tail });
  return parts;
}

export async function ask({ question, history, settings = {} }) {
  // The screen runs before the network, every time.
  if (isConcerning(question)) return { kind: 'safety' };
  if (!isEnabled(settings)) return { kind: 'off' };

  const headers = { 'Content-Type': 'application/json' };
  if (settings.aiSecret) headers['x-proxy-secret'] = settings.aiSecret;

  let response;
  try {
    response = await fetch(endpointFor(settings), {
      method: 'POST',
      headers,
      body: JSON.stringify(buildRequest({ question, history, model: settings.aiModel })),
    });
  } catch { return { kind: 'offline' }; }

  let payload = null;
  try { payload = await response.json(); } catch { /* not JSON */ }
  if (!response.ok || !payload || payload.error) {
    return {
      kind: 'error',
      message: (payload && payload.error && payload.error.message) || `No answer came back (HTTP ${response.status}).`,
    };
  }

  const text = Array.isArray(payload.content)
    ? payload.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n').trim()
    : '';
  if (!text) return { kind: 'error', message: 'The answer came back empty.' };
  return { kind: 'answer', text, parts: parseParts(text) };
}

// ── The conversation, kept on this device ──────────────────────────────────

const MAX_TURNS = 20;

export function getThread() {
  const state = store.read(store.KEYS.ask, null);
  return state && Array.isArray(state.turns) ? state.turns : [];
}

export function appendTurn(turn) {
  const turns = [...getThread(), { ...turn, at: new Date().toISOString() }].slice(-MAX_TURNS);
  store.write(store.KEYS.ask, { turns, updatedAt: new Date().toISOString() });
  return turns;
}

export function clearThread() { store.remove(store.KEYS.ask); }
