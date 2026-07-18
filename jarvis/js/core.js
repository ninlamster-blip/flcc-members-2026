// JARVIS CORE — the central supervisor agent (Agent Orchestrator).
//
// Runs the full OBSERVE -> UNDERSTAND -> PLAN -> ACT loop each tick, keeps
// track of which specialist agent (Faith/Family/Creator/Knowledge) owns
// each step, and holds the durable approval queue Act produces for anything
// that reaches a third party. REFLECT/LEARN close the loop once the caller
// reports how the user responded — see recordFeedback().
//
// tick() is deliberately safe to call on a timer (see app.js's Proactive
// mode) and not just from a manual click — see the same-day dedup logic
// inside it below.
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
// module instead of duplicating it. Knowledge (V0.2), Home (V0.4), and
// Calendar stay engine-shaped (js/knowledge.js, js/home.js,
// js/calendar.js) rather than growing agents/ modules of their own — per
// the spec's own diagram, they're tools/sources the four agents above
// reach for or read from (Family reaches for the Home Tool to pause a
// device during devotion; Faith reads Calendar's events via context, both
// fused in by observe.js), not agents in their own right.
import { todayKey } from './utils.js';
import {
  rollShortTermIfNewDay, pushObservation, getMemory, addGoal, addFamilyMember,
  recordFeedback as memoryRecordFeedback, exportMemory, eraseMemory as erasePersonalMemory,
  wasNotifiedToday, markNotifiedToday, wasResolvedToday, markResolvedToday,
  getPendingApprovals, addPendingApproval, removePendingApproval,
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
import {
  getConnection as getAiConnection, saveConnection as saveAiConnection,
} from './ai-client.js';
import {
  refreshDevices, getCachedDevices, controlDevice, isConnected as homeConnected,
  getConnection as getHomeConnection, saveConnection as saveHomeConnection,
  eraseHomeCache,
} from './home.js';
import {
  refreshEvents, getCachedEvents, isConfigured as calendarConfigured,
  getIcsUrl, getTzOffsetMinutes, saveSettings as saveCalendarSettings,
  eraseCalendarCache,
} from './calendar.js';
import * as faith from './agents/faith.js';
import * as family from './agents/family.js';
import * as creator from './agents/creator.js';

export const AGENTS = {
  faith: { name: faith.name, description: faith.description },
  family: { name: family.name, description: family.description },
  creator: { name: creator.name, description: creator.description },
  knowledge: { name: 'Knowledge Agent', description: 'News, facts, general questions — kept separate from personal memory.' },
};

// Executed/deferred steps from the most recent tick, keyed by id, so
// recordFeedback() can look one up without the caller re-threading state.
// Deliberately in-memory only (not persisted) — a thumbs up/down only ever
// makes sense right after seeing the result in this same session; anything
// worth keeping past that is already in memory.js. Pending approvals are
// NOT looked up here — see the persistent queue below.
let lastSteps = new Map();

// Proactive Intelligence: tick() is safe to call automatically and
// repeatedly (see app.js's scheduler), not just from a manual click. Two
// things make that safe instead of spammy:
//   - `notify` steps fire at most once a day per step id (wasNotifiedToday/
//     markNotifiedToday) — screen-time, evening check-in, devotion
//     reminders etc. previously had no such gate at all; only the
//     Knowledge briefing and weekly goals review (each via their own
//     one-off mechanism) did. This generalizes the same idea to every
//     agent's notify steps in one place instead of each hand-rolling it.
//   - `ask-permission` steps join a *persistent* queue (pendingApprovals)
//     instead of being recomputed fresh each tick — recomputing them would
//     either duplicate an already-queued request or, worse, silently drop
//     one the user hasn't acted on yet the moment a later tick's plan
//     stops including it. Once approved or denied, the id is marked
//     resolved for the day so the same situation doesn't re-queue itself
//     five minutes later.
export async function tick(signals = {}) {
  const today = todayKey();
  rollShortTermIfNewDay(today);

  const context = buildContext(signals);
  pushObservation(context);

  const understandings = buildUnderstanding(context);
  const rawPlan = buildPlan(context, understandings);

  const runnable = [];
  const alreadyHandled = [];
  for (const step of rawPlan) {
    if (step.mode === 'notify' && wasNotifiedToday(step.id)) { alreadyHandled.push(step); continue; }
    if (step.requiresApproval && wasResolvedToday(step.id)) { alreadyHandled.push(step); continue; }
    runnable.push(step);
  }

  const { executed, pending: newlyPending, deferred } = await runPlan(runnable);

  for (const { step } of executed) {
    if (step.mode === 'notify') markNotifiedToday(step.id);
  }
  for (const step of newlyPending) addPendingApproval(step);

  lastSteps = new Map(rawPlan.map((s) => [s.id, s]));

  return {
    context,
    contextSummary: describeContext(context),
    understandings,
    plan: rawPlan,
    executed,
    pending: getPendingApprovals(),
    deferred, // mode: 'wait' only — genuinely waiting, not yet handled
    alreadyHandledToday: alreadyHandled, // already notified/resolved earlier today — won't repeat
  };
}

export async function approve(actionId) {
  const step = getPendingApprovals().find((s) => s.id === actionId) || lastSteps.get(actionId);
  if (!step) return null;
  removePendingApproval(actionId);
  markResolvedToday(actionId, 'approved');
  return executeStep(step);
}

export function deny(actionId) {
  const step = getPendingApprovals().find((s) => s.id === actionId) || lastSteps.get(actionId);
  if (!step) return null;
  removePendingApproval(actionId);
  markResolvedToday(actionId, 'denied');
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

// "Erase everything" wipes every store — Personal Memory, the Knowledge
// Engine's cache, and the Home Engine's cache — even though they're
// deliberately separate the rest of the time; from the user's side, one
// button should mean everything on this device is gone. (Home Assistant's
// own connection settings are credentials, not cached data, and are left
// for the user to clear from the Home panel itself, same as Settings
// elsewhere in this repo never auto-clears a saved connection.)
export function eraseMemory() {
  erasePersonalMemory();
  eraseKnowledgeCache();
  eraseHomeCache();
  eraseCalendarCache();
}

// Direct Knowledge Tool access for the UI's "ask a question" / "refresh
// news" controls — these don't go through Plan because they're the user
// invoking the tool themselves, not JARVIS deciding to. Kept separate from
// personal memory at every layer (see knowledge.js's own header comment).
export {
  refreshNews, getCachedNews, askGlobalKnowledge, knowledgeConnected,
  getAiConnection, saveAiConnection,
};

// Direct Home Tool access for the UI's device-control panel — same
// reasoning: the user operating their own devices directly, not JARVIS
// deciding to via Plan (Plan only ever calls the 'home' tool's pauseAll,
// see tools.js and agents/family.js).
export {
  refreshDevices, getCachedDevices, controlDevice, homeConnected,
  getHomeConnection, saveHomeConnection,
};

// Direct Calendar access for the UI's Calendar panel — same reasoning as
// Knowledge/Home above. Plan never calls into calendar.js directly; it
// only ever sees today's events already fused into context by observe.js.
export {
  refreshEvents, getCachedEvents, calendarConfigured,
  getIcsUrl, getTzOffsetMinutes, saveCalendarSettings,
};

// Direct Personal Agent access for the UI's own "generate" buttons and
// small add-a-goal/family-member/reminder forms — same reasoning as the
// Knowledge Tool access above: the user invoking a tool directly, not
// JARVIS deciding to via Plan.
export const generatePrayer = faith.generatePrayer;
export const suggestConnectionIdea = family.suggestConnectionIdea;
export const generateIdea = creator.generateIdea;
export const createReminder = creator.createReminder;
export { addGoal, addFamilyMember };
