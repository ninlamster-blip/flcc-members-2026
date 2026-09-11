# Running the app for the whole BOTR network

All 14 churches share **one copy** of the app — the same `index.html`, the same
editors, the same design. Nothing is forked per church. Only the data behind it
differs, so a feature added once shows up for everyone, and no church's app can
drift away from the others' visually.

## Links

| Who | Link |
| --- | --- |
| A member of a church | `/c/<slug>/` — e.g. `/c/shekinah/` |
| Anyone, to pick a church | `/c/` |
| Any page, any church | `?church=<slug>` — e.g. `attendance.html?church=shekinah` |

`/c/<slug>/` is the link to hand out. It remembers the choice on that device,
so the member's bookmark keeps working even if they later open a bare
`index.html`. Members can also switch church from the **About** tab.

Abundance stays at the plain root URLs it has always used — every existing
bookmark, and every device already using the app, is unaffected.

## Where the data lives

```
data.json, attendance.json, prayer.json, …   ← Abundance (historical location)
churches/shekinah/data.json                  ← every other church
churches/shekinah/attendance.json
churches/_template/…                         ← skeletons to copy from
```

`church.js` is the single source of truth for which churches exist and where
each one's data sits. Every page loads it before the app and then reads
`FLCC.data('data.json')` — no page hardcodes a path. A page that needs to read
*another* church's file uses `FLCC.dataFor(slug, 'data.json')`, which answers
the same question for any church in the registry and returns `null` for a slug
that isn't one.

**Shared by the whole network** (not per church): `botr.json`,
`botr-schedule.json`, `announcements.json`, the Bible tools, World Watch,
Faith Map, Equip content, the games, `big-story/` (the children's and youth
app), `ofw-companion/` and `daily-blessing/`.

**Per church**: members and workers, the service schedule, attendance, prayer
ministry, music ministry, worship songs, giving, and the sermon notes a member
takes at their own church's services (`sermon-notes/`).

`botr-schedule.json` is the exception that proves the rule. It is BOTR
Friday's Friday-morning worship service at 10:00 AM, but the whole network is
invited, so every church sees the next one as a card on its Home tab — one
shared file at the root, read by all 14. It is therefore the one schedule that
is **not** loaded through `FLCC.data()`; `index.html` reads the fixed path
`./botr-schedule.json` on purpose, because `FLCC.data()` would send each
church looking for its own copy.

It has a row already scaffolded for every Friday of the year, so it is
hand-edited rather than managed in the schedule editor. Fill in `preacher`,
`pastoralPrayer`, `emcee` and the optional `event` on the dates as they are
assigned; a row left blank simply doesn't show.

### Making a Friday duty land in someone's own app

Those three fields are plain display names — "Ptr. Rodel" — which is all the
shared card needs. Add a matching `preacherId` / `pastoralPrayerId` /
`emceeId` and that person also gets it as a **real assignment**: on their My
Schedule tab, in their notification bell, and as a clash when they add a
personal event on the same day.

```json
{
  "date": "2026-08-07",
  "preacher": "Ptr. Rodel",
  "preacherId": "ft:bro-17",
  "pastoralPrayer": "Ptr. Mike",
  "pastoralPrayerId": "agape:bro-06"
}
```

A reference is **church-qualified** — `<slug>:<worker-id>` — because this one
service draws from all 14 churches and a worker id is only unique inside its
own church. `bro-17` alone would match a different person at every church.

The ids are optional and additive: an entry without one still appears on the
shared card exactly as before, it just isn't tied to anybody's app. A test
checks that every reference points at a real member of a real church, so a
typo fails the suite rather than quietly leaving someone untold.

### What else the file carries

Alongside `schedule[]` it holds three lists the whole network sees:

- `themes` — `"2026-09": "Financial Stewardship"`, keyed by month. The theme
  shows on the service card for any date in that month. Leave a month out
  until its theme is decided; a blank one is worse than none.
- `holidays` — `{ "date": "2026-08-27", "name": "PBUH Birthday" }`. The next
  45 days appear on Home, each saveable to a phone calendar.
