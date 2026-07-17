// Understand Engine — UNDERSTAND step of the agentic loop.
//
// For every situation it recognizes in the context, answers the four
// questions the spec asks of this stage: what is happening, does it need
// attention, what's the user's likely intention, and would acting actually
// help. Pure function (context in, understandings out) so Plan can stay
// pure too and the whole loop is easy to unit test.
//
// Since V0.3, most detectors live in their owning agent module
// (js/agents/faith.js, family.js, creator.js) — this file only keeps the
// cross-cutting ones that don't belong to a single domain (do-not-disturb)
// and the Knowledge Engine's own (small enough to stay here rather than
// grow a fourth agents/knowledge.js for symmetry's sake alone).
import * as faith from './agents/faith.js';
import * as family from './agents/family.js';
import * as creator from './agents/creator.js';

const AGENT_MODULES = [faith, family, creator];

function doNotDisturbUnderstanding(c) {
  const working = Object.values(c.presence).some((status) => status === 'working');
  return {
    id: 'do-not-disturb',
    situation: working ? 'Allen is working.' : 'Allen is not currently working.',
    needsAttention: false, // this one only ever informs Plan's timing choice
    intent: working ? 'Avoid interrupting focused work.' : 'Normal availability.',
    goal: 'Respect focus time.',
  };
}

function knowledgeBriefingUnderstanding(c) {
  if (c.newsCount === 0 || c.knowledgeBriefingShownToday) return null;
  return {
    id: 'knowledge-briefing',
    agent: 'knowledge',
    situation: `${c.newsCount} news headline${c.newsCount === 1 ? '' : 's'} available (Latest AI/world/tech news).`,
    needsAttention: true,
    intent: 'Fresh general knowledge is available and hasn\'t been shared today.',
    goal: 'Keep Allen informed without overwhelming him with a full feed.',
  };
}

export function buildUnderstanding(context) {
  const core = [doNotDisturbUnderstanding(context), knowledgeBriefingUnderstanding(context)].filter(Boolean);
  const fromAgents = AGENT_MODULES.flatMap(
    (mod) => mod.understand(context).map((u) => ({ ...u, agent: mod.id })),
  );
  return [...core, ...fromAgents];
}
