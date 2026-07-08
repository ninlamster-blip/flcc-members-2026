// =============================================================================
// Nihongo — Cloudflare Worker proxy for the Anthropic API
// =============================================================================
//
// Why: so a group can share ONE API key instead of everyone pasting their own,
// and so the key never ships in the browser. The app talks to this Worker; the
// Worker adds the secret key server-side and forwards to Anthropic.
//
// SETUP (about 5 minutes):
//   1. dash.cloudflare.com → Workers & Pages → Create Worker
//   2. "Edit code", paste this whole file, Deploy
//   3. Worker → Settings → Variables and Secrets → add a Secret:
//        Name:  ANTHROPIC_API_KEY
//        Value: your sk-ant-... key from console.anthropic.com
//   4. (Recommended) add another Secret to gate access:
//        Name:  PROXY_SECRET
//        Value: any password you choose (share it with your users)
//   5. Deploy, copy the Worker URL (e.g. https://nihongo.you.workers.dev)
//   6. Open the app → Connect → Shared Proxy → paste the URL (+ secret)
//
// The app calls POST <worker-url>/proxy. GET /ping is a health check.
// =============================================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-proxy-secret',
};

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      return json({ error: { message: `Worker error: ${err.message}` } }, 500);
    }
  },
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
  });
}

async function handle(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/ping') {
    return json({ ok: true, keySet: !!env.ANTHROPIC_API_KEY, secretRequired: !!env.PROXY_SECRET });
  }

  if (request.method !== 'POST') {
    return new Response('Nihongo proxy. POST /proxy to translate.', { status: 200, headers: CORS });
  }

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: { message: 'ANTHROPIC_API_KEY secret is not set on the Worker. See setup instructions.' } }, 500);
  }

  // Optional shared-secret gate — only enforced when PROXY_SECRET is set.
  if (env.PROXY_SECRET) {
    const incoming = request.headers.get('x-proxy-secret') || '';
    if (incoming !== env.PROXY_SECRET) {
      return json({ error: { message: 'Invalid proxy secret.' } }, 401);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: 'Invalid JSON body' } }, 400);
  }

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return json({ error: { message: `Could not reach Anthropic API: ${err.message}` } }, 502);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { ...CORS, 'Content-Type': upstream.headers.get('Content-Type') || 'application/json' },
  });
}
