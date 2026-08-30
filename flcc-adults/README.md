# FLCC NEXT — for adults

The adult edition of FLCC NEXT: Scripture, prayer and teaching for the members
of FLCC Church, built for a life that is already full.

Open `flcc-adults/` on the deployed site — for this repository's Workers
deployment that is `…/flcc-adults/`. There is nothing to install and nothing to
build.

```
flcc-adults/
  index.html            the shell
  css/quiet.css         the Quiet design system
  js/core/              storage, profile, progress, content, rotation,
                        scripture, prayers, plan, art, ui
  js/screens/           one module per screen
  content/              everything the teaching team writes, as JSON
  test/                 node --test 'flcc-adults/test/*.test.mjs'
```

## What it does

**Home** — today's Scripture moment at the size it deserves, then four quiet
lines saying where you were when you left: the path you are part-way through,
the day your reading plan is on, a prayer guide, and one thing from church.

**Bible** — all 66 books in three public-domain translations, on the device.
Look up a reference or search a word, keep verses, and follow one of three
reading plans. Nothing here can edit Scripture.

**Pray** — guided prayer for the person who wants to pray and does not know how
to start, and a prayer list for the person who prays constantly and cannot hold
it all in their head. Prayers are kept when they are answered, not deleted.

**Grow** — four learning paths: Foundations, Bible Deep Dive, Faith at Work,
and Marriage & Relationships. Each session is a passage, three paragraphs, one
question, one practice and a prayer.

**Connect** — church updates, what is on, and who needs help. Everything on
that screen points at something that happens in a room with other people.

## Three decisions worth knowing about

**Nothing leaves the device.** There is no server, no account and no sync. Your
prayer list, your reflections, your reading and your verses live in this
browser on this phone; a second device starts empty and clearing site data
clears everything. That is a real cost, and it buys the thing that matters
more: what an adult prays about their marriage, their money or their manager
cannot be collected, leaked or read by a leader, because it physically never
goes anywhere.

**There is no score.** No XP, no levels, no badges, no leaderboard, and no
streak that breaks. The app counts days you turned up and says plainly that
they are not a measure of anything. `test/progress.test.mjs` fails if points
ever appear.

**A reading plan is a sequence, not a calendar.** Day 12 is the twelfth
reading you have done, not the twelfth day since you started. Miss a fortnight
and the plan is exactly where you left it — there is nothing to catch up on,
and no red number telling an adult they have failed at reading the Bible.

## The design

`css/quiet.css` — the *Quiet* system. This app was drawn twice before this
one. The second attempt gave every surface a 3px navy outline and a hard
offset shadow, put a row of rating stars on every card and a cartoon face on
every picture. It was cheerful and it was, unmistakably, an app for children.

This one is built the way the interface of a well-run clinic is built:

- **White is the ground.** Cards are white paper on a cool near-white page,
  lifted by a shadow soft enough to read as paper rather than as a sticker.
  Colour arrives as a *wash* — a tenth of a colour, enough to tell one card
  from another and light enough to put a paragraph on.
- **One loud block per screen.** Exactly one card is allowed to be a full
  colour, and it is always navy: the Scripture on Home, the invitation on
  Pray, the featured path on Grow. Everything else stays quiet so that one
  block means something.
- **Hairlines, never outlines.** Nothing in the app has a border thicker than
  1px. Separation comes from a hairline, a soft shadow or plain space.
- **Type is set, not shouted.** Headings are 600 weight, sentence case, tight.
  Nothing is 900, nothing is uppercase except a small tracked label.
- **Pictures are monoline and have no faces.** Twelve thin icons
  (`js/core/art.js`) drawn on one grid at one stroke weight, each taking the
  colour of the text beside it. They can be turned off entirely in **You**.

The palette is the same six colours the kids and teens edition uses — sky
`#C3D7EA`, captain `#4173B0`, navy `#2B4C6D`, rose `#EABCB5`, poppy `#EB8861`,
sunshine `#EDCE7A` — so the two apps stay a family. What differs is how much
of them appears at once: the kids app is full-bleed colour, this one is a
wash.

Two typefaces, doing two jobs. The interface is a sans-serif; **Scripture is
set in a serif**. And the chrome stops at Scripture: the Bible reader is plain
white paper with nothing on it at all.

## Content

Everything under `content/` is the teaching team's, written once in one adult
register, and reviewed in a pull request rather than edited from a dashboard —
which is the honest description of how an adult discipleship curriculum gets
approved.

| File | What it holds |
|---|---|
| `moments.json` | the daily Scripture moments — a fortnight is the floor |
| `paths.json`, `paths/*.json` | the four learning paths and their sessions |
| `prayer-guides.json` | guided prayer, step by step |
| `prayer-categories.json` | Family, Work, Personal, Finances, Ministry |
| `reading-plans.json` | John in 21 days, Psalms for a hard season, Mark in 16 |
| `updates.json`, `events.json`, `ministries.json` | what is happening at church |

`test/content.test.mjs` checks the shape of all of it, and
`test/scripture.test.mjs` checks every quoted verse against the shipped World
English Bible, word for word. Adding a devotional with a misremembered verse
fails the suite.

## What needs a person, not a server

The app says so on the screens themselves, and it should stay that way:

- Joining a ministry, registering for the membership class, or asking for help
  from the benevolence fund — speak to a leader after the Friday service.
- Sharing a prayer request with the church — the Tuesday prayer meeting.
- "I plan to be there" on an event is a note to yourself on your own phone. It
  does not tell the church you are coming.
