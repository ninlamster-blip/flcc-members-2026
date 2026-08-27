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
| **Explore** | Bible journeys with lessons, and real-life topics — pressure, doubt, friendship, phones |
| **Play** | Five games: Bible quiz, speed quiz, Who am I?, verse builder and a crossword |
| **Connect** | What is on, sharing a prayer, and Ask NEXT |
| **Me** | Streak, level, XP and achievements as collectible stamps, plus name and delete-everything |

Behind them: **Ask NEXT**, a study helper that answers in five fixed parts and
is off until a ministry leader configures it, and a **ministry dashboard** at
[`/flcc-next/admin.html`](admin.html).

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
│   ├── core/           storage, profile, progress, content, ai, safety, art, ui, dom, router
│   ├── screens/        one module per screen, loaded on demand
│   ├── games/          crossword layout (pure, no DOM)
│   └── admin/          the dashboard and the content audit
├── content/            authored JSON — the whole library
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
| `daily.json` | The daily word: verse, reflection, prayer, challenge, devotional |
| `journeys.json` + `journeys/*.json` | Three journeys, fourteen lessons |
| `real-life.json` | Eight real-life topics |
| `games.json` + `games/*.json` | The five games and their question banks |
| `events.json` | What is on |
| `achievements.json` | The collectible stamps and how each is earned |
| `help-lines.json` | Who to contact when something is serious |

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

[`admin.html`](admin.html) — overview, content, prayers, events and Ask NEXT.

It is honest about what it can see. Authored content is public and read-only,
so the dashboard audits it (the same rules as the test suite, running in the
browser) and hands back JSON to commit. Everything else it shows belongs to
**this device**, because FLCC NEXT has no accounts and no server. A prayer a
young person marked *only me and God* is counted there and never displayed.

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
- **Writing content from the dashboard.** It produces JSON to commit.
- **Community moments.** The photo wall is a placeholder; a shared, moderated
  photo feed for minors needs storage, moderation and consent that a static
  site cannot provide.
