// Planning Engine — PLAN step of the agentic loop.
//
// Turns understandings into an ordered action plan, answering the spec's
// four planning questions per step: notify / ask permission / act
// automatically / wait. Since V0.3, most of the actual rule-building lives
// in each domain's agent module (js/agents/faith.js, family.js, creator.js)
// — this file is the orchestrator: it works out the one cross-cutting
// fact every agent needs (`working`, from the do-not-disturb understanding)
// and merges each agent's plan with the Knowledge Engine's own step and the
// two structural steps (a quiet memory record, and "nothing to do").
//
// Every step still carries:
//   - `agent`: which specialist (Faith/Family/Creator/Knowledge) owns it.
//   - `mode`: notify | ask-permission | act-automatically | wait.
//   - `requiresApproval`: Safety Principle in code. Anything that reaches a
//     third party (not the primary user) always requires approval before
//     Act executes it — JARVIS may *suggest* Allen reconnect with Jared,
//     but it never messages Jared on its own. Memory writes and messages
//     to Allen himself don't need approval: reversible, visible, erasable.
//
// `working` (Allen mid-focus) doesn't cancel other steps — it defers them:
// their mode is downgraded to 'wait' so nothing interrupts him, matching
// the spec's own example ("Do not interrupt Allen" as step 1, not "skip
// everything else").
import * as faith from './agents/faith.js';
import * as family from './agents/family.js';
import * as creator from './agents/creator.js';

const AGENT_MODULES = [faith, family, creator];

function findings(understandings, id) {
  return understandings.find((u) => u.id === id) || null;
}

export function buildPlan(context, understandings) {
  const working = findings(understandings, 'do-not-disturb')?.intent.includes('Avoid interrupting');
  const steps = [];

  for (const mod of AGENT_MODULES) {
    steps.push(...mod.plan(context, { understandings, working }));
  }

  const knowledgeBriefing = findings(understandings, 'knowledge-briefing');
  if (knowledgeBriefing?.needsAttention) {
    steps.push({
      id: 'knowledge-briefing',
      agent: 'knowledge',
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: `${knowledgeBriefing.situation} Want today's headlines?`,
      tool: { name: 'knowledge', params: {} },
    });
  }

  // A quiet record of this tick, whenever something worth remembering
  // happened — safe to run without approval: it only writes to Allen's own
  // memory, never sent anywhere, and stays visible/erasable like everything
  // else in long-term memory.
  if (steps.length > 0) {
    steps.push({
      id: 'record-tick',
      agent: 'knowledge',
      mode: 'act-automatically',
      requiresApproval: false,
      target: 'memory',
      message: understandings.map((u) => u.situation).join(' '),
      tool: { name: 'remember', params: {} },
    });
  }

  if (steps.length === 0) {
    steps.push({
      id: 'wait',
      agent: 'knowledge',
      mode: 'wait',
      requiresApproval: false,
      target: null,
      message: 'Nothing needs attention right now.',
      tool: null,
    });
  }

  return steps;
}
