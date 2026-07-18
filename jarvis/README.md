# JARVIS Home Sanctuary — V1.0: Proactive Intelligence

A standalone app (same *conventions* as `../ofw-companion` and
`../daily-blessing` — vanilla ES modules, no build step, installable PWA —
but no shared code or data with either) implementing the JARVIS agentic
loop:

```
OBSERVE -> UNDERSTAND -> PLAN -> ACT -> REFLECT -> LEARN
```

This covers **V0.1: Agentic Core** (Observe/Planning/Action engines, Memory),
**V0.2: Knowledge** (News, Search, general intelligence), **V0.3: Personal
Agents** (Faith, Family, Creator), **V0.4: Home** (Apple TV, HomePod, Bose,
Home Assistant), and a first real slice of **V1.0: the complete ecosystem**
— the spec's own roadmap treats V1.0 as ongoing polish rather than a fixed
checklist, so "complete" here means the loop can genuinely run itself
instead of only reacting to a click; see Proactive Intelligence below, and
"What V1.0 still doesn't cover" at the end of this file for what's left.

## Open it

Serve the repo root with any static file server and open `jarvis/index.html`
— no build step, no dependencies.

## Fully standalone — independent of ofw-companion

JARVIS shares this repository for hosting and nothing else. It never reads
or writes any `localStorage` key another app in this repo uses, and it
imports no code from `../ofw-companion` or anywhere else outside `jarvis/`.
Every external connection JARVIS can use is configured from *inside
JARVIS's own UI*, under its own keys:

