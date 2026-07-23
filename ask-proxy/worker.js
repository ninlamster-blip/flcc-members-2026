// =============================================================================
// FLCC Ask FLCC — Cloudflare Worker Proxy
// =============================================================================
//
// SETUP INSTRUCTIONS (5 minutes):
//
// PUSH NOTIFICATIONS ("bagong panalangin" alerts):
//  See the setup note above handlePushSubscriptions() further down this file.
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
// The worker also serves GET /news — live RSS headlines from trusted sources —
// and GET /calendar?url=<ics-url> — a caller-supplied ICS feed, fetched and
// parsed server-side (bypasses CORS, which most ICS providers don't set).
//
// OPTIONAL — Daily Blessing community counter:
//  Go to your Worker → Settings → Bindings → Add binding → KV Namespace,
//  create (or pick) a namespace, and name the binding DAILY_BLESSING_KV.
//  This powers the real "members opened today" count on the Daily Blessing
//  Community tab. Without it, that tab just shows a local-only message.
// =============================================================================

import { sendWebPush } from './webpush.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-proxy-secret',
};

// ── RSS feeds served via GET /news ────────────────────────────────────────────
const RSS_FEEDS = [
  // International
  { name: 'BBC News',     icon: '🌐', url: 'https://feeds.bbci.co.uk/news/rss.xml'             },
  // Reuters retired its own public RSS feeds years ago (no first-party URL
  // to point at anymore) — Google News's RSS search, scoped to reuters.com,
  // is the standard live workaround and returns genuine Reuters headlines.
  { name: 'Reuters',      icon: '📈', url: 'https://news.google.com/rss/search?q=site:reuters.com+when:2d&hl=en-US&gl=US&ceid=US:en' },
  { name: 'The Guardian', icon: '🗞️', url: 'https://www.theguardian.com/world/rss'             },
  { name: 'NPR News',     icon: '📻', url: 'https://feeds.npr.org/1001/rss.xml'                },
  { name: 'Al Jazeera',  icon: '📡', url: 'https://www.aljazeera.com/xml/rss/all.xml'         },
  // Philippines
  { name: 'ABS-CBN',     icon: '🇵🇭', url: 'https://news.abs-cbn.com/rss/headlines'           },
  { name: 'Inquirer',    icon: '📰', url: 'https://newsinfo.inquirer.net/feed'                 },
  { name: 'GMA News',    icon: '📺', url: 'https://www.gmanetwork.com/news/rss/news/feed.xml' },
  // Showbiz — a widely-loved genre among the OFW audience Kaibigan serves.
  // GMA Network runs its RSS by category on the same domain/path shape as
  // the GMA News feed just above (…/rss/{category}/feed.xml), so this is
  // the same source, just its showbiz section.
  { name: 'GMA Showbiz', icon: '🎬', url: 'https://www.gmanetwork.com/news/rss/showbiz/feed.xml' },
  // Technology (feeds JARVIS's Knowledge Engine, and now Kaibigan's brief
  // tech-news mentions too — Technology/Apple ecosystem updates)
  { name: 'Apple Newsroom', icon: '🍎', url: 'https://www.apple.com/newsroom/rss-feed.rss'    },
  { name: 'Ars Technica',   icon: '💻', url: 'https://feeds.arstechnica.com/arstechnica/index' },
];

