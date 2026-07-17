// Knowledge Engine — the "Global Knowledge" half of the spec's Memory
// section: "Separate: Personal Memory AND Global Knowledge." This module
// deliberately never imports memory.js and never sees journal/checkin/chat
// data — its own cache lives under a different localStorage key so the
// separation is structural, not just a comment.
//
// V0.2 sources:
//   - News (real, live): GET {proxyUrl}/news on the same church-wide
//     Cloudflare Worker FLCC Kasama already uses (see ask-proxy/worker.js —
//     it fetches BBC/Guardian/NPR/Al Jazeera/ABS-CBN/Inquirer/GMA plus, as of
//     this version, Apple Newsroom and Ars Technica for the spec's
//     Technology/Apple-ecosystem categories). Needs no Anthropic key, only a
//     Worker URL.
//   - General knowledge / search (real, only when connected): the shared
//     ai-client.js transport, but with a system prompt that contains no
//     personal data at all — the personal agents (js/agents/*.js) use that
//     same transport differently, with their own personalized prompts.
// Both are optional: with nothing configured, this module still returns
// well-formed "not connected" results instead of throwing, same offline-
// first philosophy as the rest of this repo (see ofw-companion/README.md).
import { todayKey } from './utils.js';
import { getConnection, isConnected, callAI } from './ai-client.js';

const CACHE_KEY = 'flcc-jarvis-knowledge:v1';

function defaultCache() {
  return {
    news: { fetchedAt: null, items: [] },
    lastBriefingDate: null, // last day the daily knowledge briefing was shown
  };
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...defaultCache(), ...JSON.parse(raw) } : defaultCache();
  } catch {
    return defaultCache();
  }
}

let cache = loadCache();

function saveCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export { isConnected };

// /news only exists on the Worker (it isn't a direct-Anthropic-key feature)
// — a proxy URL is required even if the member otherwise uses a direct key.
export function newsAvailable() {
  return !!getConnection().proxyUrl;
}

export function getCachedNews() {
  return cache.news;
}

export async function refreshNews() {
  const { proxyUrl, proxySecret } = getConnection();
  if (!proxyUrl) return { ok: false, detail: 'No Worker URL configured — Knowledge Tool has no news source yet.' };
  try {
    const headers = {};
    if (proxySecret) headers['x-proxy-secret'] = proxySecret;
    const res = await fetch(proxyUrl.replace(/\/+$/, '') + '/news', { headers });
    if (!res.ok) return { ok: false, detail: `News source returned HTTP ${res.status}.` };
    const data = await res.json();
    cache.news = { fetchedAt: Date.now(), items: data.items || [] };
    saveCache();
    return { ok: true, detail: `${cache.news.items.length} headlines refreshed.` };
  } catch (err) {
    return { ok: false, detail: `Couldn't reach the news source: ${err.message}` };
  }
}

// General-knowledge Q&A / summarization — the spec's "Knowledge Tool:
// search and summarize information." System prompt is intentionally bare:
// no journal, no memories, no family names — this is the Global Knowledge
// side of the Memory System, not the Family/Faith agents' territory.
export async function askGlobalKnowledge(query) {
  if (!isConnected()) {
    return { ok: false, detail: 'No AI connection configured yet — Knowledge Tool can only serve cached news until one is set up.' };
  }
  return callAI({
    system: 'You are a general-knowledge assistant. Answer briefly, plainly, and honestly (say so if unsure). You have no information about the user personally — answer only what is asked.',
    message: query,
    maxTokens: 400,
  });
}

export function briefingShownToday() {
  return cache.lastBriefingDate === todayKey();
}

export function markBriefingShown() {
  cache.lastBriefingDate = todayKey();
  saveCache();
}

export function eraseKnowledgeCache() {
  cache = defaultCache();
  saveCache();
}
