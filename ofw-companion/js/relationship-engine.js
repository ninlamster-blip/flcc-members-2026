// Relationship Engine — picks one remembered detail worth a warm, specific
// follow-up in the AI's daily conversation opener ("Last week you mentioned
// missing your daughter — how are you feeling about that this week?"),
// working through the backlog of shared memories in the order they were
// given rather than leaving it to chance which one (if any) the AI happens
// to bring up on its own. Part of the Companion Brain (see js/agent-
// brain.js for the full five-brain map) — companion.js and ai.js are the
// other two pieces. No DOM here, same pattern as those.
//
// "Always rely on information the user intentionally shared and can
// manage" — this reads from state.js's `memories`, the exact store the AI
// already writes to mid-conversation (see the <memory> tag instruction in
// ai.js) and that's already fully visible and erasable from Settings >
// "What Kaibigan remembers." No new consent surface, no new storage of
// anything the member didn't already choose to share — this module only
// decides which already-shared thing to gently ask about next.

import { getState } from './state.js';

// The oldest memory that hasn't been proactively followed up on yet.
// Working oldest-first means something shared weeks ago doesn't stay
// permanently buried under whatever's newest. Once every memory has had at
// least one follow-up, this returns null rather than repeating one — a
// second-pass/cooldown policy is a reasonable future addition, not needed
// for a first slice.
export function nextFollowUpCandidate() {
  const { memories } = getState();
  const notYetFollowedUp = memories.filter((m) => !m.followedUpAt);
  if (!notYetFollowedUp.length) return null;
  return notYetFollowedUp.reduce((oldest, m) => (m.t < oldest.t ? m : oldest));
}

// Decides what the daily opener's hint should actually be: an urgent,
// actionable nudge from the Decision Engine (heavy heart, a journal gap...)
// always wins when there is one — it's time-sensitive in a way a personal
// callback isn't. A remembered detail fills the quiet moments instead of
// competing with something that actually needs saying today.
export function pickGreetingHint(urgentHint) {
  if (urgentHint) return { text: urgentHint, followUpMemoryText: null };
  const candidate = nextFollowUpCandidate();
  if (candidate) {
    return {
      text: `Gently ask how they're doing with this, only if it fits naturally: "${candidate.text}"`,
      followUpMemoryText: candidate.text,
    };
  }
  return { text: '', followUpMemoryText: null };
}