| Connection | Configured in | `localStorage` keys |
|---|---|---|
| AI (Knowledge Q&A + the personal agents' "generate" buttons) | Knowledge Engine panel | `flcc-jarvis-ai-url-v1`, `-secret-v1`, `-apikey-v1` |
| News | (same AI connection above — see Knowledge Engine) | — |
| Home Assistant | Home panel | `flcc-jarvis-home-url-v1`, `-token-v1` |

Nothing is inherited automatically from FLCC Kasama or any other app —
if you've already set up Ask FLCC there, you can point JARVIS's AI
connection at the *same* Cloudflare Worker URL if you want to, but that's
a choice made once, in JARVIS's own settings, not an assumption this app
makes on your behalf.

## How the loop maps to files

| Step | File | What it does |
|---|---|---|
| Observe | `js/observe.js` | Builds one unified context state from time/date (computed) plus presence/events/environment (fed in — see below) and recent long-term memory. |
| Understand | `js/understand.js` | Cross-cutting detectors (do-not-disturb, the Knowledge briefing) plus each personal agent's own `understand()`, merged into one list. |
| Plan | `js/plan.js` | Works out `working` (is Allen mid-focus) once, then routes to each agent's own `plan()` and merges the results into one ordered, prioritized action plan. |
| Act | `js/act.js` + `js/tools.js` | Executes plan steps through a small tool registry (Communication, Memory, Knowledge, Home; Calendar is still stubbed until a real Calendar source exists). Async throughout, since real tools do real I/O. |
| Reflect | `js/reflect.js` | Turns a user's 👍/👎 on an executed action into a reflection record. |
| Learn | `js/learn.js` | Aggregates reflections into `js/memory.js`'s learned-preferences layer — today, which message style (encouraging vs. direct) gets a better response. |
| Orchestrator | `js/core.js` | JARVIS CORE: runs the full loop each tick, routes to the Faith/Family/Creator agent modules and the Knowledge/Home engines, holds the approval queue. |
| Memory | `js/memory.js` | Three layers — short-term (this session, rolls over daily), long-term (durable facts/goals/family/reminders), learned preferences — all in this device's `localStorage` only. |

## Proactive Intelligence (V1.0)

Through V0.4, `core.tick()` only ever ran from a manual "Run tick" click —
a real rule engine, but not yet the spec's "JARVIS should behave like a
personal AI companion that proactively helps the user, not only responds
when asked." V1.0's first slice makes `tick()` safe to call on its own, on
a timer, via the new Proactive Intelligence card at the top of the page:

- **"Enable notifications"** requests real browser `Notification` permission
  (requires a click — browsers won't grant it otherwise) so a `notify` step
  actually surfaces as an OS notification even if the tab is backgrounded,
  not just an update to the page you're not looking at.
- **"Run automatically every N minutes"** starts a `setInterval` that calls
  `core.tick()` reusing whatever was last entered in the Observe form (see
  `app.js`'s `lastSignals`) — automatic ticks don't fabricate new
  information, they just re-evaluate the loop against the last known state
  as time itself moves forward (a new part of day, a new day rolling over)
  and whatever Knowledge/Home have refreshed in the background.
- **Foreground-only, and said so in the UI**: this is a browser tab, not a
  native app or a server. There's no push-notification backend and no
  Service Worker background sync wired up, so the interval only runs while
  the tab stays open — closing it stops everything until it's reopened (at
  which point, if "Run automatically" was left on, it resumes — see the
  `flcc-jarvis-proactive-enabled-v1` preference in `app.js`). This is an
  honest limitation of a no-build-step static PWA, not a bug to paper over.

**The dedup problem this exposed, and how it's fixed**: before V1.0, only
two of the app's several `notify`-mode steps had any cadence gating at all
— the Knowledge briefing (`knowledge.js`'s own `lastBriefingDate`) and the
weekly goals review (`tools.js`'s `goalsReminder`, added in V0.3 to fix a
similar bug). Every other notify step (screen time, evening check-in,
devotion reminders, the V0.4 device-during-devotion suggestion) had none —
harmless when a human decides when to click "Run tick", but exactly the
kind of repetitive reminder the spec's own Reflect/Learn example warns
against once ticks fire automatically every few minutes. `core.tick()` now
generalizes the fix for every agent at once, using new `shortTerm` state in
`memory.js` that rolls over daily along with everything else short-term:

- `notifiedIds` — a `notify` step won't fire again the same day once it
  has.
- `pendingApprovals` — an `ask-permission` step joins a **persistent**
  queue instead of being recomputed fresh each tick. This matters more than
  it sounds: recomputing pending items fresh every tick would either
  duplicate an already-queued request, or — worse — silently drop one the
  user hasn't acted on yet the moment a later tick's plan stops including
  it (e.g. once `working` flips, or the triggering condition briefly
  clears). Now a request sits in the queue until explicitly approved or
  denied, surviving any number of ticks and even a page reload in between.
- `resolvedIds` — once approved or denied, that id won't re-queue itself
  later the same day even if the same situation is still true.
- `rememberFact()` in `memory.js` also now skips an exact repeat of the
  most recent long-term fact, so the record-tick step (which does still run
  every tick — it's `act-automatically`, not gated) doesn't flood memory
  with identical entries when nothing has actually changed between two
  automatic ticks a few minutes apart.

The "Already covered today" list on the Plan & Act card makes the dedup
itself visible — same Safety Principle reasoning as everything else here:
the user should be able to see what JARVIS decided not to repeat, not just
what it did.

## No live Calendar/Presence yet — this is where it plugs in

There's still no real Calendar or Presence integration, so `index.html`'s
"Observe" form is a stand-in for that part: it feeds `observe.js` the same
shape a real Calendar/Presence source will eventually populate automatically
(`{ presence, events, environmentNote, raw }`). Device/home status is no
longer part of that stand-in — see Home Engine below — and wiring up a real
Calendar source later only changes *where* the remaining signals come from;
nothing downstream (Understand, Plan, Act) needs to change.

## Knowledge Engine (V0.2)

`js/knowledge.js` is the spec's "Knowledge Engine," and it is a genuinely
separate module and a separate `localStorage` key
(`flcc-jarvis-knowledge:v1`) from Personal Memory (`memory.js`'s
`flcc-jarvis:v1`) — the spec's Memory System explicitly calls for keeping
"Personal Memory AND Global Knowledge" apart, so this isn't just a comment,
it's two different stores that only meet inside `observe.js`'s unified
context state.

- **News** (real, live): `GET {proxyUrl}/news`, where `proxyUrl` is
  whatever Cloudflare Worker URL the user enters in the Knowledge Engine
  panel — any Worker running `../ask-proxy/worker.js`'s code exposes this
  endpoint (RSS from BBC/Guardian/NPR/Al Jazeera/ABS-CBN/Inquirer/GMA plus
  Apple Newsroom and Ars Technica, covering the spec's Technology/Apple-
  ecosystem categories). Needs only a Worker URL — no Anthropic key
  required. JARVIS doesn't assume or share any particular Worker; the user
  picks one (it can be the same Worker `../ofw-companion` uses, or a
  different one entirely — JARVIS has no way to tell, and doesn't care).
- **Search / general knowledge** (real, only when an AI connection exists):
  `POST {proxyUrl}/proxy` (or a direct Anthropic API key), via `js/ai-client.js`
  — JARVIS's own connection, its own `localStorage` keys, configured in the
  same panel — with a system prompt that contains zero personal data.
  Intentional: this is the Global Knowledge side of the Memory System, not
  a personal-agent conversation.
- **Graceful offline degradation**: with no connection configured, every
  Knowledge function returns a well-formed `{ ok: false, detail }` instead of
  throwing — same offline-first philosophy as the rest of this repo.
- **Proactive briefing**: `understand.js`'s `knowledgeBriefingUnderstanding`
  flags unseen, cached headlines; `plan.js` surfaces them at most once a day
  (`knowledge.js`'s own `lastBriefingDate`, not a Personal Memory field).

## Personal Agents (V0.3)

`js/agents/faith.js`, `family.js`, and `creator.js` are real modules now,
not just the routing labels Plan attached to a step in V0.1/V0.2. Each one
owns:

- **`understand(context)`** — the detectors that used to live inline in
  `understand.js` (screen time and evening wind-down for Family; scheduled
  devotion and morning devotion for Faith; the goals review for Creator).
- **`plan(context, { understandings, working })`** — the plan steps those
  detectors used to produce directly in `plan.js`. `plan.js` itself is now
  just the orchestrator: compute `working` once, ask each agent for its
  steps, merge, add the Knowledge briefing and the closing record/wait
  steps.
- **One real generative capability**, the spec's "Creation" actions, wired
  to its own button in the demo UI — AI-backed (via `js/ai-client.js`,
  personalized from Personal Memory) when a connection exists, a small
  curated offline pool otherwise:
  - Faith: **`generatePrayer()`** — a short prayer, gently informed by
    `memory.js`'s long-term facts.
  - Family: **`suggestConnectionIdea()`** — informed by `longTerm.family`
    (now a real, editable list rather than a declared-but-unused array).
  - Creator: **`generateIdea()`** and **`createReminder(text)`** — ideas
    informed by `longTerm.goals`; reminders are a plain local list.

Fixed along the way: the weekly goals-review nudge had no way to mark
itself shown (nothing ever called `setPreference('lastGoalsReviewDate', …)`),
so once due it would have fired on every tick forever. It now runs through
its own tiny tool (`tools.js`'s `goalsReminder`) that marks the weekly gate
at the same point the Knowledge Tool's daily briefing does — only once
actually delivered.

## Home Engine (V0.4)

`js/home.js` covers the spec's "Home: Apple TV, HomePod, Bose, Home
Assistant." Apple TV, HomePod, and Bose each speak their own local-network
protocol (AirPlay, HomeKit, SoundTouch) that a static PWA has no way to
reach directly — Home Assistant is the common layer real setups already
use to bridge exactly those three into one place, and it has a clean,
documented REST API a no-build-step app can call directly. Its own
`localStorage` keys (a base URL and a Long-Lived Access Token, entered in
the Home panel) — a separate connection from JARVIS's own AI connection
above, since Home Assistant is a different service entirely.

- **Device list** (real, live): `GET {baseUrl}/api/states`, filtered to
  `media_player.*` entities — the domain Home Assistant's Apple TV,
  HomePod/AirPlay, and Bose SoundTouch integrations all surface devices
  under, regardless of brand.
- **Control** (real): `POST {baseUrl}/api/services/media_player/<service>`
  for play/pause/volume/turn-off, called directly from the Home panel's
  per-device buttons — the user operating their own devices, same as
  asking the Knowledge Tool a question directly.
- **One proactive step, approval-gated**: Family Agent's new
  `deviceDuringDevotionUnderstanding` reads `context.playingDevices` (which
  `observe.js` fuses in from `home.js`, the same pattern it already uses
  for Knowledge's news) and, if something's still playing when family
  devotion is scheduled, plans a `suggest-pause-for-devotion` step. Unlike
  the read-only news briefing, this one **changes physical device state**,
  so — same reasoning as messaging Jared directly — it's always
  `requiresApproval: true`. Approving it calls `home.js`'s
  `pauseAllPlaying()` through `tools.js`'s `home` tool.
- **Graceful offline degradation**: with no connection configured, every
  Home function returns a well-formed `{ ok: false, detail }`, same as
  Knowledge.
- **Not a fifth agent**: Home stays engine-shaped like Knowledge rather
  than growing its own `js/agents/` module — per the spec's own diagram,
  it's a tool the four agents reach for (here, Family reaches for it),
  not an agent in its own right.

A known limitation worth naming: if this app is served over HTTPS (as it
will be once deployed) and Home Assistant is only reachable over plain
HTTP on the local network, the browser will block the request as mixed
content. Home Assistant's own remote-access options (Nabu Casa, a
reverse proxy with a certificate) route around this the same way they
would for any other client — nothing here is JARVIS-specific.

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

## What V1.0 still doesn't cover

Named honestly rather than left implicit:

- **No real Calendar/Presence source** — still the manual Observe form.
- **V0.4 has only been tested against a mock Home Assistant REST API**, not
  a real instance.
- **No PWA icons** — `manifest.webmanifest`'s `icons` is still empty, unlike
  `../ofw-companion`'s and `../daily-blessing`'s installed-icon treatment.
- **Foreground-only proactivity** — see above. A genuinely always-on
  assistant needs either a native shell or a push-notification backend;
  neither exists here.

## Extending it

- New signal: add a small `*Signal`-style function in `observe.js`.
- New situation for an existing agent: add one detector function to that
  agent's own `understand()` (`js/agents/faith.js`/`family.js`/`creator.js`).
- New plan step for an existing agent: add one entry in that agent's own
  `plan()`, same ordered-rules shape `../ofw-companion/js/companion-brain.js`
  uses.
- New tool: add one entry to `TOOLS` in `tools.js`.
- New specialist agent: add a module under `js/agents/` exporting `id`,
  `name`, `description`, `understand()`, and `plan()`; list it in
  `understand.js`'s and `plan.js`'s `AGENT_MODULES`, and in `core.js`'s
  `AGENTS` registry.
