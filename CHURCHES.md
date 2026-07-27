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

## How leaders publish

Unchanged from how Abundance has always worked: the leader opens the editor,
connects a fine-grained GitHub token once, and Publish writes the JSON back to
the repo. What's new is that each editor writes **only its own church's file** —
`schedule-editor.html?church=shekinah` can only ever overwrite
`churches/shekinah/data.json`, and the editor header shows the church and the
exact file before anything is published.

Worth being clear about the limit: this is scoping, not enforcement. The token
a leader holds is a repo token, so a determined leader could still write outside
their folder by other means. Moving publishing behind the Cloudflare Worker —
one server-side token, a per-church passcode, writes restricted to that church's
folder — is the planned follow-up and the point at which this becomes a real
boundary. Until then, hand tokens only to leaders you'd trust with the repo.

## Storage on a shared device

Each church's saved state is namespaced (`shekinah:flcc-members-me`), so a phone
that has looked at two churches keeps two separate identities, note sets and
progress streaks. Abundance deliberately keeps the original un-prefixed keys, so
nobody who is already using the app loses anything.

Device-wide preferences stay shared across churches on purpose: Bible
translation, Bible reading plan, game scores, and the Ask API key.

## Not multi-tenant yet

The Cloudflare Worker's prayer chain and push notifications (`ask-proxy/`,
used by `ofw-companion/`) are network-wide by design — one anonymous chain for
everyone, not one per church. If a church ever needs its own private chain, that
means adding a `church` column to the D1 tables and scoping the endpoints; it
hasn't been done because nothing today asks for it.
