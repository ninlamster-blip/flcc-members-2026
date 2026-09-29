// =============================================================================
// FLCC NEXT — playing together online: nicknames, a weekly leaderboard, a
// team goal, and ready-made cheers
// =============================================================================
//
// SETUP: nothing beyond KASAMA_DB, which is already bound in wrangler.toml.
// The tables are created on first use.
//
// Everything here is opt-in, and it is built around one rule: a child is never
// identifiable, and never reachable by typed words.
//
//  1. NO REAL NAMES. A player is a nickname the SERVER chooses from two fixed
//     word lists ("Brave Lion 42"). The app never sends a name, an age, a
//     church or anything typed, and there is no field that could carry one.
//  2. KIDS AND TEENS NEVER MEET. Every board, goal, cheer and room is scoped to
//     one age group. A 7-year-old's board holds only kids. Adults (the
//     flcc-adults edition) join only for rooms, with other adults.
//  3. NOTHING TYPED TRAVELS. A cheer is an index into CHEERS below, checked
//     here; free text is not accepted anywhere in this module.
//  4. LEAVING MEANS GONE. POST /leave deletes the player and every score and
//     cheer they had, at once. Idle players are swept after 90 days, and old
//     weeks after eight.
//
// A player proves who they are with a random token only their phone holds.
// The server stores its SHA-256, never the token itself.

export const AGE_GROUPS = ['kids', 'teens', 'adults'];
/**
 * Who has a leaderboard, a team goal and cheers. The adult edition (flcc-adults)
 * joins for live rooms only: it promises "no score, no leaderboard", so the
 * server refuses to keep an adult's score rather than trusting the app not to
 * send one.
 */
export const BOARD_GROUPS = ['kids', 'teens'];
export const GAMES = { hop: { max: 5000 }, galaga: { max: 10_000_000 } };

/** What the whole age group is working towards together, each week. */
export const TEAM_GOALS = {
  kids: { hop: 3000, galaga: 150000 },
  teens: { hop: 5000, galaga: 400000 },
};

/** The only things one player can send another. Index-addressed; never text. */
export const CHEERS = ['🙌 Great job!', '🔥 On fire!', '🙏 Praying for you', '⭐ Keep going!', '😂 Nice one!', '👏 Well played!'];

/**
 * What can be said in a game room — tapped, never typed. Index-addressed and
 * checked on this side, like CHEERS.
 */
export const ROOM_SAYS = ['👋 Hi!', '✅ Ready!', '🙌 Great job!', '😮 Wow!', '😂', '🔥', '🙏 Praying for you', '🤝 Good game!', '🔁 One more round?'];

/** Live rooms: a quiz battle, or a Hop Across race. */
/**
 * An avatar is a drawing chosen from the app's own set — `draw:<symbol>:<tone>`
 * — and nothing a child could upload. Only the adult edition may send a photo,
 * and only a small one: a data URL of at most AVATAR_PHOTO_MAX characters,
 * which a 96×96 JPEG fits in comfortably.
 */
export const AVATAR_TONES = ['sky', 'captain', 'rose', 'poppy', 'sunshine', 'ink'];
export const AVATAR_PHOTO_MAX = 16000;
export function cleanAvatar(value, ageGroup) {
  const text = String(value || '');
  const drawn = new RegExp(`^draw:[a-z]{2,16}:(${AVATAR_TONES.join('|')})$`);
  if (drawn.test(text)) return text;
  if (ageGroup === 'adults' && text.length <= AVATAR_PHOTO_MAX
    && /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/]+=*$/.test(text)) return text;
  return null;
}

/**
 * Columns added after a table first shipped. One read of the table's columns,
 * and an ALTER only for what is missing — so once they exist, a request costs
 * a single quick read rather than a schema change. `columns` is a fixed list
 * written in this file, never anything from a request.
 */
const migrated = new WeakSet();
export async function addMissingColumns(db, table, columns) {
  const { results } = await db.prepare(`SELECT name FROM pragma_table_info('${table}')`).all();
  const have = new Set((results || []).map((row) => row.name));
  for (const [column, type] of columns) {
    if (have.has(column)) continue;
    try { await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run(); } catch { /* added by a request alongside */ }
  }
}

