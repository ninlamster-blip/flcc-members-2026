// Companion Brain — a lightweight, on-device orchestration layer that looks
// across the heart check-in, wellbeing check-ins, Journal, and conversation
// history to decide the one or two most helpful things to surface right
// now, instead of leaving every feature to compete for attention on its own.
//
// Everything it reads already lives in state.js under the same privacy
// terms as today — on this device only, visible and erasable from Settings
// (see "What Kaibigan remembers" / "Erase everything"). This module adds no
// new remote storage and no new consent surface; the only new persisted
// field (companionBrain.dismissedId) is covered by those same controls.
//
// No DOM here on purpose — this is the "orchestrator independent of the
// UI" piece. A caller (companion.js today; conceivably a native shell
// tomorrow) reads getTopRecommendation() and decides how to show it.
//
// Two layers, kept deliberately separate so either can grow without
// touching the other:
//   - Context Engine  (buildContext):          state.js -> a plain summary
//   - Decision Engine (chooseRecommendations):  summary -> ranked suggestions
//
// Adding a new signal means adding one function alongside journalSignal/
// checkinSignal/etc. and spreading its result into buildContext(). Adding a
// new suggestion means adding one entry to RULES. Neither touches the
// other, and neither touches any UI code.

import {
  getState, heartFeelingsToday,
  isCompanionSuggestionDismissed,
} from './state.js';
import { todayKey, daysBetween } from './utils.js';

const HEAVY_FEELINGS = new Set(['exhausted', 'heavy', 'anxious', 'lonely', 'homesick', 'invisible']);

// ── Context Engine ───────────────────────────────────────────────────────

function journalSignal(s) {
  const last = s.journal[0];
  return {
    daysSinceJournal: last ? daysBetween(last.date) : null,
    journalCount: s.journal.length,
  };
}

// Compares the mood of the more recent half of the last week's check-ins
// against the older half. Needs at least 4 check-ins to say anything —
// fewer than that is too little signal to call a "trend" rather than noise.
function checkinSignal(s) {
  const recent = s.checkins.slice(0, 7);
  let moodTrend = 'unknown';
  if (recent.length >= 4) {
    const half = Math.floor(recent.length / 2);
    const newer = recent.slice(0, half).reduce((sum, c) => sum + c.mood, 0) / half;
    const older = recent.slice(half).reduce((sum, c) => sum + c.mood, 0) / (recent.length - half);
    if (newer - older >= 0.6) moodTrend = 'improving';
    else if (older - newer >= 0.6) moodTrend = 'declining';
    else moodTrend = 'steady';
  }
  return {
    daysSinceCheckin: s.checkins[0] ? daysBetween(s.checkins[0].date) : null,
    moodTrend,
  };
}

function heartSignal() {
  const feelings = heartFeelingsToday();
  return {
    checkedInToday: feelings.length > 0,
    heavyToday: feelings.some((f) => HEAVY_FEELINGS.has(f)),
  };
}

function chatSignal(s) {
  return {
    daysSinceTalked: s.chat.lastTalkedDate ? daysBetween(s.chat.lastTalkedDate) : null,
    memoryCount: s.memories.length,
  };
}

export function buildContext() {
  const s = getState();
  return {
    today: todayKey(),
    faithEnabled: s.settings.faithEnabled,
    ...journalSignal(s),
    ...checkinSignal(s),
    ...heartSignal(),
    ...chatSignal(s),
  };
}

// ── Decision Engine ──────────────────────────────────────────────────────
// Ordered most to least urgent, same shape as a simple triage list. Every
// rule that matches the current context produces a candidate; the caller
// (chooseRecommendations) keeps them in this priority order.

const RULES = [
  {
    id: 'heavy-today',
    when: (c) => c.heavyToday,
    build: () => ({
      title: 'Mabigat ang pakiramdam mo ngayon',
      message: 'Gusto mo bang mag-isang minutong paghinga, o kausapin si Kaibigan tungkol dito?',
      cta: 'Hinga muna',
      action: { tab: 'home', focus: 'breathe' },
    }),
  },
  {
    id: 'mood-declining',
    when: (c) => c.moodTrend === 'declining',
    build: () => ({
      title: 'Kumusta ka nga pala?',
      message: 'Medyo mas mabigat ang huling mga araw mo kumpara sa nakaraang linggo. Gusto mo bang mag-usap?',
      cta: 'Kausapin si Kaibigan',
      action: { tab: 'home' },
    }),
  },
  {
    id: 'journal-gap',
    when: (c) => c.journalCount === 0
      ? c.daysSinceTalked !== null && c.daysSinceTalked >= 2
      : c.daysSinceJournal >= 3,
    build: (c) => ({
      title: 'Sulat muna tayo',
      message: c.journalCount === 0
        ? 'Subukan mong isulat ang nasa isip mo ngayon — pribado lang ito, ikaw lang ang makakabasa.'
        : `${c.daysSinceJournal} araw na mula nang huli kang sumulat sa Journal. Gusto mo bang magsulat ngayon?`,
      cta: 'Buksan ang Journal',
      action: { tab: 'journal' },
    }),
  },
  {
    id: 'no-checkin-today',
    when: (c) => !c.checkedInToday,
    build: () => ({
      title: 'Kumusta ang puso mo ngayon?',
      message: 'Hindi mo pa nagagawa ang check-in mo ngayon — isang tap lang.',
      cta: 'Mag-check in',
      action: { tab: 'home', focus: 'heart' },
    }),
  },
  {
    id: 'encourage',
    when: () => true, // always matches — the default, encouraging fallback
    build: (c) => ({
      title: 'Galing mo!',
      message: c.journalCount > 0
        ? 'Salamat sa pagpapatuloy mo. Isang maliit na hakbang araw-araw, malaking bagay iyan.'
        : 'Nandito lang si Kaibigan, anumang oras mo kailanganin.',
      cta: null,
      action: { tab: 'home' },
    }),
  },
];

// Every currently-true rule, in priority order — NOT dismissal-aware. Kept
// pure (context in, list out) so it's simple to unit test and so a future
// caller can make its own dismissal/frequency decisions if it needs to.
export function chooseRecommendations(context = buildContext(), max = RULES.length) {
  const matched = [];
  for (const rule of RULES) {
    if (matched.length >= max) break;
    if (rule.when(context)) matched.push({ id: rule.id, ...rule.build(context) });
  }
  return matched;
}

// The one recommendation a caller should actually show: highest-priority
// match that the member hasn't already dismissed today.
export function getTopRecommendation() {
  const all = chooseRecommendations();
  return all.find((r) => !isCompanionSuggestionDismissed(r.id)) || null;
}

// A short, plain-language hint for the AI's own conversation opener — never
// shown to the user as-is, just context so the greeting can fold it in
// naturally (same spirit as the existing "days away" note in ai.js). Skips
// the always-on "encourage" fallback: that one isn't worth the AI reciting.
export function topRecommendationHint() {
  const top = getTopRecommendation();
  if (!top || top.id === 'encourage') return '';
  return top.message;
}
