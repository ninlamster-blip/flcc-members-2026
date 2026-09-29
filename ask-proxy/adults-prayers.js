// =============================================================================
// FLCC NEXT — Adults: the prayer wall
// =============================================================================
//
// SETUP: nothing beyond KASAMA_DB, which is already bound in wrangler.toml.
// The tables are created on first use.
//
// A member of the adult edition can share one prayer request with everyone in
// that app. Their private prayer list never comes here — a request travels only
// when they tap "Share with the church" on it, and it goes signed with their
// first name. The rules this module holds:
//
//  1. ONE REQUEST, CHOSEN. The body is the text and a first name, nothing else.
//     Text is 5–500 characters, the name 1–40, both trimmed of control
//     characters. A device can share at most SHARES_PER_DAY a day.
//  2. THE SENDER CAN TAKE IT BACK. Sharing returns a random token only the
//     sender's phone holds; the server keeps its SHA-256. POST /remove with it
//     deletes the request and every "I prayed" and report on it at once.
//  3. THE CHURCH CAN TAKE IT DOWN. Any reader can report a request. Once
//     REPORTS_TO_HIDE different phones have, it stops being shown — nobody has
//     to be awake at the time for that to happen.
//  4. NOTHING STAYS FOR EVER. A request is deleted RETENTION_DAYS after it was
//     shared, from the Worker's hourly cron.
//
//  5. REACTIONS ARE TAPPED, NEVER TYPED. One of REACTIONS below, once per phone
//     each, tapped again to take it back. 🙌 opens only once a request has been
//     marked answered.
//  6. ONLY THE SHARER SAYS IT WAS ANSWERED. POST /answer with the sharing
//     token marks it, with a note of up to NOTE_MAX characters.
//
// A reaction and a report are counted once per phone: the phone sends a random
// id it made itself, and the server keeps only its SHA-256.

import { cleanAvatar, addMissingColumns } from './next-play.js';

export const RETENTION_DAYS = 30;
export const REPORTS_TO_HIDE = 3;
export const SHARES_PER_DAY = 5;
export const NOTE_MAX = 280;
const WALL_SIZE = 50;

