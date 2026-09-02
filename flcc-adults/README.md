# FLCC NEXT — for adults

The adult edition of FLCC NEXT: Scripture, prayer and teaching for the members
of FLCC Church, built for a life that is already full.

Open `flcc-adults/` on the deployed site — for this repository's Workers
deployment that is `…/flcc-adults/`. There is nothing to install and nothing to
build.

```
flcc-adults/
  index.html            the shell
  css/layers.css        the Layers design system
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

`css/layers.css` — the *Layers* system. A list here is a stack of colour, and
what separates one layer from the next is a torn curve rather than a rule.
Each band carries a hand-drawn texture in the corner where no type goes.
Everything that is not a list is warm paper.

- **A list is a stack.** Anything that is a set of things with a count —
  prayer categories, learning paths, reading plans — is a stack of full-bleed
  bands with the count set large on the right. Sixty-six Bible books are *not*
  this: a stack that long is a paint chart, so the shelves stay plain type.
- **Every band has a texture.** One of four hand-drawn marks — hatch, dashes,
  dots, comb — in a corner, at a fifth strength. It is what stops a flat
  colour reading as a swatch.
- **Waves are seeded, never random.** The same list draws the same edges on
  every phone, every time (`js/core/art.js`).
- **Anything that makes something is a sheet.** A white page, a heading with
  one word marked in ember over a highlighter stroke, the choices as soft
  filled blocks, and one full-width action along the bottom.
- **One loud block per screen**, in ember — the deep coral the reference opens
  on. Everything else is a wash, at about a tenth strength.

Four rules survive from the version of this app that read as an app for
children, and all four are still enforced by tests: no border over 1px, no
shadow with a zero blur radius, no font-weight over 600, and no face on any
drawing.

The palette is the six colours shared with the kids and teens edition — sky
`#C3D7EA`, captain `#4173B0`, navy `#2B4C6D`, rose `#EABCB5`, poppy `#EB8861`,
sunshine `#EDCE7A` — plus one derived shade, **ember `#C24A38`**: poppy
deepened until white type sits on it at 4.8:1. Ember is local to this app.

Two typefaces, doing two jobs. The interface is Plus Jakarta Sans; **Scripture
is set in a serif**. And the chrome stops at Scripture: the Bible reader is
plain white paper with nothing on it — no band, no texture, no wave.

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