- `leave` — `{ "person": "Froi", "when": "Sep 16-Oct 31" }`, folded away on
  Home behind "Ministry leave". `when` is shown **exactly as written**: the
  ministry's own shorthand ("Oct T", "Dec 19-Jan 16") doesn't parse cleanly
  into dates, and showing it verbatim beats guessing wrong.

## Telling the whole network something

`announcements.json` at the root is how one notice reaches every member of all
14 churches — a meeting, a network gathering, anything that isn't one church's
own business. Add an entry and it appears on every member's Home tab and in
their notification bell, including members who skipped the name picker:

```json
{
  "id": "ann-2026-08-07-leaders-meeting",
  "title": "Leaders' Meeting",
  "date": "2026-08-07",
  "startTime": "13:00",
  "endTime": "15:30",
  "location": "FLCC - Faithful & True Church Hall",
  "host": "FLCC - F&T",
  "notes": ""
}
```

`title` and `date` are what a member reads, so both are required; `startTime`
is `HH:MM` in 24-hour form and is shown as "1:00 PM". Entries show from 60 days
out on Home and 14 days out in the bell, and drop off by themselves the day
after they happen — nothing needs deleting. Members who have allowed browser
notifications are alerted within three days of the date.

Anything only one church should see is **not** an announcement — that belongs
in that church's own `data.json` `events[]`.

## Who Ask FLCC is switched on for

Everyone, on first open, with nothing to set up.

The Worker that serves the app also answers on `/proxy`, holding the Anthropic
key as a server-side secret, so the app points at its own origin. Members never
see an API key and never paste a URL. Every question is billed to the church's
own `ANTHROPIC_API_KEY` — there is no per-member cap, so that key's spend limit
is the ceiling worth setting.

It asks the Worker before connecting itself, and stays on "Connect to get
started" unless `/ping` reports that the call would actually succeed:

| `/ping` says | What a member sees |
| --- | --- |
| `keySet: true`, no secret | Connected, nothing to do |
| `keySet: false` | Connect — the Worker has no Anthropic key |
| `secretRequired: true` | Connect — they need the secret first |
| no Worker at all | Connect — a personal key is the only route |

That last column matters: promising an assistant that 401s on the first message
is worse than asking for setup. `/ping` reports only *whether* a secret exists,
never its value.

Setting `PROXY_SECRET` on the Worker therefore turns off the zero-setup path by
design — it is the switch for "leaders only". Leave it unset for a church-wide
assistant.

## What Ask FLCC knows

`ask.html` is the assistant, and it is the **only** one — the members app links
to it rather than embedding a second copy, so there is one knowledge base to
keep current. It builds its system prompt fresh on every load from the files
already described here, which is why nothing about it needs updating when a
schedule changes: publish the data and the assistant knows it.

It reads, in one pass:

- this visitor's church — `data.json`, `music.json`, `prayer.json`,
  `equip.json`, `attendance.json`, through `FLCC.data()` as every page does
- the network-wide files — `botr.json`, `botr-schedule.json` and
  `announcements.json` — from the root, on the same fixed paths and for the
  same reason `index.html` uses them
- **every church's `data.json`**, through `FLCC.dataFor(slug, file)`, which is
  `FLCC.data()` for a church you are not currently in

That last one is what makes it a network assistant rather than a church one. A
member of JAOC can ask who leads Cornerstone and get an answer, because all 14
rosters are in front of it — listed with the titles and designations each church
published for itself. A church that hasn't published yet is named as such rather
than left out.

Its first section is **What Is Happening Right Now**, and it holds exactly what
a member sees on their Home tab: the next network announcements, the next BOTR
Friday services, this church's own next services, holidays inside 45 days,
who is on ministry leave, and both themes for the month. The assistant is told
to read that before anything else, so "what's on tomorrow?" is answered from
the same facts the Home tab shows.

## Making a publish actually reach members

Nothing here is versioned: every file is published by editing it in place, so
its URL never changes when its contents do. Left alone, that means a member who
has opened the app once keeps running the copy their browser and Cloudflare's
edge already hold — leaders publish a new schedule, and the phones carry on
showing last week's.

