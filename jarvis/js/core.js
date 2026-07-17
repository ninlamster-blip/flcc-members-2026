// JARVIS CORE — the central supervisor agent (Agent Orchestrator).
//
// Runs the full OBSERVE -> UNDERSTAND -> PLAN -> ACT loop each tick, keeps
// track of which specialist agent (Faith/Family/Creator/Knowledge) owns
// each step, and holds the approval queue Act produces for anything that
// reaches a third party. REFLECT/LEARN close the loop once the caller
// reports how the user responded — see recordFeedback().
//
//              JARVIS CORE
//                   |
//   --------------------------------
//   |          |          |          |
//  Faith    Family    Creator    Knowledge
//
// Since V0.3, Faith/Family/Creator are real modules (js/agents/*.js) with
// their own understand()/plan() — plan.js routes to them directly, and the
// AGENTS registry below reads its name/description straight off each
// module instead of duplicating it. Knowledge (V0.2) stays engine-shaped
// (js/knowledge.js) rather than growing a fourth agents/ module; it's
// small enough that the extra layer wouldn't earn its keep yet.
import { todayKey } from './utils.js';
import {
  rollShortTermIfNewDay, pushObservation, getMemory, addGoal, addFamilyMember,
  recordFeedback as memoryRecordFeedback, exportMemory, eraseMemory as erasePersonalMemory,
} from './memory.js';
import { buildContext, describeContext } from './observe.js';
import { buildUnderstanding } from './understand.js';
import { buildPlan } from './plan.js';
import { runPlan, executeStep } from './act.js';
import { reflectOn } from './reflect.js';
import { recordStyleOutcome } from './learn.js';
import {
  refreshNews, getCachedNews, askGlobalKnowledge, isConnected as knowledgeConnected,
  eraseKnowledgeCache,
} from './knowledge.js';
import * as faith from './agents/faith.js';
import * as family from './agents/family.js';
import * as creator from './agents/creator.js';

export const AGENTS = {
  faith: { name: faith.name, description: faith.description },
  family: { name: family.name, description: family.description },
  creator: { name: creator.name, description: creator.description },
  knowledge: { name: 'Knowledge Agent', description: 'News, facts, general questions — kept separate from personal memory.' },
};

// Steps from the most recent tick, keyed by id, so approve()/deny()/
// recordFeedback() can look one up without the caller re-threading state.
// Deliberately in-memory only (not persisted) — it's this session's
// pending work, not a durable record; anything worth keeping past this
// tick is already in memory.js by the time this map would be lost.
let lastSteps = new Map();

export async function tick(signals = {}) {
  const today = todayKey();
  rollShortTermIfNewDay(today);

  const context = buildContext(signals);
  pushObservation(context);

  const understandings = buildUnderstanding(context);
  const plan = buildPlan(context, understandings);
  const { executed, pending, deferred } = await runPlan(plan);

  lastSteps = new Map(plan.map((s) => [s.id, s]));

  return {
    context,
    contextSummary: describeContext(context),
    understandings,
    plan,
    executed,
    pending,
    deferred,
  };
}

export async function approve(actionId) {
  const step = lastSteps.get(actionId);
  if (!step) return null;
  return executeStep(step);
}

export function deny(actionId) {
  const step = lastSteps.get(actionId);
  if (!step) return null;
  return { step, result: { ok: false, detail: 'Denied by user — not sent.' } };
}

// REFLECT + LEARN: called by the UI when the user gives a thumbs up/down
// on something JARVIS did. Feeds the raw tally into memory (reflect.js's
// record) and, for messages whose wording came from the learned `style`
// preference, into Learn so future wording can adapt.
export function recordFeedback(actionId, sentiment) {
  const step = lastSteps.get(actionId);
  const reflection = step ? reflectOn(step, { ok: true }, sentiment) : null;
  memoryRecordFeedback(actionId, sentiment);
  if (step?.styleUsed) recordStyleOutcome(step.styleUsed, sentiment);
  return reflection;
}

export function getAgents() {
  return AGENTS;
}

export function getMemorySnapshot() {
  return getMemory();
}

export { exportMemory };

// "Erase everything" wipes both stores — Personal Memory and the Knowledge
// Engine's own cache — even though they're deliberately separate the rest
// of the time; from the user's side, one button should mean everything on
// this device is gone.
export function eraseMemory() {
  erasePersonalMemory();
  eraseKnowledgeCache();
}

// Direct Knowledge Tool access for the UI's "ask a question" / "refresh
// news" controls — these don't go through Plan because they're the user
// invoking the tool themselves, not JARVIS deciding to. Kept separate from
// personal memory at every layer (see knowledge.js's own header comment).
export { refreshNews, getCachedNews, askGlobalKnowledge, knowledgeConnected };

// Direct Personal Agent access for the UI's own "generate" buttons and
// small add-a-goal/family-member/reminder forms — same reasoning as the
// Knowledge Tool access above: the user invoking a tool directly, not
// JARVIS deciding to via Plan.
export const generatePrayer = faith.generatePrayer;
export const suggestConnectionIdea = family.suggestConnectionIdea;
export const generateIdea = creator.generateIdea;
export const createReminder = creator.createReminder;
export { addGoal, addFamilyMember };
