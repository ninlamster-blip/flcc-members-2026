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
//  5. Click Save and Deploy
//  6. Copy your Worker URL  (e.g. https://flcc-ask.yourname.workers.dev)
//  7. Open the app → Ask FLCC tab → enter that URL in "Proxy URL" setup
//
// That's it — all members can now use Ask FLCC with no API key setup.
// =============================================================================

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    const corsHeaders = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY secret not set on the Worker. See setup instructions.' } }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid JSON body' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Forward to Anthropic — stream body passthrough so SSE streaming works
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
        ...corsHeaders,
        'Content-Type': anthropicResp.headers.get('Content-Type') || 'application/json',
      },
    });
  },
};
