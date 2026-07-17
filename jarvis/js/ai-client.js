// Shared AI transport — the same church-wide Ask FLCC connection
// ofw-companion/js/ai.js already uses (same origin, same localStorage
// keys, do not rename). Transport only: this module has no opinion about
// what's asked or what a prompt contains. knowledge.js calls it for Global
// Knowledge (neutral system prompts, no personal data); the personal
// agents (js/agents/faith.js, family.js, creator.js) call it for
// personalized generation (their own prompts, drawing on Personal Memory
// that they gather themselves). Same client, deliberately different data
// on each side — see each caller's own header comment.
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

// One Claude call, system prompt and message supplied entirely by the
// caller — always returns { ok, detail } instead of throwing, so every
// caller gets the same graceful "not connected" / "request failed" shape.
export async function callAI({ system, message, maxTokens = 400 }) {
  if (!isConnected()) {
    return { ok: false, detail: 'No AI connection configured yet.' };
  }
  const { endpoint, headers } = buildEndpointAndHeaders();
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: message }],
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, detail: data?.error?.message || `Request failed (HTTP ${res.status})` };
    const text = (data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    return { ok: true, detail: text || '(no answer returned)' };
  } catch (err) {
    return { ok: false, detail: `Couldn't reach the AI: ${err.message}` };
  }
}
