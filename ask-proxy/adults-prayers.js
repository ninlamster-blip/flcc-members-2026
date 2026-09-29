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
// "I prayed" and a report are counted once per phone: the phone sends a random
// id it made itself, and the server keeps only its SHA-256.

export const RETENTION_DAYS = 30;
export const REPORTS_TO_HIDE = 3;
export const SHARES_PER_DAY = 5;
const WALL_SIZE = 50;

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
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** A phone's own random id: 32–64 hex characters, never anything about the person. */
const deviceOf = (value) => (/^[0-9a-f]{32,64}$/i.test(String(value || '')) ? String(value).toLowerCase() : null);

async function wall(db, device) {
  const since = Date.now() - RETENTION_DAYS * 86400000;
  const { results } = await db.prepare(
    `SELECT p.id, p.first_name, p.content, p.created_ms,
       (SELECT COUNT(*) FROM adult_prayer_marks m WHERE m.prayer_id = p.id AND m.kind = 'prayed') AS prayed,
       (SELECT COUNT(*) FROM adult_prayer_marks m WHERE m.prayer_id = p.id AND m.kind = 'report') AS reports
     FROM adult_prayers p WHERE p.created_ms > ? ORDER BY p.created_ms DESC LIMIT ${WALL_SIZE * 2}`
  ).bind(since).all();
  let mine = new Set();
  if (device) {
    const { results: marks } = await db.prepare(
      `SELECT prayer_id FROM adult_prayer_marks WHERE device_hash = ? AND kind = 'prayed'`
    ).bind(await sha256(device)).all();
    mine = new Set((marks || []).map((row) => row.prayer_id));
  }
  return (results || [])
    .filter((row) => row.reports < REPORTS_TO_HIDE)
    .slice(0, WALL_SIZE)
    .map((row) => ({
      id: row.id, firstName: row.first_name, text: row.content, at: row.created_ms,
      prayed: row.prayed, prayedByYou: mine.has(row.id),
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
      `INSERT INTO adult_prayers (id, first_name, content, token_hash, device_hash, created_ms) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, firstName, text, await sha256(token), deviceHash, Date.now()).run();
    return json({ configured: true, shared: true, id, token });
  }

  const id = clean(body.id, 64);
  const prayer = id ? await db.prepare(`SELECT id, token_hash FROM adult_prayers WHERE id = ?`).bind(id).first() : null;
  if (!prayer) return json({ error: { message: 'That request is no longer on the wall.' } }, 404);

  // POST /pray { id, device } — "I prayed", once per phone
  // POST /report { id, device } — once per phone; enough of them hides it
  if (path === '/pray' || path === '/report') {
    const kind = path === '/pray' ? 'prayed' : 'report';
    await db.prepare(`INSERT OR IGNORE INTO adult_prayer_marks (prayer_id, device_hash, kind) VALUES (?, ?, ?)`)
      .bind(prayer.id, deviceHash, kind).run();
    const count = await db.prepare(`SELECT COUNT(*) AS n FROM adult_prayer_marks WHERE prayer_id = ? AND kind = ?`)
      .bind(prayer.id, kind).first();
    return json({ configured: true, id: prayer.id, [kind]: count ? count.n : 0 });
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
