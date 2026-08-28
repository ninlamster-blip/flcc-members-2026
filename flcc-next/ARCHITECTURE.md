# FLCC NEXT — architecture

FLCC NEXT is a static, offline-first application. There is no server, no build
step and no dependency. This document says how it is put together, where the
boundaries are, and what the ten-table database in the brief would look like if
and when one is stood up.

## The boundary

This repository holds four applications. FLCC NEXT is one of them and shares
nothing with the others.

- It **never** imports `church.js` or reads the `FLCC.*` global.
- It **never** touches anything under `shepherd/` or `lamp/`.
- Every key it stores begins `next/v1/`. `js/core/storage.js` calls `guard()`
  on every read and write and throws on anything else, so the boundary holds
  mechanically rather than by convention. `test/storage.test.mjs` tries the
  other three apps' key prefixes and asserts each one throws.

The one thing it shares with the FLCC Members app is
[`ask-proxy/worker.js`](../ask-proxy/worker.js) — the same deployed proxy can
serve both, because the proxy holds the API key and neither app holds anything
of the other's.

## Layers

```
index.html / admin.html          shell: header, screen, tabs. Owns nothing else.
  └── js/app.js                  boot, onboarding, routing
        └── js/screens/*.js      one module per screen, dynamic import()
              └── js/core/*.js   storage, profile, progress, content, library,
                                 scripture, ai, safety
                    └── js/games/, js/admin/   pure logic, no DOM
```

Rules that keep it honest:

- **A screen returns `{ title, el }`** and never touches the header or the tab
  bar. Anything a screen throws is caught by the shell and rendered as a
  poster, not a blank page.
- **Core modules never import a screen.** Dependencies point one way.
- **`js/core/storage.js` is the only module that touches browser storage.**
  Everything else goes through `KEYS`.
- **Pure logic lives where it can be tested.** The crossword layout
  (`js/games/crossword.js`), the daily rotation (`js/core/rotation.js`) and the
  content audit (`js/admin/audit.js`) have no DOM in them at all, which is why
  all three are unit-tested rather than screenshotted.
- **What today's content is, is a pure function of the date.** No screen picks
  its own material with `Math.random()` or `Date.now()`. They call
  `rotation.deal()`, which means the choice is reproducible, identical across
  the ministry, and testable a year ahead.
- **Content is data, never instructions.** Nothing under `content/` is
  executed, and nothing from it is passed to a model as part of a prompt.
- **`content/` is the ministry's; `bible/` is not.** Everything under
  `content/` can be rewritten from the dashboard (`js/core/library.js`).
  Everything under `bible/` is the text of Scripture, is built once by
  `scripts/build-next-bible.mjs`, and no screen in the app can change a word
  of it. `js/core/scripture.js` is a separate module from `content.js` for
  exactly that reason.

## Storage today

All of it is `localStorage`, JSON-encoded, under `next/v1/`. `storage.js` falls
back to an in-memory driver when storage is blocked (private windows, a locked
browser), so the app runs rather than crashing.

| Key | Shape | Written by |
|---|---|---|
| `next/v1/user` | `{ name, age, interests[], created }` | onboarding, Me |
| `next/v1/progress` | `{ xp, streak: { count, best, lastDay }, done{}, counts{} }` | `progress.complete()` |
| `next/v1/prayers` | `{ items: [{ id, date, mood, content, visibility, moderation_status }] }` | Prayer |
| `next/v1/rsvps` | `{ going: [eventId] }` | Connect |
| `next/v1/ask` | the current Ask NEXT thread | Ask |
| `next/v1/settings` | `{ theme, motion, aiWorker, aiSecret, aiEnabled, aiModel }` | the dashboard |
| `next/v1/bible` | `{ code, last: { n, chapter }, saved: [{ ref, text, code, at }] }` | the Bible reader |
| `next/v1/library` | `{ version, updated, files: { <file>: { added[], edited{}, removed[] } } }` | the dashboard's Library |

Two consequences worth stating plainly, because the dashboard states them too:

1. **Nothing crosses devices.** A young person who opens FLCC NEXT on a second
   phone starts again. There is no account to restore from.
2. **There are no church-wide numbers.** Progress, prayers and RSVPs exist only
   where they were typed, so the dashboard's figures are always this-device
   figures and are labelled as such.

## The ten tables

The brief specifies a database. Below is the schema those local records map
onto, in the order they would need to exist. Nothing in this section is built.

