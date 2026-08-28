// ASK NEXT — the faith companion.
//
// It is a capability, not a character. It never claims to be God, never speaks
// as Jesus, and never stands in for a parent, a pastor or a professional. What
// it sends is the question and the age group; never a name, never a prayer.
//
// Every answer comes back in five parts, and the app renders those parts
// itself, so a reply that ignores the shape is visible rather than passing as
// pastoral advice.

import * as store from './storage.js';
import { isConcerning } from './safety.js';

export const DEFAULT_MODEL = 'claude-sonnet-5';

export const PARTS = [
  { key: 'talk',    label: 'LET’S TALK ABOUT IT' },
  { key: 'bible',   label: 'WHAT THE BIBLE SAYS' },
  { key: 'think',   label: 'THINK ABOUT THIS' },
  { key: 'pray',    label: 'A PRAYER' },
  { key: 'step',    label: 'ONE NEXT STEP' },
];

export const MAX_TOKENS = { kids: 500, teens: 900 };

export const DISCLOSURE = 'FLCC NEXT can get things wrong. Check it against the Bible, and talk to someone you trust.';

const REGISTER = {
  kids: 'You are talking to a child between 7 and 12. Short sentences. Simple words. Warm, never babyish. Three or four sentences per part at most.',
  teens: 'You are talking to a teenager between 13 and 18. Be honest and unpatronising. Do not moralise, do not use slang to sound young, and do not pretend hard questions have easy answers.',
};

export function systemPrompt(mode) {
  return [
    'You are the study helper inside FLCC NEXT, an app made by FLCC Church for its kids and teens ministry.',
    REGISTER[mode] || REGISTER.teens,
    '',
    'Answer in exactly these five parts, each on its own line, each beginning with the marker:',
    '[TALK] a compassionate response to what they actually asked.',
    '[BIBLE] what Scripture says, with a reference. Quote accurately or do not quote.',
    '[THINK] one question or thought to sit with.',
    '[PRAY] a short prayer they could pray, in their own voice.',
    '[STEP] one small practical thing to do today.',
    '',
    'Rules you never break:',
    'You are not God and you are not Jesus. Never speak as either, and never claim to know what God is saying to this person.',
    'You never replace a parent, a guardian, a pastor, a ministry leader, a doctor or a counsellor. Where one of those is needed, say so plainly.',
    'You do not give medical, legal or psychiatric advice, sexual content, or anything about harming anyone.',
    'Where Christians genuinely disagree, say that they disagree rather than picking a side and presenting it as settled.',
    'If the question suggests they are in danger or thinking of hurting themselves, do not counsel them: tell them to speak to a trusted adult today, and stop.',
  ].join('\n');
}

export function isConfigured(settings) {
  return Boolean(settings && settings.aiEnabled && settings.aiWorker);
}

export function buildRequest({ question, mode, history = [], model }) {
  return {
    model: model || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS[mode] || MAX_TOKENS.teens,
    system: systemPrompt(mode),
    messages: [
      ...history.slice(-4).map((turn) => ({ role: turn.role, content: turn.text })),
      { role: 'user', content: String(question || '').slice(0, 1500) },
    ],
  };
}

/** Split a reply into the five parts. Anything unmarked is shown as-is. */
export function parseParts(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  const pattern = /\[(TALK|BIBLE|THINK|PRAY|STEP)\]/gi;
  if (!pattern.test(source)) return [{ key: 'talk', body: source }];
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

export async function ask({ question, mode, history, settings }) {
  if (isConcerning(question)) return { kind: 'safety' };
  if (!isConfigured(settings)) return { kind: 'unconfigured' };

  const headers = { 'Content-Type': 'application/json' };
  if (settings.aiSecret) headers['x-proxy-secret'] = settings.aiSecret;
  const endpoint = `${String(settings.aiWorker).trim().replace(/\/+$/, '')}/proxy`;

  let response;
  try {
    response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(buildRequest({ question, mode, history, model: settings.aiModel })) });
  } catch { return { kind: 'offline' }; }

  let payload = null;
  try { payload = await response.json(); } catch { /* not JSON */ }
  if (!response.ok || !payload || payload.error) {
    return { kind: 'error', message: (payload && payload.error && payload.error.message) || `No answer came back (HTTP ${response.status}).` };
  }

  const text = Array.isArray(payload.content)
    ? payload.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n').trim()
    : '';
  if (!text) return { kind: 'error', message: 'The answer came back empty.' };
  return { kind: 'answer', text, parts: parseParts(text) };
}

const MAX_TURNS = 20;

export function getThread() {
  const state = store.read(store.KEYS.ask, null);
  return state && Array.isArray(state.turns) ? state.turns : [];
}

export function appendTurn(turn) {
  const turns = [...getThread(), turn].slice(-MAX_TURNS);
  store.write(store.KEYS.ask, { turns, updatedAt: new Date().toISOString() });
  return turns;
}

export function clearThread() { store.remove(store.KEYS.ask); }