export const ROOM_KINDS = { quiz: { questions: 10, questionMs: 12000 }, hop: {} };
export const ROOM_MAX_PLAYERS = 8;
const ROOM_COUNTDOWN_MS = 3000;
const ROOM_LIFETIME_HOURS = 2;
const ROOM_MESSAGES_PER_MINUTE = 12;
// No I, L, O, U or 0/1: a code read out across a church hall should not be misheard.
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTVWXYZ';

const ADJECTIVES = ['Brave', 'Bright', 'Bold', 'Swift', 'Kind', 'Happy', 'Mighty', 'Gentle', 'Joyful', 'Faithful', 'Clever', 'Shining', 'Steady', 'Quick', 'Cheerful', 'Loyal'];
const ANIMALS = ['Lion', 'Eagle', 'Lamb', 'Dove', 'Fox', 'Bear', 'Otter', 'Falcon', 'Whale', 'Panda', 'Tiger', 'Owl', 'Deer', 'Dolphin', 'Sparrow', 'Turtle'];

const PLAYER_RETENTION_DAYS = 90;
const SCORE_RETENTION_WEEKS = 8;
const CHEERS_PER_DAY = 20;             // one device cannot flood a board with cheers

export function nickname(random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)];
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${10 + Math.floor(random() * 90)}`;
}

/** The Monday of `date`'s week (UTC), as 'YYYY-MM-DD' — the leaderboard's week. */
export function weekOf(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function ensureNextPlaySchema(db) {
  if (migrated.has(db)) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS next_players (
      id          TEXT PRIMARY KEY,
      token_hash  TEXT NOT NULL UNIQUE,
      nickname    TEXT NOT NULL,
      age_group   TEXT NOT NULL,
      on_board    INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now')),
      seen_at     TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS next_scores (
      player_id   TEXT NOT NULL,
      game        TEXT NOT NULL,
      week        TEXT NOT NULL,
      best        INTEGER NOT NULL DEFAULT 0,
      total       INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (player_id, game, week)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS next_cheers (
      id          TEXT PRIMARY KEY,
      from_id     TEXT NOT NULL,
      to_id       TEXT NOT NULL,
      kind        INTEGER NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS next_rooms (
      code        TEXT PRIMARY KEY,
      kind        TEXT NOT NULL,
      age_group   TEXT NOT NULL,
      host_id     TEXT NOT NULL,
      seed        INTEGER NOT NULL,
      status      TEXT NOT NULL DEFAULT 'lobby',
      started_ms  INTEGER,
      created_at  TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS next_room_players (
      code        TEXT NOT NULL,
      player_id   TEXT NOT NULL,
      score       INTEGER NOT NULL DEFAULT 0,
      progress    INTEGER NOT NULL DEFAULT -1,
      alive       INTEGER NOT NULL DEFAULT 1,
      joined_ms   INTEGER NOT NULL,
      PRIMARY KEY (code, player_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS next_room_says (
      id          TEXT PRIMARY KEY,
      code        TEXT NOT NULL,
      player_id   TEXT NOT NULL,
      kind        INTEGER NOT NULL,
      at_ms       INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_next_scores_week ON next_scores (game, week, best DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_next_cheers_to ON next_cheers (to_id, created_at DESC)`),
  ]);
  await addMissingColumns(db, 'next_players', [['avatar', 'TEXT']]);
  migrated.add(db);
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function playerFor(db, token) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const player = await db.prepare(`SELECT id, nickname, age_group, on_board, avatar FROM next_players WHERE token_hash = ?`)
    .bind(await sha256(token)).first();
  if (player) await db.prepare(`UPDATE next_players SET seen_at = datetime('now') WHERE id = ?`).bind(player.id).run();
  return player;
}

