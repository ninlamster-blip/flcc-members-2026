// =============================================================================
// FLCC Ask FLCC — Cloudflare Worker Proxy
// =============================================================================
//
// SETUP INSTRUCTIONS (5 minutes):
//
//  1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
//  2. Click "Edit code", paste the entire contents of this file, click Deploy
//  3. Go to your Worker → Settings → Variables and Secrets
//  4. Click "Add variable" → Type: Secret
//     Name:  ANTHROPIC_API_KEY
//     Value: your sk-ant-... key from console.anthropic.com
//  5. (Recommended) Add another Secret to restrict who can use the proxy:
//     Name:  PROXY_SECRET
//     Value: any password you choose (share this with your members)
//  6. Click Save and Deploy
//  7. Copy your Worker URL  (e.g. https://flcc-ask.yourname.workers.dev)
//  8. Open the app → Ask FLCC tab → enter the Worker URL + Proxy Secret
//
// That's it — all members can now use Ask FLCC with no API key setup.
// The worker also serves GET /news — live RSS headlines from trusted sources.
//
// OPTIONAL — Daily Blessing community counter:
//  Go to your Worker → Settings → Bindings → Add binding → KV Namespace,
//  create (or pick) a namespace, and name the binding DAILY_BLESSING_KV.
//  This powers the real "members opened today" count on the Daily Blessing
//  Community tab. Without it, that tab just shows a local-only message.
// =============================================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-proxy-secret',
};

// ── RSS feeds served via GET /news ────────────────────────────────────────────
const RSS_FEEDS = [
  // International
  { name: 'BBC News',     icon: '🌐', url: 'https://feeds.bbci.co.uk/news/rss.xml'             },
  { name: 'The Guardian', icon: '🗞️', url: 'https://www.theguardian.com/world/rss'             },
  { name: 'NPR News',     icon: '📻', url: 'https://feeds.npr.org/1001/rss.xml'                },
  { name: 'Al Jazeera',  icon: '📡', url: 'https://www.aljazeera.com/xml/rss/all.xml'         },
  // Philippines
  { name: 'ABS-CBN',     icon: '🇵🇭', url: 'https://news.abs-cbn.com/rss/headlines'           },
  { name: 'Inquirer',    icon: '📰', url: 'https://newsinfo.inquirer.net/feed'                 },
  { name: 'GMA News',    icon: '📺', url: 'https://www.gmanetwork.com/news/rss/news/feed.xml' },
];

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?count=6&rss_url=';