function clean(str) {
  return (str || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A raw RSS/Atom field is often CDATA-wrapped ("<![CDATA[some <b>html</b>]]>")
// so it can carry embedded markup — unwrap that FIRST. Running clean()
// directly on a still-wrapped CDATA block would stop at the first real '>'
// inside the embedded HTML (e.g. the one in "<b>"), truncating the field.
function unwrapCdata(str) {
  const m = String(str || '').match(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/);
  return m ? m[1] : str;
}

// Dependency-free RSS 2.0 / Atom parser — used instead of a third-party
// RSS-to-JSON proxy (previously api.rss2json.com) after that service's
// shared, keyless rate limit started intermittently failing every single
// feed at once (one flaky third party taking down all 10 sources
// together, unrelated to whether any individual feed was actually up).
// Same "deliberately scoped, not a general parser" approach as the ICS
// parser elsewhere in this Worker: RSS 2.0 <item> is the common case,
// Atom <entry> is a defensive fallback since a feed could switch formats
// without notice — not a claim of full RSS/Atom spec coverage.
function extractTag(block, tagNames) {
  for (const tag of tagNames) {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    if (m) return clean(unwrapCdata(m[1]));
  }
  return '';
}

function extractLink(block) {
  // RSS: <link>https://example.com/article</link> (plain text content).
  const rss = block.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (rss && rss[1].trim()) return clean(unwrapCdata(rss[1]));
  // Atom: <link href="https://example.com/article" ... /> (self-closing,
  // no text content — the RSS pattern above won't match this at all).
  const atom = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i);
  return atom ? atom[1] : '';
}

function feedDateToYmd(raw) {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function parseFeedItems(xml) {
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  return blocks.map((block) => ({
    title: extractTag(block, ['title']),
    link: extractLink(block),
    pubDate: extractTag(block, ['pubDate', 'published', 'updated', 'dc:date']),
    description: extractTag(block, ['description', 'summary', 'content:encoded', 'content']),
    guid: extractTag(block, ['guid', 'id']),
  })).filter((it) => it.title);
}

async function fetchNewsFeed(feed) {
  const res = await fetch(feed.url, {
    headers: { 'Accept': 'application/rss+xml, application/xml, text/xml, */*', 'User-Agent': 'Mozilla/5.0 (compatible; FLCCKasamaBot/1.0)' },
    cf: { cacheTtl: 300 },
  });
  if (!res.ok) throw new Error(`${res.status} for ${feed.name}`);
  const xml = await res.text();
  const items = parseFeedItems(xml);
  if (!items.length) throw new Error(`empty: ${feed.name}`);
  return items.slice(0, 6).map(item => {
    const summary = item.description.length > 130 ? item.description.slice(0, 130).trimEnd() + '…' : item.description;
    return {
      id: item.guid || item.link || item.title,
      headline: item.title,
      summary,
      date: feedDateToYmd(item.pubDate),
      source: feed.name,
      sourceIcon: feed.icon,
      link: item.link,
    };
  });
}

// Al Muzaini Exchange (muzaini.com) publishes their own posted PHP rate
// somewhere on their site; the exact markup is unknown and can change
// without notice, so this searches the raw HTML text for "PHP" and pulls
// the nearest plausible decimal number instead of depending on any
// specific tag/class structure. A sanity range (100–400) guards against
// picking up an unrelated number — 1 KWD has been worth roughly 150–250
// PHP for years, so anything outside that reads as a parse miss, not a
// real rate. Returns full diagnostics (not just the number) so GET
// /exchange-rate-debug (optionally ?path=/some/page.html) can show exactly
// where the scrape is landing — whether muzaini.com even responded,
// whether "PHP" appears in the raw HTML at all (it won't if the rate is
// rendered client-side by JS, since this is a plain server-side fetch with
// no browser/JS execution), and what number (if any) the regex pulled out
// — without needing someone to paste page source by hand every time this
// needs debugging. The ?path= override exists because the homepage's rate
// widget turned out to be JS-driven (see apiHints/scriptSrcs below); it
// lets a candidate page (e.g. a dedicated rates table) get checked without
// a new deploy per guess.
async function fetchMuzainiDebug(path = '/') {
  try {
    const res = await fetch(`https://www.muzaini.com${path.startsWith('/') ? path : '/' + path}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
      cf: { cacheTtl: 1800 },
    });
    if (!res.ok) return { ok: false, status: res.status, path };
    const html = await res.text();

    // Every "PHP" occurrence, not just the first — a rates table lists many
    // currencies, so the Philippine Peso row could be anywhere in it.
    const phpOccurrences = [];
    const phpFindRegex = /PHP/gi;
    let fm;
    while ((fm = phpFindRegex.exec(html)) && phpOccurrences.length < 6) {
      phpOccurrences.push({
        context: html.slice(Math.max(0, fm.index - 40), fm.index + 160),
        nearbyNumber: (html.slice(fm.index, fm.index + 220).match(/(\d{2,3}(?:\.\d{1,4})?)/) || [])[1] || null,
      });
    }
    const match = html.match(/PHP[^0-9]{0,60}(\d{2,3}(?:\.\d{1,4})?)/i);
    const rate = match ? parseFloat(match[1]) : null;
    const rateAccepted = rate != null && Number.isFinite(rate) && rate >= 100 && rate <= 400;

    // If the static HTML has no rate near "PHP" (e.g. it only appears as a
    // <option> in a currency picker), the rate is almost certainly filled
    // in by client-side JS after the page loads — which this plain
    // server-side fetch never runs. These two scans hunt for where that JS
    // might actually get its numbers from: same-origin script files worth
    // inspecting by hand, and any quoted string anywhere in the page that
    // looks like it could be a rates/convert/ajax endpoint URL.
    const scriptSrcs = [];
    const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["']/gi;
    let sm;
    while ((sm = scriptSrcRegex.exec(html)) && scriptSrcs.length < 30) scriptSrcs.push(sm[1]);

    const apiHints = [];
    const apiHintRegex = /(["'])((?:https?:)?\/{0,2}[^"'\s]{0,160}(?:rate|exchange|currency|convert|ajax|api)[^"'\s]{0,40})\1/gi;
    let am;
    while ((am = apiHintRegex.exec(html)) && apiHints.length < 15) apiHints.push(am[2]);

    return {
      ok: true,
      path,
      status: res.status,
      htmlLength: html.length,
      phpMentionFound: phpOccurrences.length > 0,
      phpOccurrences,
      matchedText: match ? match[0] : null,
      extractedRate: rate,
      rateAccepted,
      scriptSrcs,
      apiHints,
    };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err), path };
  }
}

async function fetchMuzainiPhpRate() {
  const debug = await fetchMuzainiDebug();
  return debug.rateAccepted ? debug.extractedRate : null;
}

// Fallback mid-market rate — same source the app used before this endpoint
// existed. Free, no key, but a generic reference number rather than any
// specific exchange house's real counter rate.
async function fetchOpenErApiPhpRate() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/KWD');
    if (!res.ok) return null;
    const data = await res.json();
    if (data.result !== 'success' || !data.rates?.PHP) return null;
    return data.rates.PHP;
  } catch {
    return null;
  }
}

// ── GET /calendar — proxies + parses a personal ICS (iCalendar) feed URL ──
// Unlike /news (a fixed, public feed list this Worker owns), a calendar is
// personal — the caller supplies which feed to read via ?url=. This
// endpoint exists only to do what a browser can't: fetch it server-side
// (most ICS providers, including Google Calendar's own "secret address",
// don't set CORS headers) and turn RFC 5545 text into plain JSON. Gated by
// PROXY_SECRET like /proxy and /tts, since — unlike /news's fixed
// allowlist — this will fetch whatever URL the caller supplies.

function unfoldICS(text) {
  // RFC 5545 line folding: a logical line may be split across several
  // physical lines, each continuation starting with a single space or tab.
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function parseICSDateValue(value, tzOffsetMinutes) {
  const v = (value || '').trim();
  if (/^\d{8}$/.test(v)) {
    // VALUE=DATE — an all-day event, no time component.
    const y = +v.slice(0, 4), mo = +v.slice(4, 6), d = +v.slice(6, 8);
    return { date: new Date(Date.UTC(y, mo - 1, d)), allDay: true };
  }
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false };
  // No Z suffix: a "floating" or TZID-qualified local time. Full IANA
  // timezone data is out of scope for a dependency-free single-file
  // Worker (no DST rules, no per-region lookup), so this applies one fixed
  // offset the caller supplies (?tzOffsetMinutes=, minutes east of UTC)
  // instead of pretending to resolve arbitrary zones correctly. Good
  // enough for one household's calendar in one timezone; wrong for a feed
  // that mixes events across multiple zones.
  const utcMs = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - tzOffsetMinutes * 60000;
  return { date: new Date(utcMs), allDay: false };
}

function parseICSLine(line) {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const [name, ...paramParts] = line.slice(0, colon).split(';');
  const params = {};
  for (const p of paramParts) {
    const eq = p.indexOf('=');
    if (eq !== -1) params[p.slice(0, eq)] = p.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

const RRULE_DAY_INDEX = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const RRULE_FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

function parseRRule(value) {
  const rule = {};
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    if (k) rule[k] = v;
  }
  return rule;
}

function addInterval(date, freq, interval) {
  const d = new Date(date);
  if (freq === 'DAILY') d.setUTCDate(d.getUTCDate() + interval);
  else if (freq === 'WEEKLY') d.setUTCDate(d.getUTCDate() + interval * 7);
  else if (freq === 'MONTHLY') d.setUTCMonth(d.getUTCMonth() + interval);
  else if (freq === 'YEARLY') d.setUTCFullYear(d.getUTCFullYear() + interval);
  return d;
}

// Deliberately not a full RFC 5545 recurrence engine — supports the
// patterns real calendar exports actually use for the kind of things
// JARVIS cares about (a weekly Bible study, a daily devotion, a monthly
// meeting): FREQ of DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT or UNTIL,
// and BYDAY for weekly events. Anything fancier (BYMONTHDAY, BYSETPOS,
// nested RDATE/EXRULE, ...) is silently ignored rather than mis-expanded.
function expandRecurrence(dtstart, durationMs, rrule, exdateSet, windowStart, windowEnd) {
  const freq = rrule.FREQ;
  if (!RRULE_FREQS.includes(freq)) return [];
  const interval = Math.max(1, parseInt(rrule.INTERVAL, 10) || 1);
  const count = rrule.COUNT ? parseInt(rrule.COUNT, 10) : null;
  const until = rrule.UNTIL ? parseICSDateValue(rrule.UNTIL, 0)?.date : null;
  const byDay = rrule.BYDAY ? rrule.BYDAY.split(',').map((d) => d.replace(/^[+-]?\d+/, '')) : null;

  const MAX_OCCURRENCES = 500; // safety cap against a runaway/malformed rule
  const occurrences = [];
  let cursor = new Date(dtstart);
  let produced = 0;

  while (cursor <= windowEnd && produced < MAX_OCCURRENCES) {
    if (until && cursor > until) break;
    if (count !== null && produced >= count) break;

    if (freq === 'WEEKLY' && byDay) {
      // One pass per week: emit every requested weekday inside it.
      const weekStart = new Date(cursor);
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      for (const code of byDay) {
        const dow = RRULE_DAY_INDEX[code];
        if (dow === undefined) continue;
        const occ = new Date(weekStart);
        occ.setUTCDate(occ.getUTCDate() + dow);
        occ.setUTCHours(dtstart.getUTCHours(), dtstart.getUTCMinutes(), dtstart.getUTCSeconds(), 0);
        if (occ < dtstart || (until && occ > until)) continue;
        if (occ >= windowStart && occ <= windowEnd && !exdateSet.has(occ.toISOString().slice(0, 10))) {
          occurrences.push(occ);
          produced++;
        }
      }
    } else if (cursor >= windowStart && !exdateSet.has(cursor.toISOString().slice(0, 10))) {
      occurrences.push(new Date(cursor));
      produced++;
    }
    cursor = addInterval(cursor, freq, interval);
  }

  return occurrences.map((start) => ({ start, end: new Date(start.getTime() + durationMs) }));
}

function parseICS(text, { tzOffsetMinutes, windowStart, windowEnd }) {
  const lines = unfoldICS(text).split('\n').map((l) => l.trim()).filter(Boolean);

  const rawEvents = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) rawEvents.push(cur); cur = null; continue; }
    if (!cur) continue;
    const parsed = parseICSLine(line);
    if (!parsed) continue;
    if (parsed.name === 'SUMMARY') cur.summary = parsed.value;
    else if (parsed.name === 'LOCATION') cur.location = parsed.value;
    else if (parsed.name === 'UID') cur.uid = parsed.value;
    else if (parsed.name === 'RRULE') cur.rrule = parsed.value;
    else if (parsed.name === 'DTSTART') cur.dtstart = parsed.value;
    else if (parsed.name === 'DTEND') cur.dtend = parsed.value;
    else if (parsed.name === 'EXDATE') (cur.exdates = cur.exdates || []).push(parsed.value);
  }

  const results = [];
  for (const ev of rawEvents) {
    if (!ev.dtstart) continue;
    const start = parseICSDateValue(ev.dtstart, tzOffsetMinutes);
    if (!start) continue;
    const end = ev.dtend ? parseICSDateValue(ev.dtend, tzOffsetMinutes) : null;
    const durationMs = end ? (end.date - start.date) : (start.allDay ? 86400000 : 3600000);
    const exdateSet = new Set(
      (ev.exdates || []).map((v) => parseICSDateValue(v, tzOffsetMinutes)?.date.toISOString().slice(0, 10)).filter(Boolean)
    );

    if (ev.rrule) {
      for (const occ of expandRecurrence(start.date, durationMs, parseRRule(ev.rrule), exdateSet, windowStart, windowEnd)) {
        results.push({
          uid: ev.uid, title: ev.summary || '(untitled)', location: ev.location || '',
          start: occ.start.toISOString(), end: occ.end.toISOString(), allDay: start.allDay, recurring: true,
        });
      }
    } else if (start.date >= windowStart && start.date <= windowEnd) {
      results.push({
        uid: ev.uid, title: ev.summary || '(untitled)', location: ev.location || '',
        start: start.date.toISOString(), end: new Date(start.date.getTime() + durationMs).toISOString(),
        allDay: start.allDay, recurring: false,
      });
    }
  }

  results.sort((a, b) => a.start.localeCompare(b.start));
  return results.slice(0, 100);
}

export default {
  async fetch(request, env, ctx) {
    // Top-level catch — every response gets CORS headers, nothing escapes as a bare Cloudflare error
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { message: `Worker error: ${err.message}` } }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
  },

  // Fires hourly (see [triggers] crons in wrangler.toml) — checks whether
  // it's currently EVENING_LOCAL_HOUR in each opted-in device's own time
  // zone and sends the Sanctuary reminder only to whoever's due right now
  // (see sendEveningSanctuaryReminder). Silently a no-op if VAPID isn't
  // configured or nobody's due this hour; never throws into the Cron
  // Trigger's own retry/alerting machinery for an ordinary "nothing to
  // send" case.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendEveningSanctuaryReminder(env).catch(() => {}));
  },
};

async function handleRequest(request, env, ctx) {
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

  // ── GET /news — live RSS headlines, parsed directly (cached 5 min at edge) ─
  if (request.method === 'GET' && url.pathname === '/news') {
    const settled = await Promise.allSettled(RSS_FEEDS.map(fetchNewsFeed));
    // Each feed already caps itself at 6 items (fetchNewsFeed's own slice) —
    // there used to be a second, global .slice(0, 21) here too, which (since
    // flatMap preserves RSS_FEEDS's declaration order) silently favored
    // whichever feeds were listed first: 4 international feeds alone can
    // supply up to 24 items, so everything declared after them — Philippines
    // feeds, Technology feeds — could lose some or all of its items to a cap
    // that had nothing to do with relevance, just array position. No global
    // cap needed: consumers (Kaibigan's ai.js, JARVIS's knowledge.js) already
    // filter to the sources and count they actually want.
    const items = settled
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);
    return new Response(JSON.stringify({ items }), {
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  }

  // ── GET /exchange-rate — live KWD→PHP rate for the Padala conversion ─────
  // Scrapes Al Muzaini Exchange's own posted rate — what a member would
  // actually get walking up to their counter, not a generic mid-market
  // number — since that's the one most OFWs here actually remit through
  // and most (especially those working in the house) have no time to check
  // in person. Al Muzaini's page markup isn't a stable contract (a
  // marketing site, not an API), so this hunts the raw HTML text for a
  // plausible PHP figure rather than depending on any specific tag/class;
  // falls back to open.er-api.com's mid-market rate if that ever comes up
  // empty or out of range, so the conversion never just breaks. Cached at
  // the edge so normal traffic doesn't re-fetch either upstream per request.
  // A separate no-query-string path (rather than /exchange-rate?debug=1) —
  // easy to mistype/autocomplete-away in a mobile browser's address bar,
  // which is exactly what happened trying to diagnose a bad scrape live.
  // Uncached, bypasses the fallback entirely, and reports exactly what the
  // Al Muzaini scrape saw. Meant for a human to visit directly, not for the
  // app itself to call.
  if (request.method === 'GET' && url.pathname === '/exchange-rate-debug') {
    const debug = await fetchMuzainiDebug(url.searchParams.get('path') || '/');
    return new Response(JSON.stringify(debug, null, 2), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'GET' && url.pathname === '/exchange-rate') {
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    let phpPerKwd = await fetchMuzainiPhpRate();
    let source = 'muzaini';
    if (phpPerKwd == null) {
      phpPerKwd = await fetchOpenErApiPhpRate();
      source = 'open-er-api';
    }
    if (phpPerKwd == null) {
      return new Response(JSON.stringify({ error: { message: 'rate unavailable' } }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const response = new Response(JSON.stringify({ phpPerKwd, source }), {
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' },
    });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }

  // ── GET /calendar — proxies + parses a caller-supplied ICS feed URL ──────
  // Gated by PROXY_SECRET (when set), unlike /news's fixed allowlist above —
  // this fetches whatever URL the caller passes, so it needs the same
  // shared-secret gate /proxy and /tts use.
  if (request.method === 'GET' && url.pathname === '/calendar') {
    if (env.PROXY_SECRET) {
      const incoming = request.headers.get('x-proxy-secret') || '';
      if (incoming !== env.PROXY_SECRET) {
        return new Response(
          JSON.stringify({ error: { message: 'Invalid proxy secret.' } }),
          { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } }
        );
      }
    }
    const icsUrl = url.searchParams.get('url');
    if (!icsUrl || !/^https?:\/\//i.test(icsUrl)) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing or invalid ?url= (must be http/https).' } }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
    const days = Math.min(60, Math.max(1, parseInt(url.searchParams.get('days'), 10) || 14));
    // Minutes east of UTC, applied only to floating/TZID-qualified times
    // that have no explicit Z suffix — see parseICSDateValue()'s comment.
    // Defaults to +180 (Kuwait) since that is the one household this app
    // is built for; any caller can override it.
    const tzOffsetMinutes = Math.min(840, Math.max(-720, parseInt(url.searchParams.get('tzOffsetMinutes'), 10) || 180));
    try {
      const res = await fetch(icsUrl, { cf: { cacheTtl: 300 } });
      if (!res.ok) throw new Error(`ICS source returned HTTP ${res.status}`);
      const text = await res.text();
      const now = new Date();
      const windowStart = new Date(now.getTime() - 86400000); // include events that started earlier today
      const windowEnd = new Date(now.getTime() + days * 86400000);
      const events = parseICS(text, { tzOffsetMinutes, windowStart, windowEnd });
      return new Response(JSON.stringify({ events }), {
        headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: { message: `Couldn't read that calendar: ${err.message}` } }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
  }

  // ── /api/daily-blessing/community — anonymous daily open counter ─────────
  if (url.pathname === '/api/daily-blessing/community') {
    return handleDailyBlessingCommunity(request, env, url);
  }

  // ── /api/prayers — FLCC Kasama anonymous Kadena ng Panalangin (D1) ────────
  if (url.pathname === '/api/prayers' || url.pathname === '/api/prayers/pray') {
    return handlePrayerChain(request, env, url, ctx);
  }

  // ── /api/push — "new prayer" browser push notifications (opt-in) ─────────
  if (url.pathname.startsWith('/api/push/')) {
    return handlePushSubscriptions(request, env, url);
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

  // ── POST /stt → voice input, transcribed via ElevenLabs Scribe ───────────
  // The other direction from /tts, reusing the exact same ELEVENLABS_API_KEY
  // secret — one voice key covers both a member hearing Kaibigan speak and
  // Kaibigan understanding what they said. Without the key, this simply
  // isn't available (same "stays quiet/unavailable" philosophy as /tts).
  if (url.pathname === '/stt') {
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
        JSON.stringify({ error: { message: 'Voice input not configured on this Worker.' } }),
        { status: 501, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
    const audioBlob = await request.blob();
    if (!audioBlob.size) {
      return new Response(
        JSON.stringify({ error: { message: 'No audio received' } }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
    const sttForm = new FormData();
    sttForm.append('model_id', 'scribe_v1');
    sttForm.append('file', audioBlob, 'audio.webm');
    const sttResp = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY },
      body: sttForm,
    });
    if (!sttResp.ok) {
      const detail = await sttResp.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: { message: `Voice input error (${sttResp.status}): ${detail.slice(0, 200)}` } }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }
    const sttData = await sttResp.json();
    return new Response(JSON.stringify({ text: sttData.text || '' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
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

// ── FLCC Kasama — Kadena ng Panalangin (prayer chain) ───────────────────────
// Backed by a D1 database bound as KASAMA_DB (see wrangler.toml and
// ask-proxy/schema.sql). Members choose to attach their first name and
// country of origin to a request — both optional, trimmed and length-capped
// here. The only value that is never member-supplied is user_hash, a
// SHA-256 the device computes from its own random id + the prayer id; it
// cannot be linked back to any person and exists purely so one device can't
// inflate a prayer count by tapping twice.
//
// The *working* country badge is never taken from the client (a member could
// type anything). Cloudflare stamps every request with the connecting edge
// location as request.cf.country — an ISO 3166-1 alpha-2 code — for free, no
// GPS permission prompt, no extra API call. We store that code (country_code)
// and derive a readable name for display via COUNTRY_NAMES below, purely on
// the read path. origin_country is separate: a free-text field the member
// fills in themselves for where they consider home.
const COUNTRY_NAMES = {
  KW: 'Kuwait', SA: 'Saudi Arabia', AE: 'U.A.E.', QA: 'Qatar', BH: 'Bahrain', OM: 'Oman',
  HK: 'Hong Kong', SG: 'Singapore', TW: 'Taiwan', JP: 'Japan', KR: 'South Korea', MY: 'Malaysia',
  BN: 'Brunei', MO: 'Macau', CN: 'China', TH: 'Thailand', IL: 'Israel', JO: 'Jordan', LB: 'Lebanon',
  CY: 'Cyprus', IT: 'Italy', UK: 'United Kingdom', GB: 'United Kingdom', IE: 'Ireland', DE: 'Germany',
  FR: 'France', ES: 'Spain', NL: 'Netherlands', GR: 'Greece', CH: 'Switzerland', NO: 'Norway',
  US: 'United States', CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', PH: 'Philippines',
};
function countryNameFor(code) {
  return COUNTRY_NAMES[code] || code || null;
}

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
    db.prepare(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`),
  ]);
  // Self-migrate onto a table created before first_name/origin_country
  // existed — SQLite has no "ADD COLUMN IF NOT EXISTS", so check first.
  const { results: cols } = await db.prepare(`PRAGMA table_info(prayers)`).all();
  const have = new Set((cols || []).map((c) => c.name));
  const alters = [];
  if (!have.has('first_name')) alters.push(db.prepare(`ALTER TABLE prayers ADD COLUMN first_name TEXT`));
  if (!have.has('origin_country')) alters.push(db.prepare(`ALTER TABLE prayers ADD COLUMN origin_country TEXT`));
  if (alters.length) await db.batch(alters);

  // Same self-migration for push_subscriptions: notify_prayers/notify_evening
  // split one implicit "subscribed = wants prayer pushes" meaning into two
  // explicit, independently-toggleable opt-ins sharing one browser-level
  // subscription row (see the Evening Sanctuary reminder note below).
  // Existing rows predate notify_evening entirely, so they default to 0
  // (must be separately opted in) while notify_prayers defaults to 1 —
  // preserving exactly what a pre-existing row already meant.
  const { results: pushCols } = await db.prepare(`PRAGMA table_info(push_subscriptions)`).all();
  const havePush = new Set((pushCols || []).map((c) => c.name));
  const pushAlters = [];
  if (!havePush.has('notify_prayers')) pushAlters.push(db.prepare(`ALTER TABLE push_subscriptions ADD COLUMN notify_prayers INTEGER DEFAULT 1`));
  if (!havePush.has('notify_evening')) pushAlters.push(db.prepare(`ALTER TABLE push_subscriptions ADD COLUMN notify_evening INTEGER DEFAULT 0`));
  // Minutes EAST of UTC (same sign convention as /calendar's tzOffsetMinutes
  // param) — lets the evening reminder fire in each device's own evening
  // instead of one fixed UTC time for everyone. NULL means "not supplied,"
  // which the scheduled sender treats as "keep the old fixed-time
  // behavior" rather than silently never firing for that device.
  if (!havePush.has('tz_offset_minutes')) pushAlters.push(db.prepare(`ALTER TABLE push_subscriptions ADD COLUMN tz_offset_minutes INTEGER`));
  if (pushAlters.length) await db.batch(pushAlters);

  kasamaSchemaReady = true;
}

// Trim, strip control characters, and cap length — same treatment as the
// prayer content itself. Both fields are optional and member-supplied.
function cleanShortField(value, maxLen) {
  const s = String(value || '').replace(/[\u0000-\u001F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  return s || null;
}

async function handlePrayerChain(request, env, url, ctx) {
  if (!env.KASAMA_DB) {
    // Not configured — the app shows a gentle "malapit na" note instead.
    return jsonResponse({ configured: false });
  }
  const db = env.KASAMA_DB;
  await ensurePrayerSchema(db);

  // GET /api/prayers — the most recent requests from kapatid around the world
  if (request.method === 'GET' && url.pathname === '/api/prayers') {
    const { results } = await db.prepare(
      `SELECT id, content, mood_tag, country_code, first_name, origin_country, prayer_count, created_at
       FROM prayers ORDER BY created_at DESC LIMIT 30`
    ).all();
    const prayers = (results || []).map((p) => ({ ...p, country_name: countryNameFor(p.country_code) }));
    return jsonResponse({ configured: true, prayers });
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
    // Never trust a client-supplied country badge — request.cf.country is
    // stamped by Cloudflare's edge from the connecting IP, free, no GPS
    // prompt, and not spoofable by the page's own JavaScript. first_name and
    // origin_country, by contrast, are members choosing to identify
    // themselves — trimmed and length-capped, but taken as given.
    const cfCountry = request.cf?.country;
    const countryCode = /^[A-Z]{2}$/.test(String(cfCountry || '')) ? cfCountry : null;
    const firstName = cleanShortField(body.firstName, 40);
    const originCountry = cleanShortField(body.originCountry, 60);
    const prayer = {
      id: crypto.randomUUID(),
      content,
      mood_tag: moodTag || null,
      country_code: countryCode,
      first_name: firstName,
      origin_country: originCountry,
      prayer_count: 0,
    };
    await db.prepare(
      `INSERT INTO prayers (id, content, mood_tag, country_code, first_name, origin_country) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(prayer.id, prayer.content, prayer.mood_tag, prayer.country_code, prayer.first_name, prayer.origin_country).run();
    // Notify subscribed devices after responding to the submitter — never
    // let a slow or failing push service delay their "Ipadala" confirmation.
    ctx?.waitUntil(fanOutNewPrayerPush(db, env, prayer).catch(() => {}));
    return jsonResponse({ configured: true, prayer: { ...prayer, country_name: countryNameFor(countryCode) } });
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

// Sends `payload` to every row in `subs` (fire-and-forget list, already
// filtered by whichever notify_* flag the caller cares about). Devices
// whose subscription has expired (push service returns 404/410) are
// quietly removed — regardless of which feature(s) they'd opted into,
// since a stale endpoint can't receive anything anymore either way.
async function sendPushToSubscriptions(db, env, subs, payload) {
  if (!env.VAPID_PRIVATE_KEY_JWK || !env.VAPID_PUBLIC_KEY) return; // not configured
  if (!subs?.length) return;

  let privateKeyJwk;
  try {
    privateKeyJwk = JSON.parse(env.VAPID_PRIVATE_KEY_JWK);
  } catch {
    return; // malformed secret — fail closed, never throw into the caller
  }
  const vapid = {
    privateKeyJwk,
    publicKeyB64url: env.VAPID_PUBLIC_KEY,
    subject: env.VAPID_SUBJECT || 'mailto:kasama@flcc.church',
  };

  const staleIds = [];
  await Promise.allSettled(subs.map(async (sub) => {
    try {
      const res = await sendWebPush(sub, payload, vapid);
      if (res.status === 404 || res.status === 410) staleIds.push(sub.id);
    } catch {
      // one device's push service hiccuped — skip it this round, not fatal
    }
  }));

  if (staleIds.length) {
    await db.batch(staleIds.map((id) => db.prepare(`DELETE FROM push_subscriptions WHERE id = ?`).bind(id)));
  }
}

// Sends an encrypted "bagong panalangin" push to every device that opted
// into prayer notifications specifically (fire-and-forget, called via
// ctx.waitUntil so it never delays the submitter's response).
async function fanOutNewPrayerPush(db, env, prayer) {
  const { results } = await db.prepare(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE notify_prayers = 1`).all();
  const excerpt = prayer.content.length > 90 ? prayer.content.slice(0, 90).trimEnd() + '…' : prayer.content;
  await sendPushToSubscriptions(db, env, results, {
    title: 'Bagong panalangin sa Kadena 🕯️',
    body: excerpt,
    url: './index.html',
  });
}

// Local hour the reminder should land at (matches sanctuary.js's own
// "evening" period boundary) — and, for devices that never supplied a time
// zone, the fixed UTC hour this used before per-device offsets existed
// (17:00 UTC = 20:00 Kuwait), so they keep getting it at the same time
// rather than silently losing the feature.
const EVENING_LOCAL_HOUR = 20;
const FALLBACK_UTC_HOUR = 17;

// Sends the evening Sanctuary reminder to every device that opted in
// specifically (a separate opt-in from prayer notifications — see the
// notify_evening column note above), timed to each device's own evening
// where a time zone offset is known. scheduled() below now fires hourly;
// this filters down to whoever's local clock reads EVENING_LOCAL_HOUR
// right now, so any given device is only ever due in exactly one of the
// day's 24 firings — no separate "already sent today" bookkeeping needed.
// Entirely generic and non-personalized either way (see the OFW Companion
// conversation this was scoped from) — the real, personalized suggestion
// still only ever lives on-device, decided by js/agent-brain.js the
// moment someone actually opens the app.
async function sendEveningSanctuaryReminder(env) {
  if (!env.KASAMA_DB) return;
  const db = env.KASAMA_DB;
  await ensurePrayerSchema(db);
  const { results } = await db.prepare(
    `SELECT id, endpoint, p256dh, auth, tz_offset_minutes FROM push_subscriptions WHERE notify_evening = 1`
  ).all();
  if (!results?.length) return;

  const now = new Date();
  const utcMinutesOfDay = now.getUTCHours() * 60 + now.getUTCMinutes();
  const due = results.filter((sub) => {
    if (sub.tz_offset_minutes === null || sub.tz_offset_minutes === undefined) {
      return now.getUTCHours() === FALLBACK_UTC_HOUR;
    }
    const localMinutesOfDay = ((utcMinutesOfDay + sub.tz_offset_minutes) % 1440 + 1440) % 1440;
    return Math.floor(localMinutesOfDay / 60) === EVENING_LOCAL_HOUR;
  });
  if (!due.length) return;

  await sendPushToSubscriptions(db, env, due, {
    title: 'FLCC Kasama',
    body: 'Kumusta ka ngayon? Panahon na para sa Sanctuary — isang tahimik na sandali kasama si Kaibigan. 🤍',
    url: './index.html?open=sanctuary',
  });
}

// ── Push notification subscriptions ─────────────────────────────────────────
// Two independent opt-ins share this table: "bagong panalangin" (reactive,
// fires when someone posts a prayer request) and the evening Sanctuary
// reminder (scheduled, see the [triggers] crons entry in wrangler.toml and
// scheduled() above — fires once daily, entirely generic/non-personalized).
// Optional, opt-in per device. To enable either:
//  1. Generate a VAPID key pair (see ask-proxy/webpush.js or run
//     `node -e "..."` — ask an admin/Claude session for the one-liner).
//  2. Worker → Settings → Variables and Secrets:
//     - Secret  VAPID_PRIVATE_KEY_JWK — the private key as a JSON string
//     - Text    VAPID_PUBLIC_KEY      — the public key, base64url
//     - Text    VAPID_SUBJECT         — mailto:you@example.com (optional)
// Without these, /api/push/vapid-public-key reports { configured: false }
// and both of the app's notification toggles simply stay hidden.
async function handlePushSubscriptions(request, env, url) {
  if (url.pathname === '/api/push/vapid-public-key' && request.method === 'GET') {
    if (!env.VAPID_PUBLIC_KEY) return jsonResponse({ configured: false });
    return jsonResponse({ configured: true, publicKey: env.VAPID_PUBLIC_KEY });
  }

  if (!env.KASAMA_DB) return jsonResponse({ configured: false });
  const db = env.KASAMA_DB;
  await ensurePrayerSchema(db);

  if (request.method !== 'POST') {
    return jsonResponse({ error: { message: 'Method not allowed' } }, 405);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: { message: 'Invalid JSON body' } }, 400);
  }

  // Prayer notifications and the evening Sanctuary reminder are separate
  // opt-ins that can share one browser-level push subscription (a device
  // only needs one; these four endpoints just flip which notify_* flag(s)
  // are set on that subscription's row). Subscribing to one never implies
  // consent to the other — each INSERT only sets its own flag on a fresh
  // row (leaving the other at its column default) and only touches its own
  // flag in the ON CONFLICT update, so re-subscribing to one never
  // resurrects or overwrites the other's existing value. Each unsubscribe
  // clears only its own flag and deletes the row entirely only once BOTH
  // are off — a device's client-side PushManager subscription itself is a
  // separate resource the app decides when to tear down (see js/
  // notifications.js), independent of this row's lifecycle.
  if (url.pathname === '/api/push/subscribe' || url.pathname === '/api/push/evening/subscribe') {
    const { endpoint, keys } = body.subscription || body;
    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') ||
        typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
      return jsonResponse({ error: { message: 'Invalid push subscription' } }, 400);
    }
    const isEvening = url.pathname === '/api/push/evening/subscribe';
    const flagCol = isEvening ? 'notify_evening' : 'notify_prayers';
    // Only the evening endpoint ever carries a time zone offset — a plain
    // prayer subscribe/re-subscribe has no reason to touch it, and must
    // never clobber an existing evening subscriber's offset with NULL.
    const tzOffsetMinutes = isEvening && Number.isInteger(body.tzOffsetMinutes)
      ? Math.min(840, Math.max(-720, body.tzOffsetMinutes))
      : null;
    const setTz = tzOffsetMinutes !== null ? `, tz_offset_minutes = excluded.tz_offset_minutes` : '';
    await db.prepare(
      `INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, notify_prayers, notify_evening, tz_offset_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, ${flagCol} = 1${setTz}`
    ).bind(crypto.randomUUID(), endpoint, keys.p256dh, keys.auth, isEvening ? 0 : 1, isEvening ? 1 : 0, tzOffsetMinutes).run();
    return jsonResponse({ configured: true, subscribed: true });
  }

  if (url.pathname === '/api/push/unsubscribe' || url.pathname === '/api/push/evening/unsubscribe') {
    const endpoint = String(body.endpoint || '');
    if (endpoint) {
      const flagCol = url.pathname === '/api/push/evening/unsubscribe' ? 'notify_evening' : 'notify_prayers';
      await db.prepare(`UPDATE push_subscriptions SET ${flagCol} = 0 WHERE endpoint = ?`).bind(endpoint).run();
      await db.prepare(
        `DELETE FROM push_subscriptions WHERE endpoint = ? AND notify_prayers = 0 AND notify_evening = 0`
      ).bind(endpoint).run();
    }
    return jsonResponse({ configured: true, subscribed: false });
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
