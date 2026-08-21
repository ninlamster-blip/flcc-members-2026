/**
 * The model client.
 *
 * The API key is never in the browser. The app posts to an endpoint the user
 * configures in Settings — this repository already ships one
 * (`ask-proxy/worker.js`, deployed with the site) which holds
 * ANTHROPIC_API_KEY as a Worker secret and forwards to the Messages API. Any
 * endpoint with that contract works.
 *
 * Nothing here pretends. If no endpoint is configured, `available` is false
 * and the screens that need a model say so and offer the setting, rather
 * than showing a spinner that will never finish.
 */

export const DEFAULT_MODEL = 'claude-sonnet-5';

export class ModelUnavailable extends Error {
  constructor(message = 'No transcription or intelligence endpoint is configured.') {
    super(message);
    this.name = 'ModelUnavailable';
  }
}

export class ModelError extends Error {
  constructor(message, { status = 0 } = {}) {
    super(message);
    this.name = 'ModelError';
    this.status = status;
  }
}

export class ModelClient {
  /** @param {{endpoint?: string, secret?: string, model?: string, fetchImpl?: typeof fetch}} config */
  constructor({ endpoint = '', secret = '', model = DEFAULT_MODEL, fetchImpl } = {}) {
    this.endpoint = String(endpoint || '').trim();
    this.secret = String(secret || '');
    this.model = model || DEFAULT_MODEL;
    this.fetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  }

  get available() { return Boolean(this.endpoint && this.fetch); }

  headers(extra = {}) {
    return {
      'Content-Type': 'application/json',
      ...(this.secret ? { 'x-proxy-secret': this.secret } : {}),
      ...extra,
    };
  }

  /** The transcription endpoint sits beside the model endpoint on the same
   *  Worker: POST /proxy for the model, POST /stt for audio. */
  siblingPath(path) {
    if (!this.endpoint) return '';
    try {
      const url = new URL(this.endpoint);
      url.pathname = path;
      url.search = '';
      return url.toString();
    } catch {
      return this.endpoint.replace(/\/[^/]*$/, '') + path;
    }
  }

  /**
   * One turn, no streaming. Meeting analysis and memory answers are both
   * "ask once, use the whole reply" — streaming would add moving text to a
   * screen whose whole point is calm.
   *
   * @param {{system?: string, prompt: string, maxTokens?: number, temperature?: number, signal?: AbortSignal}} request
   * @returns {Promise<string>}
   */
  async complete({ system, prompt, maxTokens = 2000, temperature = 0, signal }) {
    if (!this.available) throw new ModelUnavailable();
    let response;
    try {
      response = await this.fetch(this.endpoint, {
        method: 'POST',
        headers: this.headers(),
        signal,
        body: JSON.stringify({
          model: this.model,
          max_tokens: maxTokens,
          temperature,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      throw new ModelError(`Could not reach the endpoint: ${err && err.message ? err.message : err}`);
    }
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json())?.error?.message || ''; } catch { /* not JSON */ }
      throw new ModelError(detail || `The endpoint returned HTTP ${response.status}.`, { status: response.status });
    }
    const data = await response.json();
    if (Array.isArray(data.content)) {
      return data.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n').trim();
    }
    return String(data.text || data.completion || '').trim();
  }

  /** A completion that must come back as JSON. Models occasionally wrap it in
   *  prose or a fence; take the first balanced object rather than failing. */
  async completeJson(request) {
    const text = await this.complete({ ...request, maxTokens: request.maxTokens || 3000 });
    const parsed = extractJson(text);
    if (!parsed) throw new ModelError('The endpoint replied with something that was not the requested JSON.');
    return parsed;
  }
}

export function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1].trim() : raw;
  try { return JSON.parse(candidate); } catch { /* try harder */ }
  const start = candidate.search(/[[{]/);
  if (start < 0) return null;
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const char = candidate[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === open) depth++;
    else if (char === close) {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(candidate.slice(start, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
}
