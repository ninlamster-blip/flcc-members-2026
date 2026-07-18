# JARVIS Home Sanctuary — V1.0: Proactive Intelligence + Calendar + Presence

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

## Icon

`icons/` — the same file set and manifest wiring `../ofw-companion`'s
`icons/` uses, so JARVIS installs to a home screen with a real icon instead
of a generic placeholder. The design is literally the architecture diagram
from the top of the project spec: a glowing JARVIS CORE with its four
agents (Faith/Family/Creator/Knowledge) as satellites around it, each a
different color.

- `icon.svg` / `icon-maskable.svg` — the actual source, hand-editable if
  the design ever needs to change. `icon-maskable.svg` is the same drawing
  scaled into the ~80% "safe zone" the maskable-icon spec requires, since a
  maskable icon can be cropped to any shape (circle, squircle, ...) by the
  OS.
- `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`,
  `apple-touch-icon.png` — those two SVGs rendered to PNG at each size the
  manifest/`<link>` tags need (PNG rather than SVG directly because
  manifest icons and `apple-touch-icon` need concrete raster sizes, not a
  scalable source).

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
| Calendar | Calendar panel | `flcc-jarvis-calendar-ics-url-v1`, `-tz-offset-v1` (routed through the same Worker URL as News, above) |
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
| Act | `js/act.js` + `js/tools.js` | Executes plan steps through a small tool registry (Communication, Memory, Knowledge, Home, Calendar). Async throughout, since real tools do real I/O. |
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

## Presence — now real too, no new connection needed

There's no single "presence API" the way there's a REST API for devices or
an ICS format for calendars — but Home Assistant already aggregates
whatever a household uses to track where people are (a phone via its
Companion App, a Find My integration, router-based detection, ...) into
`person.*` entities with a `home` / `not_home` / zone-name state. That's
returned by the exact same `GET /api/states` call `home.js` already makes
for devices, so Presence needed no new connection, no new credentials, and
no new panel — just reading more of a response that was already being
fetched. See `home.js`'s `getPresence()`.

- **Mapping**: Home Assistant's `home` state maps to `'home'`; a zone name
  containing "work" (a real, common Home Assistant feature — Settings ->
  Areas & Zones — but not something every install has configured) maps to
  `'working'`; anything else (`not_home`, another zone, `unknown`,
  `unavailable`) maps to `'away'`. Without a Work zone configured, presence
  is honestly only ever `'home'` or `'away'` — a named gap, not a bug, same
  spirit as Calendar's timezone-offset note.
- **Real presence wins over the manual dropdown, per person** — the one
  place this app's "real source overrides manual" pattern couldn't just be
  concatenation the way Calendar's events are (two events don't conflict;
  two opinions about whether Allen is home very much can). `observe.js`
  spreads the manual signal first, then Home Assistant's presence on top,
  so a real `person.*` entity always wins for any name it covers, and the
  Observe form's dropdown becomes a fallback only for names Home Assistant
  doesn't have an entity for.
- **Verified in a real browser**: with the manual "Allen's status" dropdown
  left at its default ("Home") and a mock Home Assistant reporting
  `person.allen` in a "Work" zone, the do-not-disturb detector still
  correctly read `'working'` from real presence and deferred the
  screen-time nudge — the exact "Allen is working -> do not interrupt"
  behavior the spec's own worked example describes, driven by real data
  instead of a hand-set dropdown.

## Calendar Engine

`js/calendar.js` covers the spec's "Personal Context: Calendar" — and
proves out a claim this README has made since V0.1: "wiring up a real
source later only changes *where* signals come from, nothing downstream
needs to change." The manual "Family devotion scheduled today" checkbox in
the Observe form was always a stand-in for exactly this.