| # | Table | Columns (essential) | Local record today |
|---|---|---|---|
| 1 | `users` | `id, name, birth_year, age_group, role, church_id, created_at` | `next/v1/user` |
| 2 | `user_progress` | `user_id, xp, level, streak_count, streak_best, last_active_day` | `next/v1/progress` |
| 3 | `completions` | `user_id, kind, key, completed_at` | `progress.done{}` |
| 4 | `achievements` | `id, title, symbol, tone, need_kind, need_count, how` | `content/achievements.json` |
| 5 | `user_achievements` | `user_id, achievement_id, earned_at` | none — derived from progress in Me |
| 6 | `prayer_requests` | `id, user_id, content, mood, visibility, moderation_status, created_at, moderated_by, moderated_at` | `next/v1/prayers` |
| 7 | `content_items` | `id, type, age_group, tone, symbol, body_kids, body_teens, published_at, reviewed_by` | `content/*.json` |
| 8 | `events` | `id, title_kids, title_teens, when_text, where_text, audience, blurb, tone, symbol` | `content/events.json` |
| 9 | `event_rsvps` | `event_id, user_id, created_at` | `next/v1/rsvps` |
| 10 | `ask_sessions` | `id, user_id, age_group, question, answered_at, flagged` | `next/v1/ask` |

Two more that the Bible and the editor imply, and that a server would need:

| # | Table | Columns (essential) | Local record today |
|---|---|---|---|
| 11 | `saved_verses` | `user_id, ref, translation, saved_at` | `next/v1/bible.saved` |
| 12 | `content_revisions` | `id, file, row_key, action, body, author_id, created_at` | `next/v1/library` |

`content_revisions` is the one that would change the most. Today a leader's
edits live on the phone that made them, which is why the dashboard says so on
every screen that offers one. A server turns that pack into a review queue —
who wrote it, who approved it, and when it reached the children — and that is
the shape a ministry editing content for minors should have.

Three notes on that table, because a schema for minors is not a neutral
document:

- **`role` on `users` is the only thing that makes the dashboard real.** Until
  a request can be authenticated and authorised, "moderation" is one person
  tidying their own device. Roles are the first thing to build, not the last.
- **`prayer_requests.visibility` must be enforced server-side, not in the
  UI.** A row marked private should be unreadable by a leader's query, not
  merely unrendered by a leader's page. The client already behaves this way;
  a server must too.
- **`ask_sessions` should store the question and the verdict, not a
  transcript.** Keeping a searchable archive of what children asked about God
  is a liability, and it is not needed to run the ministry.

## What the client would keep

Moving to a server does not mean moving everything. The app should stay usable
on a phone with no signal in a church hall, which means:

- Content stays cached and readable offline (`sw.js`).
- Progress is written locally first and synced, never the other way round.
- Ask NEXT stays off by default and stays routed through a proxy, so no key
  ever reaches a device whichever way the rest goes.

## Safety, in code

Three mechanisms, all testable, all in the client where they cannot be skipped
by a network failure:

1. **`js/core/safety.js`** matches a question against concerning patterns
   *before* `ask()` makes any network call, and returns the help card instead.
   `test/safety.test.mjs` runs fixtures through it.
2. **`js/core/ai.js`** fixes the system prompt, the five answer parts and the
   rules that cannot bend, and builds a request that carries only the question
   and the age group. `test/ai.test.mjs` seeds the device with a name, a
   birthday, a saved prayer and an Ask thread, then asserts none of it can
   appear in the request payload.
3. **`content/help-lines.json`** is signed, not merely edited.
   `verifyBeforeLaunch` starts `true`; clearing it requires recording
   `verifiedBy` and `verifiedAt`. The audit warns while the flag is set and
   also when it has been cleared with nobody named, because a silently deleted
   flag is indistinguishable from a checked one. `test/audit.test.mjs` asserts
   both warnings fire, and `test/content.test.mjs` refuses a cleared flag
   without a name and a dated sign-off.

## Tests

```bash
node --test 'flcc-next/test/*.test.mjs'
```

| Suite | What it holds the line on |
|---|---|
| `modules` | every browser module parses, screens included |
| `storage` | the `next/v1/` namespace, and that the other apps' keys throw |
| `profile` | age → mode, and that content falls back rather than blanking |
| `rotation` | a full cycle deals the whole bank, nothing repeats inside it, and the same day always deals the same thing |
| `progress` | XP, levels, streak arithmetic, idempotent completion |
| `safety` | concerning questions never reach the network |
| `ai` | the five parts, the rules, and what may be sent |
| `content` | the authored JSON's schema, including both age variants |
| `audit` | the dashboard's audit agrees with the suite, and catches what it claims to |
| `crossword` | every puzzle interlocks, numbering is right, scoring is right |
| `library` | an edit survives, a removal stays removed, an import does not overwrite |
| `scripture` | the 66 books are all there, references resolve, and every reference the content quotes points at a verse that exists |
| `modules` also | every screen that quotes Scripture links the reference, so the Bible stays one tap away as screens are added |

`library` is the one worth explaining. It is the module that lets a ministry
leader add content without a developer, which makes it also the module that can
quietly lose their work — so `merge()` is pure and every case a leader could hit
is pinned down: an edit that must survive a reload, a removal that must not come
back, a row added twice by importing the same pack twice.

`audit` also holds the line on repetition: no bank may run dry inside a week,
and the amounts it assumes each game deals are checked against what the screens
actually deal, so the dashboard's run lengths cannot quietly become fiction.
