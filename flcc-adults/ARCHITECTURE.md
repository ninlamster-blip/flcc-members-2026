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
              └── js/core/*.js   storage, profile, progress, content, rotation,
                                 scripture, prayers, plan, shapes, ui
```

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
- **The organic shapes are a pure function of a seed** (`js/core/shapes.js`).
  A hero that re-rolls its curve on every reload is noise.
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
| `adults/v1/settings` | `{ shapes }` | You |
| `adults/v1/bible` | `{ code, last: { n, chapter }, saved: [{ ref, text, code, at }] }` | the Bible reader |
| `adults/v1/plan` | `{ id, started }` | a reading plan |

**Nothing crosses devices, and nothing leaves the device at all.** There is no
account, no server and no sync — a second phone starts empty, and clearing the
browser's data clears everything. Unlike the kids and teens app there is not
even a prayer-delivery exception: an adult's prayers about their marriage,
their money or their manager are not ours to collect. Three screens say so
where it matters (Pray, Connect, You) rather than burying it in a policy.

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

`css/organic.css` is the whole of it, and its opening comment states the rules.
The one worth repeating here is the one that erodes first:

> Hierarchy comes from type, space, colour blocks and rules — not from a stack
> of rounded rectangles.

There is no `.card` class in this application, and `test/modules.test.mjs`
fails the build if one appears in the stylesheet or in a screen. The organic
shapes are the other half of the identity: `js/core/shapes.js` draws them, one
colour moment per screenful, the lighter colour as the wash and the darker one
as a small accent pinned to a corner where a phone layout puts nothing.

## Tests

```bash
node --test 'flcc-adults/test/*.test.mjs'
```

| Suite | What it holds the line on |
|---|---|
| `storage` | the `adults/v1/` namespace, and that the other four apps' keys throw |
| `shapes` | the same seed always draws the same shape, and a field is well-formed |
| `rotation` | a full cycle deals the whole bank, nothing repeats inside it, and the same day always deals the same thing |
| `progress` | day arithmetic, idempotent completion — and that no XP, level or badge has crept in |
| `prayers` | an answered prayer is kept rather than deleted, and removal is the only thing that destroys anything |
| `plan` | a plan is a sequence, not a calendar: a month away does not move it |
| `content` | every authored file's shape, every accent that must exist in the stylesheet, and that the writing never promises something no server exists to do |
| `scripture` | the shared Bible is where the app says it is, every reference resolves, and **every verse the writing prints is word for word the shipped text** |
| `modules` | every module parses, every screen exports a screen, the app boundary, no `.card`, no direct `replaceChildren`, and that `sw.js` precaches everything |

The scripture suite is the one worth explaining. Forty passages are quoted
across the devotionals, the sessions and the guides, and no reviewer catches a
dropped clause by eye. Comparing every quotation against the shipped World
English Bible is the only way a misquotation gets caught before a reader
notices it — and a Bible app that misquotes Scripture has failed at the one
thing it exists to do.
