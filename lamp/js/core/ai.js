// The Ask companion.
//
// AI is an assistant, not the product. Requests go through this repository's
// existing Worker proxy, so no API key ever reaches a device. What LAMP sends
// is: the question, the age band, and the screen's context — never the child's
// name, journal, prayers or history beyond the current thread (SPEC.md §9).

import * as store from './storage.js';
import { isConcerning } from './safety.js';
import { parseRef, formatRef } from './refs.js';

// Same model the FLCC Ask page uses, so both apps behave alike. Overridable in
// Settings for a church running its own Worker.
export const DEFAULT_MODEL = 'claude-sonnet-5';

export const MAX_TOKENS = { '7-10': 400, '11-14': 700, '15-18': 1200 };

export const DISCLOSURE = "LAMP's helper can make mistakes. Always check what the Bible says.";

const BAND_STYLE = {
  '7-10':
    'The reader is 7 to 10 years old. Use short sentences and simple words. Three to five sentences in total. One Bible verse. One picture in their mind they can hold on to. Warm, never babyish.',
  '11-14':
    'The reader is 11 to 14 years old. Two or three short paragraphs. Give context and one clear application to their real life. Two or three verses.',
  '15-18':
    'The reader is 15 to 18 years old. Answer with real depth: theological, historical and where useful apologetic. Acknowledge the strongest counter-argument honestly. Name sources or passages precisely. Never condescend.',
};

export function systemPrompt(band, contextLabel) {
  return [
    'You are the study helper inside LAMP, a Bible app for children and teenagers. You are a tool, not a person: never claim to be a friend, a pastor, a counsellor or a human being.',
    BAND_STYLE[band] || BAND_STYLE['11-14'],
    '',
    'Structure every answer with these exact markers, in this order, using only the ones that apply:',
    '[SCRIPTURE] what the Bible itself says, with references.',
    '[BELIEVE] what Christians have commonly believed about it.',
    '[DEBATE] where sincere Christians disagree, named as disagreement and left open.',
    'Never blur the three. A child must be able to see which part is the Bible and which part is commentary.',
    '',
    'Quote or cite only real passages, with book, chapter and verse. If you are not certain a verse says what you want it to say, do not cite it.',
    'Do not produce: sexual content, methods of self-harm, graphic violence, contempt for the child\'s family, church or culture, or medical, legal or psychiatric advice.',
    'If the question suggests the child is in danger, being hurt, or thinking of hurting themselves, do not counsel them: tell them plainly to speak to a trusted adult today, and stop there.',
    'If a question is outside the Bible and the Christian faith, say so briefly and offer what Scripture does speak to.',
    contextLabel ? `The child is currently reading: ${contextLabel}. Answer with that in view.` : '',
  ].filter(Boolean).join('\n');
}

export function isConfigured(settings) {
  return Boolean(settings && settings.aiEnabled && settings.aiWorker);
}

function endpoint(workerUrl) {
  const base = String(workerUrl || '').trim().replace(/\/+$/, '');
  return `${base}/proxy`;
}

/** Build the request body. Separated out so tests can read what we send. */
export function buildRequest({ question, band, contextLabel, history = [], model }) {
  const messages = [
    ...history.slice(-6).map((turn) => ({ role: turn.role, content: turn.text })),
    { role: 'user', content: String(question || '').slice(0, 2000) },
  ];
  return {
    model: model || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS[band] || MAX_TOKENS['11-14'],
    system: systemPrompt(band, contextLabel),
    messages,
  };
}

/** Split a reply into its labelled tiers. Unmarked text becomes one plain tier. */
export function parseTiers(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  const pattern = /\[(SCRIPTURE|BELIEVE|DEBATE)\]/gi;
  if (!pattern.test(source)) return [{ tier: 'plain', body: source }];
  pattern.lastIndex = 0;

  const tiers = [];
  let match;
  let lastIndex = 0;
  let currentTier = null;
  while ((match = pattern.exec(source)) !== null) {
    if (currentTier) {
      const body = source.slice(lastIndex, match.index).trim();
      if (body) tiers.push({ tier: currentTier, body });
    } else {
      const preamble = source.slice(0, match.index).trim();
      if (preamble) tiers.push({ tier: 'plain', body: preamble });
    }
    currentTier = match[1].toLowerCase();
    lastIndex = pattern.lastIndex;
  }
  const tail = source.slice(lastIndex).trim();
  if (currentTier && tail) tiers.push({ tier: currentTier, body: tail });
  return tiers;
}

/** Every reference an answer claims, in the order it claims them. */
export function citedRefs(text) {
  const found = [];
  const pattern = /\b((?:[1-3]\s*)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/g;
  let match;
  while ((match = pattern.exec(String(text || ''))) !== null) {
    const verses = `${match[2]}:${match[3]}${match[4] ? `-${match[4]}` : ''}`;
    // "See John 3:16" captures two capitalised words; drop leading ones until
    // what is left is an actual book.
    const words = match[1].trim().split(/\s+/);
    for (let start = 0; start < words.length; start++) {
      const ref = parseRef(`${words.slice(start).join(' ')} ${verses}`);
      if (ref) {
        found.push({ raw: match[0], ref, pretty: formatRef(ref) });
        break;
      }
    }
  }
  return found;
}

export async function ask({ question, band, contextLabel, history, settings }) {
  if (isConcerning(question)) return { kind: 'safety' };
  if (!isConfigured(settings)) return { kind: 'unconfigured' };

  const body = buildRequest({ question, band, contextLabel, history, model: settings.aiModel });
  const headers = { 'Content-Type': 'application/json' };
  if (settings.aiSecret) headers['x-proxy-secret'] = settings.aiSecret;

  let response;
  try {
    response = await fetch(endpoint(settings.aiWorker), { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    return { kind: 'offline' };
  }

  let payload = null;
  try { payload = await response.json(); } catch { /* non-JSON error page */ }

  if (!response.ok || !payload || payload.error) {
    return { kind: 'error', message: (payload && payload.error && payload.error.message) || `The helper could not answer (HTTP ${response.status}).` };
  }

  const text = Array.isArray(payload.content)
    ? payload.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n').trim()
    : '';
  if (!text) return { kind: 'error', message: 'The helper sent an empty answer.' };

  return { kind: 'answer', text, tiers: parseTiers(text), refs: citedRefs(text) };
}

// ── Thread (local, capped, expiring) ────────────────────────────────────────

const MAX_TURNS = 40;          // 20 exchanges
const EXPIRE_DAYS = 30;

export function getThread(now = new Date()) {
  const state = store.read(store.KEYS.ask, null);
  if (!state || !Array.isArray(state.turns)) return [];
  const age = now.getTime() - new Date(state.updatedAt || 0).getTime();
  if (age > EXPIRE_DAYS * 86400000) {
    store.remove(store.KEYS.ask);
    return [];
  }
  return state.turns;
}

export function appendTurn(turn, now = new Date()) {
  const turns = [...getThread(now), turn].slice(-MAX_TURNS);
  store.write(store.KEYS.ask, { turns, updatedAt: now.toISOString() });
  return turns;
}

export function clearThread() {
  store.remove(store.KEYS.ask);
}
