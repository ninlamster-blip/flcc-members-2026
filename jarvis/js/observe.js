// Observe Engine — OBSERVE step of the agentic loop.
//
// Turns whatever is available right now into one unified context state,
// exactly like the JARVIS spec's example:
//   "Allen is home. Time: 8:30 PM. Weather: Hot Kuwait evening.
//    Family devotion scheduled. Jared gaming for 2 hours."
//
// V0.1 has no live Calendar/Home/Weather integrations yet (those are
// V0.2-V0.4 in the spec's own roadmap), so this reads two kinds of source:
//   - Environment: computed locally (time, date, part of day) — always on.
//   - Everything else (presence, family events, screen time, interests):
//     passed in as `signals`, the same shape a future Calendar/Home/Message
//     integration would eventually populate automatically. Keeping that
//     boundary explicit means swapping a manual toggle for a real Calendar
//     Tool later only changes where `signals` comes from, not this file.
import { getMemory } from './memory.js';
import { todayKey, partOfDay } from './utils.js';

export function buildContext(signals = {}) {
  const mem = getMemory();
  const now = new Date();
  return {
    today: todayKey(now),
    time: now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    partOfDay: partOfDay(now),
    // Personal context: who's around, what's scheduled — supplied by the
    // caller until a real Calendar/Presence source exists.
    presence: signals.presence || {}, // { [personName]: 'home'|'away'|'working'|'gaming' }
    events: signals.events || [], // [{ label, note }] — e.g. family devotion
    // A free-text environment note (weather, home status) — same idea as
    // Weather/Home Tool output once those exist.
    environmentNote: signals.environmentNote || '',
    // Long-term memory surfaced into today's context, so Understand/Plan
    // don't need to reach into memory.js themselves.
    knownFacts: mem.longTerm.facts.slice(0, 5).map((f) => f.text),
    openGoals: mem.longTerm.goals.slice(0, 5).map((g) => g.text),
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
  return parts.join(' ');
}