Two things prevent it, and both are needed:

- **`_headers`** sets `Cache-Control: no-cache` on every `.html` and `.json`,
  and on the pretty `/c/<slug>/` links. That is not "don't cache" — the browser
  still stores the file and still revalidates, so an unchanged file costs a 304
  and no download. It covers **the app itself**, which `?t=` cannot.
- **`?t=` on every data read**, which covers a page left open. `index.html` has
  always done this; `ask.html` now does too, and also reloads when the tab
  returns to the foreground, since a phone holds a page open for days.

If a change ever seems not to have landed, this pair is the first place to look.

### How it knows who "Ptra. Weng" is

The Friday sheet writes people the way the ministry says them out loud. Those
short names are what members recognise, so they stay — but on their own they
are unanswerable: nothing connects "Ptra. Weng" to a roster.

The `preacherId` / `pastoralPrayerId` / `emceeId` references described above do
connect them, so the assistant resolves each one against the network rosters and
is given both forms:

```
2026-08-14: Preacher: Ptra. Weng = Ptra. Louella Calisagan, FLCC - Cornerstone
```

plus a deduplicated **Who these names are** lookup, since "who is Ptra. Weng?"
is the single most common question this data answers. Seventeen names resolve
today. An entry nobody has linked keeps the sheet's wording and nothing more —
the assistant is told to say it doesn't have that person's church rather than
guess at a match from the directory, which is exactly the mistake a plausible
name collision would produce.

**Linking a name is therefore what teaches the assistant who someone is.** Add
the id and both the person's own app and every member's assistant learn it at
once.

Nothing here is hardcoded. Add a church to the registry and the assistant picks
it up on the next load; no path, name or roster is typed into `ask.html`, and a
test fails if one ever is.

The prompt also tells the assistant to **lead with what is imminent**, close
with a useful next step, and flag things worth noticing — a role still
unassigned near its date, someone scheduled during their own leave. The
"Coming up" cards and the "Try asking…" chips on its opening screen are built
from the same data locally, so they are on screen before any API call and are
never stale.

A church only needs `data.json` and `attendance.json` to go live. Every other
ministry file is optional — until it exists, the app simply hides that tab. To
start a ministry, copy the file out of `churches/_template/` and publish from
that ministry's dashboard.

## Adding a church

```bash
node scripts/new-church.mjs "FLCC - Living Hope" living-hope Love
```

That registers it in `church.js`, scaffolds `churches/living-hope/`, and
regenerates the `/c/` links. Commit, then send `/c/living-hope/` to its leaders.

If you edit the registry in `church.js` by hand, re-run
`node scripts/build-church-links.mjs` so the pretty links match.

## Collecting a church's member list

`roster.html` is a form to send a church so they can give you their members
without touching the editors. They type or paste names, the titles
(Bro./Sis./Ptr./…) are picked up from the start of each line, and they send the
result back as pasted text or a downloaded `.json`. Birthdays and wedding
anniversaries are optional per person, folded behind a per-row toggle so a long
list stays readable; both come back as `MM-DD`, which is what `data.json`
already stores. The draft is saved on their device as they go.

Send it either way:

- **as a link** — `roster.html?church=shekinah` pre-selects their church
- **as a file** — attach `roster.html` to a WhatsApp or email message; they open
  it from their downloads and pick their church from the dropdown

It is deliberately self-contained for that second case: no CDN scripts, no
`church.js`, no web fonts, nothing fetched at all, so it works with no internet.
That is also why its church list is stamped in by
`scripts/build-church-links.mjs` rather than read from the registry at run time
— **re-run that script after adding a church** or the attached copy won't list
it.

Nothing is submitted anywhere on its own — the admin loads what comes back into
that church's `data.json`. The downloaded file already carries a `workers[]`
array in the shape `data.json` wants, with ids assigned (`sis-01`, `ptr-01`, …)
and `eligibleRoles` left empty, since service roles are the admin's to assign
in the schedule editor.

## Who updates what

Two different jobs, two different answers:

