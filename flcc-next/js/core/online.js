// Playing online: a nickname, a weekly leaderboard, a team goal, and cheers.
//
// Everything here is opt-in, and it is the second deliberate exception to
// "nothing leaves the device" (the first is a prayer sent to a leader). What
// goes, and only once a young person has chosen to join:
//
//   · their age group — so kids and teens are never on the same board
//   · their Hop Across rows and Galaga score, at the end of each run
//   · which cheer they picked, from the fixed list below
//
// What never goes: their name, their age, anything they have typed anywhere in
// the app. The nickname is chosen by the server from two word lists, and there
// is no way to type one. `test/online.test.mjs` builds every request and
// checks. Leaving deletes everything on the server as well as here.
//
// The endpoint is the app's own origin — the same Worker that serves the app.

import * as store from './storage.js';

const TIMEOUT = 8000;

/** The only things one player can send another. Must match ask-proxy/next-play.js. */
export const CHEERS = ['🙌 Great job!', '🔥 On fire!', '🙏 Praying for you', '⭐ Keep going!', '😂 Nice one!', '👏 Well played!'];

export const GAMES = { hop: 'Hop Across', galaga: 'Galaga' };

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

/** This phone's online self, if it has joined — and only for the age group it joined as. */
export function me(ageGroup) {
  const saved = store.read(store.KEYS.online, null);
  if (!saved || !saved.token) return null;
  if (ageGroup && saved.ageGroup !== ageGroup) return null;
  return saved;
}

/** Is playing online set up on this Worker at all? */
export async function available() {
  const { ok, data } = await ask('/ping');
  return Boolean(ok && data && data.nextPlay);
}

/** Join with a server-chosen nickname. Sends the age group and nothing else. */
export async function join(ageGroup) {
  const { ok, data } = await ask('/api/next/play/join', { method: 'POST', body: { ageGroup } });
  if (!ok || !data || !data.token) return { joined: false, reason: data && data.configured === false ? 'off' : 'offline' };
  const saved = { token: data.token, id: data.id, nickname: data.nickname, ageGroup: data.ageGroup, onBoard: true };
  store.write(store.KEYS.online, saved);
  return { joined: true, ...saved };
}

const withToken = async (path, extra = {}) => {
  const self = me();
  if (!self) return { ok: false, data: null, status: 401 };
  return ask(path, { method: 'POST', body: { token: self.token, ...extra } });
};

export async function rename() {
  const { ok, data } = await withToken('/api/next/play/rename');
  if (!ok || !data) return null;
  store.write(store.KEYS.online, { ...me(), nickname: data.nickname });
  return data.nickname;
}

export async function setOnBoard(show) {
  const { ok } = await withToken('/api/next/play/board-visibility', { show: Boolean(show) });
  if (ok) store.write(store.KEYS.online, { ...me(), onBoard: Boolean(show) });
  return ok;
}

/** Leave: deleted on the server first, then forgotten here. */
export async function leave() {
  const { ok, status } = await withToken('/api/next/play/leave');
  // A 401 means the server has already forgotten this player; forget it here too.
  if (ok || status === 401) { store.remove(store.KEYS.online); return true; }
  return false;
}

/** One finished run. Quietly does nothing for a phone that has not joined. */
export async function submit(game, value, ageGroup) {
  if (!GAMES[game] || !me(ageGroup)) return null;
  const { ok, data } = await withToken('/api/next/play/score', { game, value: Math.max(0, Math.trunc(value) || 0) });
  return ok ? data : null;
}

export async function board(game, ageGroup) {
  const self = me(ageGroup);
  const { ok, data } = await ask(`/api/next/play/board?ageGroup=${encodeURIComponent(ageGroup)}&game=${encodeURIComponent(game)}`, { token: self && self.token });
  return ok ? data : null;
}

export async function cheers() {
  const self = me();
  if (!self) return [];
  const { ok, data } = await ask('/api/next/play/cheers', { token: self.token });
  return ok && data ? data.cheers || [] : [];
}

export async function cheer(to, kind) {
  const { ok, status, data } = await withToken('/api/next/play/cheer', { to, kind });
  return { sent: Boolean(ok && data && data.sent), limited: status === 429 };
}
