// Creator Agent — ideas, reminders, generated content. Owns the spec's
// "Creation: Create reminders, Suggest ideas" actions, plus the weekly
// goals-review nudge that used to live inline in plan.js.
import { getMemory, addReminder, getPreference } from '../memory.js';
import { isConnected, callAI } from '../ai-client.js';

export const id = 'creator';
export const name = 'Creator Agent';
export const description = 'Ideas, reminders, generated content.';

function goalsReviewUnderstanding(c) {
  if (c.openGoals.length === 0) return null;
  return {
    id: 'goals-review',
    situation: `${c.openGoals.length} open personal goal${c.openGoals.length === 1 ? '' : 's'} on file.`,
    needsAttention: false, // Plan gates this to a weekly cadence, not every tick
    intent: 'Worth surfacing periodically so goals don\'t quietly go stale.',
    goal: 'Keep personal growth visible without nagging.',
  };
}

export function understand(context) {
  return [goalsReviewUnderstanding(context)].filter(Boolean);
}

export function plan(context, { understandings, working }) {
  const steps = [];
  const goals = understandings.find((u) => u.id === 'goals-review');
  if (!goals) return steps;

  const lastReviewed = getPreference('lastGoalsReviewDate', null);
  const dueWeekly = lastReviewed === null || (Date.now() - lastReviewed) >= 7 * 86400000;
  if (dueWeekly) {
    steps.push({
      id: 'weekly-goals-review',
      agent: id,
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: `You have not reviewed your ${goals.situation.match(/^\d+/)[0]} personal goal(s) this week.`,
      // Its own tool (rather than the generic 'notify') so delivering it
      // also marks the weekly gate — same "only mark shown once actually
      // delivered" rule knowledge.js's daily briefing follows.
      tool: { name: 'goalsReminder', params: {} },
    });
  }

  return steps;
}

const OFFLINE_IDEAS = [
  "Write down one thing you're proud of from this week.",
  'Plan a 20-minute walk for tomorrow morning.',
  'Message an old friend just to say hello.',
  'Block 15 minutes tomorrow for something purely for yourself.',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// "Suggest ideas" — personalized against open goals when connected.
export async function generateIdea() {
  if (!isConnected()) return { ok: true, detail: pick(OFFLINE_IDEAS) };
  const mem = getMemory();
  const goals = mem.longTerm.goals.map((g) => g.text).join('; ') || 'no specific goals on file';
  const result = await callAI({
    system: `Suggest one short, practical idea or reminder for Allen based on his personal goals: ${goals}. One or two sentences, no preamble.`,
    message: 'Suggest one idea for today.',
    maxTokens: 150,
  });
  return result.ok ? result : { ok: true, detail: `${pick(OFFLINE_IDEAS)} (offline fallback — ${result.detail})` };
}

// "Create reminders" — always local, no AI needed.
export function createReminder(text) {
  addReminder(text);
  return { ok: true, detail: `Reminder saved: ${text}` };
}
