// Live rooms: a Bible quiz played together, at the same time, on your own phones.
//
// The second thing in this app that sends anything anywhere (the first is ASK),
// and it only does so once a member chooses to play in a room. What goes:
//
//   · that this is the adult edition — rooms hold adults only
//   · which room, and whether each answer was right
//   · which ready-made line was tapped, from the fixed list below
//
// What never goes: a name, anything typed, a prayer, a note, a reflection. The
// member plays as a nickname the server picks from two word lists. Nothing is
// kept as a score: there is no leaderboard in this edition — the server refuses
// to keep an adult's score at all — and a room, with what was said in it, is
// deleted a few hours after it was made. `test/rooms.test.mjs` builds every
// request and checks.
//
// The endpoint is the app's own origin, served by ask-proxy/next-play.js on the
// shared Worker. Nothing here comes from flcc-next/: the two apps share the
// Worker and no code.

import * as store from './storage.js';
import { permute, hash } from './rotation.js';

const TIMEOUT = 8000;
export const EDITION = 'adults';

/** What can be said in a room — tapped, never typed. Must match ask-proxy/next-play.js. */
export const ROOM_SAYS = ['👋 Hi!', '✅ Ready!', '🙌 Great job!', '😮 Wow!', '😂', '🔥', '🙏 Praying for you', '🤝 Good game!', '🔁 One more round?'];

async function ask(path, { method = 'GET', body, token } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(new URL(path, location.origin).href, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token && method === 'GET' ? { 'x-play-token': token } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

/** This device's room nickname, if it has one. */
export function me() {
  const saved = store.read(store.KEYS.online, null);
  return saved && saved.token && saved.ageGroup === EDITION ? saved : null;
}

/** Are rooms switched on for this Worker? */
export async function available() {
  const { ok, data } = await ask('/ping');
  return Boolean(ok && data && data.nextPlay);
}

/** A nickname for rooms. Sends only which edition this is. */
export async function join() {
  const { ok, data } = await ask('/api/next/play/join', { method: 'POST', body: { ageGroup: EDITION } });
  if (!ok || !data || !data.token) return { joined: false };
  const saved = { token: data.token, id: data.id, nickname: data.nickname, ageGroup: data.ageGroup };
  store.write(store.KEYS.online, saved);
  return { joined: true, ...saved };
}

const withToken = async (path, extra = {}) => {
  const self = me();
  if (!self) return { ok: false, status: 401, data: null };
  return ask(path, { method: 'POST', body: { token: self.token, ...extra } });
};

/** Stop playing in rooms: the nickname is deleted on the server, then here. */
export async function leave() {
  const { ok, status } = await withToken('/api/next/play/leave');
  if (ok || status === 401) { store.remove(store.KEYS.online); return true; }
  return false;
}

const roomCall = async (what, extra) => {
  const result = await withToken(`/api/next/play/room/${what}`, extra);
  return { ok: result.ok, status: result.status, data: result.data, message: result.data && result.data.error && result.data.error.message };
};

export const createRoom = () => roomCall('create', { kind: 'quiz' });
export const joinRoom = (code) => roomCall('join', { code: String(code || '').trim().toUpperCase() });
export const startRoom = (code) => roomCall('start', { code });
export const leaveRoom = (code) => roomCall('leave', { code });
export const answer = (code, question, right) => roomCall('answer', { code, question, right: Boolean(right) });
export const say = (code, kind) => roomCall('say', { code, kind });

/** The room as the server sees it, with `clock()`: the server's time, so every phone moves together. */
export async function room(code) {
  const self = me();
  if (!self) return null;
  const sent = Date.now();
  const { ok, status, data } = await ask(`/api/next/play/room?code=${encodeURIComponent(code)}`, { token: self.token });
  if (!ok || !data) return { gone: status === 404 || status === 403, offline: !status };
  const offset = data.now - (sent + Date.now()) / 2;
  return { ...data, clock: () => Date.now() + offset };
}

// ── The quiz itself: the same questions, in the same order, on every phone ──


/** The room's questions, dealt from its seed — identical wherever it is dealt. */
export const questionsFor = (bank, seed, count) => permute(bank, seed).slice(0, count);

/**
 * A question's options in the order they are shown. The right answer is written
 * first in content/quiz.json; shown first, it would be the answer to every
 * question, so the order is shuffled by the question's own text — the same on
 * every phone, different for every question.
 */
export function shown(question) {
  const order = permute(question.options.map((_, i) => i), hash(question.q) + 1);
  return { options: order.map((i) => question.options[i]), answer: order.indexOf(question.answer) };
}