function clean(str) {
  return (str || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchNewsFeed(feed) {
  const res = await fetch(RSS2JSON + encodeURIComponent(feed.url), {
    headers: { 'Accept': 'application/json' },
    cf: { cacheTtl: 300 },
  });
  if (!res.ok) throw new Error(`rss2json ${res.status} for ${feed.name}`);
  const data = await res.json();
  if (data.status !== 'ok' || !data.items?.length) throw new Error(`empty: ${feed.name}`);
  return data.items.slice(0, 6).map(item => {
    const raw = clean(item.description || item.content || '');
    const summary = raw.length > 130 ? raw.slice(0, 130).trimEnd() + '…' : raw;
    return {
      id: item.guid || item.link || item.title,
      headline: clean(item.title || ''),
      summary,
      date: (item.pubDate || '').slice(0, 10),
      source: feed.name,
      sourceIcon: feed.icon,
      link: item.link || '',
    };
  });
}

export default {
  async fetch(request, env) {
    // Top-level catch — every response gets CORS headers, nothing escapes as a bare Cloudflare error
    try {
      return await handleRequest(request, env);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { message: `Worker error: ${err.message}` } }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
  },
};

async function handleRequest(request, env) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);

  // ── GET /ping — health check ──────────────────────────────────────────────
  if (request.method === 'GET' && url.pathname === '/ping') {
    return new Response(JSON.stringify({
      ok: true,
      keySet: !!env.ANTHROPIC_API_KEY,
      assetsBinding: !!env.ASSETS,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ── GET /news — live RSS headlines via rss2json (cached 5 min at edge) ────
  if (request.method === 'GET' && url.pathname === '/news') {
    const settled = await Promise.allSettled(RSS_FEEDS.map(fetchNewsFeed));
    const items = settled
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .slice(0, 21);
    return new Response(JSON.stringify({ items }), {
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  }

  // ── /api/daily-blessing/community — anonymous daily open counter ─────────
  if (url.pathname === '/api/daily-blessing/community') {
    return handleDailyBlessingCommunity(request, env, url);
  }

  // ── /api/prayers — FLCC Kasama anonymous Kadena ng Panalangin (D1) ────────
  if (url.pathname === '/api/prayers' || url.pathname === '/api/prayers/pray') {
    return handlePrayerChain(request, env, url);
  }

  // ── All other non-POST requests ──────────────────────────────────────────
  // Static files (HTML, JSON, etc.) are served directly by Cloudflare's edge
  // before the Worker runs, so env.ASSETS is not available here.
  if (request.method !== 'POST') {
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404, headers: CORS });
  }

  // ── POST /tts → natural voice for FLCC Kasama spoken replies ─────────────
  // Optional: proxies ElevenLabs text-to-speech so members hear a warm human
  // voice instead of the phone's robotic one. To enable, add a Secret named
  // ELEVENLABS_API_KEY on this Worker (free key at elevenlabs.io — the free
  // tier covers ~10k characters per month). Optionally set ELEVENLABS_VOICE_ID
  // to pick a different voice. Without the key, the app simply stays silent.
  if (url.pathname === '/tts') {
    if (env.PROXY_SECRET) {
      const incoming = request.headers.get('x-proxy-secret') || '';
      if (incoming !== env.PROXY_SECRET) {
        return new Response(
          JSON.stringify({ error: { message: 'Invalid proxy secret.' } }),
          { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } }
        );
      }
    }
    if (!env.ELEVENLABS_API_KEY) {
      return new Response(
        JSON.stringify({ error: { message: 'Natural voice not configured on this Worker.' } }),
        { status: 501, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
    let ttsBody;
    try {
      ttsBody = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid JSON body' } }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
    const text = String(ttsBody.text || '').slice(0, 600).trim();
    if (!text) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing text' } }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
    // "Sarah" — a warm, natural female voice; multilingual model handles Taglish.
    const voiceId = env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL';
    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );
    if (!ttsResp.ok) {
      const detail = await ttsResp.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: { message: `Voice service error (${ttsResp.status}): ${detail.slice(0, 200)}` } }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(ttsResp.body, {
      headers: { ...CORS, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  }

  // ── POST /proxy → Anthropic proxy (explicit path avoids asset-routing conflicts) ──
  // Also accept POST to any path for backwards compatibility
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY secret not set on the Worker. See setup instructions.' } }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  // Optional shared-secret gate — only enforced when PROXY_SECRET is set
  if (env.PROXY_SECRET) {
    const incoming = request.headers.get('x-proxy-secret') || '';
    if (incoming !== env.PROXY_SECRET) {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid proxy secret. Ask your church admin for the correct password.' } }),
        { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: { message: 'Invalid JSON body' } }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  let anthropicResp;
  try {
    anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: `Worker could not reach Anthropic API: ${err.message}` } }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(anthropicResp.body, {
    status: anthropicResp.status,
    headers: {
      ...CORS,
      'Content-Type': anthropicResp.headers.get('Content-Type') || 'application/json',
    },
  });
}

// ── FLCC Kasama — Kadena ng Panalangin (anonymous prayer chain) ─────────────
// Backed by a D1 database bound as KASAMA_DB (see wrangler.toml and
// ask-proxy/schema.sql). Privacy by design: no names, no accounts — the only
// per-user value stored is user_hash, a SHA-256 the device computes from its
// own random id + the prayer id. It cannot be linked back to any person; it
// exists purely so one device can't inflate a count by tapping twice.

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Lazily create the tables so binding the database is the only setup step.
let kasamaSchemaReady = false;
async function ensurePrayerSchema(db) {
  if (kasamaSchemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS prayers (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      mood_tag TEXT,
      country_code TEXT,
      prayer_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS prayer_interactions (
      id TEXT PRIMARY KEY,
      prayer_id TEXT NOT NULL,
      user_hash TEXT NOT NULL
    )`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_prayer_interactions_unique
      ON prayer_interactions (prayer_id, user_hash)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_prayers_created_at
      ON prayers (created_at DESC)`),
  ]);
  kasamaSchemaReady = true;
}

async function handlePrayerChain(request, env, url) {
  if (!env.KASAMA_DB) {
    // Not configured — the app shows a gentle "malapit na" note instead.
    return jsonResponse({ configured: false });
  }
  const db = env.KASAMA_DB;
  await ensurePrayerSchema(db);

  // GET /api/prayers — the most recent requests from kapatid around the world
  if (request.method === 'GET' && url.pathname === '/api/prayers') {
    const { results } = await db.prepare(
      `SELECT id, content, mood_tag, country_code, prayer_count, created_at
       FROM prayers ORDER BY created_at DESC LIMIT 30`
    ).all();
    return jsonResponse({ configured: true, prayers: results || [] });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method not allowed' } }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: { message: 'Invalid JSON body' } }, 400);
  }

  // POST /api/prayers — leave an anonymous prayer request
  if (url.pathname === '/api/prayers') {
    const content = String(body.content || '').replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (content.length < 5) {
      return jsonResponse({ error: { message: 'Kulang pa ang mensahe — isulat mo lang nang kaunti pa, kapatid.' } }, 400);
    }
    const moodTag = String(body.moodTag || '').slice(0, 30);
    const countryCode = /^[A-Z]{2,3}$/.test(String(body.countryCode || '')) ? body.countryCode : null;
    const prayer = {
      id: crypto.randomUUID(),
      content,
      mood_tag: moodTag || null,
      country_code: countryCode,
      prayer_count: 0,
    };
    await db.prepare(
      `INSERT INTO prayers (id, content, mood_tag, country_code) VALUES (?, ?, ?, ?)`
    ).bind(prayer.id, prayer.content, prayer.mood_tag, prayer.country_code).run();
    return jsonResponse({ configured: true, prayer });
  }

  // POST /api/prayers/pray — "Sinasamahan kita sa panalangin"
  if (url.pathname === '/api/prayers/pray') {
    const prayerId = String(body.prayerId || '');
    const userHash = String(body.userHash || '');
    if (!/^[0-9a-f-]{8,64}$/i.test(prayerId) || !/^[0-9a-f]{64}$/i.test(userHash)) {
      return jsonResponse({ error: { message: 'Invalid prayerId or userHash' } }, 400);
    }
    const insert = await db.prepare(
      `INSERT OR IGNORE INTO prayer_interactions (id, prayer_id, user_hash) VALUES (?, ?, ?)`
    ).bind(crypto.randomUUID(), prayerId, userHash).run();

    if ((insert.meta?.changes ?? 0) === 0) {
      // Same kapatid, same prayer — already counted, and that's beautiful too.
      return jsonResponse({ configured: true, counted: false, message: 'Sinalo na natin ito dati pa. 🤍' });
    }
    await db.prepare(
      `UPDATE prayers SET prayer_count = prayer_count + 1 WHERE id = ?`
    ).bind(prayerId).run();
    const row = await db.prepare(`SELECT prayer_count FROM prayers WHERE id = ?`).bind(prayerId).first();
    return jsonResponse({
      configured: true,
      counted: true,
      prayerCount: row?.prayer_count ?? null,
      message: 'Salamat, kapatid — dinala mo siya sa panalangin. 🤍',
    });
  }

  return jsonResponse({ error: { message: 'Not found' } }, 404);
}

// ── Daily Blessing community counter ────────────────────────────────────────
// Optional: only works once a KV namespace is bound to this Worker as
// DAILY_BLESSING_KV (Workers & Pages → your Worker → Settings → Bindings →
// add a KV namespace binding named DAILY_BLESSING_KV). Without it, the app's
// Community tab gracefully falls back to a local-only message — nothing
// breaks. Counts are anonymous: only a random per-device id (no member
// identity) is stored, purely to avoid one device inflating the count.
async function handleDailyBlessingCommunity(request, env, url) {
  if (!env.DAILY_BLESSING_KV) {
    return new Response(JSON.stringify({ configured: false }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const date = url.searchParams.get('date') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ error: { message: 'Invalid or missing date' } }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const countKey = `count:${date}`;

  if (request.method === 'GET') {
    const count = parseInt(await env.DAILY_BLESSING_KV.get(countKey), 10) || 0;
    return new Response(JSON.stringify({ configured: true, date, count }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: { message: 'Invalid JSON body' } }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const deviceId = String(body.deviceId || '').slice(0, 64);
    if (!deviceId) {
      return new Response(JSON.stringify({ error: { message: 'Missing deviceId' } }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const dedupeKey = `opened:${date}:${deviceId}`;
    const alreadyCounted = await env.DAILY_BLESSING_KV.get(dedupeKey);
    if (!alreadyCounted) {
      const count = (parseInt(await env.DAILY_BLESSING_KV.get(countKey), 10) || 0) + 1;
      await env.DAILY_BLESSING_KV.put(countKey, String(count), { expirationTtl: 60 * 60 * 24 * 3 });
      await env.DAILY_BLESSING_KV.put(dedupeKey, '1', { expirationTtl: 60 * 60 * 24 * 3 });
    }
    const count = parseInt(await env.DAILY_BLESSING_KV.get(countKey), 10) || 0;
    return new Response(JSON.stringify({ configured: true, date, count }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
    status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