| | Who | How |
| --- | --- | --- |
| **Schedule, workers, themes, events** (`data.json`) | one central admin | `schedule-editor.html?church=<slug>`, GitHub token |
| **Attendance** (`attendance.json`) | that church's own steward | `attendance.html?church=<slug>`, church passcode |

Schedules are monthly and centralised — churches submit theirs to the admin,
who enters them. Attendance is per service, at 14 churches, so it can't route
through one person; each steward publishes their own.

A steward can add visitors and new faces themselves (they're stored in
`attendance.json`), but the roster of regular members comes from `data.json` —
so a new member has to reach the admin. **A church's attendance app is not
usable until its `data.json` has a workers list**; before that the steward just
sees "No workers found".

### Setting up passcode publishing (one time)

On the Worker → Settings → Variables and Secrets:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `ATTENDANCE_PASSCODES` | `{"shekinah":"…","mtcc":"…"}` — church slug → passcode |
| Secret | `GITHUB_TOKEN` | fine-grained token, Contents: read+write, this repo only |
| Text | `GITHUB_REPO` | `owner/repo` (optional; defaults to this repo) |

Then send each steward their link and their passcode. They enter it once in
Settings and never think about it again — nothing expires.

The reason this is safe: **the church is derived from the passcode, never from
the request.** A steward never names a file, so there is no file to point
somewhere else — the passcode alone decides the single path the endpoint will
write, and it can only be that church's `attendance.json`. A valid passcode
also can't write arbitrary content: the payload is rejected unless it looks
like an attendance file. Both properties are covered by tests in
`ask-proxy/worker.test.mjs` (`node ask-proxy/worker.test.mjs`).

To revoke a church, change its passcode in the secret and hand out the new one.

Until those secrets exist the endpoint returns a clear "not set up yet" and
nothing else in the Worker is affected. Stewards without a passcode can still
record attendance — it just stays on their device.

## The admin's token

The schedule editor still publishes with a fine-grained GitHub token, the way
Abundance always has — one admin, one token, switching church with
`?church=<slug>`. Each editor writes **only its own church's file**
(`schedule-editor.html?church=shekinah` can only overwrite
`churches/shekinah/data.json`) and shows the church and exact destination in
its header before anything is published.

Be clear-eyed about what that scoping is: a guardrail, not a wall. A GitHub
token can write anything in the repo, so the editor pointing at one file is a
convention the app follows, not something the token enforces. That's fine for a
single trusted admin — it is exactly why stewards get passcodes instead.

The prayer and music dashboards still export a `.json` for manual upload; they
have no publish button yet. If those ministries end up spread across churches
too, they're the next candidates for passcode publishing.

## Storage on a shared device

Each church's saved state is namespaced (`shekinah:flcc-members-me`), so a phone
that has looked at two churches keeps two separate identities, note sets and
progress streaks. Abundance deliberately keeps the original un-prefixed keys, so
nobody who is already using the app loses anything.

Device-wide preferences stay shared across churches on purpose: Bible
translation, Bible reading plan, game scores, and the Ask API key.

One key is read and written by **two** apps: `flcc-sermon-notes-v1`, by
`index.html` and by `sermon-notes/`. They share the note id (`2026-08-30|Sunday`)
as well, so a note taken in either opens in the other, and both spread the
stored note before saving so neither drops a field the other added. A test holds
them to it — see `sermon-notes/README.md`.

An app in a **subdirectory** has one thing to watch: `FLCC.data()` answers
relative to the site root, because every page that has ever called it sits at
the root. `sermon-notes/` walks the answer back up a level before fetching it;
anything else added below the root has to do the same, or a member of Abundance
asks for `/sermon-notes/data.json` and gets a 404.

## Still network-wide

The Cloudflare Worker's prayer chain and push notifications (`ask-proxy/`,
used by `ofw-companion/`) are network-wide by design — one anonymous chain for
everyone, not one per church. If a church ever needs its own private chain, that
means adding a `church` column to the D1 tables and scoping the endpoints; it
hasn't been done because nothing today asks for it.
