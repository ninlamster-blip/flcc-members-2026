# LAMP

**A Bible & faith companion for ages 7–18.** *Discover God. Know His Word.
Live It.*

```
https://<your-site>/lamp/
```

Phase 1 of [SPEC.md](SPEC.md) is built and working: onboarding, an age
profile, Today, the Bible reader, the daily verse, Bible stories, prayer, the
journal, memory verses, daily challenges, the Ask companion and progress.

No build step, no dependencies, no account. Serve the repository as static
files and open `/lamp/`:

```bash
python3 -m http.server 8000    # from the repository root
# then open http://localhost:8000/lamp/
```

`file://` will not work — ES modules need a real origin.

## What is here

| Screen | What it does |
|--------|--------------|
| **Today** | Greeting, continue reading, today's Word, today's challenge, quick actions |
| **Bible** | 66 books, chapter navigation, reference jumping (`1 sam 17`, `psalm 23`), search over downloaded chapters, six actions on every verse |
| **Stories** | 14 Bible stories, each illustrated, in six parts, written three times — once for each age band |
| **Journey** | Streak, chapters, stories, memory verses, challenges, and the five stages |
| **Me** | Prayer, journal, settings, a plain account of what is stored and sent, download-everything and delete-everything |
| **Ask** | The AI companion — off until configured, tiered answers, verse-checking, on-device safety routing |

## How it is put together

```
lamp/
  index.html            app shell
  sw.js                 service worker — shell and authored content offline
  css/lamp.css          the whole design system (SPEC.md §13)
  js/
    app.js              boot, onboarding, navigation
    core/
      storage.js        the namespace guard — nothing outside lamp/v1/ is writable
      age.js            one band token: content, copy register, type scale, AI depth
      books.js refs.js  the canon, and reference parsing/formatting
      bible.js          fetch, normalise, cache, search Scripture
      profile.js progress.js memory.js challenges.js daily.js
      safety.js         on-device concern detection and the safety card
      ai.js             prompt contract, tiering, reference extraction
      content.js router.js dom.js ui.js
    screens/            one file per screen, imported on demand
  content/              all authored content as JSON (SPEC.md §14)
  test/                 node:test suites, no dependencies
```

**Illustration.** Every story has a scene, drawn in code from one kit of paper-cut
shapes and one twelve-colour palette (`js/core/art.js`). No image files, no
network, a few kilobytes for the set — and testable: the suite fails if a scene
strays from the palette or references anything outside itself. Commissioned
artwork can replace the kit later without touching a screen.

**The design grows with the reader.** One band token drives the whole system,
so at 7–10 Stories is a shelf of pictures, cards carry a colour rail, taps are
52px and Today opens with the sky; at 15–18 the pictures step back, the rails
disappear and the type tightens. Same screens, same content, three registers —
see SPEC.md §13.

**Storage.** Everything lives under `lamp/v1/…`, and `storage.js` throws on any
key that does not. That guard is what makes the boundary in SPEC.md §3
mechanically true: LAMP cannot read or write FLCC's or Shepherd's keys even by
accident. It never imports `church.js`, never reads `FLCC.*`, and never touches
`shepherd/`.

**Scripture** comes from `bolls.life`, with `bible-api.com` as a fallback, and
is cached per chapter in IndexedDB. No Bible text is bundled with the app: a
chapter is downloaded once and then reads offline. Public-domain translations
only (WEB, KJV, ASV) — modern translations need a publisher licence.

**Ask** is off until someone enters a Worker address in Me → Settings. It goes
through this repository's existing `ask-proxy` Worker, so no API key ever
reaches a device. What is sent: the question, the age band, and the passage on
screen. What is never sent: the child's name, journal, or prayers.

**Safety** runs before anything leaves the device. `safety.js` detects
disclosures of self-harm, abuse, exploitation or danger and replaces the answer
with a card that names a trusted adult and the region's help lines — no model
call is made at all. `test/safety.test.mjs` holds the fixtures.

## Tests

```bash
node --test 'lamp/test/*.test.mjs'
```

52 tests, no dependencies. They cover age-band resolution and fallback,
reference parsing across the whole canon, both response shapes `bolls.life` has
served, the storage namespace guard (including explicit FLCC and Shepherd
keys), memory-verse scheduling and grading, daily and challenge determinism,
the AI request contract (asserting the child's name, journal and prayers are
never in the payload), the safety fixtures, the illustration system (every story has a scene, every
scene is self-contained and drawn only from the palette), reference display for
chapter ranges and lists, and a full schema validation of every content file —
a story missing an age band fails the suite.

## Before a church launches this

1. **Verify the help lines.** `content/safety/*.json` carries only numbers we
   could be confident about (emergency numbers, Childline, Samaritans);
   everything else points at a directory. Each file is marked
   `"verifyBeforeLaunch": true`. Check them for your country and replace them.
2. **Review the content.** Every story and challenge has empty `reviewedBy` and
   `reviewedAt` fields. A person should read every line a child will read.
3. **Set up Ask, or leave it off.** LAMP is fully usable without it.

## What Phase 1 does not include, and where it differs

Phase 2–4 features are not built: Bible characters, the map, the timeline,
topics, Big Questions, reading plans, recorded audio, parent mode and church
mode. Beyond that, three deliberate differences from SPEC.md:

- **14 stories, not 40** (SPEC.md §7). The structure, the loader and the
  content test all handle any number; adding the rest is authoring, not code.
- **A 52-entry daily pool, rotated by day of year**, rather than 366 authored
  entries per band (SPEC.md §14). The rotation is deterministic and shifts each
  year, so a church still sees the same Word on the same day.
- **The tab is called Stories, not Discover.** It becomes Discover when Phase 2
  puts people, places and topics behind it.

Audio is the platform speech synthesiser, as the spec's MVP allows. Illustration
is a placeholder mark, clearly not commissioned artwork — see SPEC.md §19,
open question 2.