/** The week's board for one game and one age group, plus the team's total. */
async function board(db, ageGroup, game, week, me) {
  const { results } = await db.prepare(
    `SELECT p.id, p.nickname, p.avatar, s.best FROM next_scores s JOIN next_players p ON p.id = s.player_id
     WHERE s.game = ? AND s.week = ? AND p.age_group = ? AND p.on_board = 1 AND s.best > 0
     ORDER BY s.best DESC, p.nickname LIMIT 10`
  ).bind(game, week, ageGroup).all();
  const team = await db.prepare(
    `SELECT COALESCE(SUM(s.total), 0) AS total, COUNT(*) AS players FROM next_scores s JOIN next_players p ON p.id = s.player_id
     WHERE s.game = ? AND s.week = ? AND p.age_group = ?`
  ).bind(game, week, ageGroup).first();
  let mine = null;
  if (me) {
    const row = await db.prepare(`SELECT best, total FROM next_scores WHERE player_id = ? AND game = ? AND week = ?`)
      .bind(me.id, game, week).first();
    mine = { best: row ? row.best : 0, total: row ? row.total : 0 };
  }
  return {
    week, game, ageGroup,
    top: (results || []).map((row, i) => ({ rank: i + 1, id: row.id, nickname: row.nickname, avatar: row.avatar || null, best: row.best, you: Boolean(me && row.id === me.id) })),
    team: { total: team ? team.total : 0, players: team ? team.players : 0, goal: TEAM_GOALS[ageGroup][game] },
    mine,
  };
}

