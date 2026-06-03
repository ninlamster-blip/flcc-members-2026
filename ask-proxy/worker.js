// =============================================================================
// FLCC — Cloudflare Worker  (AI Proxy + Daily Greeting & Reminder Cron)
// =============================================================================
//
// Required secrets (Workers & Pages → Settings → Variables & Secrets):
//   ANTHROPIC_API_KEY         — Claude AI proxy key (sk-ant-...)
//
// Optional secrets for fully-automated WhatsApp messages:
//   WHATSAPP_ACCESS_TOKEN     — Meta System User permanent token
//   WHATSAPP_PHONE_NUMBER_ID  — WhatsApp Business phone number ID
//   DATA_URL                  — Override URL for data.json (default: GitHub raw)
//
// Cron fires daily at 04:00 UTC = 07:00 Kuwait / Arabia Standard Time.
// Sends:
//   1. Birthday / anniversary / baptism greetings on the member's day
//   2. Schedule assignment reminders 3 days and 1 day before each service
// =============================================================================

const DATA_JSON_URL =
  'https://raw.githubusercontent.com/ninlamster-blip/flcc-members-2026/main/data.json';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const pad2 = n => String(n).padStart(2, '0');
const todayMMDD = () => { const d = new Date(); return `${pad2(d.getUTCMonth()+1)}-${pad2(d.getUTCDate())}`; };
const dateISO = daysAhead => { const d = new Date(); d.setUTCDate(d.getUTCDate()+daysAhead); return d.toISOString().slice(0,10); };
const dateLong = iso => new Date(iso+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

const ROLE_LABELS = {
  presider:            'Presider',
  songLeader:          'Song Leader',
  preacher:            'Preacher / Exhorter',
  pastoralPrayer:      'Pastoral Prayer',
  communionAssistant1: 'Communion Assistant 1',
  communionAssistant2: 'Communion Assistant 2',
  foodInCharge:        'Food In Charge',
};

// ── message builders ───────────────────────────────────────────────────────────────
const greetingMsg = {
  birthday:    name => `🎂 Happy Birthday, ${name}!\n\nMay God shower you with His abundant blessings today and always. You are a cherished member of our FLCC family and we thank God for you! 🙏\n\nWith love and prayers,\nFLCC - Abundance Church 🕊️`,
  anniversary: name => `💑 Happy Anniversary, ${name}!\n\nMay God continue to bless and strengthen your marriage. Your love story reflects His grace and goodness. 🙏\n\nWith love and prayers,\nFLCC - Abundance Church 🕊️`,
  baptism:     name => `✝️ Happy Baptism Anniversary, ${name}!\n\nWhat a beautiful day — the day you publicly declared your faith in Jesus! May your walk with God grow richer every year. 🙏\n\nWith love and prayers,\nFLCC - Abundance Church 🕊️`,
};

const reminderMsg = (name, role, service, daysAhead, dateStr) =>
  daysAhead === 1
    ? `⏰ Hi ${name}!\n\nJust a quick reminder: you are assigned as ${role} for our ${service} service TOMORROW, ${dateStr}.\n\nWe look forward to serving together! God bless your final preparations! 🙏\n\nFLCC - Abundance Church 🕊️`
    : `📋 Hi ${name}!\n\nThis is a gentle reminder that you are assigned as ${role} for our ${service} service on ${dateStr} (3 days from now).\n\nPlease prepare your heart and any materials needed. May God fill you with His wisdom and anointing! 🙏\n\nSee you there!\nFLCC - Abundance Church 🕊️`;

// ── WhatsApp Cloud API ─────────────────────────────────────────────────────────
async function sendWhatsApp(env, toNumber, message) {
  const url = `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product:'whatsapp', to:toNumber.replace(/\D/g,''), type:'text', text:{ body:message, preview_url:false } }),
  });
  if (!resp.ok) console.error(`WhatsApp error for ${toNumber}:`, await resp.text().catch(()=>resp.status));
  return resp.ok;
}

async function maybeSend(env, apiReady, waNumber, message, result) {
  if (apiReady && waNumber) {
    result.sent = await sendWhatsApp(env, waNumber, message);
    result.note = result.sent ? 'sent via WhatsApp API' : 'WhatsApp API error — check logs';
  } else if (!apiReady) {
    result.note = 'WhatsApp API not configured — use greetings.html for manual send';
  } else {
    result.note = 'no WhatsApp number — add via greetings.html → Contacts';
  }
  console.log(`[greetings] ${result.sent?'✓':'○'} ${result.name||result.title} (${result.type||result.role}) — ${result.note}`);
}

// ── main cron logic ──────────────────────────────────────────────────────────────
async function runDailyGreetings(env) {
  const dataUrl = env.DATA_URL || DATA_JSON_URL;
  const dataResp = await fetch(dataUrl, { cf:{ cacheTtl:300 } });
  if (!dataResp.ok) { console.error('data.json fetch failed:', dataResp.status); return { error:`fetch failed (${dataResp.status})`, results:[] }; }
  const data = await dataResp.json();

  const mmdd = todayMMDD();
  const isoToday = dateISO(0);
  const apiReady = !!(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
  const results = [];

  // 1. Birthday / anniversary / baptism greetings
  for (const w of data.workers||[]) {
    if (w.type!=='individual'||w.status!=='active') continue;
    const name = `${w.title?w.title+' ':''}${w.name}`;
    const waNumber = (w.whatsapp||'').replace(/\D/g,'');
    for (const [field, type] of [['birthday','birthday'],['anniversary','anniversary'],['baptismDate','baptism']]) {
      if (w[field]!==mmdd) continue;
      const message = (greetingMsg[type]||greetingMsg.birthday)(name);
      const result = { memberId:w.id, name, type, whatsapp:w.whatsapp||'', sent:false, note:'' };
      await maybeSend(env, apiReady, waNumber, message, result);
      results.push(result);
    }
  }

  // 2. Yearly events (data.events array)
  for (const ev of data.events||[]) {
    if (!ev.date) continue;
    const isToday = (ev.recurrence==='yearly' && ev.date.slice(5)===mmdd) || ev.date===isoToday;
    if (!isToday) continue;
    results.push({ eventId:ev.id, title:ev.title, type:ev.type, note:'event — use greetings.html to send' });
    console.log(`[greetings] event today: ${ev.title}`);
  }

  // 3. Schedule assignment reminders (1-day and 3-day advance)
  for (const daysAhead of [1, 3]) {
    const targetDate = dateISO(daysAhead);
    const service = (data.schedule||[]).find(s => s.date===targetDate);
    if (!service) continue;
    const dateStr = dateLong(targetDate);

    for (const [roleKey, workerId] of Object.entries(service.roles||{})) {
      if (!workerId) continue;
      const worker = (data.workers||[]).find(w => w.id===workerId);
      if (!worker||worker.status!=='active') continue;
      const name = `${worker.title?worker.title+' ':''}${worker.name}`;
      const waNumber = (worker.whatsapp||'').replace(/\D/g,'');
      const role = ROLE_LABELS[roleKey]||roleKey;
      const message = reminderMsg(name, role, service.service, daysAhead, dateStr);
      const result = { memberId:worker.id, name, type:`reminder-${daysAhead}day`, role, service:service.service, date:targetDate, daysAhead, sent:false, note:'' };
      await maybeSend(env, apiReady, waNumber, message, result);
      results.push(result);
    }
  }

  console.log(`[greetings] done — ${results.length} total for ${mmdd}`);
  return { date:mmdd, total:results.length, apiReady, results };
}

// ── export ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method==='OPTIONS') return new Response(null,{status:204,headers:CORS});

    const url = new URL(request.url);

    if (request.method==='GET' && url.pathname==='/api/greetings/today') {
      const result = await runDailyGreetings(env);
      return new Response(JSON.stringify(result,null,2),{ headers:{...CORS,'Content-Type':'application/json'} });
    }

    if (request.method!=='POST') return env.ASSETS.fetch(request);

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({error:{message:'ANTHROPIC_API_KEY secret not set on the Worker. See setup instructions.'}}),
        {status:500,headers:{...CORS,'Content-Type':'application/json'}}
      );
    }

    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({error:{message:'Invalid JSON body'}}),{status:400,headers:{...CORS,'Content-Type':'application/json'}}); }

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
      body:JSON.stringify(body),
    });

    return new Response(anthropicResp.body,{
      status:anthropicResp.status,
      headers:{...CORS,'Content-Type':anthropicResp.headers.get('Content-Type')||'application/json'},
    });
  },

  // Cron trigger — daily at 04:00 UTC (07:00 Kuwait / Arabia Standard Time)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDailyGreetings(env));
  },
};
