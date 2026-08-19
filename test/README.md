# Tests for the FLCC Members app

```bash
node --test 'test/*.test.mjs'
```

No dependencies, no build step — the same as `shepherd/test/` and
`ask-proxy/worker.test.mjs`. Shepherd has its own suite and is not covered
here; the two applications share no code.

| File | Covers |
| --- | --- |
| `attendance.test.mjs` | Service rosters, session summaries, pastoral care flags |
| `members.test.mjs` | A member's own attendance record, the birthday/anniversary window |
| `network.test.mjs` | The 14-church registry, every church's data files, the one-app rule |
| `assistant.test.mjs` | Ask FLCC: what it is told, and which files it is told it from |
| `crossword.test.mjs` | Bible Crossword: the answer bank, the grids, the daily puzzle, the streak |

## How these reach into a single-file app

The apps are one HTML file each, so their logic can't be `import`ed the way
`shepherd/js/core/*` can. `lib/extract.mjs` lifts named top-level declarations
out of the `<script type="text/babel">` block and evaluates them on their own.

Only pure top-level helpers survive that — anything holding JSX, hooks or DOM
access will not. That is a feature: when you want to test something and can't
extract it, the fix is to lift it to the top level of the app file, the way
`rosterForService` and `upcomingOccasions` were. A rename fails the suite
loudly rather than silently testing nothing.

`loadChurch()` evaluates the real `church.js` against a stubbed browser, so the
registry tests exercise the shipped resolver rather than a copy of it.

`bible-crossword/` is the exception to all of the above: it is a standalone game
built from plain ES modules, so `crossword.test.mjs` imports its bank, engine
and storage directly. It only reaches for `extract.mjs` for the one piece that
lives inside `index.html` — the Home tab's crossword card, which reads the same
localStorage key the game writes and is checked against it so the two cannot
drift.

## What these are defending

Every test here maps to a bug that shipped. The recurring shape is worth
knowing, because none of them looked wrong on screen:

- **A Friday roster and a Sunday roster are not the same people.** Sessions
  were measured against every active member, so a service where everyone on
  the roster was present reported 88% (Sunday) or 63% (Friday) and could never
  reach 100%. The same mistake in the members app told a Sunday-only member
  who had missed nothing that she was at 50%.
- **Absence is the lack of a record, not a record.** The weekly summary built
  its follow-up list from `session.records` — which only ever holds people who
  were *present* — so it reported "no follow-up needed" on the same data where
  the Care tab flagged 18 people.
- **One app serves fourteen churches.** A church name, a link pinned to the
  repository name, or a hardcoded start month is invisible to whoever wrote it
  and wrong for the other thirteen, or wrong later. Several tests here are
  therefore grep-shaped by design.

When fixing a bug in these areas, add the failing case first and check it goes
red — a test that cannot fail is decoration.