- **Routed through the Worker, same as News** — but unlike News (a fixed,
  public feed list the Worker itself owns), a calendar is personal, so the
  *client* supplies which feed to read: `GET {proxyUrl}/calendar?url=<ics-url>`.
  Most calendar providers, including Google Calendar's own "Secret address
  in iCal format," don't set CORS headers, so a browser can't read the feed
  directly — the Worker fetches it server-side and returns parsed JSON.
  Gated by `PROXY_SECRET` when the Worker has one set, unlike `/news`'s
  open access, since this endpoint will fetch whatever URL it's given.
- **A real, dependency-free ICS (RFC 5545) parser lives in
  `ask-proxy/worker.js`** — line unfolding, `VEVENT` fields, and a
  deliberately-scoped recurrence engine (`FREQ` of DAILY/WEEKLY/MONTHLY/
  YEARLY, `INTERVAL`, `COUNT` or `UNTIL`, `BYDAY` for weekly events, capped
  at 500 generated occurrences) covering the patterns real calendar exports
  actually use for a weekly Bible study or a daily devotion — not a full
  RFC 5545 engine (no `BYMONTHDAY`, `BYSETPOS`, nested `RDATE`/`EXRULE`).
- **One named, deliberate limitation**: full IANA timezone data (regional
  DST rules) is out of scope for a dependency-free single-file Worker, so a
  floating/`TZID`-qualified event time (no `Z` suffix — what most real
  calendar exports actually emit, to preserve wall-clock time across DST)
  is interpreted using one fixed UTC offset the Calendar panel exposes as
  "Timezone offset from UTC, in hours" (default 3, for Kuwait). Correct for
  a feed entirely in one timezone; wrong for a feed mixing several.
- **Real events flow into `context.events` automatically**: `observe.js`
  merges `calendar.js`'s cached events for *today* into the same
  `{ label, note }` shape the manual checkbox always produced, ahead of any
  manually-entered ones. Faith Agent's `scheduledDevotionUnderstanding()`
  needed zero changes to start reacting to a real calendar — verified in a
  real browser: a daily-recurring "Family devotion" ICS event was detected
  and produced the identical notify step the manual checkbox always did.
- **Graceful offline degradation**: with no ICS URL or Worker URL
  configured, every Calendar function returns a well-formed
  `{ ok: false, detail }`, same as Knowledge and Home.
- **Personal Context, not Global Knowledge** — worth naming explicitly:
  unlike `js/knowledge.js`, calendar events are genuinely personal (Allen's
  own schedule), not global/shared data. It's still kept as its own engine
  with its own store, for the same "fuse in Observe, keep the stores apart"
  structural reasoning the rest of this app already uses — not because it
  belongs conceptually next to Knowledge.

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

Two known limitations worth naming:

- **CORS**: Home Assistant doesn't send CORS headers by default, so a
  cross-origin fetch from the JARVIS page (its own origin, not Home
  Assistant's) will likely be blocked by the browser before it even
  reaches Home Assistant. Fix: add JARVIS's origin to `cors_allowed_origins`
  under `http:` in `configuration.yaml`.
- **Mixed content**: if this app is served over HTTPS (as it will be once
  deployed) and Home Assistant is only reachable over plain HTTP on the
  local network, the browser will block the request as mixed content.
  Home Assistant's own remote-access options (Nabu Casa, a reverse proxy
  with a certificate) route around this the same way they would for any
  other client — nothing here is JARVIS-specific.

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

- **Presence only distinguishes `'working'` from `'home'`/`'away'` if the
  household has a Home Assistant zone named with "work" in it** —
  otherwise it's honestly only ever `'home'` or `'away'`. See Presence
  above.
- **Calendar's timezone handling is one fixed UTC offset, not real IANA
  timezone data** — correct for a household in one timezone (see Calendar
  Engine above), wrong for a feed spanning several.
- **Home Assistant (devices + presence) and Calendar have only been tested
  against mocks** (a mock REST API, a mock ICS server) — not a real
  instance or feed yet. Home Assistant in particular will likely need
  `cors_allowed_origins` configured (see Home Engine's note below) before
  a real device/presence connection works at all.
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
