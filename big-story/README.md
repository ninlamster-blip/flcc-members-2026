# The Big Story

The Bible as one story, in twenty-three parts, for FLCC children and youth —
**ages 7 to 18 in one app**. Standalone, like the games: open
`big-story/index.html`, reached from the **For the kids** card on the members
app's Home tab. Plain ES modules, no dependencies, no build step, no network
calls at all. It installs to a phone and works with no signal from the first
visit onwards.

## The problem this app is actually solving

Seven and seventeen are not one audience. Everything a "kids Bible app"
normally does — cartoons, bubble lettering, confetti — loses the older half
immediately, and building two apps means two banks of content drifting apart.

So there is one app and one bank, and **the content is tiered**. A child picks
their age once, and it decides three things:

| | 7-9 | 10-13 | 14-18 |
| --- | --- | --- | --- |
| The story | short, one thing at a time | the story with its causes | the full account |
| Go deeper note | — | — | yes |
| Questions | 3, all written for that age | 5 | 5, the hardest first |

The three tellings are **written separately**, not one text with words swapped
out. "Shorter" is not the same as "younger", and a sixteen-year-old handed a
padded children's paragraph can tell at once.

## Where things live

| File | What it holds |
| --- | --- |
| `js/stories.js` | **The story bank.** 23 stories, each told three times, with its era, its passage and its memory verse. |
| `js/questions.js` | **The question bank.** 161 questions, each tagged with the age it starts at, each carrying the passage that settles it. |
| `js/engine.js` | Pure functions: tiers, dealing a quiz, scoring, masking a verse, what counts as finished. No DOM, no storage. |
| `js/storage.js` | Profiles and progress, on the device. |
| `js/app.js` | The four screens. |

`test/big-story.test.mjs` covers all of it, and most of it is about the banks
rather than the code.

## The rules the content is held to

A Sunday school app that teaches a child something the Bible does not say is
worse than no app. So:

- **Every question carries a reference**, shown after the answer whether the
  child got it right or wrong, so they can go and check. Nothing can enter the
  bank that nobody could point to in a Bible.
- **Every question is answerable from the story at that tier.** A question a
  child could not have answered from what they just read is a trick, and it
  teaches them that the quiz is the enemy.
- **The right answer is stored first** in `questions.js`, so a person reading
  the file — or checking it against a Bible — can see at a glance what it
  claims. The engine shuffles the options on the way to the screen, and a test
  checks it does, because a child spots a fixed answer inside two questions.

## Memory verses and the translation

The verses are bundled so they work offline, which makes the translation a real
decision rather than a detail. They are quoted from the **World English Bible**,
which is in the public domain — nothing here needs a licence.

The WEB renders the divine name as "Yahweh" through the Old Testament. Rather
than print wording no FLCC teacher would recognise, or quietly substitute "the
LORD" and still call it the WEB, **stories whose natural verse contains it are
given a different verse.** Three were re-chosen on exactly this ground. A test
enforces the rule so it cannot be forgotten later.

The practice screen has four levels — the whole verse, a few words gone, most
words gone, first letters only. Which words are hidden is worked out from their
position, not at random: a child practising one verse three evenings running is
learning *that sentence*, and moving the gaps each time makes it a new puzzle
every evening instead.

## Profiles, because of how the phones are actually used

A family shares one phone, and two children in it are not the same age and are
not up to the same story. Up to six people can each keep their own age, their
own place and their own progress; the chip in the corner switches between them.

Nothing is uploaded, there is no account, and no name is required beyond
whatever a child types for themselves. One key, `flcc-big-story-v1`,
deliberately **not** namespaced by church — this app reads no church data at
all, and progress here is device-wide like game scores and the reading plan
(see "Storage on a shared device" in [CHURCHES.md](../CHURCHES.md)).

## Nothing is locked

Every story is open from the first visit. A "finish Genesis first" app is
useless to an actual Sunday school, where this week's class is doing Jonah.
**Continue** points at the first unfinished story, and the map shows where
everybody is up to, but neither of them stops anybody going anywhere.

A story counts as finished when all three marks are earned — read, quiz passed
(three out of five), verse learned. Any one of them alone is not knowing it.

## Adding a story

Add it to `STORIES` in `js/stories.js` with all three tellings, a `deeper`
note, its passage and its verse; add at least 3 `young`, 2 `middle` and 2
`older` questions to `js/questions.js`; add the new file to nothing, because
there are no new files. Then run:

```bash
node --test 'test/big-story.test.mjs'
```

The suite will tell you if a telling is missing, if a tier is thin, if a
reference does not read like one, if the verse is too long to memorise, or if
the era does not exist.