/** What can be said about a request — tapped, never typed. `prayed` predates the rest. */
export const REACTIONS = { prayed: '🙏', love: '❤️', with: '🤝', praise: '🙌' };

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const clean = (value, max) => String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export async function ensureAdultPrayerSchema(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS adult_prayers (
      id          TEXT PRIMARY KEY,
      first_name  TEXT NOT NULL,
      content     TEXT NOT NULL,
      token_hash  TEXT NOT NULL,
      device_hash TEXT NOT NULL,
      created_ms  INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS adult_prayer_marks (
      prayer_id   TEXT NOT NULL,
      device_hash TEXT NOT NULL,
      kind        TEXT NOT NULL,
      PRIMARY KEY (prayer_id, device_hash, kind)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_adult_prayers_created ON adult_prayers (created_ms DESC)`),
  ]);
  // Added after the wall first shipped. Look first, and ALTER only what is
  // missing: a schema change on every request — even one that fails at once
  // because the column exists — is the slowest thing D1 does, and three of
  // them before every read is how the wall came to time out on phones.
  await addMissingColumns(db, 'adult_prayers', [['answered_ms', 'INTEGER'], ['answered_note', 'TEXT'], ['avatar', 'TEXT']]);
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** A phone's own random id: 32–64 hex characters, never anything about the person. */
const deviceOf = (value) => (/^[0-9a-f]{32,64}$/i.test(String(value || '')) ? String(value).toLowerCase() : null);

async function wall(db, device) {
  const since = Date.now() - RETENTION_DAYS * 86400000;
  const { results } = await db.prepare(
    `SELECT p.id, p.first_name, p.content, p.created_ms, p.answered_ms, p.answered_note, p.avatar,
       (SELECT COUNT(*) FROM adult_prayer_marks m WHERE m.prayer_id = p.id AND m.kind = 'report') AS reports
     FROM adult_prayers p WHERE p.created_ms > ? ORDER BY p.created_ms DESC LIMIT ${WALL_SIZE * 2}`
  ).bind(since).all();
  const shown = (results || []).filter((row) => row.reports < REPORTS_TO_HIDE).slice(0, WALL_SIZE);
  const counts = new Map(shown.map((row) => [row.id, Object.fromEntries(Object.keys(REACTIONS).map((k) => [k, 0]))]));
  const yours = new Map(shown.map((row) => [row.id, []]));
  const { results: tallies } = await db.prepare(
    `SELECT prayer_id, kind, COUNT(*) AS n FROM adult_prayer_marks WHERE kind != 'report' GROUP BY prayer_id, kind`
  ).all();
  for (const row of tallies || []) if (counts.has(row.prayer_id) && REACTIONS[row.kind]) counts.get(row.prayer_id)[row.kind] = row.n;
  if (device) {
    const { results: marks } = await db.prepare(
      `SELECT prayer_id, kind FROM adult_prayer_marks WHERE device_hash = ? AND kind != 'report'`
    ).bind(await sha256(device)).all();
    for (const row of marks || []) if (yours.has(row.prayer_id)) yours.get(row.prayer_id).push(row.kind);
  }
  return shown.map((row) => ({
    id: row.id, firstName: row.first_name, text: row.content, at: row.created_ms,
    avatar: row.avatar || null,
    answered: row.answered_ms ? { at: row.answered_ms, note: row.answered_note || '' } : null,
    reactions: counts.get(row.id),
    yourReactions: yours.get(row.id),
    // Kept for a phone still running the first version of the wall.
    prayed: counts.get(row.id).prayed,
    prayedByYou: yours.get(row.id).includes('prayed'),
  }));
}

export async function handleAdultPrayers(request, env, url) {
  try {
    return await route(request, env, url);
  } catch (err) {
    // Said plainly, so the wall can show why rather than a bare "could not
    // be reached" — nothing in it identifies anyone.
    return json({ configured: true, error: { message: `The prayer wall hit a server error: ${err.message}` } }, 500);
  }
}

async function route(request, env, url) {
  if (!env.KASAMA_DB) return json({ configured: false });
  const db = env.KASAMA_DB;
  await ensureAdultPrayerSchema(db);
  const path = url.pathname.replace(/^\/api\/adults\/prayers/, '') || '/';

  // GET /api/adults/prayers — the wall, newest first
  if (request.method === 'GET' && path === '/') {
    return json({ configured: true, prayers: await wall(db, deviceOf(request.headers.get('x-prayer-device'))) });
  }

  if (request.method !== 'POST') return json({ error: { message: 'Method not allowed' } }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: { message: 'Invalid JSON body' } }, 400); }
  const device = deviceOf(body.device);
  if (!device) return json({ error: { message: 'This phone could not be recognised.' } }, 400);
  const deviceHash = await sha256(device);

  // POST /api/adults/prayers { text, firstName, device } — share one request
  if (path === '/') {
    const text = clean(body.text, 500);
    const firstName = clean(body.firstName, 40);
    if (text.length < 5) return json({ error: { message: 'Write a little more first.' } }, 400);
    if (!firstName) return json({ error: { message: 'A shared request is signed with your first name.' } }, 400);
    const today = await db.prepare(`SELECT COUNT(*) AS n FROM adult_prayers WHERE device_hash = ? AND created_ms > ?`)
      .bind(deviceHash, Date.now() - 86400000).first();
    if (today && today.n >= SHARES_PER_DAY) return json({ error: { message: 'That is plenty shared for one day.' } }, 429);
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
    const id = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO adult_prayers (id, first_name, content, token_hash, device_hash, created_ms, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, firstName, text, await sha256(token), deviceHash, Date.now(), cleanAvatar(body.avatar, 'adults')).run();
    return json({ configured: true, shared: true, id, token });
  }

  const id = clean(body.id, 64);
  const prayer = id ? await db.prepare(`SELECT id, token_hash, answered_ms FROM adult_prayers WHERE id = ?`).bind(id).first() : null;
  if (!prayer) return json({ error: { message: 'That request is no longer on the wall.' } }, 404);

  // POST /react { id, device, kind } — one of REACTIONS, once per phone; again takes it back
  // POST /pray { id, device } — the first version's "I prayed", kept as 🙏
  if (path === '/react' || path === '/pray') {
    const kind = path === '/pray' ? 'prayed' : String(body.kind || '');
    if (!REACTIONS[kind]) return json({ error: { message: 'Pick a reaction from the list.' } }, 400);
    if (kind === 'praise' && !prayer.answered_ms) return json({ error: { message: '🙌 opens once it has been answered.' } }, 400);
    const had = await db.prepare(`SELECT 1 AS y FROM adult_prayer_marks WHERE prayer_id = ? AND device_hash = ? AND kind = ?`)
      .bind(prayer.id, deviceHash, kind).first();
    if (had && path === '/react') {
      await db.prepare(`DELETE FROM adult_prayer_marks WHERE prayer_id = ? AND device_hash = ? AND kind = ?`).bind(prayer.id, deviceHash, kind).run();
    } else if (!had) {
      await db.prepare(`INSERT INTO adult_prayer_marks (prayer_id, device_hash, kind) VALUES (?, ?, ?)`).bind(prayer.id, deviceHash, kind).run();
    }
    const count = await db.prepare(`SELECT COUNT(*) AS n FROM adult_prayer_marks WHERE prayer_id = ? AND kind = ?`)
      .bind(prayer.id, kind).first();
    return json({ configured: true, id: prayer.id, kind, count: count ? count.n : 0, yours: !(had && path === '/react'), [kind]: count ? count.n : 0 });
  }

  // POST /report { id, device } — once per phone; enough of them hides it
  if (path === '/report') {
    await db.prepare(`INSERT OR IGNORE INTO adult_prayer_marks (prayer_id, device_hash, kind) VALUES (?, ?, 'report')`)
      .bind(prayer.id, deviceHash).run();
    return json({ configured: true, id: prayer.id, reported: true });
  }

  // POST /answer { id, token, note } — the sharer says it was answered; an empty
  // note is fine, and { answered: false } takes the mark back off.
  if (path === '/answer') {
    if (typeof body.token !== 'string' || (await sha256(body.token)) !== prayer.token_hash) {
      return json({ error: { message: 'Only the phone that shared it can mark it answered.' } }, 403);
    }
    if (body.answered === false) {
      await db.prepare(`UPDATE adult_prayers SET answered_ms = NULL, answered_note = NULL WHERE id = ?`).bind(prayer.id).run();
      await db.prepare(`DELETE FROM adult_prayer_marks WHERE prayer_id = ? AND kind = 'praise'`).bind(prayer.id).run();
      return json({ configured: true, answered: null });
    }
    const note = clean(body.note, NOTE_MAX);
    const at = Date.now();
    await db.prepare(`UPDATE adult_prayers SET answered_ms = ?, answered_note = ? WHERE id = ?`).bind(at, note, prayer.id).run();
    return json({ configured: true, answered: { at, note } });
  }

  // POST /remove { id, token, device } — the sender takes it back
  if (path === '/remove') {
    if (typeof body.token !== 'string' || (await sha256(body.token)) !== prayer.token_hash) {
      return json({ error: { message: 'Only the phone that shared it can take it down.' } }, 403);
    }
    await removeAll(db, prayer.id);
    return json({ configured: true, removed: true });
  }

  return json({ error: { message: 'Not found' } }, 404);
}

async function removeAll(db, id) {
  await db.batch([
    db.prepare(`DELETE FROM adult_prayer_marks WHERE prayer_id = ?`).bind(id),
    db.prepare(`DELETE FROM adult_prayers WHERE id = ?`).bind(id),
  ]);
}

/** Requests older than RETENTION_DAYS, and what was marked on them, are deleted. */
export async function sweepAdultPrayers(env) {
  if (!env.KASAMA_DB) return;
  const db = env.KASAMA_DB;
  await ensureAdultPrayerSchema(db);
  const { results } = await db.prepare(`SELECT id FROM adult_prayers WHERE created_ms < ?`)
    .bind(Date.now() - RETENTION_DAYS * 86400000).all();
  for (const row of results || []) await removeAll(db, row.id);
}
