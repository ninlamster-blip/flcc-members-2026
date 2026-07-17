// Planning Engine — PLAN step of the agentic loop.
//
// Turns understandings into an ordered action plan, answering the spec's
// four planning questions per step: notify / ask permission / act
// automatically / wait. Mirrors companion-brain.js's RULES pattern (ordered
// list of `when` + `build`), extended with:
//   - `agent`: which specialist (Faith/Family/Creator/Knowledge) this step
//     belongs to — a routing hint for the orchestrator, real specialist
//     modules land in V0.3.
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
import { getPreference } from './memory.js';

function currentStyle() {
  return getPreference('style', 'encouraging-first');
}

function styleLine(encouraging, direct) {
  return currentStyle() === 'direct' ? direct : encouraging;
}

function findings(understandings, id) {
  return understandings.find((u) => u.id === id) || null;
}

export function buildPlan(context, understandings) {
  const working = findings(understandings, 'do-not-disturb')?.intent.includes('Avoid interrupting');
  const steps = [];

  const screenTime = findings(understandings, 'screen-time');
  if (screenTime?.needsAttention) {
    steps.push({
      id: 'notify-jared-gaming',
      agent: 'family',
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: styleLine(
        `Jared's been gaming a while. ${screenTime.situation} Might be a good moment to check in.`,
        `${screenTime.situation} Consider suggesting a break.`,
      ),
      styleUsed: currentStyle(),
      tool: { name: 'notify', params: {} },
    });
    steps.push({
      id: 'suggest-encouragement-to-jared',
      agent: 'family',
      mode: 'ask-permission',
      requiresApproval: true, // reaches Jared, not Allen — always gated
      target: 'jared',
      message: styleLine(
        "Hey, having fun? Whenever you're ready, would love to hang out for a bit.",
        'Time for a break soon?',
      ),
      styleUsed: currentStyle(),
      tool: { name: 'message', params: { to: 'jared' } },
    });
  }

  const devotion = findings(understandings, 'family-devotion');
  if (devotion?.needsAttention) {
    steps.push({
      id: 'notify-devotion',
      agent: 'faith',
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: `${devotion.situation} A gentle reminder, not a demand.`,
      tool: { name: 'notify', params: {} },
    });
  }

  const morning = findings(understandings, 'morning-devotion');
  if (morning?.needsAttention && !devotion) {
    steps.push({
      id: 'suggest-morning-devotion',
      agent: 'faith',
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: 'Allen, today you have time for a short devotion before work.',
      tool: { name: 'notify', params: {} },
    });
  }

  const evening = findings(understandings, 'evening-checkin');
  // Only add the generic evening nudge if the gaming-specific one above
  // didn't already cover reconnecting with family tonight.
  if (evening?.needsAttention && !screenTime?.needsAttention) {
    steps.push({
      id: 'suggest-evening-connection',
      agent: 'family',
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: 'Your evening is winding down — a good moment to connect with family.',
      tool: { name: 'notify', params: {} },
    });
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

  const goals = findings(understandings, 'goals-review');
  if (goals) {
    const lastReviewed = getPreference('lastGoalsReviewDate', null);
    const dueWeekly = lastReviewed === null
      || (Date.now() - lastReviewed) >= 7 * 86400000;
    if (dueWeekly) {
      steps.push({
        id: 'weekly-goals-review',
        agent: 'creator',
        mode: working ? 'wait' : 'notify',
        requiresApproval: false,
        target: 'allen',
        message: `You have not reviewed your ${goals.situation.match(/^\d+/)[0]} personal goal(s) this week.`,
        tool: { name: 'notify', params: {} },
      });
    }
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
