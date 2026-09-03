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

## FLCC NEXT — Adults

`flcc-adults/` is a **fifth, separate application** — the adult edition of
FLCC NEXT, for the members of FLCC Church. It has its own `adults/v1/…`
storage namespace, its own content and its own tests, and it must never import
`church.js`, read `FLCC.*`, or touch anything under `shepherd/` or `lamp/`.
`flcc-adults/js/core/storage.js` throws on any key outside the namespace.

Read `flcc-adults/ARCHITECTURE.md` before adding a module, a storage key or a
screen, and `flcc-adults/README.md` for what it does and the three decisions
behind it (nothing leaves the device; there is no score; a reading plan is a
sequence, not a calendar).

It is a separate application from `flcc-next/` on purpose — the kids and teens
app and the adult app share an identity and no code, because a single codebase
with an `isAdult` flag through it would serve neither audience. Content is
written once, in one adult register: there are no age variants here, and
`flcc-adults/test/content.test.mjs` fails a file that grows a `kids` or `teens`
key.

Two narrow, deliberate exceptions to the boundary.

The first is documented at length in the header of
`flcc-adults/js/core/scripture.js`: the adult app reads the committed text of
Scripture from `flcc-next/bible/` rather than committing a second 14 MB copy of
it. That is a one-way read of static, public-domain, same-origin text at a
fixed path — never `flcc-next/content/`, never a module, never storage.
`flcc-adults/test/modules.test.mjs` fails any file that reaches past the Bible
into the kids app, and `test/scripture.test.mjs` fails if the shared text
moves.

The second is **ASK**, and it is the only thing in this app that sends
anything anywhere. `js/core/ai.js` POSTs a question to `/proxy` — same origin,
served by the deployed `ask-proxy/worker.js`, which holds the API key so no
device has to. What goes is the question and the last four turns; what never
goes is the member's name, season, prayer list, reflections, sermon notes or
reading progress, and `test/ai.test.mjs` asserts each of those by name against
the built request. `js/core/safety.js` screens for crisis language **before**
the network — `ai.test.mjs` replaces `fetch` with a throw to prove it — and
`test/safety.test.mjs` holds both halves of that screen: what it must catch,
and the ordinary hard questions it must leave alone. The Ask screen states
what it sends in body type, and You can switch it off. Everything else in the
app still never leaves the device.

A third thing crosses the app's edge, and it is not the app doing it:
`flcc-adults/admin/` is a **tool that edits this app rather than part of it** —
a page for whoever runs the church calendar, so changing the Community tab does
not mean a GitHub account. It borrows the stylesheet and takes nothing else (no
router, no storage module, no `adults/v1/` key), the app never links to it, and
the service worker steps aside for it. It POSTs to `/api/publish/adults` on the
shared Worker, which passcode-gates the write, **repeats the content suite's
rules** — `content.test.mjs` can never run on a file published through an API —
and commits `content/events.json` or `content/updates.json` back to this
repository, so git stays the single source of truth. Only those two paths can
ever be written: the file is a key into a fixed map, never taken from the
request. `flcc-adults/test/admin.test.mjs` holds all of that, including that
the Worker's validator and the content suite have not drifted apart.

The crossword's layout engine (`js/games/crossword.js`) is a third deliberate
duplicate of a `flcc-next/` file, on the same terms as the stylesheet and the
illustrations: a pure algorithm, copied rather than imported, with
`test/crossword.test.mjs` comparing the two files below the header and failing
when they drift.

### The two editions are one design

**The adult app is drawn in the same system as `flcc-next/` — the poster
system.** Cream paper `#FBF8F0`, navy ink `#2B4C6D`, one flat colour per
poster, a single 3px outline weight, Inter at 900 for headlines and 800 for
labels, flat navy-outline drawings on a 100×100 grid at stroke 5.5, `.pill`
and `.go` for actions, a 14px outlined `.track` for progress. Nothing in it is
soft: no gradients, no glass, no glow, and no drop shadow — `box-shadow`
appears only as an inset outline, which is how a 3px edge is drawn without a
border changing an element's size.

The two apps still share **no code**. The stylesheet and the illustration set
are deliberate duplicates, and a duplicate with nothing holding it in place
drifts, so `flcc-adults/test/design.test.mjs` reads *both* stylesheets and
fails when the palette, the edge weight, the face, the headline weights, the
poster tones or the two actions stop matching; `test/art.test.mjs` compares the
path data of the shared symbols character for character. Both are build-time
reads of the other app's source — nothing ships to a browser across the
boundary, and `modules.test.mjs` still enforces that at runtime. **If a rule
genuinely needs to change, change it in both files.** That is the point of
those tests, not an obstacle to them.

The adult register is not a different system, it is the same system spoken
plainly: a squarer 10px radius, no faces in the drawings, and prose written
for an adult. Two rules are untested and matter most: **the chrome stops at
Scripture** — the Bible reader is plain white paper and serif type — and
**poppy is never a whole poster**, because white type does not sit on it
safely at that size. The crossword grid and the match-three board are the same
system at tile size: flat tones, one navy outline, the app's own drawings.

**Type size is a setting** (You → Text size), and everything in the stylesheet
is in rem so one number moves all of it. The lower bound of each headline
`clamp()` is capped against the viewport with `min()` — without that, the
largest setting scales the floor of the clamp too and a long headline word runs
off the side of its poster. `--edge`, `--radius` and the track height stay in
px on purpose: they are the drawing, not the type.

**The six named colours are shared with `flcc-next/`** — sky `#C3D7EA`,
captain `#4173B0`, navy/ink `#2B4C6D`, rose `#EABCB5`, poppy `#EB8861`,
sunshine `#EDCE7A`, on the shared cream paper `#FBF8F0` — and a test in each
app pins them, so changing one means changing both.

## Pull requests

Open PRs ready for review, not as drafts — `main` has no branch protection
(no required reviews, no required status checks), so a draft only adds an
extra "mark ready" step before it can merge. Skip that step by default.
