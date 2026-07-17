// Reflection Engine — a weekly, encouraging look back, built from the same
// on-device data as the rest of the Companion Brain (js/companion-brain.js).
// No DOM here, same reasoning as companion-brain.js: this only computes
// facts and a plain-language fallback text from them; a caller decides how
// and when to show it, and whether to upgrade the text with an AI narrative
// (see ai.js weeklyReflection).
//
// Deliberately scoped to what's reliably computable today: wellbeing
// check-ins and Journal entries both keep full dated history. Prayer
// activity, Bible/faith engagement, and community participation are
// natural additions once those features track per-entry dates the way
// check-ins and Journal already do — today's teachingNotes, for instance,
// are keyed by the teaching's date, not by when the note was written, so
// there's no reliable way yet to say "engaged with Faith this week."

import { getState } from './state.js';
import { todayKey, daysBetween } from './utils.js';

const MOOD_WORDS = ['', 'very low', 'low', 'okay', 'good', 'very good'];

function inLastNDays(dateKey, n) {
  const d = daysBetween(dateKey);
  return d >= 0 && d < n;
}

function average(list, key) {
  if (!list.length) return null;
  return list.reduce((sum, item) => sum + item[key], 0) / list.length;
}

export function buildWeeklySummary() {
  const s = getState();
  const thisWeek = s.checkins.filter((c) => inLastNDays(c.date, 7));
  const lastWeek = s.checkins.filter((c) => {
    const d = daysBetween(c.date);
    return d >= 7 && d < 14;
  });
  const journalThisWeek = s.journal.filter((e) => inLastNDays(e.date, 7));

  const thisMood = average(thisWeek, 'mood');
  const lastMood = average(lastWeek, 'mood');
  let moodTrend = 'unknown';
  if (thisMood != null && lastMood != null) {
    if (thisMood - lastMood >= 0.5) moodTrend = 'improving';
    else if (lastMood - thisMood >= 0.5) moodTrend = 'declining';
    else moodTrend = 'steady';
  }

  const gratitudeMoments = thisWeek
    .filter((c) => c.gratitude && c.gratitude.trim())
    .slice(0, 3)
    .map((c) => c.gratitude.trim());

  return {
    weekEnd: todayKey(),
    checkinCount: thisWeek.length,
    avgMood: thisMood,
    avgMoodWord: thisMood != null ? MOOD_WORDS[Math.round(thisMood)] : null,
    moodTrend,
    gratitudeMoments,
    journalCount: journalThisWeek.length,
    hasAnyActivity: thisWeek.length > 0 || journalThisWeek.length > 0,
  };
}

// A synchronous, no-AI-needed fallback — always available, works offline,
// and is what's shown first (then optionally replaced by a warmer AI
// narrative once one resolves — see companion.js). Never comments on
// what's missing; a quiet week gets gentleness, not a reminder of it.
export function structuredReflectionText(summary = buildWeeklySummary()) {
  const parts = [];
  if (summary.checkinCount > 0) parts.push(`nag-check in ka ${summary.checkinCount}x`);
  if (summary.journalCount > 0) {
    parts.push(`nagsulat ka ${summary.journalCount}x sa Journal`);
  }
  if (summary.gratitudeMoments.length) {
    parts.push(`may pinasalamatan kang "${summary.gratitudeMoments[0]}"`);
  }
  if (!parts.length) {
    return 'Tahimik lang ang linggong ito, at okay lang iyan. Nandito lang si Kaibigan kapag handa ka nang mag-check in ulit.';
  }
  return `Ang linggo mo: ${parts.join(', ')}. Patuloy lang, kapatid — bawat hakbang, may saysay.`;
}
