# Repo-specific instructions

## Multi-church

All 14 BOTR churches share these same files — same structure, same design, only
the data differs. `church.js` is the source of truth for which churches exist
and where each one's data lives; pages read `FLCC.data('file.json')` and
`FLCC.key('storage-key')` rather than hardcoding paths or keys. See
`CHURCHES.md` before adding a church, a data file, or a localStorage key.

## Pull requests

Open PRs ready for review, not as drafts — `main` has no branch protection
(no required reviews, no required status checks), so a draft only adds an
extra "mark ready" step before it can merge. Skip that step by default.
