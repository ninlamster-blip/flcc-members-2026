// Agent Brain — the orchestrator. Looks across the heart check-in,
// wellbeing check-ins, Journal, and conversation history to decide the one
// or two most helpful things to surface right now, instead of leaving
// every feature to compete for attention on its own.
//
// This is the "Agent Brain" in Project Sanctuary's five-brain vocabulary —
// the piece that coordinates the other four rather than doing any one
// thing itself. (Renamed from companion-brain.js: that name collided with
// a different brain in the taxonomy — the Companion Brain is conversation,
// memory, and empathy, i.e. companion.js + ai.js + relationship-engine.js
// below — not this orchestrator.) The five, and what actually implements
// each:
//   - Companion Brain  — companion.js, ai.js, relationship-engine.js
//   - Wellness Brain    — journal.js, reflection-engine.js, growth-engine.js
//   - Faith Brain        — faith.js, sanctuary-mode.js
//   - Community Brain   — community.js, prayerchain.js
//   - Agent Brain (this file) — reads across all of the above, decides what
//     to surface and when
//
// The SAFETY pillar (support.js's Tulong tab) has no dedicated brain of its
// own, same as LIFE (state.js `life`) above it — both are simple enough to
// live as signals + rules directly in this file rather than a separate
// module. See safetySignal() and the sustained-hardship/no-documents-saved
// rules below.
//
// Everything this file reads already lives in state.js under the same
// privacy terms as today — on this device only, visible and erasable from
// Settings (see "What Kaibigan remembers" / "Erase everything"). This
// module adds no new remote storage and no new consent surface; the only
// new persisted field (companionBrain.dismissedId) is covered by those
// same controls. (That field's name predates this rename too — left as-is
// since renaming a state.js key means writing a migration for existing
// members' saved data, for a cosmetic gain that isn't worth that risk.)
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
import { todayKey, daysBetween, nextAnnualOccurrence } from './utils.js';
import { buildWeeklySummary, structuredReflectionText } from './reflection-engine.js';
import { findGrowthHighlight } from './growth-engine.js';

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
    // A sustained count, not a trend — moodTrend can read "steady" while
    // still being steadily hard. Needs at least 5 check-ins to say
    // anything, same reasoning as moodTrend's own 4-check-in floor.
    hardDaysRecent: recent.length >= 5 ? recent.filter((c) => c.mood <= 2).length : 0,
    recentCheckinCount: recent.length,
  };
}