export async function handleNextPlay(request, env, url) {
  if (!env.KASAMA_DB) return json({ configured: false });
  const db = env.KASAMA_DB;
  await ensureNextPlaySchema(db);
  const path = url.pathname.replace(/^\/api\/next\/play/, '') || '/';

  // GET /board?ageGroup=kids&game=hop — anyone may look; the token only adds "you"
  if (request.method === 'GET' && path === '/board') {
    const ageGroup = url.searchParams.get('ageGroup');
    const game = url.searchParams.get('game');
    if (!BOARD_GROUPS.includes(ageGroup) || !GAMES[game]) return json({ error: { message: 'Which board?' } }, 400);
    const me = await playerFor(db, request.headers.get('x-play-token'));
    if (me && me.age_group !== ageGroup) return json({ error: { message: 'That board is for another age group.' } }, 403);
    return json({ configured: true, ...(await board(db, ageGroup, game, weekOf(), me)) });
  }

  // GET /room?code=ABCD — everything a phone in the room needs, polled
  if (request.method === 'GET' && path === '/room') {
    const me = await playerFor(db, request.headers.get('x-play-token'));
    if (!me) return json({ error: { message: 'Not signed in to play online.' } }, 401);
    const room = await roomFor(db, url.searchParams.get('code'));
    if (!room) return json({ error: { message: 'That room has closed.' } }, 404);
    if (!(await inRoom(db, room.code, me.id))) return json({ error: { message: 'You are not in that room.' } }, 403);
    return json({ configured: true, ...(await roomState(db, room, me)) });
  }

  // GET /cheers — the cheers you have been sent this week
  if (request.method === 'GET' && path === '/cheers') {
    const me = await playerFor(db, request.headers.get('x-play-token'));
    if (!me) return json({ error: { message: 'Not signed in to play online.' } }, 401);
    const { results } = await db.prepare(
      `SELECT c.kind, p.nickname AS from_nickname, c.created_at FROM next_cheers c JOIN next_players p ON p.id = c.from_id
       WHERE c.to_id = ? ORDER BY c.created_at DESC LIMIT 30`
    ).bind(me.id).all();
    return json({ configured: true, cheers: (results || []).map((row) => ({ text: CHEERS[row.kind], from: row.from_nickname, at: row.created_at })) });
  }

  if (request.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: { message: 'Invalid JSON body' } }, 400); }

  // POST /join { ageGroup } — a nickname and a token; nothing about the child is sent
  if (path === '/join') {
    if (!AGE_GROUPS.includes(body.ageGroup)) return json({ error: { message: 'Which age group?' } }, 400);
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
    const player = { id: crypto.randomUUID(), nickname: nickname(), ageGroup: body.ageGroup, avatar: cleanAvatar(body.avatar, body.ageGroup) };
    await db.prepare(`INSERT INTO next_players (id, token_hash, nickname, age_group, avatar) VALUES (?, ?, ?, ?, ?)`)
      .bind(player.id, await sha256(token), player.nickname, player.ageGroup, player.avatar).run();
    return json({ configured: true, token, id: player.id, nickname: player.nickname, ageGroup: player.ageGroup, avatar: player.avatar });
  }

  const me = await playerFor(db, body.token);
  if (!me) return json({ error: { message: 'Not signed in to play online.' } }, 401);

  // POST /rename — another nickname from the lists; still never typed
  if (path === '/rename') {
    const name = nickname();
    await db.prepare(`UPDATE next_players SET nickname = ? WHERE id = ?`).bind(name, me.id).run();
    return json({ configured: true, nickname: name });
  }

  // POST /avatar { avatar } — a drawing from the app's set (or, for adults, a small photo); null clears it
  if (path === '/avatar') {
    const avatar = body.avatar == null ? null : cleanAvatar(body.avatar, me.age_group);
    if (body.avatar != null && !avatar) return json({ error: { message: 'That picture cannot be used.' } }, 400);
    await db.prepare(`UPDATE next_players SET avatar = ? WHERE id = ?`).bind(avatar, me.id).run();
    return json({ configured: true, avatar });
  }

  // POST /board-visibility { show } — on the leaderboard, or only in the team total
  if (path === '/board-visibility') {
    await db.prepare(`UPDATE next_players SET on_board = ? WHERE id = ?`).bind(body.show ? 1 : 0, me.id).run();
    return json({ configured: true, onBoard: Boolean(body.show) });
  }

  // The leaderboard's own routes are for kids and teens only.
  if (['/score', '/cheer', '/board-visibility'].includes(path) && !BOARD_GROUPS.includes(me.age_group)) {
    return json({ error: { message: 'This edition keeps no score and no leaderboard.' } }, 403);
  }

  // POST /score { game, value } — one finished run
  if (path === '/score') {
    const game = GAMES[body.game];
    const value = Math.trunc(Number(body.value));
    if (!game || !Number.isFinite(value) || value < 0 || value > game.max) return json({ error: { message: 'That score does not look right.' } }, 400);
    const week = weekOf();
    await db.prepare(
      `INSERT INTO next_scores (player_id, game, week, best, total) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (player_id, game, week) DO UPDATE SET best = MAX(best, excluded.best), total = total + excluded.total`
    ).bind(me.id, body.game, week, value, value).run();
    return json({ configured: true, ...(await board(db, me.age_group, body.game, week, me)) });
  }

  // POST /cheer { to, kind } — one of CHEERS, to someone of your own age group
  if (path === '/cheer') {
    const kind = Number(body.kind);
    if (!Number.isInteger(kind) || kind < 0 || kind >= CHEERS.length) return json({ error: { message: 'Pick a cheer from the list.' } }, 400);
    const to = await db.prepare(`SELECT id, age_group FROM next_players WHERE id = ?`).bind(String(body.to || '')).first();
    if (!to || to.age_group !== me.age_group || to.id === me.id) return json({ error: { message: 'That player cannot be cheered.' } }, 400);
    const today = await db.prepare(`SELECT COUNT(*) AS n FROM next_cheers WHERE from_id = ? AND created_at > datetime('now', '-1 day')`).bind(me.id).first();
    if (today && today.n >= CHEERS_PER_DAY) return json({ error: { message: 'That is plenty of cheering for today!' } }, 429);
    await db.prepare(`INSERT INTO next_cheers (id, from_id, to_id, kind) VALUES (?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), me.id, to.id, kind).run();
    return json({ configured: true, sent: CHEERS[kind] });
  }

  // ── Live rooms ─────────────────────────────────────────────────────────
  if (path.startsWith('/room/')) return handleRoom(db, path, body, me);

  // POST /leave — everything about this player, gone
  if (path === '/leave') {
    await db.batch([
      db.prepare(`DELETE FROM next_scores WHERE player_id = ?`).bind(me.id),
      db.prepare(`DELETE FROM next_cheers WHERE from_id = ? OR to_id = ?`).bind(me.id, me.id),
      db.prepare(`DELETE FROM next_room_players WHERE player_id = ?`).bind(me.id),
      db.prepare(`DELETE FROM next_room_says WHERE player_id = ?`).bind(me.id),
      db.prepare(`DELETE FROM next_players WHERE id = ?`).bind(me.id),
    ]);
    return json({ configured: true, left: true });
  }

  return json({ error: { message: 'Not found' } }, 404);
}

// ── Rooms ────────────────────────────────────────────────────────────────
//
// A room is a code, a kind, one age group, and a seed every phone in it uses
// to deal the same questions or build the same road. Phones poll GET /room
// about once a second; the server's clock (`now`) keeps them in step. Scores
// are reported by the phones — this is a game between friends, not an exam —
// but each is bounded: one point per question, once, while it is being asked.

async function roomFor(db, code) {
  if (typeof code !== 'string' || !/^[A-Z]{4}$/.test(code.toUpperCase())) return null;
  return db.prepare(`SELECT * FROM next_rooms WHERE code = ? AND created_at > datetime('now', ?)`)
    .bind(code.toUpperCase(), `-${ROOM_LIFETIME_HOURS} hours`).first();
}

const inRoom = async (db, code, playerId) =>
  Boolean(await db.prepare(`SELECT 1 FROM next_room_players WHERE code = ? AND player_id = ?`).bind(code, playerId).first());

/** Which quiz question is being asked at `now` (−1 in the countdown, `questions` once over). */
export function questionAt(room, now) {
  if (room.status === 'lobby' || room.started_ms == null) return -1;
  const into = now - room.started_ms;
  if (into < 0) return -1;
  return Math.min(ROOM_KINDS.quiz.questions, Math.floor(into / ROOM_KINDS.quiz.questionMs));
}

async function roomState(db, room, me) {
  const now = Date.now();
  // A quiz ends by the clock; a race ends when nobody is left running.
  if (room.status === 'playing' && room.kind === 'quiz' && questionAt(room, now) >= ROOM_KINDS.quiz.questions) {
    await db.prepare(`UPDATE next_rooms SET status = 'done' WHERE code = ?`).bind(room.code).run();
    room.status = 'done';
  }
  const { results: players } = await db.prepare(
    `SELECT p.id, p.nickname, p.avatar, r.score, r.progress, r.alive FROM next_room_players r JOIN next_players p ON p.id = r.player_id
     WHERE r.code = ? ORDER BY r.joined_ms, r.rowid`
  ).bind(room.code).all();
  if (room.status === 'playing' && room.kind === 'hop' && players.length && players.every((p) => !p.alive)) {
    await db.prepare(`UPDATE next_rooms SET status = 'done' WHERE code = ?`).bind(room.code).run();
    room.status = 'done';
  }
  const { results: says } = await db.prepare(
    `SELECT s.id, s.kind, s.at_ms, p.nickname FROM next_room_says s JOIN next_players p ON p.id = s.player_id
     WHERE s.code = ? ORDER BY s.at_ms DESC LIMIT 12`
  ).bind(room.code).all();
  return {
    code: room.code, kind: room.kind, seed: room.seed, status: room.status, startedMs: room.started_ms, now,
    host: room.host_id === me.id,
    question: room.kind === 'quiz' ? questionAt(room, now) : null,
    questions: room.kind === 'quiz' ? ROOM_KINDS.quiz.questions : null,
    questionMs: room.kind === 'quiz' ? ROOM_KINDS.quiz.questionMs : null,
    players: (players || []).map((p) => ({ id: p.id, nickname: p.nickname, avatar: p.avatar || null, score: p.score, progress: p.progress, alive: Boolean(p.alive), you: p.id === me.id })),
    says: (says || []).reverse().map((row) => ({ id: row.id, text: ROOM_SAYS[row.kind], from: row.nickname, at: row.at_ms })),
  };
}

async function handleRoom(db, path, body, me) {
  // POST /room/create { kind } — a new room with a fresh code, you as host
  if (path === '/room/create') {
    if (!ROOM_KINDS[body.kind]) return json({ error: { message: 'Which game?' } }, 400);
    let code = '';
    for (let tries = 0; tries < 20; tries++) {
      code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
      if (!(await roomFor(db, code))) break;
    }
    await db.prepare(`DELETE FROM next_rooms WHERE code = ?`).bind(code).run();       // an expired room with the same code
    await db.prepare(`DELETE FROM next_room_players WHERE code = ?`).bind(code).run();
    await db.prepare(`DELETE FROM next_room_says WHERE code = ?`).bind(code).run();
    await db.prepare(`INSERT INTO next_rooms (code, kind, age_group, host_id, seed) VALUES (?, ?, ?, ?, ?)`)
      .bind(code, body.kind, me.age_group, me.id, Math.floor(Math.random() * 2147483646) + 1).run();
    await db.prepare(`INSERT INTO next_room_players (code, player_id, joined_ms) VALUES (?, ?, ?)`).bind(code, me.id, Date.now()).run();
    return json({ configured: true, code });
  }

  const room = await roomFor(db, body.code);
  if (!room) return json({ error: { message: 'No room with that code. Check the letters with whoever made it.' } }, 404);
  if (room.age_group !== me.age_group) return json({ error: { message: 'That room is for another age group.' } }, 403);

  // POST /room/join { code }
  if (path === '/room/join') {
    if (await inRoom(db, room.code, me.id)) return json({ configured: true, code: room.code });
    if (room.status !== 'lobby') return json({ error: { message: 'That game has already started.' } }, 409);
    const count = await db.prepare(`SELECT COUNT(*) AS n FROM next_room_players WHERE code = ?`).bind(room.code).first();
    if (count.n >= ROOM_MAX_PLAYERS) return json({ error: { message: 'That room is full.' } }, 409);
    await db.prepare(`INSERT INTO next_room_players (code, player_id, joined_ms) VALUES (?, ?, ?)`).bind(room.code, me.id, Date.now()).run();
    return json({ configured: true, code: room.code });
  }

  if (!(await inRoom(db, room.code, me.id))) return json({ error: { message: 'You are not in that room.' } }, 403);

  // POST /room/start — the host, with at least two players, starts the countdown
  if (path === '/room/start') {
    if (room.host_id !== me.id) return json({ error: { message: 'Only whoever made the room can start it.' } }, 403);
    if (room.status !== 'lobby') return json({ error: { message: 'Already started.' } }, 409);
    const count = await db.prepare(`SELECT COUNT(*) AS n FROM next_room_players WHERE code = ?`).bind(room.code).first();
    if (count.n < 2) return json({ error: { message: 'Wait for at least one friend to join.' } }, 409);
    await db.prepare(`UPDATE next_rooms SET status = 'playing', started_ms = ? WHERE code = ?`).bind(Date.now() + ROOM_COUNTDOWN_MS, room.code).run();
    return json({ configured: true, started: true });
  }

  // POST /room/answer { code, question, right } — once per question, while it is being asked
  if (path === '/room/answer') {
    if (room.kind !== 'quiz' || room.status !== 'playing') return json({ error: { message: 'Not answering now.' } }, 409);
    const question = Math.trunc(Number(body.question));
    if (question !== questionAt(room, Date.now())) return json({ error: { message: 'Too late for that one.' } }, 409);
    const result = await db.prepare(
      `UPDATE next_room_players SET progress = ?, score = score + ? WHERE code = ? AND player_id = ? AND progress < ?`
    ).bind(question, body.right ? 1 : 0, room.code, me.id, question).run();
    return json({ configured: true, counted: result.meta.changes > 0 });
  }

  // POST /room/progress { code, row, alive } — a racer's furthest row, and whether they are still running
  if (path === '/room/progress') {
    if (room.kind !== 'hop' || room.status !== 'playing') return json({ error: { message: 'Not racing now.' } }, 409);
    const row = Math.trunc(Number(body.row));
    if (!Number.isFinite(row) || row < 0 || row > 5000) return json({ error: { message: 'That row does not look right.' } }, 400);
    await db.prepare(
      `UPDATE next_room_players SET progress = MAX(progress, ?), score = MAX(score, ?), alive = alive AND ? WHERE code = ? AND player_id = ?`
    ).bind(row, row, body.alive === false ? 0 : 1, room.code, me.id).run();
    return json({ configured: true });
  }

  // POST /room/say { code, kind } — one of ROOM_SAYS, never text
  if (path === '/room/say') {
    const kind = Number(body.kind);
    if (!Number.isInteger(kind) || kind < 0 || kind >= ROOM_SAYS.length) return json({ error: { message: 'Pick one from the list.' } }, 400);
    const recent = await db.prepare(`SELECT COUNT(*) AS n FROM next_room_says WHERE player_id = ? AND at_ms > ?`).bind(me.id, Date.now() - 60000).first();
    if (recent.n >= ROOM_MESSAGES_PER_MINUTE) return json({ error: { message: 'Slow down a little!' } }, 429);
    await db.prepare(`INSERT INTO next_room_says (id, code, player_id, kind, at_ms) VALUES (?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), room.code, me.id, kind, Date.now()).run();
    return json({ configured: true, said: ROOM_SAYS[kind] });
  }

  // POST /room/leave { code } — out of this room; a host leaving closes it
  if (path === '/room/leave') {
    if (room.host_id === me.id && room.status === 'lobby') {
      await db.batch([
        db.prepare(`DELETE FROM next_room_players WHERE code = ?`).bind(room.code),
        db.prepare(`DELETE FROM next_room_says WHERE code = ?`).bind(room.code),
        db.prepare(`DELETE FROM next_rooms WHERE code = ?`).bind(room.code),
      ]);
    } else {
      await db.prepare(`UPDATE next_room_players SET alive = 0 WHERE code = ? AND player_id = ?`).bind(room.code, me.id).run();
      if (room.status === 'lobby') await db.prepare(`DELETE FROM next_room_players WHERE code = ? AND player_id = ?`).bind(room.code, me.id).run();
    }
    return json({ configured: true, left: true });
  }

  return json({ error: { message: 'Not found' } }, 404);
}

