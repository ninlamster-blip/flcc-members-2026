// Reflect Engine — REFLECT step of the agentic loop.
//
// After an action runs (or after enough time passes with no response),
// asks the spec's questions: did this help, was the timing right, did the
// user respond positively, should the behavior change? V0.1 has no way to
// detect "the user ignored it" on its own (no read receipts), so it relies
// on explicit feedback from the UI — a thumbs up/down on each executed
// action — same signal the spec's own example uses ("User ignored
// message").
//
// Pure: takes a step + result + sentiment, returns a reflection record.
// Learn (learn.js) is what turns a stream of these into a preference.
export function reflectOn(step, result, sentiment /* 'positive' | 'negative' | null */) {
  return {
    actionId: step.id,
    agent: step.agent,
    message: step.message,
    ok: result.ok,
    sentiment,
    at: Date.now(),
    note: sentiment === 'negative'
      ? 'User did not respond well — Learn should try a different approach next time.'
      : sentiment === 'positive'
        ? 'User responded positively — reinforce this approach.'
        : 'No feedback yet.',
  };
}
