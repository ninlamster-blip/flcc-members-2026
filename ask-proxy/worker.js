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
// The worker also serves GET /news — live RSS headlines from trusted sources.
// =============================================================================

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);

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

    // ── All other non-POST requests → static assets ───────────────────────────
    if (request.method !== 'POST') {
      return env.ASSETS.fetch(request);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY secret not set on the Worker. See setup instructions.' } }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
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
};