// SAFETY pillar (support.js's Tulong tab) signal — whether the member has
// ever saved a document to the on-device vault, so the Decision Engine
// below can nudge them to do it before it's actually needed (a contract
// ending or a trip home), not only after. Also the soonest expiry date
// across every saved document (see js/ai.js's analyzeDocument, which fills
// this in), the same "nearest across a whole list" pattern as
// lifeSignal's birthday countdown — one nudge for whichever document is
// closest to lapsing, not one per document.
function safetySignal(s) {
  const today = todayKey();
  let daysUntilDocumentExpiry = null;
  let expiringDocumentName = null;
  for (const d of s.documents) {
    if (!d.expiryDate) continue;
    const days = daysBetween(today, d.expiryDate);
    if (daysUntilDocumentExpiry === null || days < daysUntilDocumentExpiry) {
      daysUntilDocumentExpiry = days;
      expiringDocumentName = d.name;
    }
  }
  return { documentCount: s.documents.length, daysUntilDocumentExpiry, expiringDocumentName };
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

function reflectionSignal(s) {
  const last = s.companionBrain.lastReflectionDate;
  return {
    daysSinceReflection: last ? daysBetween(last) : null,
  };
}

function growthSignal(s) {
  const last = s.companionBrain.lastGrowthDate;
  return {
    daysSinceGrowth: last ? daysBetween(last) : null,
  };
}

// LIFE pillar (state.js `life`) prediction signals — day counts to
// whatever's coming up, so the Decision Engine below can nudge before a
// milestone rather than only reacting after. Birthday uses the soonest
// one across all family members, not every family member's own countdown
// — one nudge for the nearest, same "one thing at a time" spirit as
// every other rule here.
function lifeSignal(s) {
  const life = s.life;
  const today = todayKey();
  let daysUntilBirthday = null;
  let upcomingBirthdayName = null;
  for (const m of life.family || []) {
    if (!m.birthday) continue;
    const days = daysBetween(today, nextAnnualOccurrence(m.birthday, today));
    if (daysUntilBirthday === null || days < daysUntilBirthday) {
      daysUntilBirthday = days;
      upcomingBirthdayName = m.name;
    }
  }
  return {
    daysUntilContractEnd: life.contractEndDate ? daysBetween(today, life.contractEndDate) : null,
    daysUntilVacation: life.vacationDate ? daysBetween(today, life.vacationDate) : null,
    daysUntilBirthday,
    upcomingBirthdayName,
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
    ...reflectionSignal(s),
    ...growthSignal(s),
    ...lifeSignal(s),
    ...safetySignal(s),
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
    // SAFETY pillar — a sustained pattern, not just one hard day (that's
    // heavy-today's job above) or a short relative trend (mood-declining's,
    // below — kept lower-priority since a trend can be noisy while this is
    // an absolute floor). Gently opens the door to Tulong's real hotlines
    // and church contacts — works even without an AI connection, unlike
    // the system prompt's own "direct persistent despair to Tulong"
    // instruction, which only fires mid-conversation. Never diagnoses;
    // just says the door is there.
    id: 'sustained-hardship',
    when: (c) => c.recentCheckinCount >= 5 && c.hardDaysRecent >= 4,
    build: () => ({
      title: 'Hindi ka nag-iisa dito',
      message: 'Mabigat ang mga huling araw mo. May mga totoong tao na handang makinig — hindi lang app. Narito ang Tulong kung gusto mong makipag-usap sa isang tao ngayon.',
      cta: 'Buksan ang Tulong',
      action: { tab: 'support' },
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
    // A real transition worth acknowledging gently, not just a date on a
    // calendar — matches mood-declining's level of care since this can be
    // an anxious moment (job security, an uncertain next step) as easily
    // as a hopeful one.
    id: 'contract-ending-soon',
    when: (c) => c.daysUntilContractEnd !== null && c.daysUntilContractEnd >= 0 && c.daysUntilContractEnd <= 30,
    build: (c) => ({
      title: 'Papalapit na ang katapusan ng kontrata mo',
      message: c.daysUntilContractEnd === 0
        ? 'Ngayon na ang huling araw ng kontrata mo — malaking bagay ito. Kumusta ang pakiramdam mo?'
        : `${c.daysUntilContractEnd} araw na lang bago matapos ang kontrata mo. Malaking transition ito — gusto mo bang pag-usapan, o ipanalangin natin ito?`,
      cta: 'Kausapin si Kaibigan',
      action: { tab: 'home' },
    }),
  },
  {
    id: 'family-birthday-soon',
    when: (c) => c.daysUntilBirthday !== null && c.daysUntilBirthday >= 0 && c.daysUntilBirthday <= 7,
    build: (c) => ({
      title: c.daysUntilBirthday === 0 ? `Kaarawan ni ${c.upcomingBirthdayName} ngayon!` : `Papalapit na ang kaarawan ni ${c.upcomingBirthdayName}`,
      message: c.daysUntilBirthday === 0
        ? `Ngayon ang kaarawan ni ${c.upcomingBirthdayName} — baka gusto mong tumawag o magpadala ng masayang mensahe.`
        : `${c.daysUntilBirthday} araw na lang bago ang kaarawan ni ${c.upcomingBirthdayName}. Gusto mo bang tulungan kang mag-isip ng espesyal na mensahe?`,
      cta: 'Kausapin si Kaibigan',
      action: { tab: 'home' },
    }),
  },
  {
    id: 'vacation-approaching',
    when: (c) => c.daysUntilVacation !== null && c.daysUntilVacation >= 0 && c.daysUntilVacation <= 14,
    build: (c) => ({
      title: c.daysUntilVacation === 0 ? 'Bakasyon mo na ngayon!' : 'Papalapit na ang bakasyon mo!',
      message: c.daysUntilVacation === 0
        ? 'Ngayon na! Sana maging maganda at mapagpahinga ang oras mo kasama ang mga mahal mo.'
        : `${c.daysUntilVacation} araw na lang bago ang bakasyon mo. Excited ka na ba?`,
      cta: null,
      action: { tab: 'home' },
    }),
  },
  {
    // SAFETY pillar — a passport/visa/iqama that lapses unnoticed is a real,
    // disruptive problem, so this fires well ahead (30 days, same window as
    // contract-ending-soon) rather than only once it's already urgent.
    // Ranked above no-documents-saved below: an expiry in hand is more
    // pressing than the general "you have none saved" nudge.
    id: 'document-expiring-soon',
    when: (c) => c.daysUntilDocumentExpiry !== null && c.daysUntilDocumentExpiry <= 30,
    build: (c) => ({
      title: c.daysUntilDocumentExpiry < 0 ? 'May dokumentong nag-expire na' : 'May dokumentong malapit nang mag-expire',
      message: c.daysUntilDocumentExpiry < 0
        ? `Nag-expire na ang ${c.expiringDocumentName} mo. Palitan agad kung kaya, at siguraduhing updated ang litrato sa Tulong tab.`
        : c.daysUntilDocumentExpiry === 0
          ? `Nag-e-expire ngayon ang ${c.expiringDocumentName} mo.`
          : `${c.daysUntilDocumentExpiry} araw na lang bago mag-expire ang ${c.expiringDocumentName} mo. Magandang panahon para mag-renew.`,
      cta: 'Buksan ang Tulong',
      action: { tab: 'support' },
    }),
  },
  {
    // SAFETY pillar — best timed around a real transition (a contract
    // ending, a trip home) rather than as a generic recurring nag, so it
    // shares its trigger window with contract-ending-soon/vacation-
    // approaching above instead of firing on its own schedule.
    id: 'no-documents-saved',
    when: (c) => c.documentCount === 0 && (
      (c.daysUntilContractEnd !== null && c.daysUntilContractEnd >= 0 && c.daysUntilContractEnd <= 30) ||
      (c.daysUntilVacation !== null && c.daysUntilVacation >= 0 && c.daysUntilVacation <= 14)
    ),
    build: () => ({
      title: 'Ligtas ba ang mga dokumento mo?',
      message: 'Malapit nang may malaking pagbabago — magandang panahon para kumuha ng litrato ng pasaporte, visa, o kontrata mo, para andito kahit kailan mo kailanganin.',
      cta: 'Buksan ang Tulong',
      action: { tab: 'support' },
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
    // Lower urgency than any of the actionable nudges above — a look back
    // at the week only matters once nothing more immediate needs attention.
    // Gated to at most once every 7 days, and only when there's something
    // to reflect on (see reflection-engine.js hasAnyActivity) — an empty
    // reflection isn't worth interrupting anyone for.
    id: 'weekly-reflection',
    when: (c) => (c.daysSinceReflection === null || c.daysSinceReflection >= 7) && buildWeeklySummary().hasAnyActivity,
    build: () => {
      const summary = buildWeeklySummary();
      return {
        title: 'Ang linggo mo',
        message: structuredReflectionText(summary),
        cta: null,
        action: { tab: 'home' },
        aiUpgradeKind: 'reflection', // hint to the caller: try to upgrade this with an AI narrative if connected
      };
    },
  },
  {
    // Even lower urgency than the weekly reflection — a month-over-month
    // pattern, gated to once a month, and only when there's a genuine
    // positive trend (see growth-engine.js: it never reports a decline —
    // that's mood-declining/journal-gap's job above, each paired with an
    // offer of support rather than a scorecard).
    id: 'growth-insight',
    when: (c) => (c.daysSinceGrowth === null || c.daysSinceGrowth >= 30) && !!findGrowthHighlight(),
    build: () => {
      const highlight = findGrowthHighlight();
      return {
        title: 'May napansin kami',
        message: highlight.text,
        cta: null,
        action: { tab: 'home' },
        aiUpgradeKind: 'growth',
      };
    },
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
// recs that already get their own AI narrative on the card itself (weekly
// reflection, growth insight — folding them into the greeting too would say
// the same thing twice) and the always-on "encourage" fallback (not worth
// the AI reciting).
const HINT_EXCLUDED_IDS = new Set(['encourage', 'weekly-reflection', 'growth-insight']);

export function topRecommendationHint() {
  const top = getTopRecommendation();
  if (!top || HINT_EXCLUDED_IDS.has(top.id)) return '';
  return top.message;
}
