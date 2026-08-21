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

## Longhand

`longhand/` is a **third, separate application** — meeting recording,
transcription and conversation memory. Same rule as Shepherd: it has its own
`longhand/v1/…` storage namespace, its own design system and its own tests, and
it must never import `church.js` or read `FLCC.*`. It shares nothing with
Shepherd either. It does use the repository's Cloudflare Worker
(`ask-proxy/worker.js`) for `POST /proxy` and `POST /stt`, because that is where
the API keys live — the app itself holds none. See `longhand/ARCHITECTURE.md`
before adding a collection, a screen or a transcription provider.

## Pull requests

Open PRs ready for review, not as drafts — `main` has no branch protection
(no required reviews, no required status checks), so a draft only adds an
extra "mark ready" step before it can merge. Skip that step by default.
