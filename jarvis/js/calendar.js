// Calendar Engine — the spec's "Personal Context: Calendar," and the real
// source the manual "Family devotion scheduled today" checkbox in the
// Observe form was always meant to be replaced by (see observe.js). Like
// Knowledge and Home, it's its own store — own localStorage keys, no
// personal journal/memory data ever passed to it — but unlike Knowledge
// (Global, not personal) it genuinely IS Personal Context; it's kept as a
// separate engine anyway, for the same "fuse in Observe, keep the stores
// apart" reasoning the rest of this app already uses.
//
// Routed through the Worker, same as News: a calendar ICS feed almost
// never sets CORS headers (Google Calendar's own "secret address"
// included), so a browser can't fetch it directly. Unlike News, the feed
// itself is personal — JARVIS supplies the ICS URL as a query parameter to
// the Worker's GET /calendar, which fetches and parses it server-side and
// returns plain JSON. Reuses JARVIS's own AI connection (js/ai-client.js)
// for the Worker URL/secret, since it's the same Worker /news and /proxy
// already live on — only the ICS feed URL itself is new configuration.
import { getConnection } from './ai-client.js';

const ICS_URL_KEY = 'flcc-jarvis-calendar-ics-url-v1';
const TZ_OFFSET_KEY = 'flcc-jarvis-calendar-tz-offset-v1'; // minutes east of UTC

const CACHE_KEY = 'flcc-jarvis-calendar:v1';

function defaultCache() {
  return { events: [], fetchedAt: null };
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...defaultCache(), ...JSON.parse(raw) } : defaultCache();
  } catch {
    return defaultCache();
  }
}

let cache = loadCache();

function saveCache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export function getIcsUrl() {
  try { return localStorage.getItem(ICS_URL_KEY) || ''; } catch { return ''; }
}

export function getTzOffsetMinutes() {
  const raw = (() => { try { return localStorage.getItem(TZ_OFFSET_KEY); } catch { return null; } })();
  const n = Number(raw);
  return Number.isFinite(n) ? n : 180; // default: Kuwait, UTC+3
}

export function saveSettings(icsUrl, tzOffsetHours) {
  localStorage.setItem(ICS_URL_KEY, icsUrl.trim());
  localStorage.setItem(TZ_OFFSET_KEY, String(Math.round((Number(tzOffsetHours) || 0) * 60)));
}

export function isConfigured() {
  return !!(getIcsUrl() && getConnection().proxyUrl);
}

export function getCachedEvents() {
  return cache;
}

export async function refreshEvents() {
  const { proxyUrl, proxySecret } = getConnection();
  const icsUrl = getIcsUrl();
  if (!proxyUrl) return { ok: false, detail: 'No Worker URL configured — set one up in the Knowledge Engine panel first.' };
  if (!icsUrl) return { ok: false, detail: 'No calendar feed URL configured yet.' };
  try {
    const headers = {};
    if (proxySecret) headers['x-proxy-secret'] = proxySecret;
    const qs = new URLSearchParams({ url: icsUrl, days: '14', tzOffsetMinutes: String(getTzOffsetMinutes()) });
    const res = await fetch(proxyUrl.replace(/\/+$/, '') + '/calendar?' + qs.toString(), { headers });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, detail: data?.error?.message || `Calendar source returned HTTP ${res.status}.` };
    cache = { events: data.events || [], fetchedAt: Date.now() };
    saveCache();
    return { ok: true, detail: `${cache.events.length} event(s) refreshed.` };
  } catch (err) {
    return { ok: false, detail: `Couldn't reach the calendar source: ${err.message}` };
  }
}

// Cached events that fall on "today," using the same fixed timezone offset
// the Worker used to interpret floating/TZID times (see worker.js's
// parseICSDateValue()) for BOTH the event and "now" — deliberately not the
// browser's own local timezone, which may not match the calendar's (e.g.
// this device, testing from elsewhere, vs. the household the offset is
// actually configured for).
export function eventsToday() {
  const offsetMs = getTzOffsetMinutes() * 60000;
  const today = new Date(Date.now() + offsetMs).toISOString().slice(0, 10);
  return cache.events.filter((e) => {
    const localDay = new Date(new Date(e.start).getTime() + offsetMs).toISOString().slice(0, 10);
    return localDay === today;
  });
}

export function eraseCalendarCache() {
  cache = defaultCache();
  saveCache();
}
