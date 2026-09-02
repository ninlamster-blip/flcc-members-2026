# FLCC NEXT — for adults

**Faith for real life.**

The adult edition of FLCC NEXT: Scripture, prayer, teaching and the church's
own week, for the members of FLCC Church — built for a life that is already
full.

Open `flcc-adults/` on the deployed site — for this repository's Workers
deployment that is `…/flcc-adults/`. There is nothing to install and nothing to
build.

```
flcc-adults/
  index.html            the shell
  css/next.css          the NEXT system
  js/core/              storage, profile, progress, content, rotation, agenda,
                        scripture, prayers, plan, art, ui
  js/screens/           one module per screen
  content/              everything the teaching team writes, as JSON
  test/                 node --test 'flcc-adults/test/*.test.mjs'
```

## Five tabs

**Today** — the greeting, then today's Scripture at the size it deserves, then
what is next on the church's calendar with a countdown against it, then three
honest figures, then whatever you were part-way through. What it says changes
through the week: the church gathered, the hours after it, the eve of it, and
the ordinary days that are most of them.

**Explore** — "What do you need today?", and four editorial blocks: **Read**
(the Bible), **Pray**, **Grow** (the learning paths), **Plan** (a reading
plan). Under them, where you already were.

**Community** — the prayer meeting, what is happening with real dates against
it, what the church has said, and where help is needed. Everything on it points
at something that happens in a room with other people.

**Watch** — the messages preached at FLCC: featured, the rest of the series you
are in, everything newest first, and by series.

**You** — what you have made, how you have been, the settings, and the plain
truth about what this app holds.

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

`css/next.css` — the **NEXT system**. It is the app's fifth design and the
first one that is not built out of coloured rectangles. The four before it each
tried to carry the screen with surface — stickers, then bands, then seeded
waves and hand-drawn textures — and each of them ended up as a dashboard of
tiles wearing a different coat. This one gives the work to type and to space.

- **80 / 15 / 5.** Eighty per cent of a screen is warm editorial paper
  (`#F8F8F6`) and near-black ink. Fifteen is the one deep block a screen is
  allowed — the Daily Word, the featured message, the profile head. Five is
  gold, and gold is a signal, never a decoration.
- **Type does the work.** A heading is large enough that it does not need a
  box around it. Most sections are a heading and a list of hairline-separated
  rows, with no container at all.
- **One main action per screen.** One filled button. Everything else is a text
  action with a rule after it. There is no third style.
- **The line points forward.** `NEXT UP ─────→` — the signature, and the
  reason the app is called NEXT. It is on section headings and on the four
  Explore blocks, and nowhere else.
- **The chrome stops at Scripture.** The Bible reader is white paper and serif
  type with nothing on it at all. The app is quiet so that Scripture can be the
  loudest thing in it.

The interface is set in the platform's own face — SF on Apple hardware, the
system face elsewhere — and the one webfont the app loads is spent on
Scripture. The palette is near-black `#151515` on `#F8F8F6`, hairlines in
`#E8E8E4`, and gold in two weights: `#B4884A` on the deep block, `#8A5F1E`
where it carries text on paper. The six colours shared with the kids and teens
edition are still here and still pinned by a test in both apps, but they are
2px stems and tenth-strength washes now, never a surface with a paragraph on
it.

Four rules survive from the version of this app that read as an app for
children, and all four are still enforced by tests: no border over 1px, no
shadow with a zero blur radius, no font-weight over 600, and no face on any
drawing.

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
| `messages.json` | what was preached — passage, substance, question |
| `updates.json`, `events.json`, `ministries.json` | what is happening at church |

`test/content.test.mjs` checks the shape of all of it, and
`test/scripture.test.mjs` checks every quoted verse against the shipped World
English Bible, word for word. Adding a devotional with a misremembered verse
fails the suite.

### Two things the teaching team should know

**An event says when it is, twice.** `when` is the sentence a member reads
("Every Friday · 10:00 AM – 12:00 PM"). Beside it, `weekday` (0 is Sunday,
5 is Friday) with `start` and `minutes`, or `date`, or `dates[]` for a short
series — that is what the countdown on the Today screen is computed from. An
event with only the sentence never appears as "Next up", and the content suite
fails it rather than letting it disappear quietly.

**A message does not need a recording.** FLCC publishes no video archive, so
every message in `messages.json` ships with `url` empty and stands on what it
carries instead: the passage it was preached from, three takeaways and the
question it left behind. Nothing on the Watch screen claims to play anything.
When the media team posts a recording, filling in that one field turns "Watch
the recording" on for that message and changes nothing else.

## What needs a person, not a server

The app says so on the screens themselves, and it should stay that way:

- Joining a ministry, registering for the membership class, or asking for help
  from the benevolence fund — speak to a leader after the Friday service.
- Sharing a prayer request with the church — the Tuesday prayer meeting.
- "I plan to be there" on an event is a note to yourself on your own phone. It
  does not tell the church you are coming.
- Who is praying, who is here, and whose birthday it is today — this app holds
  no member directory and no attendance record, so it cannot tell you, and it
  says so rather than showing a number it made up.
