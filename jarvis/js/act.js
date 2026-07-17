// Action Engine — ACT step of the agentic loop.
//
// Executes plan steps through the tool registry (tools.js). Three outcomes
// per step, matching Plan's `mode`:
//   - 'wait':            not executed, recorded as deferred.
//   - 'notify' /
//     'act-automatically': executed immediately — Plan already established
//                           these don't need approval (they reach only
//                           Allen himself, or only write to his own memory).
//   - 'ask-permission':   never auto-executed here. Returned as `pending`
//                         for the caller to hold until the user approves or
//                         denies (see executeStep(), called later by
//                         core.js's approve()).
import { TOOLS } from './tools.js';

export function runPlan(steps) {
  const executed = [];
  const pending = [];
  const deferred = [];

  for (const step of steps) {
    if (step.mode === 'wait' || !step.tool) {
      deferred.push(step);
      continue;
    }
    if (step.requiresApproval) {
      pending.push(step);
      continue;
    }
    executed.push(executeStep(step));
  }

  return { executed, pending, deferred };
}

// Runs exactly one step's tool and returns the result attached to the step
// — shared by runPlan() above and core.js's approve()/deny() so an
// approved step is executed through the same path as an automatic one.
export function executeStep(step) {
  const tool = TOOLS[step.tool.name];
  const result = tool.run({ message: step.message, to: step.target, ...step.tool.params });
  return { step, result };
}
