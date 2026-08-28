# FLCC NEXT

**Grow. Play. Discover. Follow Jesus.** A mobile-first companion for the kids
(7–12) and teens (13–18) of FLCC Church.

```
https://<your-site>/flcc-next/
```

No build step, no dependencies, no account, no server. Serve the repository as
static files and open `/flcc-next/`:

```bash
python3 -m http.server 8000    # from the repository root
# then open http://localhost:8000/flcc-next/
```

`file://` will not work — ES modules need a real origin.

## What is here

Five destinations along the bottom, and none of them is named after a feature.

| Tab | What it does |
|---|---|
| **Today** | One thing for today: a verse, what it means, a prayer, a challenge, and the devotional behind it |
| **Explore** | The Bible itself, Bible journeys with lessons, and real-life topics — pressure, doubt, friendship, phones |
| **Play** | Six games: Bible quiz, speed quiz, Our church, Who am I?, verse builder and a crossword — a fresh set each day |
| **Connect** | What is on, sharing a prayer, and Ask NEXT |
| **Me** | Streak, level, XP and achievements as collectible stamps, plus name and delete-everything |

Behind them: **the Bible**, all 66 books in three translations on the device;
**Ask NEXT**, a study helper that answers in five fixed parts and is off until
a ministry leader configures it; and a **ministry dashboard** at
[`/flcc-next/admin.html`](admin.html) where every piece of authored content can
be rewritten without a developer.

## The Bible

Kids and teens asking to look something up now have somewhere to look. The
whole Bible ships with the app — committed, not fetched from an API — in three
public-domain translations:

| | | |
|---|---|---|
| **World English Bible** | modern English, the default | public domain |
| **Bible in Basic English** | about a thousand words, for a younger reader | public domain |
| **Ang Dating Biblia (1905)** | Tagalog, the language most FLCC families pray in | public domain |

Committing the text rather than calling a service is the point. A child reading
Scripture should not depend on a third party staying up, staying free, or
staying quiet about what was read, and a church hall with no signal should not
be a reason the Bible will not open. One file per book means opening John
downloads John (~180 KB), not a Bible, and the service worker keeps whatever
has been read.

Four ways in, because a young person arrives with four different questions:

- **A reference** — "John 3:16", "1 Jn 2:1-5", "Mga Awit 23". English and
  Tagalog names, and the abbreviations study Bibles actually print.
- **A word they half-remember** — search runs a book at a time, showing results
  as they arrive, starting with books already on the device.
- **A feeling with no reference attached** — *Where do I look?* answers twelve
  of them: scared, sad, left out, furious, sorry, unsure anyone loves you.
- **No question at all** — the shelf, with one line saying what each of the 66
  books actually is.

Verses can be kept, a bookmark is remembered, and none of it leaves the device.

```bash
node scripts/build-next-bible.mjs    # rebuild bible/ from the public-domain sources
```

## The two modes

Age is architecture here, not a font size. `modeForAge` puts anyone 12 or under
in `kids` and everyone else in `teens`, the mode is stamped on the root element
as `data-mode`, and it changes three things at once:

- **Register.** Every piece of authored content is written twice, once per
  mode. A missing variant fails the test suite; there is no fallback that
  quietly shows a teenager the version written for a seven-year-old.
- **Type and shape.** Kids get a larger headline scale and a 22px corner
  radius; teens get a tighter scale and 6px. Same palette, same grid.
- **Behaviour.** The crossword confirms an answer as soon as a child completes
  it; a teenager has to press Check. Ask NEXT sends a different system prompt
  and a shorter answer budget for kids.

## Design

The rules are in `css/next.css` as tokens, and the tests enforce the parts a
stylesheet cannot.

- **Colour.** Cream `#F4D89A`, pink `#E9A6A3`, blue `#8FC3CF`, sage `#A9C5A2`,
  off-white `#F7F5F0`, ink `#161616`. One dominant colour per item — a poster
  is a block of colour, not a white card with an accent.
- **Type.** Inter, 400–800, with dramatic jumps between a `.label` at
  `.68rem` and a `.display` at `clamp(2.6rem, 13.5vw, 4rem)`. Nothing in
  between is decorative.
- **Illustration.** 21 symbols drawn in code in `js/core/art.js` as flat shapes
  with a `5.5`-weight black outline on a 100×100 grid. No stock art, no emoji
  as illustration, no gradients. A test fails if a symbol uses a colour outside
  the palette, so the language cannot drift.
