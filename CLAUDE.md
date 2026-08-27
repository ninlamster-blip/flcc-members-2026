# Repo-specific instructions

## Multi-church

All 14 BOTR churches share these same files — same structure, same design, only
the data differs. `church.js` is the source of truth for which churches exist
and where each one's data lives; pages read `FLCC.data('file.json')` and
`FLCC.key('storage-key')` rather than hardcoding paths or keys. See
`CHURCHES.md` before adding a church, a data file, or a localStorage key.

## Shepherd

`shepherd/` is a **separate application**, not part of the FLCC Members app.
It has its own tenant registry, its own `shepherd/v1/…` storage namespace, its
own design system and its own tests, and it must never import `church.js` or
read `FLCC.*`. Work on one does not imply work on the other. See
`shepherd/ARCHITECTURE.md` before adding a module or a collection.

Two narrow, deliberate exceptions exist for churches (like Abundance) running
both apps side by side, both opt-in and both documented where they live in
code:

- `attendance.html` links to `./shepherd/` — a plain navigational shortcut,
  nothing more. Shepherd still has its own sign-in and its own tenant; no
  session, storage or data crosses this link.
- Settings → Data's "FLCC attendance sync" (`shepherd/js/core/flccSync.js`)
  reads FLCC's public, read-only `attendance.json` from the same domain and
  matches present members by name into Shepherd's own `attendance`
  collection — off by default, and only works when both apps share a domain
  (this repo's standard deployment). It never writes back to FLCC's files.
  Once opted in, `App#startFLCCAutoSync` (`shepherd/js/app.js`) repeats the
  check every five minutes for as long as the church stays signed in — the
  closest a static, serverless pair of apps can get to real-time syncing.

Neither exception reads the `churches/` data files (the sync only ever
targets the root-level, Abundance-shaped `attendance.json`), imports
`church.js`, or reads the `FLCC.*` global — those stay off-limits.

## LAMP

`lamp/` is a **third, separate application** — a Bible and faith companion for
ages 7–18. Like Shepherd it has its own storage namespace (`lamp/v1/…`), its
own design system and its own tests, and it must never import `church.js`, read
`FLCC.*`, or touch anything under `shepherd/`. `lamp/js/core/storage.js` throws
on any key outside the namespace, so the boundary holds mechanically rather
than by convention.

Read `lamp/SPEC.md` before adding a screen, a content type or a storage key,
and `lamp/README.md` for what Phase 1 actually built. Authored content lives in
`lamp/content/` as JSON, keyed by age band — `lamp/test/content.test.mjs`
fails the suite if a band is missing, so add all three.

## FLCC NEXT

`flcc-next/` is a **fourth, separate application** — the kids (7–12) and teens
(13–18) app for FLCC Church. It has its own `next/v1/…` storage namespace, its
own design system and its own tests, and it must never import `church.js`, read
`FLCC.*`, or touch anything under `shepherd/` or `lamp/`.
`flcc-next/js/core/storage.js` throws on any key outside the namespace.

Read `flcc-next/ARCHITECTURE.md` before adding a module, a storage key or a
screen, and `flcc-next/README.md` for what is built and what needs a server.
Authored content lives in `flcc-next/content/` as JSON and every item is
written twice, once for `kids` and once for `teens` —
`flcc-next/test/content.test.mjs` fails the suite if a variant is missing, and
`flcc-next/test/audit.test.mjs` holds the ministry dashboard's own audit to the
same rules.

The one thing it shares with the FLCC Members app is the deployed
`ask-proxy/worker.js`: the proxy holds the API key so no device does. It reads
none of the FLCC data files and none of the `FLCC.*` global.

## Pull requests

Open PRs ready for review, not as drafts — `main` has no branch protection
(no required reviews, no required status checks), so a draft only adds an
extra "mark ready" step before it can merge. Skip that step by default.
