# FLCC NEXT — Adults · architecture

FLCC NEXT for adults is a static, offline-first application. There is no
server, no build step and no dependency. This document says how it is put
together, where the boundaries are, and what a database behind it would have
to look like.

It is the adult edition of the same idea as `flcc-next/`, and it shares no
code with it. Two audiences that different deserve two applications; a single
codebase with an `isAdult` flag running through it would have served neither.

## The boundary

This repository holds five applications. This is one of them.

- It **never** imports `church.js` or reads the `FLCC.*` global.
- It **never** touches anything under `shepherd/` or `lamp/`.
- It reads exactly one thing from `flcc-next/`: the committed text of
  Scripture. Nothing else — not its content, not its modules, not its storage.
  See [Scripture](#scripture) below.
- Every key it stores begins `adults/v1/`. `js/core/storage.js` calls `guard()`
  on every read and write and throws on anything else, so the boundary holds
  mechanically rather than by convention. `test/storage.test.mjs` tries the
  other four apps' key prefixes and asserts each one throws, and
  `test/modules.test.mjs` fails any module that touches `localStorage`
  directly or names another app.

## Layers

```
index.html                       shell: header, screen, tabs. Owns nothing else.
  └── js/app.js                  boot, onboarding, routing
        └── js/screens/*.js      one module per screen, dynamic import()
              ├── js/core/*.js   storage, profile, progress, content, rotation,
              │                  agenda, scripture, prayers, plan, notes, ai,
              │                  safety, art, ui
              └── js/games/*.js  crossword layout, match-three rules — pure
                                 functions, no DOM, so they can be tested
```

## The five tabs

| Tab | What it answers | Screens under it |
|---|---|---|
| **Today** | What matters to me right now? | `moment` |
| **Explore** | What do I need today? | `bible`, `pray`, `grow`, `path`, `session`, `guide`, `plan`, `ask`, `play`, `crossword`, `game` |
| **Community** | Who am I doing this with? | — |
| **Watch** | What was preached? | `message`, `notes`, `note` |
| **You** | Where have I got to? | — |

Six doors on Explore, in this order: READ, ASK, PRAY, GROW, PLAN, PLAY. Notes
sit under Watch rather than under You because a note belongs to the sermon it
was taken at, and Watch is the tab somebody has open during a service.

`app.js` holds all three lists — the tabs, the routes and the `UNDER` map that
decides which tab a sub-screen lights. `test/modules.test.mjs` reads that file
and fails if the three ever disagree, because a typo in any of them is either a
tab that lights nothing or a screen nobody can reach.

Rules that keep it honest:

- **A screen returns `{ title, el }`** and never touches the header or the tab
  bar. Anything a screen throws is caught by the shell and rendered as a block,
  not a blank page.
- **Core modules never import a screen.** Dependencies point one way.
- **`js/core/storage.js` is the only module that touches browser storage.**
- **A screen swaps its contents with `swap()`, never `replaceChildren()`.**
  `replaceChildren` stringifies what it is given, so the conditional-child
  pattern used throughout these screens (`condition ? thing() : null`) prints
  the word "null" on the page. `test/modules.test.mjs` enforces this.
- **What today's Scripture moment is, is a pure function of the date.** No
  screen picks its own material with `Math.random()`. They call
  `rotation.deal()`, which means the whole church meets the same verse on the
  same morning and nobody can re-roll a passage they would rather not sit with.
- **Illustration goes through `art()` in `js/core/ui.js`**, never straight
  from `js/core/art.js`. `art()` is where a reader's choice to switch the
  drawings off is honoured; a screen that reaches past it would keep drawing
  them on some screens and not others.
- **What is next is `js/core/agenda.js`, and only `agenda.js`.** Countdowns,
  the order of the calendar, and the framing the Today screen opens on are all
  pure functions of an event and a moment. A screen that worked out its own
  "in 3 days" would drift out of step with the one beside it, and neither
  could be tested without waiting three days.
- **Content is data, never instructions.** Nothing under `content/` is
  executed, and there is no model in this app to hand it to.

## Scripture

The 66 books, in three public-domain translations, live at `flcc-next/bible/`,
built once by `scripts/build-next-bible.mjs`. This app reads those files rather
than committing a second identical copy.

That is a deliberate, narrow exception to the boundary above:

|  | |
|---|---|
| It **is** | a read of static, public-domain, same-origin **text**, at a fixed path, in one direction, by one module (`js/core/scripture.js`). |
| It **is not** | a shared module, a shared storage namespace, or a read of anything under `flcc-next/content/` — that content is written for children and has no business here. |

The alternative was 14 MB of duplicated Scripture in one repository, kept in
step by hand, where a correction applied to one copy would silently not reach
the other. The path is written down in exactly one place — `scripture.BIBLE` —
and `test/scripture.test.mjs` asserts both that the constant is what the test
expects and that the files are actually there, so a move breaks the suite
rather than the app.

`sw.js` caches those files under this app's own cache. Service worker scope is
per path, so this app's worker only ever sees requests made by this app's
pages: neither app can evict the other's Scripture.

## ASK

The one part of this app that talks to anything.

`js/screens/ask.js` collects a question; `js/core/ai.js` builds the request and
sends it to `/proxy` — same origin, served by the deployed
`ask-proxy/worker.js`, which holds the Anthropic key so that no device does.
Nothing has to be configured: the app and the proxy are behind the same
Worker. `settings.aiWorker` overrides the address for a church running this
somewhere else, and is the only reason that setting still exists.

Three things make it safe to have in a church app at all, and all three are
tested:

1. **The crisis screen runs before the network.** `js/core/safety.js` matches
   the ways an adult actually says it — self-harm, domestic abuse, being
   afraid to go home — and `ask()` returns the safety card without calling
   `fetch` at all. `test/ai.test.mjs` replaces `fetch` with a throw to prove
   the ordering. The card names people and phone numbers; it does not counsel,
   and it does not quote Scripture at somebody who needs a helpline.
2. **The request carries the question and nothing else.** No name, no season,
   no prayers, no reflections, no notes, no progress. `test/ai.test.mjs`
   asserts each of those by name against the serialised body.
3. **The answer arrives in five marked parts** — `[HEARD]`, `[SCRIPTURE]`,
   `[MEANING]`, `[PRAY]`, `[STEP]` — and the screen renders those parts as
   posters itself. A reply that ignores the shape falls through to one block of
   text, which is visibly not the app's voice. That is the point: it should
   look unreliable when it is.

The system prompt forbids the things that would do real damage — speaking as
God, telling somebody what God is saying to them, standing in for a pastor or
a doctor, presenting a contested question as settled, or telling a grieving
adult their loss was a lesson. `test/ai.test.mjs` pins each of those lines, so
removing one fails the suite rather than quietly changing what the app says to
somebody at 2am.

## Play

Two games, neither of which is a delivery mechanism for anything. No points, no
streak, no score anybody else can see, and nothing reported to the church.

**The crossword** is dealt, not authored. `rotation.deal()` takes nine clues
out of `content/crossword.json` (184 of them) for the day, and
`js/games/crossword.js` interlocks them into a grid. Nobody writes a
coordinate, there is no puzzle file to exhaust, and the bank is re-permuted
every cycle so a clue that comes round again arrives crossing different words.
`test/crossword.test.mjs` builds **every day for two years** and fails if any
of them strands a word or produces a grid too wide for a phone.

**Match three** is `js/games/match3.js` — pure functions for matching,
collapsing and playing a swap, so the cascade can be tested without a browser.
One departure from the genre worth knowing about: a swap that matches nothing
is *refused* rather than played and snapped back, because there is no reason to
spend a move on somebody's misread.

## The events admin

`admin/` is a tool that edits this app; it is not part of it. It shares the
stylesheet so it looks like the thing it edits, and takes nothing else — no
router, no storage module, no `adults/v1/` key — and the app never links to it.
`test/admin.test.mjs` enforces each of those.

```
admin/index.html ──▶ reads  content/events.json   (live, past the cache)
                 └─▶ POSTs  /api/publish/adults
                              │  passcode?  shape?
                              ▼
                       GitHub Contents API
                              │  commit
                              ▼
                       flcc-adults/content/*.json
                              │  Cloudflare rebuild
                              ▼
                          members' phones
```

Three decisions inside that:

1. **It commits to the repository rather than writing to a database.** The app
   reads these files straight off the origin and its service worker caches
   them, so it works with no signal; moving them into D1 would have bought
   nothing and cost that. What it buys instead is a real history — every save
   is a commit with a date and an editor on it, and a mistake is one revert.
2. **The path is a key into a fixed map, never taken from the request.** Only
   `content/events.json` and `content/updates.json` can ever be written, and a
   `path` or `repo` in the body is ignored — the same posture as the church
   attendance publisher this is modelled on. `worker.test.mjs` tries both.
3. **The Worker repeats the content suite's rules.** A file published through
   the API never passes through a pull request, so `content.test.mjs` will
   never run on it. `validateAdultsEvents()` therefore checks what that suite
   checks, and `test/admin.test.mjs` reads both and fails when they drift —
   otherwise somebody tightens a rule here and the endpoint quietly keeps
   accepting what the app can no longer render.

The service worker steps aside for `/flcc-adults/admin/` entirely, and the
admin fetches the content files with a cache-buster. Without that an editor is
handed the copy the service worker kept, edits it, and silently undoes the
change they published five minutes ago.

The passcode lives in `sessionStorage` and nowhere else, so closing the tab
signs you out. It says who may publish, not who anybody is.

Setting it up needs two secrets that come from two different places — one you
invent, one you generate on GitHub — so neither the 503 nor `/ping` lumps them
together: both name the one that is actually missing. `/ping` answers the same
question from a browser before anybody tries to publish, reporting
`adultsPasscodes`, `githubToken` and `adultsAdmin` as booleans and never a
value, exactly as it already does for the API key and the leader key.

## Storage today

All of it is `localStorage`, JSON-encoded, under `adults/v1/`. `storage.js`
falls back to an in-memory driver when storage is blocked (private windows, a
locked browser), so the app runs rather than crashing.

| Key | Shape | Written by |
|---|---|---|
| `adults/v1/user` | `{ id, name, season, focus[], createdAt }` | onboarding, You |
| `adults/v1/progress` | `{ days: { count, best, lastDay }, done{}, counts{} }` | `progress.complete()` |
| `adults/v1/prayers` | `{ items: [{ id, text, category, created, answered }] }` | Pray |
| `adults/v1/journal` | `{ entries: [{ id, at, guide, ref, text }] }` | guided prayer, sessions |
| `adults/v1/rsvps` | `{ going: [eventId] }` | Connect |
| `adults/v1/settings` | `{ figures, text, ask, aiWorker?, aiSecret? }` | You |
| `adults/v1/bible` | `{ code, last: { n, chapter }, saved: [{ ref, text, code, at }] }` | the Bible reader |
| `adults/v1/plan` | `{ id, started }` | a reading plan |
| `adults/v1/ask` | `{ turns: [{ role, text, at }], updatedAt }` | ASK |
| `adults/v1/notes` | `[{ id, title, speaker, ref, body, messageId, createdAt, updatedAt }]` | sermon notes |
| `adults/v1/play` | `{ crossword: { day, filled{}, given[] } }` | the crossword |

**Nothing crosses devices, and none of it leaves the device.** There is no
account, no server and no sync — a second phone starts empty, and clearing the
browser's data clears everything. Unlike the kids and teens app there is not
even a prayer-delivery exception: an adult's prayers about their marriage,
their money or their manager are not ours to collect. Four screens say so where
it matters (Pray, Connect, Notes, You) rather than burying it in a policy.

The one thing that goes out is an ASK question, and it is not stored here or
there — see [ASK](#ask) below. Nothing in the table above is ever sent with it.

## What a server would need

Nothing in this section is built.

| # | Table | Columns (essential) | Local record today |
|---|---|---|---|
| 1 | `members` | `id, name, season, church_id, role, created_at` | `adults/v1/user` |
| 2 | `member_progress` | `member_id, days_count, days_best, last_active_day` | `adults/v1/progress` |
| 3 | `completions` | `member_id, kind, key, completed_at` | `progress.done{}` |
| 4 | `paths` / `sessions` | `id, title, accent, ordinal, ref, body, question, practice, prayer` | `content/paths*.json` |
| 5 | `reading_plans` / `plan_days` | `plan_id, ordinal, ref, note` | `content/reading-plans.json` |
| 6 | `prayer_list` | `id, member_id, text, category, created_at, answered_at, answered_note` | `adults/v1/prayers` |
| 7 | `reflections` | `id, member_id, written_at, guide, ref, text` | `adults/v1/journal` |
| 8 | `events` / `event_rsvps` | `id, title, when_text, where_text, blurb; event_id, member_id` | `content/events.json`, `adults/v1/rsvps` |
| 9 | `updates` | `id, title, from_team, body, published_at` | `content/updates.json` |
| 10 | `saved_verses` | `member_id, ref, translation, saved_at` | `adults/v1/bible.saved` |
| 11 | `messages` | `id, title, speaker, preached_on, series, ref, blurb, takeaways[], question, url` | `content/messages.json` |

Two notes, because a schema is not a neutral document:

- **`prayer_list` and `reflections` are the reason to think twice about a
  server at all.** They are the most sensitive rows any church system could
  hold, and today they are safe by construction because they physically cannot
  leave the phone. Any server design must start with who can read those rows
  and what happens when a leader leaves — not with how to sync them.
- **`role` on `members` is what would make anything else real.** Until a
  request can be authenticated and authorised, there is no "church-wide"
  anything, and the app should keep saying its numbers are this-device numbers.

## Design system

`css/next.css` is the whole of it, and its opening comment states the rules.
**It is the same design system as `flcc-next/`** — the poster system — and
that is the point rather than a coincidence. The adult edition went through
four designs of its own first (stickers, then bands, then seeded waves, then
an editorial near-black-and-gold), each one an attempt to be recognisably
*not* the kids app. What the church actually wanted was one app with two
editions, so this one is drawn in the kids and teens edition's system,
spoken in an adult register.

The pieces:

| | |
|---|---|
| Paper | cream `#FBF8F0`, everywhere, in both editions |
| Ink | navy `#2B4C6D` — type, outlines and drawings |
| Colour | one flat tone per poster, from the six shared names |
| Edge | `--edge: 3px`, one outline weight, drawn as an inset `box-shadow` |
| Type | Inter — 900 for `.display`/`.headline`/`.numeral`, 800 for `.label` |
| Radius | `10px` — the adult register is squarer than the kids' |
| Drawings | flat shapes on a 100×100 grid, one navy outline at stroke 5.5 |
| Actions | `.pill` (filled), `.pill[data-quiet]`, `.go` (a word and an arrow) |
| Progress | `.track` — 14px tall and outlined, never a thin grey rule |

Nothing in it is soft: no gradients, no glass, no glow, and no drop shadow.
`box-shadow` appears only as an inset outline, which is how a 3px edge is
drawn without a border changing an element's size.

**A poster is the layout primitive.** `poster({ tone, tall })` is a whole
block of colour with a label at the top, a headline in the middle and a
`.poster-foot` at the bottom carrying one action and one drawing. A screen is
a vertical run of them, not a grid of tiles — a member scrolls through four
big things instead of reading twelve small ones to find the one they wanted.

Three rules that are the adult register rather than the system:

1. **The chrome stops at Scripture.** The Bible reader, the book list and the
   chapter grid are plain white paper and serif type — no poster, no colour,
   no drawing. The app can be as loud as it likes right up to the moment
   somebody is reading the Bible.
2. **Poppy is never a whole poster.** It is in the palette and it is used, but
   white type does not sit safely on it at display size.
   `test/content.test.mjs` fails a content file that assigns it as a tone.
3. **No drawing has a face.** The kids edition's characters do not come across;
   the objects do.

### Keeping the two editions one design

The two apps share **no code**, so `css/next.css` and `js/core/art.js` here are
deliberate duplicates of their opposite numbers in `flcc-next/`. A duplicate
with nothing holding it in place drifts — somebody widens a radius here,
softens a weight there, and in six months the two apps are cousins instead of
editions. Two suites stop that:

- `test/design.test.mjs` reads **both** stylesheets and fails when the palette,
  the edge weight, the face, the headline weights, the six poster tones, the
  two actions or the flat-colour rules stop matching.
- `test/art.test.mjs` extracts the path data for the symbols that exist in both
  sets — `book`, `heart`, `mountain`, `star`, and this edition's `sprout`,
  `sun` and `flame` against their `plant`, `sunrise` and `light` — and compares
  them character for character.

Both are build-time reads of the other app's source. Nothing crosses the
boundary at runtime, and `test/modules.test.mjs` still fails any module that
reaches past `flcc-next/bible/`. **If a rule genuinely needs to change, change
it in both files** — that is what these tests are for, not an obstacle to
them.

One detail worth knowing before touching it: this app loads Inter as a webfont,
the same face and the same weights as the kids edition. The Bible reader does
not use it — Scripture is set in the platform's own serif.

## Tests

```bash
node --test 'flcc-adults/test/*.test.mjs'
```

| Suite | What it holds the line on |
|---|---|
| `storage` | the `adults/v1/` namespace, and that the other four apps' keys throw |
| `art` | every symbol draws, is one navy outline at one weight, takes a single fill from the palette, has no face — and that the symbols shared with `flcc-next/` are character-identical to theirs |
| `agenda` | the countdown, against fixed dates: an event running now is now rather than next week, a series stops at its last date, and days are counted as calendar days |
| `rotation` | a full cycle deals the whole bank, nothing repeats inside it, and the same day always deals the same thing |
| `progress` | day arithmetic, idempotent completion — and that no XP, level or badge has crept in |
| `prayers` | an answered prayer is kept rather than deleted, and removal is the only thing that destroys anything |
| `plan` | a plan is a sequence, not a calendar: a month away does not move it |
| `content` | every authored file's shape, every colour and icon it names, that every event can be counted down to, that every message stands up with or without a recording, and that the writing never promises something no server exists to do |
| `scripture` | the shared Bible is where the app says it is, every reference resolves — the messages' included — and **every verse the writing prints is word for word the shipped text** |
| `design` | the two editions are one design: it reads **both** stylesheets and fails when the palette, the 3px edge, the face, the 900/800 headline weights, the six poster tones, the two actions or the no-shadow-no-gradient-no-blur rules stop matching |
| `ai` | the shape of the request and of the reply: that it carries the question and nothing about the person, that the crisis screen and the off switch come **before** `fetch` rather than after it, that a reply ignoring the five-part shape arrives as one visible block, and that the prompt still forbids speaking as God, standing in for a pastor, settling a contested question, or calling somebody's grief a lesson |
| `safety` | both halves of the crisis screen: fourteen ways an adult actually says it, and twelve ordinary hard questions it must leave alone — a screen that fires on "I am struggling at work" is a screen members learn to scroll past |
| `crossword` | the clue bank's shape and that no clue gives its answer away; that **every day for two years** deals nine words that fully interlock into a phone-sized grid; that a day is the same puzzle on every device and a different one tomorrow; and that the layout engine has not drifted from the kids edition's |
| `match3` | matching, cascading and collapsing: no holes left in a column, no board that starts solved or deadlocked, no diagonal swaps, and a swap that matches nothing leaving the board untouched |
| `notes` | a note survives being left mid-sentence, an empty one is thrown away rather than kept as clutter, ids do not collide, and everything stays in the namespace |
| `admin` | the events admin is a tool, not part of the app: it borrows only the stylesheet, the app never links to it, the service worker steps aside for it, the endpoint can only write the two content files, and the Worker's validator still enforces everything the content suite does |
| `textsize` | four sizes that only go up; that the scale multiplies the reader's own browser default rather than replacing it; that the whole type scale is in rem so one number moves it; and that the outline, the radius and the track do **not** grow with the type |
| `modules` | every module parses, every screen exports a screen, the app boundary, that the stylesheet is still the poster system, no paragraph set in capitals, no hex literal in a screen, every root screen names itself, the tabs and the routes and the `UNDER` map agree, no hand-built posters, no screen importing `art.js` behind `art()`'s back, no direct `replaceChildren`, and that `sw.js` precaches everything |

The scripture suite is the one worth explaining. Forty passages are quoted
across the devotionals, the sessions and the guides, and no reviewer catches a
dropped clause by eye. Comparing every quotation against the shipped World
English Bible is the only way a misquotation gets caught before a reader
notices it — and a Bible app that misquotes Scripture has failed at the one
thing it exists to do.
