// The prayer wall: one request, shared with everyone in this app, by choice.
//
// The third thing in this app that sends anything anywhere (after ASK and quiz
// rooms), and only when a member taps "Share with the church" on one prayer.
// The private prayer list in prayers.js never comes here. What goes:
//
//   · the request's text, as it was written
//   · the member's first name, which signs it
//   · a random id this phone made itself, so a reaction counts once per phone
//   · the member's picture, if they set one on You (avatar.js)
//
// Afterwards the sharer can mark it answered, with a short note; everyone can
// react with one of REACTIONS — tapped, never typed.
//
// What never goes: the rest of the name, the season, the rest of the list, a
// reflection, a note. `test/wall.test.mjs` builds every request and checks.
//
// Sharing returns a token only this phone holds, kept under KEYS.shared, and
// it is the only way to take a request down again. The server deletes every
// request after thirty days, and hides one once three phones have reported it.

import * as store from './storage.js';
import { firstName, getUser } from './profile.js';
import { isConcerning } from './safety.js';
import { valid as validAvatar } from './avatar.js';

const TIMEOUT = 8000;
const BASE = '/api/adults/prayers';

/** What can be said about a request. Must match ask-proxy/adults-prayers.js. 🙌 opens once it is answered. */
export const REACTIONS = [
  { kind: 'prayed', emoji: '🙏', label: 'Praying' },
  { kind: 'love', emoji: '❤️', label: 'Love' },
  { kind: 'with', emoji: '🤝', label: 'With you' },
  { kind: 'praise', emoji: '🙌', label: 'Praise', answeredOnly: true },
];
export const NOTE_MAX = 280;

async function ask(path, { method = 'GET', body, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(new URL(path, location.origin).href, {
      method,
      signal: controller.signal,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data, message: data && data.error && data.error.message };
  } catch {
    return { ok: false, status: 0, data: null, message: 'Could not reach the church. Try again when you are online.' };
  } finally {
    clearTimeout(timer);
  }
}

function saved() {
  const kept = store.read(store.KEYS.shared, null) || {};
  return { device: '', mine: {}, reported: [], ...kept };
}

/** This phone's own random id — made here, never derived from the person. */
function device() {
  const kept = saved();
  if (/^[0-9a-f]{32}$/.test(kept.device)) return kept.device;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  kept.device = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  store.write(store.KEYS.shared, kept);
  return kept.device;
}

/** What would be sent, built without sending it — the test reads this. */
export function buildShare(text, user = getUser()) {
  const avatar = validAvatar((user || {}).avatar);
  return { text: String(text || '').trim(), firstName: firstName(user), device: device(), ...(avatar ? { avatar } : {}) };
}

/**
 * The wall, newest first — or `{ error }` saying why it could not be read:
 * offline, not set up on this Worker, or the server's own message.
 */
export async function list() {
  const { ok, status, data, message } = await ask(BASE, { headers: { 'x-prayer-device': device() } });
  if (!status) return { error: 'The prayer wall needs a connection; your own prayer list does not.' };
  if (data && data.configured === false) return { error: 'The prayer wall is not switched on for this server yet.' };
  if (!ok || !data || !Array.isArray(data.prayers)) {
    return { error: `The prayer wall could not be read (${status}${message ? `: ${message}` : ''}).` };
  }
  const mine = saved().mine;
  return (data.prayers || []).map((one) => ({
    ...one,
    answered: one.answered || null,
    reactions: one.reactions || { prayed: one.prayed || 0 },
    yourReactions: one.yourReactions || (one.prayedByYou ? ['prayed'] : []),
    yours: Boolean(mine[one.id]),
  }));
}

/**
 * Share one request. Words that sound like someone is in danger are not posted
 * to the whole church: the screen shows who to tell instead.
 */
export async function share(text) {
  if (isConcerning(text)) return { ok: false, concerning: true };
  const body = buildShare(text);
  if (body.text.length < 5) return { ok: false, message: 'Write a little more first.' };
  const result = await ask(BASE, { method: 'POST', body });
  if (!result.ok || !result.data || !result.data.token) return { ok: false, message: result.message || 'Could not share it.' };
  const kept = saved();
  kept.mine[result.data.id] = result.data.token;
  store.write(store.KEYS.shared, kept);
  return { ok: true, id: result.data.id };
}

/** Add a reaction, or take it back if this phone already gave it. */
export const react = (id, kind) => ask(`${BASE}/react`, { method: 'POST', body: { id, kind, device: device() } });

/**
 * Mark one of your own requests answered, with an optional note — or, with
 * `answered: false`, take the mark back off. The note is screened like the
 * request itself before anything is sent.
 */
export async function answer(id, note = '', { answered = true } = {}) {
  const token = saved().mine[id];
  if (!token) return { ok: false, message: 'Only the phone that shared it can mark it answered.' };
  const text = String(note || '').trim().slice(0, NOTE_MAX);
  if (answered && isConcerning(text)) return { ok: false, concerning: true };
  return ask(`${BASE}/answer`, { method: 'POST', body: { id, token, device: device(), ...(answered ? { note: text } : { answered: false }) } });
}

export async function report(id) {
  const result = await ask(`${BASE}/report`, { method: 'POST', body: { id, device: device() } });
  if (result.ok) {
    const kept = saved();
    kept.reported = [...new Set([...kept.reported, id])];
    store.write(store.KEYS.shared, kept);
  }
  return result;
}

export const reported = () => saved().reported;

/** Take one of your own requests down. Only this phone holds the token that can. */
export async function remove(id) {
  const kept = saved();
  const token = kept.mine[id];
  if (!token) return { ok: false, message: 'Only the phone that shared it can take it down.' };
  const result = await ask(`${BASE}/remove`, { method: 'POST', body: { id, token, device: device() } });
  if (result.ok || result.status === 404) {
    delete kept.mine[id];
    store.write(store.KEYS.shared, kept);
    return { ok: true };
  }
  return result;
}
