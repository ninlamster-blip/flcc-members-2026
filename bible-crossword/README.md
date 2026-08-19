# Bible Crossword

A hard 6×6 crossword for FLCC members: **31 puzzles, one for each day of the
month**, so the rotation does not repeat inside four weeks. Standalone, like the
other games: open `bible-crossword/index.html`, reached from the games
button on the app's Home tab and from the "Today's challenge" card.

Plain ES modules, no dependencies and no build step, the same as everything else
in this repository. It works offline once the page has loaded, and it works with
no AI connection at all.

## Where things live

| File | What it holds |
| --- | --- |
| `js/answers.js` | **The answer bank.** Every answer, clue, hint, Scripture reference and explanation, written and checked by hand. |
| `js/puzzles.js` | **Generated.** 31 solved 6×6 grids. Rebuild with `node scripts/build-crossword-puzzles.mjs`. |
| `js/engine.js` | Pure functions: numbering, entries, navigation, the daily puzzle, whether a word is right. No DOM, no storage. |
| `js/storage.js` | The one localStorage key: streak, results, work in progress, the sound setting. |
| `js/ai.js` | Optional. Lazy-loaded the first time somebody asks for help. |
| `js/app.js` | The screen: grid, typing, hints, scoring, the completion sheet. |
| `style.css` | The FLCC design tokens, applied to a game. |

`test/crossword.test.mjs` covers the bank, the grids, the daily selection and
the streak.

## One place a Bible fact can enter

A puzzle is stored as its **solved grid** — `'#'` for a block, a letter
everywhere else — and nothing else:

```js
{ id: 'flcc-hard-005', category: 'Women of the Bible', difficulty: 'Hard',
  grid: ['EUODIA', '##D##W', '##ELUL', 'IDDO##', 'R##I##', 'ACHSAH'] }
```

`engine.js` derives the blocks, the numbering and the across/down entries from
that, then looks every entry up in `answers.js` for its clue text. A puzzle
therefore carries no clue of its own, and no answer can exist without a record
somebody wrote. The test suite fails loudly if a grid ever contains a word the
bank has never heard of.

## Rebuilding the puzzles

The grids are not drawn by hand. `scripts/build-crossword-puzzles.mjs`
enumerates every 180°-symmetric 6×6 pattern whose white runs are all either a
real entry or a single square checked by the crossing word, then fills them by
backtracking out of the bank. It is deterministic — the same bank produces the
same 31 puzzles — so re-running it after adding answers is safe to commit.

Two things in it are worth knowing before changing it:

**Patterns are ranked by where the bank is deep.** Sorting purely on how open a
grid looks picks shapes full of three- and four-letter slots, which burns the
two scarcest banks while the five- and six-letter ones sit idle — measured at
64% and 73% consumed against 11% and 17%, and it capped the whole build at
eleven puzzles. Weighting by supply is what lets one bank carry a month.

**The theme is a constraint on the search, not a filter after it.** Half of
every grid's answers must carry the puzzle's category, and the slots that have
to are nominated before the fill starts. Checking afterwards does not work: the
solver happily satisfies a grid from the general bank, and a thin category like
Holy Spirit then never reaches its quota however many patterns are tried.

Answers of five letters and up appear in exactly one puzzle. Four-letter answers
may serve twice and three-letter answers three times — they are the connecting
tissue a grid this small needs, and Scripture offers only so many defensible
short ones. Whatever repeats is kept at least six puzzles apart, so no answer
comes back inside a week of daily play.

## The AI layer

The clue ladder is entirely local: the hint, the Scripture reference, the
revealed letter and the explanation all come from the bank, so they work with no
network and no key. "Ask AI" adds a live layer on top — re-word a hint, explain
the passage, give the context — and every one of its five questions has a
written fallback that is used whenever the call fails, times out, or is not
configured.

It reuses whatever connection the member already set up for Ask FLCC (the same
`flcc-ask-proxy-url-v1` / `flcc-claude-api-key-v1` keys, falling back to this
site's own Worker on `/proxy`). There is nothing new to configure and no
environment variable to set.

**The AI never supplies an answer, a reference, or a fact the bank does not
already hold**, and one clue's worth of information is all that leaves the
device: no name, no score, no streak, no history, nothing typed into the grid.

## What is remembered

One key, `flcc-crossword-v1`, on the member's own device:

```
streak    { count, best, lastDay }
results   puzzleId -> { score, seconds, hintsUsed, mistakes, date }
progress  puzzleId -> the half-finished grid, so a reload loses nothing
settings  { sound }   ← off by default
```

It is deliberately **not** namespaced by church. Game scores are a device-wide
preference in this app, like the Bible translation and the reading plan — see
"Storage on a shared device" in [CHURCHES.md](../CHURCHES.md). Nothing is
uploaded and there is no account.

A streak counts consecutive calendar **days on which a puzzle was finished**, in
the member's own timezone. Three puzzles in one evening is a one-day streak.

## Scoring

| | |
| --- | --- |
| Correct answer | +100 |
| Puzzle complete | +500 |
| No hints at all | +500 |
| No hints and no wrong words | +1,000 |
| AI hint | −50 |
| Scripture reference | −100 |
| Revealed letter | −150 |
| Ask AI (once per clue, however many questions) | −100 |

The running score may go negative — buying a hint before scoring anything should
say so rather than look free — and the score that gets recorded is floored at
zero.
