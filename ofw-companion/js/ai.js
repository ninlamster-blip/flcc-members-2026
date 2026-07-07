// AI client for OFW Companion. Reuses the church-wide Ask FLCC connection
// (Cloudflare Worker proxy, or a direct Anthropic API key) so members who
// already set up Ask FLCC get the companion with zero extra configuration.
import { getState, addMemory } from './state.js';
import { todayKey } from './utils.js';

// Shared with ask.html / index.html — do not rename.
const PROXY_URL_KEY = 'flcc-ask-proxy-url-v1';
const PROXY_SECRET_KEY = 'flcc-ask-proxy-secret-v1';
const API_KEY_KEY = 'flcc_ask_apikey';

export function getConnection() {
  try {
    return {
      proxyUrl: localStorage.getItem(PROXY_URL_KEY) || '',
      proxySecret: localStorage.getItem(PROXY_SECRET_KEY) || '',
      apiKey: localStorage.getItem(API_KEY_KEY) || '',
    };
  } catch {
    return { proxyUrl: '', proxySecret: '', apiKey: '' };
  }
}

export function saveConnection({ proxyUrl, proxySecret }) {
  try {
    if (proxyUrl !== undefined) localStorage.setItem(PROXY_URL_KEY, proxyUrl.trim());
    if (proxySecret !== undefined) localStorage.setItem(PROXY_SECRET_KEY, proxySecret.trim());
  } catch { /* private mode — connection lasts this session only */ }
}

export function isConnected() {
  const { proxyUrl, apiKey } = getConnection();
  return !!(proxyUrl || apiKey);
}

