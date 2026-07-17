# JARVIS Home Sanctuary — V0.1 Agentic Core

A standalone app (same pattern as `../ofw-companion` and `../daily-blessing`:
vanilla ES modules, no build step, installable PWA) implementing the first
slice of the JARVIS agentic loop:

```
OBSERVE -> UNDERSTAND -> PLAN -> ACT -> REFLECT -> LEARN
```

This is **V0.1: Agentic Core** from the project's own development strategy —
Observe engine, Planning engine, Action engine, Memory. Knowledge (V0.2),
dedicated Faith/Family/Creator personal agents (V0.3), and real Home control
(V0.4) are out of scope here; this lays the foundation they'll plug into.

## Open it

Serve the repo root with any static file server and open `jarvis/index.html`
— no build step, no dependencies.

## How the loop maps to files

| Step | File | What it does |
|---|---|---|
| Observe | `js/observe.js` | Builds one unified context state from time/date (computed) plus presence/events/environment (fed in — see below) and recent long-term memory. |
| Understand | `js/understand.js` | Pure detectors that ask "what's happening, does it need attention, what's the intent, is this helpful" for each situation. |
| Plan | `js/plan.js` | Turns understandings into an ordered, prioritized action plan: which agent owns it, whether to notify / ask permission / act automatically / wait. |
| Act | `js/act.js` + `js/tools.js` | Executes plan steps through a small tool registry (Communication, Memory; Calendar/Home/Knowledge are stubbed until their versions land). |
| Reflect | `js/reflect.js` | Turns a user's 👍/👎 on an executed action into a reflection record. |
| Learn | `js/learn.js` | Aggregates reflections into `js/memory.js`'s learned-preferences layer — today, which message style (encouraging vs. direct) gets a better response. |
| Orchestrator | `js/core.js` | JARVIS CORE: runs the full loop each tick, owns the agent registry (Faith/Family/Creator/Knowledge routing labels), holds the approval queue. |
| Memory | `js/memory.js` | Three layers — short-term (this session, rolls over daily), long-term (durable facts/goals/family), learned preferences — all in this device's `localStorage` only. |

## No live sources yet — this is where they plug in

V0.1 has no real Calendar, Weather, or Home integration, so `index.html`'s
"Observe" form is a stand-in: it feeds `observe.js` the same shape a real
Calendar/Presence/Home source will eventually populate automatically
(`{ presence, events, environmentNote, raw }`). Wiring up a real source later
only changes *where* those signals come from — nothing downstream (Understand,
Plan, Act) needs to change.

## Safety Principle, in code

- **Never decide important things without approval**: any action that
  reaches someone other than the primary user (e.g. a message meant for
  Jared) is planned with `mode: 'ask-permission'` and sits in the "Awaiting
  your approval" list until explicitly approved — see `plan.js` and the
  approval queue in `core.js`/`act.js`.
- **Never spy, control, or manipulate**: JARVIS only ever *suggests* to the
  primary user; it never contacts a family member on its own initiative.
- **Privacy / user control**: everything lives in `localStorage` on this
  device. "Export memory" and "Erase everything" in the Memory panel are the
  same one-tap export/erase pattern as the rest of this repo's apps.

## Extending it

- New signal: add a small `*Signal`-style function in `observe.js`.
- New situation: add one detector function to `understand.js`'s `DETECTORS`.
- New plan step: add one entry in `plan.js`'s `buildPlan()`, same
  ordered-rules shape as `../ofw-companion/js/companion-brain.js`.
- New tool: add one entry to `TOOLS` in `tools.js`.
- New specialist agent (V0.3): give it its own module and let `core.js`
  route plan steps tagged with its key to it, instead of treating the key as
  just a display label.