- **Layout.** Tall vertical posters stacked in one column, `.figures` for
  small paired numbers, and generous whitespace. No dashboard grid.

## How it is put together

```
flcc-next/
├── index.html          the app shell (header, screen, tab bar)
├── admin.html          the ministry dashboard
├── css/next.css        every token and every component
├── js/
│   ├── app.js          boot, onboarding, routing, the frame
│   ├── core/           storage, profile, progress, content, library, scripture,
│   │                   rotation, ai, safety, art, ui, dom, router
│   ├── screens/        one module per screen, loaded on demand
│   ├── games/          crossword layout (pure, no DOM)
│   └── admin/          the dashboard, the editor and the content audit
├── content/            authored JSON — the ministry's, and editable
├── bible/              the text of Scripture — not the ministry's, and not editable
└── test/               node:test, zero dependencies
```

Screens are loaded with dynamic `import()` and are never bundled. Each returns
`{ title, el }`; the shell owns the header and the tabs and nothing else.

## Content

Everything a young person reads is authored JSON under `content/`, versioned
with the code and reviewed like code. Every item carries a `kids` and a `teens`
version, one of the five colours, and the name of an illustration that already
exists.

| File | What it holds |
|---|---|
| `daily.json` | 35 daily words: verse, reflection, prayer, challenge, devotional |
| `journeys.json` + `journeys/*.json` | Three journeys, 24 lessons — fifteen of them the life of Jesus |
| `real-life.json` | 14 real-life topics |
| `games.json` + `games/*.json` | The six games and their banks — 189 quiz questions, 40 Who am I? rounds, 54 verses, 16 crosswords |
| `events.json` | What is on |
| `achievements.json` | The collectible stamps and how each is earned |
| `bible-books.json` | One line saying what each of the 66 books is |
| `bible-find.json` | *Where do I look?* — a feeling, and the places to read |
| `help-lines.json` | Who to contact when something is serious |

Quiz questions carry a **topic** — `bible`, `jesus` or `flcc` — and each round
says which topics it deals. That is what puts our own church into the quiz, and
what gives Play a round of its own (**Our church**: the fourteen churches, the
three sectors and the verse they are named after, N.E.C.K. in Kuwait, the 2030
target, and what our statement of faith actually says) without a second
question file to keep in step with the first.

### Staying fresh

A child who opens FLCC NEXT every morning should meet something they have not
met before, for as long as the authored content can hold out. A shuffle cannot
do that — it re-rolls every time, so day two repeats day one and nothing
guarantees the whole bank is ever seen.

So the app **deals** rather than shuffles (`js/core/rotation.js`). A bank is
permuted once per cycle and handed out one slice per day: inside a cycle nothing
repeats and everything is eventually dealt, and when the bank runs out the
permutation changes and the order is different next time round. It is a pure
function of the date, which buys two more things — everyone in the ministry
gets the same puzzle on the same morning, and a child cannot re-roll a hard
question by closing the app and opening it again.

How long that lasts, on the content shipped today:

| | Kids | Teens |
|---|---|---|
| Daily word | 35 days | 35 days |
| Bible quiz | 14 days | 18 days |
| Our church | 7 days | 10 days |
| Who am I? | 8 days | 8 days |
| Verse builder | 8 days | 10 days |
| Crossword | 8 days | 8 days |
| Speed quiz | 7 days | 9 days |

The speed quiz is a recall drill against a clock, where meeting a question you
have seen before is the exercise rather than a failure. Everything is held to a
week minimum by `test/audit.test.mjs`, and each game shows its own position —
"Day 3 of 8" — while you play it.

Every question is authored with the right answer written first, because that is
the only way to check a bank of two hundred in a diff. The screens permute the
options before showing them (`rotation.askOrder`), on the same terms as
everything else here: a pure function of the day and the question, so the
ministry sees one arrangement and closing the app cannot re-roll it.

**Adding more is authoring, not engineering** — and now it is not even a
commit. See below.

## Editing content, without a developer

Kids and teens keep asking for more, and "more" used to mean a developer, a
commit and a deploy. The dashboard's **Library** tab now edits every authored
file: quiz questions, lessons in any journey, daily words, verses, crosswords,
events, achievements, the *Where do I look?* lists and the help lines. One
editor, driven by the field list each kind declares in `js/core/library.js`.

