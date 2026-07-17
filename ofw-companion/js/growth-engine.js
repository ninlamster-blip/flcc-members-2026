// Growth Engine — spots longer-horizon patterns worth celebrating, built
// from the same on-device data as the rest of the Companion Brain (see
// js/companion-brain.js and js/reflection-engine.js for the same pattern:
// no DOM here, just facts in and a plain highlight out).
//
// "Encourage growth, not score spirituality" — this module only ever
// surfaces something trending UP. It never reports a decline: that's
// already the Decision Engine's job elsewhere (mood-declining, a journal
// or check-in gap), each paired with an offer of support rather than a
// scorecard. Repeating a decline here would be scoring, not encouraging.
//
// Deliberately scoped to what's reliably computable today: wellbeing
// check-ins and Journal entries both keep full dated history, so a
// month-over-month comparison is honest. Prayer activity, Bible/faith
// engagement, and community participation are natural additions once
// those features track per-entry dates the way these two already do.

import { getState } from './state.js';
import { daysBetween } from './utils.js';

function inWindow(dateKey, minDaysAgo, maxDaysAgo) {
  const d = daysBetween(dateKey);
  return d >= minDaysAgo && d <= maxDaysAgo;
}

function countGratitude(checkins) {
  return checkins.filter((c) => c.gratitude && c.gratitude.trim()).length;
}

export function buildGrowthSummary() {
  const s = getState();
  const thisMonth = s.checkins.filter((c) => inWindow(c.date, 0, 29));
  const lastMonth = s.checkins.filter((c) => inWindow(c.date, 30, 59));
  const journalThisMonth = s.journal.filter((e) => inWindow(e.date, 0, 29));
  const journalLastMonth = s.journal.filter((e) => inWindow(e.date, 30, 59));

  return {
    checkinCountThisMonth: thisMonth.length,
    checkinCountLastMonth: lastMonth.length,
    journalCountThisMonth: journalThisMonth.length,
    journalCountLastMonth: journalLastMonth.length,
    gratitudeThisMonth: countGratitude(thisMonth),
    gratitudeLastMonth: countGratitude(lastMonth),
    // A comparison needs real data on both sides — one check-in last month
    // and one this month isn't a "trend," it's a coincidence.
    hasEnoughData: thisMonth.length >= 2 && lastMonth.length >= 2,
  };
}

// Picks the single strongest positive trend to highlight, or null if there
// isn't one worth mentioning yet. Never returns more than one — the whole
// point is one genuine, specific thing to notice, not a scoreboard.
export function findGrowthHighlight(summary = buildGrowthSummary()) {
  if (!summary.hasEnoughData) return null;
  const candidates = [];

  if (summary.gratitudeThisMonth > summary.gratitudeLastMonth) {
    candidates.push({
      kind: 'gratitude',
      text: `Mas madalas kang nagpapasalamat ngayong buwan kumpara noong nakaraan — napapansin namin 'yan.`,
      strength: summary.gratitudeThisMonth - summary.gratitudeLastMonth,
    });
  }
  if (summary.checkinCountThisMonth > summary.checkinCountLastMonth) {
    candidates.push({
      kind: 'checkin-consistency',
      text: `Mas consistent kang nag-che-check in ngayong buwan kaysa noong nakaraan. Malaking bagay ang pagpapatuloy.`,
      strength: summary.checkinCountThisMonth - summary.checkinCountLastMonth,
    });
  }
  if (summary.journalCountThisMonth > summary.journalCountLastMonth) {
    candidates.push({
      kind: 'journal-consistency',
      text: `Mas madalas kang sumusulat sa Journal ngayong buwan. Salamat sa pagiging tapat sa sarili mo.`,
      strength: summary.journalCountThisMonth - summary.journalCountLastMonth,
    });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.strength - a.strength);
  return candidates[0];
}
