# Running the app for the whole BOTR network

All 13 churches share **one copy** of the app — the same `index.html`, the same
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

**Shared by the whole network** (not per church): `botr.json`,
`botr-schedule.json`, the Bible tools, World Watch, Faith Map, Equip content,
the games, `ofw-companion/` and `daily-blessing/`.

**Per church**: members and workers, the service schedule, attendance, prayer
ministry, music ministry, worship songs, giving.

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

## Who updates what

Two different jobs, two different answers:

| | Who | How |
| --- | --- | --- |
| **Schedule, workers, themes, events** (`data.json`) | one central admin | `schedule-editor.html?church=<slug>`, GitHub token |
| **Attendance** (`attendance.json`) | that church's own steward | `attendance.html?church=<slug>`, church passcode |

Schedules are monthly and centralised — churches submit theirs to the admin,
who enters them. Attendance is per service, at 13 churches, so it can't route
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

## Still network-wide

The Cloudflare Worker's prayer chain and push notifications (`ask-proxy/`,
used by `ofw-companion/`) are network-wide by design — one anonymous chain for
everyone, not one per church. If a church ever needs its own private chain, that
means adding a `church` column to the D1 tables and scoping the endpoints; it
hasn't been done because nothing today asks for it.
