// Observe Engine — OBSERVE step of the agentic loop.
//
// Turns whatever is available right now into one unified context state,
// exactly like the JARVIS spec's example:
//   "Allen is home. Time: 8:30 PM. Weather: Hot Kuwait evening.
//    Family devotion scheduled. Jared gaming for 2 hours."
//
// There's still no live Weather/Presence integration, so this reads a mix
// of sources:
//   - Environment: computed locally (time, date, part of day) — always on.
//   - Device/home status (real, since V0.4): home.js's cached Home
//     Assistant device list — its own store, same fuse-but-separate
//     pattern as Knowledge (see below).
//   - Calendar (real, as of this version): calendar.js's cached today's
//     events, mapped into the same `{ label, note }` shape the manual
//     "Family devotion scheduled today" checkbox always produced — this is
//     the payoff of that shape being generic from V0.1: Faith Agent's
//     scheduledDevotionUnderstanding() needed zero changes to start
//     reacting to a real calendar instead of a checkbox.
//   - Everything else (presence, screen time, interests): passed in as
//     `signals`, the same shape a future Presence/Message integration
//     would eventually populate automatically.
import { getMemory } from './memory.js';
import { getCachedNews, briefingShownToday } from './knowledge.js';
import { playingDeviceNames } from './home.js';
import { eventsToday } from './calendar.js';
import { todayKey, partOfDay } from './utils.js';

export function buildContext(signals = {}) {
  const mem = getMemory();
  const news = getCachedNews();
  const now = new Date();
  const calendarEvents = eventsToday().map((e) => ({ label: e.title, note: e.location || '' }));
  return {
    today: todayKey(now),
    time: now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    partOfDay: partOfDay(now),
    // Personal context: who's around — supplied by the caller until a real
    // Presence source exists.
    presence: signals.presence || {}, // { [personName]: 'home'|'away'|'working'|'gaming' }
    // Personal Context: what's scheduled — real calendar events for today,
    // plus anything still entered manually (both are the same shape, so
    // either can carry a "Family devotion" entry Faith Agent will notice).
    events: [...calendarEvents, ...(signals.events || [])], // [{ label, note }]
    // A free-text environment note (weather, home status) — same idea as
    // Weather/Home Tool output once those exist.
    environmentNote: signals.environmentNote || '',
    // Long-term memory surfaced into today's context, so Understand/Plan
    // don't need to reach into memory.js themselves. Personal — from
    // memory.js.
    knownFacts: mem.longTerm.facts.slice(0, 5).map((f) => f.text),
    openGoals: mem.longTerm.goals.slice(0, 5).map((g) => g.text),
    // Knowledge Context (Global Knowledge — from knowledge.js, a wholly
    // separate store; see that file's header comment). Observe's job is to
    // fuse personal and global context into one state for Understand/Plan
    // to read; it does not blur where each piece of data actually lives.
    newsHeadlines: news.items.slice(0, 3).map((it) => it.headline),
    newsCount: news.items.length,
    newsFetchedToday: news.fetchedAt ? todayKey(new Date(news.fetchedAt)) === todayKey(now) : false,
    knowledgeBriefingShownToday: briefingShownToday(),
    // Environment Context (device/home status — from home.js, its own
    // store, kept separate the same way Knowledge is; see that file's
    // header comment).
    playingDevices: playingDeviceNames(),
    // Raw interaction signals for this tick — e.g. a screen-time reading.
    ...signals.raw,
  };
}

// A short, human-readable line matching the spec's "Current State" example —
// useful for the demo UI and for folding into a future AI narrative.
export function describeContext(c) {
  const parts = [];
  for (const [name, status] of Object.entries(c.presence)) {
    parts.push(`${name} is ${status}.`);
  }
  parts.push(`Time: ${c.time}.`);
  if (c.environmentNote) parts.push(`${c.environmentNote}.`);
  for (const e of c.events) parts.push(`${e.label}${e.note ? ` (${e.note})` : ''}.`);
  if (typeof c.jaredGamingHours === 'number' && c.jaredGamingHours > 0) {
    parts.push(`Jared gaming for ${c.jaredGamingHours} hour${c.jaredGamingHours === 1 ? '' : 's'}.`);
  }
  if (c.playingDevices.length > 0) {
    parts.push(`Currently playing: ${c.playingDevices.join(', ')}.`);
  }
  return parts.join(' ');
}
