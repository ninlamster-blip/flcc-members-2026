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
`FLCC.data('data.json')` — no page hardcodes a path.

**Shared by the whole network** (not per church): `botr.json`, the Bible
tools, World Watch, Faith Map, Equip content, the games, `ofw-companion/` and
`daily-blessing/`.

**Per church**: members and workers, the service schedule, attendance, prayer
ministry, music ministry, worship songs, giving.

One church has an extra file: `churches/botr-friday/botr-schedule.json` is
BOTR Friday's Friday-morning service, shown as a card on its Home tab. It used
to sit at the root and appear for every church. It has its own shape — plain
names rather than roster IDs — so it is still hand-edited rather than managed
in the schedule editor.

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

### Recording on more than one device

A steward's records live in `localStorage`, which belongs to one browser. She
bookmarks the app on her phone, records a service, opens the same link on a
laptop — and sees an empty app. Two things keep her work with her:

- **Every tap is published.** Auto-sync used to fire only when a GitHub token
  was connected, which no steward has, so a passcode steward's work never left
  her browser. A passcode now publishes on the same five-second timer.
- **The published file is read back on load.** The app fetches its own church's
  `attendance.json` and merges it into the device. Newest wins per session
  (that's what the `updatedAt` stamp on each session is for), the result is
  always a union, and a session deleted on a device stays deleted unless
  someone recorded it again afterwards. A device that has been closed for
  weeks therefore can't publish its stale copy over anyone's newer one.

She still enters the passcode once per browser — that is what identifies her
church, and it is deliberately not something a link can carry.

The merge is the one place where records could be lost, so it is tested:
`node attendance.test.mjs` runs the real functions lifted out of
`attendance.html`.

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

## Still network-wide

The Cloudflare Worker's prayer chain and push notifications (`ask-proxy/`,
used by `ofw-companion/`) are network-wide by design — one anonymous chain for
everyone, not one per church. If a church ever needs its own private chain, that
means adding a `church` column to the D1 tables and scoping the endpoints; it
hasn't been done because nothing today asks for it.
