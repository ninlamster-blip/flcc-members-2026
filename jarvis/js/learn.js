// Learn Engine — LEARN step of the agentic loop.
//
// Turns a stream of Reflect outcomes into the "Learned Preferences" memory
// layer. V0.1 keeps this to the one concrete pattern the spec itself works
// through end to end: which message style (encouraging vs. direct) gets a
// better response, tracked per style rather than per single action so the
// preference generalizes across future ticks —
//   "Jared responds better to encouragement than commands.
//    Future: Use positive messages first."
import { getMemory, setPreference } from './memory.js';

export function recordStyleOutcome(style, sentiment) {
  const mem = getMemory();
  const stats = mem.learned.styleStats[style] || { positive: 0, negative: 0 };
  if (sentiment === 'positive') stats.positive += 1;
  else if (sentiment === 'negative') stats.negative += 1;
  mem.learned.styleStats[style] = stats;
  evaluateStylePreference();
}

// Re-derives the `style` preference from accumulated stats. Only switches
// once a style has a couple of data points and a clear enough edge — a
// single bad reaction shouldn't flip behavior, matching the spec's own
// "avoid repetitive reminders, don't overreact to one signal" spirit.
function evaluateStylePreference() {
  const mem = getMemory();
  const { styleStats } = mem.learned;
  const rate = (s) => (s.positive + s.negative === 0 ? null : s.positive / (s.positive + s.negative));

  const encouraging = styleStats['encouraging-first'];
  const direct = styleStats['direct'];
  const encRate = encouraging ? rate(encouraging) : null;
  const dirRate = direct ? rate(direct) : null;

  if (encRate === null && dirRate === null) return;
  if (encRate !== null && dirRate !== null) {
    if (Math.abs(encRate - dirRate) < 0.2) return; // too close to call
    setPreference('style', encRate > dirRate ? 'encouraging-first' : 'direct');
    return;
  }
  // Only one style has data so far: keep the default unless it's clearly
  // failing (majority negative across at least 3 tries).
  const only = encRate !== null ? { name: 'encouraging-first', rate: encRate, stats: encouraging } : { name: 'direct', rate: dirRate, stats: direct };
  if (only.stats.positive + only.stats.negative >= 3 && only.rate < 0.4) {
    setPreference('style', only.name === 'encouraging-first' ? 'direct' : 'encouraging-first');
  }
}
