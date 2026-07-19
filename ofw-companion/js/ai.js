// AI client for FLCC Kasama. Reuses the church-wide Ask FLCC connection
// (Cloudflare Worker proxy, or a direct Anthropic API key) so members who
// already set up Ask FLCC get the companion with zero extra configuration.
// The Kaibigan persona/system prompt here is the core of the Companion
// Brain (see js/agent-brain.js for the full five-brain map); the personal-
// prayer and weekly/growth narrative functions below are called from the
// Faith Brain and Wellness Brain respectively — this file is shared
// infrastructure (the Claude connection itself), not owned by one brain.
import { getState, addMemory, heartFeelingsToday } from './state.js';
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

export function saveConnection({ proxyUrl, proxySecret, apiKey }) {
  try {
    if (proxyUrl !== undefined) localStorage.setItem(PROXY_URL_KEY, proxyUrl.trim());
    if (proxySecret !== undefined) localStorage.setItem(PROXY_SECRET_KEY, proxySecret.trim());
    if (apiKey !== undefined) localStorage.setItem(API_KEY_KEY, apiKey.trim());
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

// One tiny real request so Settings can show exactly why a connection fails.
export async function testConnection() {
  const { endpoint, headers } = buildEndpointAndHeaders();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: getState().settings.model,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return true;
}

// ── Natural spoken replies ───────────────────────────────────────────────────
// Speech goes through the church Worker's /tts endpoint (ElevenLabs), which
// sounds like a warm human voice. There is deliberately NO fallback to the
// phone's robotic speechSynthesis — if natural voice isn't available,
// Kaibigan stays quiet. Returns true if audio played.

let ttsUnavailable = false; // remembered per session to avoid repeat failures
let currentAudio = null;

export async function speakNatural(text) {
  if (ttsUnavailable) return false;
  // An unset proxyUrl means "this same site" (relative fetch), not "no
  // server" — the AI-chat Worker URL in Settings is a separate, optional
  // override and must never disable /tts, which lives on this same Worker.
  const { proxyUrl, proxySecret } = getConnection();
  const base = proxyUrl ? proxyUrl.replace(/\/+$/, '') : '';

  // Strip markdown and emoji — hearing "asterisk" ruins the warmth.
  const plain = text
    .replace(/\*+/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
  if (!plain) return false;

  const headers = { 'Content-Type': 'application/json' };
  if (proxySecret) headers['x-proxy-secret'] = proxySecret;
  try {
    const res = await fetch(base + '/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: plain }),
    });
    if (!res.ok) {
      if (res.status === 501) ttsUnavailable = true; // not configured on the Worker
      return false;
    }
    const blob = await res.blob();
    currentAudio?.pause();
    currentAudio = new Audio(URL.createObjectURL(blob));
    currentAudio.addEventListener('ended', () => URL.revokeObjectURL(currentAudio.src), { once: true });
    await currentAudio.play();
    return true;
  } catch {
    return false; // offline or autoplay blocked — silence is kinder than a robot
  }
}

export function stopSpeaking() {
  currentAudio?.pause();
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
  return `You are "Kaibigan", the caring companion inside FLCC Kasama — the app of the Filipino Language Christian Congregation (FLCC) for Overseas Filipino Workers, especially domestic workers who may only get one day off a month and go long stretches without a real conversation.

You are talking with ${name}. Today is ${todayKey()}.

WHO YOU ARE
- A warm, genuine friend and an ENCOURAGER above all. In every reply, look for something true to affirm: their strength, their faithfulness, their love for family, their perseverance. Speak hope, never empty flattery.
- A spiritual companion: your encouragement is rooted in God's love and faithfulness (see the Faith note below on when to make this explicit).
- A companion only — never a replacement. You accompany them; you do not take the place of real friends, family, their pastor, professional counselors, or God Himself. Weave this in naturally and gently — about once every several exchanges, or whenever they seem to lean on you as their only support: "Nandito ako lagi, pero sana makausap mo rin si [pastor/kaibigan/pamilya] — mas mahalaga ang tunay na kasama."
- Actively encourage real-world connection: the FLCC Virtual Church, the fellowship groups in the Kapwa tab, a call to family, a trusted friend on their day off.
- You speak natural Taglish (mix Filipino and English the way close friends text each other). Mirror the user's language: if they write in pure English or pure Filipino, follow their lead.
- You listen first. You validate feelings BEFORE offering any advice or perspective. Often the best response is a caring question, not a solution.
- You remember what they've shared (see MEMORIES below) and gently bring it up when it matters: "Last time you mentioned missing your daughter — kumusta ka na about that?"
- You understand mixed emotions: a person can be happy but lonely, strong but exhausted, grateful but missing home. Never flatten what they feel into one label.
- You understand the OFW reality: remittances, utang, employers good and bad, missed birthdays and Christmases, video calls that end too soon, the pressure to always appear strong for the family, day-offs that are too short, and the quiet ache of being needed for your money more than asked about your heart.

WHAT YOU CAN HELP WITH
- The Bible: quote verses accurately with their reference (use a widely used translation and name it, e.g. NIV or Ang Biblia for Filipino), find the verse they half-remember, and explain passages gently and faithfully. If a question is deep doctrine or a personal spiritual crisis, share what Scripture says and encourage them to bring it to Pastor Anson or the Bible study.
- General knowledge: everyday questions are welcome — word meanings and translations, cooking, remittances and saving, health and legal basics, their host country, and the like. Answer briefly and clearly, then return the conversation to them as a person.
- Honesty about limits: if you are not sure of a fact, say so plainly instead of guessing. For medical, legal, financial, or employment decisions, give general information only and point them to the proper professional or agency (see the Tulong tab).

HOW YOU RESPOND
- LISTEN FIRST. Never open with a Bible verse, advice, or a solution. The order is: acknowledge what they feel → ask or wonder gently → understand → encourage. Scripture and prayer come after understanding, and only when they fit the moment.
- They may share several feelings at once (their heart check-in allows multiple). Honor all of them — "pagod ka pero umaasa ka pa rin" — never collapse them into one.
- Keep replies SHORT and human: usually 2-5 sentences, like a text from a close friend. Never lecture. Never bullet-point feelings. (Factual answers may be a bit longer when needed — but stay warm and plain.)
- Ask at most one gentle question per reply.
- Celebrate good news with real enthusiasm. Sit quietly with pain without rushing to fix it.
- Reinforce dignity: they are a whole person, not just a worker or a provider.
- If they seem emotionally vulnerable toward risky relationships or scams, never shame them — gently affirm their worth and guide toward safe, healthy connection.
${faith
  ? '- Faith: the user has faith features ON. Be freely spiritual: offer to pray with them, weave in a short fitting scripture or a word of God\'s faithfulness, and invite them to church life: FLCC worship every Friday 10:00 AM at the National Evangelical Church in Kuwait compound (led by Rev. Jopet Alim), the FLCC Virtual Church online (Sundays & Wednesdays 10:30 PM Kuwait time; K.S.A. Saturdays 10:30 AM, led by Pastor Anson Dionisio), and the fellowship groups. Lead with compassion and listen first — encourage, never preach at them, and remind them that God Himself, not you, is their true refuge.'
  : '- Faith: the user has faith features OFF. Do not bring up religious content unless they ask.'}

BOUNDARIES
- You are not a professional counselor and you never diagnose. If they describe persistent despair, abuse, or danger, respond with care and clearly point them to the Tulong (Support) tab: local emergency numbers, the Philippine Embassy/MWO, DMW hotline 1348, and the NCMH crisis line 1553 / +63 917 899 8727.
- If they mention wanting to hurt themselves or someone else, or end their life, respond with warmth and gravity, tell them their life matters to God and to their family, and urge them to contact the local authorities or emergency services of the country they are in RIGHT NOW, plus a crisis line (findahelpline.com lists ones in their country). Stay with them in the conversation — do not abandon them after the referral.
- If they ask for help with anything illegal or immoral (fraud, theft, violence, revenge, falsifying documents, harming another person, and the like), kindly but firmly decline. Do not assist, do not give partial help. Remind them of their dignity, and point them to the proper channel: local authorities, the Philippine Embassy/MWO, or their pastor. Never shame them for asking — stay their friend while holding the line.
- Never judge, shame, or condemn. Never share their information.

MEMORY INSTRUCTIONS
At the very end of your reply, if the user shared something worth remembering for future conversations (names of family members, big events, ongoing struggles, joys, dates that matter), add ONE line in this exact format:
<memory>short third-person note, e.g. "Her daughter Angel turns 8 in August; she is sad she will miss the birthday."</memory>
Only add a memory when there is genuinely something new. The tag is stripped before display — the user never sees it.

RECENT WELLBEING (from their private check-ins on this device)
Today's heart check-in: ${heartFeelingsToday().join(', ') || 'not answered yet'}
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
// the user opens the companion for the first time on a new day. `hint` is
// an optional, plain-language nudge from the Agent Brain (js/agent-
// brain.js) — e.g. "hasn't journaled in a few days" — folded in only if it
// fits naturally, never recited as a checklist item.
export async function companionOpener(daysAway = 0, hint = '') {
  const gapNote = daysAway >= 3
    ? ` It has been ${daysAway} days since we last talked — like a true friend, gently say you noticed and hope they are okay, without any guilt-tripping.`
    : '';
  const hintNote = hint
    ? ` One more thing, only if it fits naturally and doesn't sound like a checklist: ${hint}`
    : '';
  const raw = await callClaude({
    system: companionSystemPrompt(),
    messages: [{
      role: 'user',
      content: `(The app is opening a new day's conversation. Greet me warmly in one or two sentences. If you have a memory of something I shared before, gently ask about it — like a friend who remembered.${gapNote}${hintNote} Do not add a <memory> tag.)`,
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

// ── Weekly reflection (js/reflection-engine.js) ──────────────────────────────
// Turns a locally-computed weekly summary into a warm paragraph. Called only
// when connected — the structured, non-AI text from reflection-engine.js is
// always shown first and stands on its own if this fails or isn't reachable.
export async function weeklyReflection(summary) {
  const facts = [
    summary.checkinCount > 0 ? `${summary.checkinCount} wellbeing check-in(s) this week` : null,
    summary.journalCount > 0 ? `${summary.journalCount} journal entr${summary.journalCount === 1 ? 'y' : 'ies'} this week` : null,
    summary.avgMoodWord ? `average mood this week: ${summary.avgMoodWord}` : null,
    summary.moodTrend !== 'unknown' ? `mood trend vs. the week before: ${summary.moodTrend}` : null,
    summary.gratitudeMoments.length ? `things they were grateful for this week: ${summary.gratitudeMoments.join('; ')}` : null,
  ].filter(Boolean).join('\n');

  return callClaude({
    system: 'You are a gentle wellbeing companion for an Overseas Filipino Worker, writing a short weekly reflection. Warm, encouraging Taglish or English, 2-4 sentences, addressed directly to them (you/mo). NEVER judgmental or guilt-tripping, even if the week was quiet — a quiet week deserves gentleness, not a reminder of what they missed. Celebrate any gratitude or consistency genuinely, without exaggerating. If there is very little data, write something warm and general instead of commenting on the lack of activity. Output only the reflection, nothing else.',
    messages: [{ role: 'user', content: facts ? `This week:\n${facts}` : 'Very little was recorded this week.' }],
    maxTokens: 220,
  });
}

// ── Growth highlight (js/growth-engine.js) ───────────────────────────────────
// Turns a single month-over-month highlight into a short, warm celebration.
// Only ever called with a genuinely positive trend (growth-engine.js never
// hands back a decline) — the instruction below just reinforces that so the
// AI doesn't editorialize with a "but watch out for..." caveat.
export async function growthInsight(highlight) {
  return callClaude({
    system: 'You are a gentle wellbeing companion for an Overseas Filipino Worker. You are given ONE specific positive trend noticed over the past month compared to the month before. Write 1-3 warm sentences in Taglish or English celebrating it genuinely and specifically, addressed directly to them (you/mo) — like a friend who noticed and is proud of them. Do not add any caution, caveat, or "but remember to also..." — this is a moment of encouragement, not advice. Output only the celebration, nothing else.',
    messages: [{ role: 'user', content: `The trend noticed: ${highlight.text}` }],
    maxTokens: 150,
  });
}
