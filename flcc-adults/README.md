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
  css/next.css          the poster system
  js/core/              storage, profile, progress, content, rotation, agenda,
                        scripture, prayers, plan, notes, ai, safety, art, ui
  js/games/             crossword layout, match-three rules — pure functions
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

**Explore** — "What do you need today?", and six editorial blocks: **Read**
(the Bible), **Ask**, **Pray**, **Grow** (the learning paths), **Plan** (a
reading plan) and **Play**. Under them, where you already were.

**Community** — the prayer meeting, what is happening with real dates against
it, what the church has said, and where help is needed. Everything on it points
at something that happens in a room with other people.

**Watch** — the messages preached at FLCC: featured, the rest of the series you
are in, everything newest first, and by series. Sermon notes live here too,
because a note belongs to the sermon it was taken at.

**You** — what you have made, how you have been, the settings, and the plain
truth about what this app holds.

## Three decisions worth knowing about

**Nothing leaves the device, except a question you chose to ask.** There is no
server, no account and no sync. Your prayer list, your reflections, your sermon
notes, your reading and your verses live in this browser on this phone; a
second device starts empty and clearing site data clears everything. That is a
real cost, and it buys the thing that matters more: what an adult prays about
their marriage, their money or their manager cannot be collected, leaked or
read by a leader, because it physically never goes anywhere.