How it works, and what it honestly is:

- The committed JSON stays the base and is never rewritten — there is no server
  here to rewrite it with.
- A **pack** of changes lives in `next/v1/library` on the device that made
  them. `content.js` lays it over the base on every read, so a question added
  in the dashboard is in the next round of the quiz.
- The audit — on Overview and Content — runs against the **merged** content, so
  a question with no right answer is caught there rather than by a child.

Which means two limits, stated on the page wherever they matter:

1. **A pack lives on one device.** Export it and import it on another, or
2. **copy the finished file and commit it**, which is how a change reaches the
   whole ministry. Both buttons are in Library.

*Undo everything* always gets back to the committed content. Nothing in Library
can touch `bible/`: Scripture is not the ministry's to edit.

`help-lines.json` is still marked `verifyBeforeLaunch: true`. **Every number in
it must be checked by a person before this app reaches a child.** The dashboard
warns about it on every load until that flag is removed.

## Ask NEXT

Off by default. A ministry leader turns it on in the dashboard by pointing it
at a proxy they deploy, so no API key ever reaches a phone —
[`ask-proxy/worker.js`](../ask-proxy/worker.js) in this repository is the same
proxy the FLCC Members app uses, and `POST /proxy` is the endpoint.

What it will not do, enforced in `js/core/ai.js` and tested in
`test/ai.test.mjs`:

- It never speaks as God or as Jesus, and never claims to know what God is
  saying to a particular young person.
- It never replaces a parent, a guardian, a pastor, a ministry leader, a doctor
  or a counsellor. Where one of those is needed, it says so.
- Where Christians genuinely disagree, it says they disagree.
- Every answer comes back in five parts — 💬 let's talk about it, 📖 what the
  Bible says, 💭 think about this, 🙏 a prayer, 👣 one next step — and the app
  renders those parts itself, so a reply that ignores the shape is *visible*
  rather than passing as pastoral advice.
- A question that suggests danger or self-harm is answered **on the device**
  with the help card. Nothing leaves the phone.
- The request carries the question and the age group. Not a name, not a
  prayer, not a journal entry, not a storage key.

## The ministry dashboard

[`admin.html`](admin.html) — overview, library, content, prayers, events and
Ask NEXT.

It is honest about what it can see. Authored content is public and served
read-only, so edits are kept as a pack on this device and laid over it; the
dashboard audits the result (the same rules as the test suite, running in the
browser) and hands back the finished JSON to commit. Everything else it shows
belongs to **this device**, because FLCC NEXT has no accounts and no server. A
prayer a young person marked *only me and God* is counted there and never
displayed.

There is no password on it, deliberately: a client-side PIN on a static page
protects nothing, and the page shows nothing a child could not already reach on
their own device. Real roles need the server in
[ARCHITECTURE.md](ARCHITECTURE.md).

## Privacy

Everything lives on the device, under the `next/v1/` namespace, and
`js/core/storage.js` throws on any key outside it. There is no public profile,
no messaging between young people, no photo upload, no advertising, no
analytics and no leaderboard. The only thing that ever leaves the device is a
question typed into Ask NEXT, and only once a leader has turned it on.

Settings → **Delete everything** in Me wipes the namespace, and says exactly
what it is about to remove before it does.

## Tests

```bash
node --test 'flcc-next/test/*.test.mjs'
```

Zero dependencies. `test/modules.test.mjs` parses every module the browser
loads, including the screens, because a syntax error in a screen otherwise
survives a green run and shows up as a blank page.

## What is not built

Phase 1 is the app a young person uses, offline-first and complete. These parts
of the brief need a server and are specified, not implemented — see
[ARCHITECTURE.md](ARCHITECTURE.md):

- **Accounts, roles and church-wide data.** No sign-in, so no cross-device
  progress, no real prayer moderation queue, no attendance or RSVP counts, and
  no church-wide numbers on the dashboard.
- **Sharing edits without a file.** Library writes content, but the pack lives
  on the device that made it until somebody exports it or commits the finished
  file. A server would make that a review queue — who wrote it, who approved
  it, when it reached the children — which is the shape content for minors
  should have.
- **Community moments.** The photo wall is a placeholder; a shared, moderated
  photo feed for minors needs storage, moderation and consent that a static
  site cannot provide.
