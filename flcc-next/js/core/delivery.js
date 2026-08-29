// Getting a prayer off the phone.
//
// This module exists because of a specific failure. A teenager wrote a prayer,
// the app said "Sent to a ministry leader", and nothing had been sent
// anywhere — there was no server, so there was no delivery, only a promise.
//
// So the one rule here is: **never report a delivery that has not happened.**
// `send()` resolves to `delivered: true` only when the Worker has written the
// prayer down and said so. Every other outcome — off, offline, refused,
// timed out — comes back as not delivered, with a reason the screen can say
// out loud, so the young person is told the truth and offered the route that
// does work (sending it themselves).
//
// The endpoint is the app's own origin, because `wrangler.toml` publishes this
// repository as one Worker: the site is its assets and `/api/next/prayers` is
// one of its routes. Nothing to configure on a phone.

const TIMEOUT = 8000;

const endpoint = (path) => new URL(path, location.origin).href;

async function ask(path, { method = 'GET', body, key, timeout = TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(endpoint(path), {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(key ? { 'x-leader-key': key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };   // offline, aborted, blocked
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Can a prayer actually reach a leader right now?
 *
 * Asked before the app offers to send, so it never makes an offer it cannot
 * keep. A Worker with no database, or with no leader key set — meaning nobody
 * could ever read what was sent — answers no.
 */
export async function available() {
  const { ok, data } = await ask('/ping');
  return Boolean(ok && data && data.nextPrayers);
}

/**
 * Why delivery is off, for whoever is setting it up.
 *
 * Returns `{ reachable, ready, missing[] }` where `missing` names the pieces
 * the Worker says it lacks — 'database', 'leaderKey', or both. Telling someone
 * only that it is off leaves them hunting through two unrelated settings
 * pages, which is what happened the first time.
 */
export async function readiness() {
  const { ok, data } = await ask('/ping');
  if (!ok || !data) return { reachable: false, ready: false, missing: [] };
  const missing = [];
  if (!data.nextDatabase) missing.push('database');
  if (!data.nextLeaderKey) missing.push('leaderKey');
  return { reachable: true, ready: Boolean(data.nextPrayers), missing };
}

/**
 * Send one prayer. Resolves `{ delivered, id, reason }`.
 *
 * `delivered` is true only on the Worker's own confirmation. `reason` is for
 * the screen to explain itself: 'off' (not set up), 'offline' (no answer),
 * 'refused' (the Worker said no), 'empty' (nothing written).
 */
export async function send({ content, mood, firstName, ageGroup, urgent }) {
  const text = String(content || '').trim();
  if (!text) return { delivered: false, reason: 'empty' };

  const { ok, status, data } = await ask('/api/next/prayers', {
    method: 'POST',
    body: { content: text, mood, firstName, ageGroup, urgent: Boolean(urgent) },
  });

  if (data && data.configured === false) return { delivered: false, reason: 'off' };
  if (!ok || !data) return { delivered: false, reason: status ? 'refused' : 'offline' };
  if (data.delivered !== true) return { delivered: false, reason: 'refused' };
  return { delivered: true, id: data.id };
}

// ── The leader's side ──────────────────────────────────────────────────────
//
// Everything below needs the key. It is held on the leader's own device and
// sent as a header; it is never shipped to a young person's phone, because a
// secret on a child's device is not a secret.

/** The queue, newest and most urgent first. */
export async function queue(key) {
  if (!key) return { ok: false, reason: 'no-key', prayers: [] };
  const { ok, status, data } = await ask('/api/next/prayers', { key });
  if (data && data.configured === false) {
    return { ok: false, reason: 'off', missing: data.missing || [], prayers: [] };
  }
  if (status === 401) return { ok: false, reason: 'bad-key', prayers: [] };
  if (!ok || !data) return { ok: false, reason: status ? 'error' : 'offline', prayers: [] };
  return { ok: true, prayers: data.prayers || [] };
}

/** Mark one read or hidden. */
export async function mark(key, id, status) {
  const result = await ask('/api/next/prayers/status', { method: 'POST', key, body: { id, status } });
  return Boolean(result.ok && result.data && result.data.status === status);
}