The single exception is **Ask**, which has to send your question somewhere to
answer it. It sends the question and nothing else about you, it can be switched
off, and it says all of this on its own screen in the same size type as
everything else. See [Ask](#ask).

**There is no score.** No XP, no levels, no badges, no leaderboard, and no
streak that breaks. The app counts days you turned up and says plainly that
they are not a measure of anything. `test/progress.test.mjs` fails if points
ever appear.

**A reading plan is a sequence, not a calendar.** Day 12 is the twelfth
reading you have done, not the twelfth day since you started. Miss a fortnight
and the plan is exactly where you left it — there is nothing to catch up on,
and no red number telling an adult they have failed at reading the Bible.

## Ask

The one screen that sends anything anywhere, and it says so on itself rather
than in a policy.

You type the question you would not put to anybody at church. It answers in
five parts — what you asked, what Scripture says, what that means here,
something to pray, one thing to do — and each part is a poster. A reply that
ignores that shape arrives as one block of grey text, which is deliberate: it
should *look* unreliable when it is.

What is sent is the question and the last few turns. What is never sent is your
name, your season, your prayer list, your reflections, your sermon notes or
your reading. The question goes to FLCC's own helper, which holds the key so
your phone does not have to; nothing is kept there, and it is not tied to you.
You can switch the whole thing off in You.

Before any of that, it screens for crisis language **on the device**. If what
you typed sounds like self-harm or like somebody is hurting you, no request is
made at all — the screen shows people and phone numbers instead, and stops.
That path does not depend on a model behaving well, on a network, or on the
proxy being up.

It will not speak as God, will not tell you what God is saying to you, will not
stand in for a pastor or a doctor, and will tell you where Christians genuinely
disagree instead of picking a side. Those are lines in the prompt, and
`test/ai.test.mjs` fails if any of them is removed.

## Sermon notes

A title, who preached, the passage, and a page to write on. That is the whole
feature, and the shortness is the point: you are meant to be listening, not
filling in a template. It saves as you type — there is no Save button to forget
— an empty note is thrown away rather than kept as clutter, and starting one
from a message fills the title, the preacher and the passage in for you.

They never leave the phone.

## Play

Two games, and neither is a delivery mechanism for anything. No points, no
streak, nothing anybody else can see, nothing reported to the church.

**The crossword** is new every morning and meant to be hard. Nine clues are
dealt from a bank of 184 and interlocked into a grid in code, so it never runs
out and never repeats a shape — and the clues assume you have read the text.
"Where the boat came to rest", not "Noah's boat". "Seventy-one interruptions in
the Psalms, and nobody now knows what it told the musicians to do." A test
builds every puzzle for the next two years and fails if one of them strands a
word.

**Match three** is the one everybody already knows how to play, drawn in this
app's own colours with its own drawings as the pieces. Thirty moves, a modest
target, no timer and no lives. A swap that matches nothing is refused rather
than played and snapped back — there is no reason to charge you a move for a
misread.

## Text size

Four steps, in You, and the first thing in the settings rather than the last. A
good part of this church is over sixty and the app is set in a face that is
lovely at 16px on a desk and hard at arm's length on a bus.

It grows everything — the Bible reader included — and it multiplies whatever
text size your phone is already set to rather than replacing it, so somebody
who has already turned text up gets that, times this. The 3px outlines, the
corner radius and the progress bars deliberately stay where they are: those are
the drawing, not the type.

## Changing what is on the Community tab

**`admin/` — the events and notices admin.** Open `…/flcc-adults/admin/`, type
the passcode, edit, press publish. Changes are live on members' phones in about
a minute. No GitHub account, no JSON.

It edits two things: **events** (what is on, and what Today counts down to) and
**announcements** (the "From FLCC" notices). Ministries are rare enough to stay
a repository edit.

What happens when you press publish: the page POSTs to `/api/publish/adults` on
this repository's Worker, which checks the passcode, validates the shape, and
commits the file back to `content/`. Cloudflare rebuilds and the app picks it
up. **So the repository is still the single source of truth** — every save is
an ordinary commit with a date and a name on it, the history is the real
history, and a mistake is one revert away. The app goes on reading static files
it can cache and serve with no signal, which a database would have taken away.

Two things it will not let you publish, because both break the app quietly
rather than loudly:

- **An event nothing can count down to.** Every event says when it is twice —
  the sentence a member reads, and the day and time the countdown is computed
  from. The page offers the sentence ready-made from the day you picked.
- **A calendar with no main gathering.** Today frames the whole week around it;
  without one the app loses its sense of the week for ever.

Setup is two Worker secrets, `ADULTS_ADMIN_PASSCODES` and `GITHUB_TOKEN` — see
the comments in `wrangler.toml`. Until they are set the endpoint is closed, not
open. Give each person their own passcode rather than sharing one: it costs
nothing and makes the commit history worth reading.

## The design

`css/next.css` — the **poster system**, which is the kids and teens edition's
design system, not a cousin of it. Open `flcc-next/` and this app side by side
and they are recognisably one product: the same cream paper, the same navy
ink, the same enormous headlines on flat blocks of colour, the same drawings.

It took four other designs to get here. The first was drawn in a playful
sticker style and read, unmistakably, as an app for children. The three after
it each ran the other way — bands, then seeded waves and hand-drawn textures,
then an editorial near-black-and-gold — and each ended up as a dashboard of
tiles wearing a different coat. The thing the church actually wanted was one
app with two editions.

- **A screen is a run of posters.** Each poster is a whole block of colour
  carrying one label, one headline and one action. Four big things to scroll
  through, not twelve small ones to read.
- **One flat colour per poster**, from the six shared names. Nothing is soft:
  no gradients, no glass, no glow, no drop shadows.
- **One outline weight.** 3px, navy, on posters, pills, tracks and drawings
  alike.
- **Headlines are heavy.** Inter at 900. A headline in this system is a block
  of colour in its own right.
- **The chrome stops at Scripture.** The Bible reader is plain white paper and
  serif type with nothing on it at all. The app can be as loud as it likes
  right up to the moment somebody is reading the Bible.

The adult register is the same system spoken plainly: a squarer 10px radius,
no faces on the drawings, poppy never used as a whole poster (white type does
not sit safely on it at that size), and prose written for an adult.

The two apps share **no code** — the stylesheet and the drawings are
deliberate duplicates. `test/design.test.mjs` reads both stylesheets and fails
if the palette, the edge, the face, the weights, the tones or the actions
drift apart, and `test/art.test.mjs` compares the shared symbols' path data
character for character. If a rule needs to change, it changes in both apps.

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
| `crossword.json` | 184 clues the daily crossword is dealt from |

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

**A crossword clue is written, a crossword is not.** Add entries to
`crossword.json` — an uppercase answer of three to fifteen letters and a clue —
and the app deals nine of them a day and builds the grid itself. Nobody lays
out a puzzle. Two rules the suite enforces: the clue may not contain its own
answer, and it may not trail off into "…in the Bible". Aim at somebody who has
read the text; the bank sets the level.

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
