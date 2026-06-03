// =============================================================================
// FLCC — Cloudflare Worker  (AI Proxy + Daily Greeting Cron)
// =============================================================================
//
// Required secrets (Workers & Pages → Settings → Variables & Secrets):
//   ANTHROPIC_API_KEY         — Claude AI proxy key (sk-ant-...)
//
// Optional secrets for fully-automated WhatsApp greetings:
//   WHATSAPP_ACCESS_TOKEN     — Meta System User permanent token
//   WHATSAPP_PHONE_NUMBER_ID  — WhatsApp Business phone number ID
//   DATA_URL                  — Override URL for data.json (default: GitHub raw)
//
// Cron trigger fires daily at 04:00 UTC = 07:00 Kuwait time.
// Add member WhatsApp numbers via greetings.html → Member Contacts → Export.
// =============================================================================

const DATA_JSON_URL =
  'https://raw.githubusercontent.com/ninlamster-blip/flcc-members-2026/main/data.json';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const pad2 = n => String(n).padStart(2, '0');
const todayMMDD = () => {
  const d = new Date();
  return `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── greeting messages ─────────────────────────────────────────────────────────
const greetingMsg = {
  birthday: name =>
    `🎂 Happy Birthday, ${name}!\n\nMay God shower you with His abundant blessings today and always. You are a cherished member of our FLCC family and we thank God for you! 🙏\n\nWith love and prayers,\nFLCC - Abundance Church 🕊️`,
  anniversary: name =>
    `💑 Happy Anniversary, ${name}!\n\nMay God continue to bless and strengthen your marriage. Your love story reflects His grace and goodness. 🙏\n\nWith love and prayers,\nFLCC - Abundance Church 🕊️`,
  baptism: name =>
    `✝️ Happy Baptism Anniversary, ${name}!\n\nWhat a beautiful day — the day you publicly declared your faith in Jesus! May your walk with God grow richer every year. 🙏\n\nWith love and prayers,\nFLCC - Abundance Church 🕊️`,
};

// ── WhatsApp Cloud API ────────────────────────────────────────────────────────
async function sendWhatsApp(env, toNumber, message) {
  const url = `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toNumber.replace(/\D/g, ''),
      type: 'text',
      text: { body: message, preview_url: false },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => resp.status);
    console.error(`WhatsApp API error for ${toNumber}:`, err);
  }
  return resp.ok;
}

// ── daily greeting logic ──────────────────────────────────────────────────────
async function runDailyGreetings(env) {
  const dataUrl = env.DATA_URL || DATA_JSON_URL;
  const dataResp = await fetch(dataUrl, { cf: { cacheTtl: 300 } });
  if (!dataResp.ok) {
    console.error('Failed to fetch data.json:', dataResp.status);
    return { error: `data.json fetch failed (${dataResp.status})`, results: [] };
  }

  const data = await dataResp.json();
  const mmdd = todayMMDD();
  const isoToday = todayISO();
  const apiReady = !!(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
  const results = [];

  // worker birthday / anniversary / baptism
  for (const w of data.workers || []) {
    if (w.type !== 'individual' || w.status !== 'active') continue;
    const name = `${w.title ? w.title + ' ' : ''}${w.name}`;
    const waNumber = (w.whatsapp || '').replace(/\D/g, '');

    const checks = [
      { field: 'birthday',    type: 'birthday'    },
      { field: 'anniversary', type: 'anniversary' },
      { field: 'baptismDate', type: 'baptism'     },
    ];

    for (const { field, type } of checks) {
      if (w[field] !== mmdd) continue;
      const message = (greetingMsg[type] || greetingMsg.birthday)(name);
      const result = { memberId: w.id, name, type, whatsapp: w.whatsapp || '', sent: false, note: '' };

      if (apiReady && waNumber) {
        result.sent = await sendWhatsApp(env, waNumber, message);
        result.note = result.sent ? 'sent via WhatsApp API' : 'WhatsApp API error — check logs';
      } else if (!apiReady) {
        result.note = 'WhatsApp API not configured — use greetings.html for manual send';
      } else {
        result.note = 'no WhatsApp number — add via greetings.html → Member Contacts';
      }

      console.log(`[greetings] ${result.sent ? '✓' : '○'} ${name} (${type}) — ${result.note}`);
      results.push(result);
    }
  }

  // one-off or yearly events in events array
  for (const ev of data.events || []) {
    if (!ev.date) continue;
    const evMMDD = ev.date.slice(5);
    const isToday = (ev.recurrence === 'yearly' && evMMDD === mmdd) || ev.date === isoToday;
    if (!isToday) continue;
    results.push({ eventId: ev.id, title: ev.title, type: ev.type, note: 'event — use greetings.html to send' });
    console.log(`[greetings] event today: ${ev.title}`);
  }

  console.log(`[greetings] done — ${results.length} event(s) for ${mmdd}`);
  return { date: mmdd, total: results.length, apiReady, results };
}

// ── export ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

    // status endpoint: GET /api/greetings/today
    if (request.method === 'GET' && url.pathname === '/api/greetings/today') {
      const result = await runDailyGreetings(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // static assets (HTML, JSON, etc.)
    if (request.method !== 'POST') {
      return env.ASSETS.fetch(request);
    }

    // Claude AI proxy
    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY secret not set on the Worker. See setup instructions.' } }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try { body = await request.json(); }
    catch {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid JSON body' } }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    return new Response(anthropicResp.body, {
      status: anthropicResp.status,
      headers: {
        ...CORS,
        'Content-Type': anthropicResp.headers.get('Content-Type') || 'application/json',
      },
    });
  },

  // Cron trigger — fires daily at 04:00 UTC (07:00 Kuwait / Arabia Standard Time)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyGreetings(env));
  },
};