/** Idle players and old weeks do not stay forever. Run from the Worker's cron. */
export async function sweepNextPlay(env) {
  if (!env.KASAMA_DB) return;
  const db = env.KASAMA_DB;
  await ensureNextPlaySchema(db);
  const cutoff = new Date(Date.now() - SCORE_RETENTION_WEEKS * 7 * 86400000);
  const { results } = await db.prepare(`SELECT id FROM next_players WHERE seen_at < datetime('now', ?)`)
    .bind(`-${PLAYER_RETENTION_DAYS} days`).all();
  const gone = (results || []).map((row) => row.id);
  for (const id of gone) {
    await db.batch([
      db.prepare(`DELETE FROM next_scores WHERE player_id = ?`).bind(id),
      db.prepare(`DELETE FROM next_cheers WHERE from_id = ? OR to_id = ?`).bind(id, id),
      db.prepare(`DELETE FROM next_players WHERE id = ?`).bind(id),
    ]);
  }
  await db.prepare(`DELETE FROM next_scores WHERE week < ?`).bind(weekOf(cutoff)).run();
  await db.prepare(`DELETE FROM next_cheers WHERE created_at < datetime('now', '-30 days')`).run();
  // Rooms are for one sitting: gone after a few hours, with what was said in them.
  const { results: stale } = await db.prepare(`SELECT code FROM next_rooms WHERE created_at < datetime('now', ?)`)
    .bind(`-${ROOM_LIFETIME_HOURS * 2} hours`).all();
  for (const { code } of stale || []) {
    await db.batch([
      db.prepare(`DELETE FROM next_room_players WHERE code = ?`).bind(code),
      db.prepare(`DELETE FROM next_room_says WHERE code = ?`).bind(code),
      db.prepare(`DELETE FROM next_rooms WHERE code = ?`).bind(code),
    ]);
  }
}