function buildEndpointAndHeaders() {
  const { proxyUrl, proxySecret, apiKey } = getConnection();
  const headers = { 'Content-Type': 'application/json' };
  let endpoint;
  if (proxyUrl) {
    endpoint = proxyUrl.replace(/\/+$/, '') + '/proxy';
    if (proxySecret) headers['x-proxy-secret'] = proxySecret;
  } else {
    endpoint = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  return { endpoint, headers };
}

async function callClaude({ system, messages, maxTokens = 700 }) {
  const { endpoint, headers } = buildEndpointAndHeaders();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: getState().settings.model,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.error?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return (data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

// ── Companion persona ────────────────────────────────────────────────────────

function recentWellbeingSummary() {
  const { checkins } = getState();
  const recent = checkins.slice(0, 7);
  if (!recent.length) return 'No wellbeing check-ins recorded yet.';
  const moodWords = ['', 'very low', 'low', 'okay', 'good', 'very good'];
  return recent
    .map((c) => `${c.date}: mood ${moodWords[c.mood] || c.mood}, energy ${c.energy}/5, loneliness ${c.loneliness}/5, hope ${c.hope}/5${c.gratitude ? `, grateful for: "${c.gratitude}"` : ''}`)
    .join('\n');
}

function memoriesBlock() {
  const { memories } = getState();
  if (!memories.length) return 'Nothing yet — this may be one of your first conversations.';
  return memories.slice(0, 25).map((m) => `- ${m.text}`).join('\n');
}

function companionSystemPrompt() {
  const s = getState();
  const name = s.profile.name || 'kaibigan';
  const faith = s.settings.faithEnabled;
  return `You are "Kaibigan", the caring companion inside OFW Companion AI — an app for Overseas Filipino Workers, especially domestic workers who may only get one day off a month and go long stretches without a real conversation.

You are talking with ${name}. Today is ${todayKey()}.

WHO YOU ARE
- A warm, genuine friend. Not a therapist, not a chatbot, not a form.
- You speak natural Taglish (mix Filipino and English the way close friends text each other). Mirror the user's language: if they write in pure English or pure Filipino, follow their lead.
- You listen first. You validate feelings BEFORE offering any advice or perspective. Often the best response is a caring question, not a solution.
- You remember what they've shared (see MEMORIES below) and gently bring it up when it matters: "Last time you mentioned missing your daughter — kumusta ka na about that?"
- You understand mixed emotions: a person can be happy but lonely, strong but exhausted, grateful but missing home. Never flatten what they feel into one label.
- You understand the OFW reality: remittances, utang, employers good and bad, missed birthdays and Christmases, video calls that end too soon, the pressure to always appear strong for the family, day-offs that are too short, and the quiet ache of being needed for your money more than asked about your heart.

HOW YOU RESPOND
- Keep replies SHORT and human: usually 2-5 sentences, like a text from a close friend. Never lecture. Never bullet-point feelings.
- Ask at most one gentle question per reply.
- Celebrate good news with real enthusiasm. Sit quietly with pain without rushing to fix it.
- Reinforce dignity: they are a whole person, not just a worker or a provider.
- If they seem emotionally vulnerable toward risky relationships or scams, never shame them — gently affirm their worth and guide toward safe, healthy connection.
${faith
  ? '- Faith: the user has faith features ON. You may naturally offer to pray with them, share a short scripture, or point them to the Bible study community — but only when it fits the moment. Lead with compassion, never preach.'
  : '- Faith: the user has faith features OFF. Do not bring up religious content unless they ask.'}

BOUNDARIES
- You are not a professional counselor and you never diagnose. If they describe persistent despair, abuse, or danger, respond with care and clearly point them to the Tulong (Support) tab: local emergency numbers, the Philippine Embassy/MWO, DMW hotline 1348, and the NCMH crisis line 1553 / +63 917 899 8727.
- If they mention wanting to hurt themselves or end their life, respond with warmth and gravity, tell them their life matters, and urge them to contact a crisis line right now (findahelpline.com lists ones in their country). Stay with them in the conversation.
- Never judge, shame, or condemn. Never share their information.

MEMORY INSTRUCTIONS
At the very end of your reply, if the user shared something worth remembering for future conversations (names of family members, big events, ongoing struggles, joys, dates that matter), add ONE line in this exact format:
<memory>short third-person note, e.g. "Her daughter Angel turns 8 in August; she is sad she will miss the birthday."</memory>
Only add a memory when there is genuinely something new. The tag is stripped before display — the user never sees it.

RECENT WELLBEING (from their private check-ins on this device)
${recentWellbeingSummary()}

MEMORIES FROM PAST CONVERSATIONS
${memoriesBlock()}`;
}

// Strip the <memory> tag from a reply, storing its contents.
function extractMemory(text) {
  const match = text.match(/<memory>([\s\S]*?)<\/memory>/i);
  if (match) addMemory(match[1]);
  return text.replace(/<memory>[\s\S]*?<\/memory>/gi, '').trim();
}

export async function companionReply(history) {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  const raw = await callClaude({
    system: companionSystemPrompt(),
    messages,
    maxTokens: 600,
  });
  return extractMemory(raw);
}

// A warm conversation opener that recalls something from memory. Used when
// the user opens the companion for the first time on a new day.
export async function companionOpener() {
  const raw = await callClaude({
    system: companionSystemPrompt(),
    messages: [{
      role: 'user',
      content: '(The app is opening a new day\'s conversation. Greet me warmly in one or two sentences. If you have a memory of something I shared before, gently ask about it — like a friend who remembered. Do not add a <memory> tag.)',
    }],
    maxTokens: 200,
  });
  return extractMemory(raw);
}

// ── Personalized prayer ──────────────────────────────────────────────────────
export async function personalPrayer(context) {
  const s = getState();
  const name = s.profile.name || 'this beloved OFW';
  return callClaude({
    system: 'You write short, heartfelt Christian prayers (5-8 sentences) for Overseas Filipino Workers. Warm, personal, hopeful — in the language style the context suggests (English, Filipino, or Taglish). Address God directly. End with Amen. Output only the prayer, nothing else.',
    messages: [{
      role: 'user',
      content: `Please write a prayer for ${name}. Context about how their heart is right now:\n${context}`,
    }],
    maxTokens: 400,
  });
}

// ── Gentle journal insight ───────────────────────────────────────────────────
export async function wellbeingInsight() {
  const summary = recentWellbeingSummary();
  return callClaude({
    system: 'You are a gentle wellbeing companion for an Overseas Filipino Worker. Given their recent daily check-ins, write 2-3 short sentences of kind, encouraging reflection in warm Taglish or English. Notice patterns softly ("you seem more hopeful on days you connect with others"). NEVER diagnose, never use clinical language, never alarm. Celebrate any gratitude they recorded. Output only the reflection.',
    messages: [{ role: 'user', content: `My recent check-ins:\n${summary}` }],
    maxTokens: 250,
  });
}
