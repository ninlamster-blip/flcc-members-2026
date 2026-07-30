# Architecture

How Shepherd is put together, why, and where to add things.

## Shape

```
shepherd/
  index.html            app shell — theme, fonts, module entry
  sw.js                 service worker (shell + visited modules)
  manifest.webmanifest
  css/shepherd.css      the whole design system
  js/
    app.js              boot, auth screens, navigation, global search, context
    core/
      dom.js            h(), render, inline icons
      ui.js             the component kit every module builds from
      storage.js        StorageAdapter — the seam a server slots into
      tenant.js         tenant registry, resolution, provisioning
      db.js             per-tenant database: CRUD, validation, audit, encryption
      schema.js         every collection, field, permission and searchable text
      rbac.js           roles and permissions
      policies.js       the rules that are not just "has permission"
      crypto.js         PBKDF2, AES-GCM vault, TOTP
      session.js        sign-in, devices, idle lock, credential changes
      search.js         inverted index over what may be indexed
      ai.js             insights (local) + drafting (model or local)
      router.js         hash router with per-module dynamic import
      exporters.js      CSV, Excel, PDF/print, ICS
      format.js         dates, money, relative time
      id.js             ids, slugs, initials
      seed.js           the demonstration church
    modules/
      _shared.js        schema-driven forms and shared list furniture
      <module>.js       one file per screen in the navigation
  test/                 node:test suites, no dependencies
```

## Principles

**No build step.** The repository ships static files; a church admin should be
able to read the source of the thing holding their records. ES modules and
`import()` give code splitting without a bundler.

**One screen, one purpose.** Modules return DOM; the shell swaps it in.
Re-rendering a whole screen is cheap because screens are small, which is why
there is no virtual DOM and no component state to keep in sync.

**Rules live in one place.** `schema.js` describes the data, `rbac.js` who may
touch it, `policies.js` the rules that are not simple permission checks. Every
one of those files is imported by both the app and the tests.

## Multi-tenancy

A church is a **tenant**. The registry (`shepherd/v1/registry`) holds only the
non-sensitive facts: id, name, branding, plan, settings. Everything else lives
under `shepherd/v1/t/<tenantId>/`.

Isolation is structural rather than conventional:

1. A `Database` is constructed for one tenant and handed a storage adapter
   wrapped by `namespaced()`, which forces every key under that tenant's
   prefix and rejects traversal.
2. `db.assertTenant(id)` catches a database held across a tenant switch.
3. `importAll()` refuses a snapshot whose `tenantId` does not match.

There is no query that can cross churches, because there is no key that can
express one.

## Data flow

```
open()   read → decrypt encrypted collections → Maps in memory
read     synchronous, from memory
write    permission check → schema validation → stamp → audit → emit → mark dirty
flush    debounced: serialise → encrypt where required → adapter.set
```

Reads are synchronous, which is what keeps the UI instant on a phone; writes
are write-behind. `await db.flush()` forces persistence — sign-out, export and
every test do this.

Deletes are soft: the row keeps a `deletedAt` and disappears from reads, so
the audit trail still refers to something real.

### Adding a collection

1. Describe it in `schema.js`: label, `resource`, `encrypted`, `titleField`,
   `searchable`, fields.
2. That is enough for validation, the search index, generated forms
   (`openRecordModal`), exports and the audit log.
3. If it is sensitive, add it to `NEVER_INDEXED` in `policies.js`.

## Security model

| Concern | Mechanism |
| --- | --- |
| Passphrase | PBKDF2-SHA-256, 310 000 iterations, per-user salt; only a verifier is stored |
| Records at rest | AES-GCM with a per-church 256-bit vault key |
| Key distribution | Vault key wrapped per user with their passphrase-derived key |
| Adding a user | Re-wraps the *current session's* vault key, so nobody is added behind the vault's back |
| Removing a user | Their wrapped copy goes; no re-keying needed |
| Second factor | TOTP (RFC 6238) with hashed single-use recovery codes |
| Session | Vault key in `sessionStorage` only; 45-minute idle lock |
| Enumeration | Unknown email and wrong passphrase take the same path and give the same message |
| Trail | Append-only audit entries for writes, sign-ins, exports, approvals, AI use |

The threat model is a shared or lost **device**, and a curious or compromised
**account**. It is not a defence against code already running in the page, and
the README says so plainly rather than implying more.

## Permissions

`resource:action`, checked by `can(user, permission)`:

- **Navigation** hides modules the user cannot read.
- **Router** refuses deep links to them.
- **Database** rejects the write. This is the one that matters; the other two
  are courtesy.

Roles carry sets of permissions; users may hold extra `grants` and
`revocations`, with revocation winning. Nobody can assign a role above their
own rank.

`ministry_head` holds `leadership:read` broadly — reading the whole hub is
what running a ministry's workspace requires — but not the blanket
`leadership:write` its rank might suggest. Writing is scoped two ways:
*workspace* access (a ministry head may open only their own ministry's
workspace: `canAccessMinistryWorkspace` in `policies.js`) and a genuine
per-instance ACL on the two record types that carry a ministry dimension
(`actionItems`, `annualPlans`): `Database._assertWritable()` falls back to a
collection's `instanceWrite` check when the coarse `leadership:write`
permission is absent, and `canWriteActionItem`/`canWriteAnnualPlan` in
`policies.js` scope that to records whose `ministryId` matches one the
acting user actually leads (`ledMinistries`). Meetings, decisions,
committees and goals have no ministry dimension in the data model, so
`ministry_head` reaches those only through `leadership:read`, never write.

## Intelligence

`ai.js` has two halves that must not be confused:

- `computeInsights(db, user)` and the functions under it — `absentMembers`,
  `attendanceTrend`, `volunteerShortages`, `financeSnapshot`,
  `upcomingCelebrations`, `suggestVolunteers`, `ministryHealthScore`,
  `ministryHealthTrend`, `churchHealthOverview`, `buildBriefing`,
  `suggestForRole`, `worshipShortages`, `serviceReadiness` — are pure
  computation over the church's own records, permission-filtered, no
  network. Everything on the dashboard's "Shepherd noticed", the AI
  executive briefing, ministry health scores and the worship-schedule
  assignment suggestions comes from here and works offline.
  `ministryHealthScore` returns its breakdown alongside the score
  deliberately — the UI shows every factor, not just a number, so the
  heuristic stays inspectable rather than a black box. It weighs seven
  factors (task completion, no overdue work, volunteer coverage, recent
  activity, goal progress, training completion, member engagement) plus an
  eighth, budget utilisation, that only appears when a budget line actually
  matches the ministry by name — a ministry with no budget is not scored on
  one it does not have. Two of the factors are deliberately neutral-default
  rather than punitive: training completion and member engagement fall back
  to 70 (not 0) whenever the *church as a whole* has no completed
  enrollments, or no attendance record, in the relevant window — because the
  absence of any tracked data anywhere is not this ministry's failing.
  `strengths` and `weaknesses` are the breakdown rows at or above 85 and
  below 60 respectively; `recommendations` maps each weakness through a fixed
  lookup table of one-line, actionable text — never a model call, since these
  are direct consequences of a computed number, not something to draft.
  Every task/goal factor filters its records to `createdAt <= now`, which is
  what makes `ministryHealthTrend(db, ministry, {now, points, intervalDays})`
  honest: it recomputes the same score at successively earlier points in
  time using only the records that genuinely existed by then, rather than
  fabricating a history. A ministry seeded five minutes ago shows a flat
  line — that is the honest answer, not an empty chart.

  `churchHealthOverview(db, {now})` is the church-wide counterpart: nine
  independently-scored dimensions (attendance growth, volunteer engagement,
  prayer activity, leadership development, member retention, visitor
  retention, giving trends, training completion, department health — the
  last one an average of every ministry's `ministryHealthScore`) rather than
  one number claiming to answer nine different questions at once. Each
  dimension carries its own status band (excellent/healthy/needs-attention/
  critical, at the same 90/75/60 thresholds `ministryHealthScore` uses) and a
  one-line human detail. Its `notTracked` array names "Small Group
  Participation" explicitly, because Shepherd has no small-groups concept
  anywhere in its schema — an honest disclosed gap beats a fabricated number.

Worship services follow the same pattern. `SERVICE_TEMPLATES` (Friday/Sunday)
supplies the title, order of service and communion checklist a leader would
otherwise type by hand; `isCommunionScheduled` in `policies.js` is the rule
itself (first Friday/first Sunday of the month, or an explicit
`communionOverride`), used identically by the service card, the smart
assignment engine (never suggests a communion minister on a non-communion
date), and the calendar's colour coding. `serviceReadiness` counts a
service's *core* roles filled against its total — parking and photography
are excluded as the spec's two optional roles, and the communion minister
role only counts toward the total on a date communion actually applies —
and both the service list and the Leadership Dashboard's Friday/Sunday
countdown cards render the same number, never two different ideas of
"ready". None of this calls a model: a service is either staffed or it
isn't, and that is a fact to compute, not draft.
- `Assistant.run(task, input)` drafts. With an endpoint configured it calls a
  model; without one it returns `buildLocalDraft(...)`, which is a real
  artefact assembled from the church's records, not a placeholder. A failed
  model call falls back to the local draft rather than losing the user's work.

Within generation, two of the tasks answer questions rather than draft
documents, and they are scoped differently on purpose:

- `Assistant.answer(question, user)` (task `knowledge.answer`) is the Knowledge
  Centre's document search: confined to records this user may read, and
  honest when nothing in them answers the question.
- `Assistant.ask(question, user)` (task `assistant.ask`) is the Assistant
  screen's "Ask Shepherd" box: relevant church records are pulled in as
  optional context the same permission-filtered way, but the answer is not
  confined to them — the `SYSTEM` prompt explicitly tells the model to draw on
  scripture, theology, ministry practice and general knowledge, and forbids
  only inventing specific facts *about this church* it was not given. Offline
  (no endpoint configured), the local draft is honest about the difference:
  it can still match the question against the church's records, but says
  plainly that it has no general knowledge of its own to answer with.

Every result is `{ aiGenerated: true, model, source, createdAt }` and is
rendered through `aiOutput()`, which cannot display it without the badge.
`buildBriefing` and the insight functions carry no such label — like the
rest of the insights layer, they are facts the church already has, formatted
for a two-second read, not a model's output.

## Equip

Four collections: `courses`, `learningPaths`, `enrollments`, `certificates`
(all `resource: 'equip'`). The permission shape mirrors the leadership
per-instance ACL exactly:

- `equip:read` is granted to every role — Equip is for members and leaders.
- `equip:write` (catalogue authoring — creating/editing courses and paths) is
  admin-held (`church_admin`, `senior_pastor`).
- An ordinary member still tracks their *own* learning without holding
  `equip:write`: `enrollments.instanceWrite` is `policies.canWriteEnrollment`,
  the same shape as `canWriteActionItem` — `Database._assertWritable()` falls
  back to it when the coarse permission is absent, scoped to `record.memberId
  === user.memberId`. `certificates` reuses the identical function: a member
  may only ever issue a certificate naming themselves, the same trust
  boundary already placed on their own enrollment record, not a new one.
- `leaderOnly` courses (Biblical Leadership, Church Governance, Child
  Protection Essentials, …) are gated by `policies.canEnrollInCourse`: open to
  `leadership:read` or `equip:write`, locked otherwise. This is a role check,
  not an instance check — unlike enrollment ownership, "is this course
  leader-only" does not depend on which record it is.

Insights, not fabrication: `learningProgress`, `recommendNextCourse` and
`leadershipReadiness` in `core/ai.js` are pure computation over enrollment and
course records — no model, and the same numbers back the Equip dashboard,
My Learning, and the Training & Equip card on a member's People profile, so
none of the three ever disagrees with the others. `recommendNextCourse`
prefers a course whose prerequisites are already met and whose category
matches a ministry the member serves in; `leadershipReadiness` is a plain
count (leader-restricted courses completed, out of how many exist), returned
alongside the score for the same reason `ministryHealthScore` returns its
breakdown — a number alone invites "readiness for what, exactly". The AI
coach (`equip.explain`, `equip.summary`, `equip.quiz`, `equip.coach`) only
drafts encouragement and study aids *around* those computed facts, and
carries the usual `aiGenerated` label.

Course authoring reuses the generic schema-driven editor (`openRecordModal`)
rather than a bespoke lesson-authoring UI — lessons are structured data (an
array of `{title, type, summary, quiz}` on the course's `lessons` field,
type `object`), seeded or edited as JSON. A rich video-upload/drag-and-drop
lesson builder is a separate feature this pass does not attempt.

## Import

`core/csv.js` (`parseCSV`, `mapColumns`) and `core/importers.js`
(`parseMembersCSV`, `parseScheduleCSV`, `matchMemberByName`) are pure
functions with no DOM dependency — `settings.js`'s two import flows are the
only caller, but the parsing itself is fully unit-tested without a browser
(`test/import.test.mjs`).

- `mapColumns` matches a spreadsheet's actual header row against a list of
  accepted aliases per field, case/whitespace-insensitively — the same
  column is "Complete Name" in one export and "Full Name" in another, and
  a column that isn't present is simply not used rather than required.
- `matchMemberByName` is deliberately conservative: it strips common titles
  (Bro./Sis./Ptr./Pastor/Elder/…), tries an exact normalized match, then a
  match where every word in the query appears somewhere in the candidate's
  name (survives reordering — a worker's schedule and a member roster
  rarely spell a name the same way twice). It returns `null` — never a
  guess — when nothing matches or more than one candidate ties, and the
  import preview lists every unmatched name before anything is written so
  the admin can fix it by hand.
- Import is CSV-only on purpose. Reading a real `.xlsx` means inflating a
  zip and walking its XML — a meaningful amount of code for a format every
  spreadsheet tool already exports to CSV in one click; the import screens
  ask for that instead of shipping a parser for the binary format.
- The whole flow is client-side: `settings.js` reads the chosen file with
  the browser's File API, parses it in memory, renders a preview, and only
  calls `ctx.db.insert(...)` — the same call every other screen in Shepherd
  makes — once the admin confirms. Nothing is uploaded, and nothing about a
  real import (names, phone numbers, addresses) is ever written to this
  repository; `core/seed.js`'s demonstration data is invented, not sourced
  from a real congregation, specifically so that stays true.

## Routing

`#/<module>/<param>?<query>`, with `#/c/<tenantId>/...` accepted so a church
link keeps working. Modules are `import()`ed on first visit and cached; a
module's `render(ctx, route)` returns a node.

`ctx` is the module contract: `db`, `user`, `tenant`, `settings`, `assistant`,
`search`, `session`, `can()`, `navigate()`, `refresh()`, `toast()`.

## Rendering

`h(tag, props?, ...children)` builds real DOM. Tag shorthand (`div.card`) keeps
markup readable, a node in the props position is treated as a child, and
`onX` props are listeners. `ui.js` composes these into the ~30 components every
module uses, so fourteen modules look like one product.

Data changes re-render the current route (debounced), which is why a gift
recorded in one tab updates the dashboard in another — the `storage` event
reloads the tenant and re-renders.

## Where a server goes

Nothing above `storage.js` knows where bytes live. A hosted deployment means:

1. An adapter implementing `get/set/remove/keys` against an API.
2. Server-side permission checks mirroring `rbac.js` — the client checks stay,
   but stop being the only ones.
3. Sync/conflict handling in `Database.flush()`.

The encryption model already fits: ciphertext is what is stored, so a server
holds records it cannot read.

## Testing

`node --test shepherd/test/*.test.mjs` — three suites, no dependencies:

- `security.test.mjs` — passphrases, vault wrapping, encryption, TOTP against
  the RFC vectors, sign-in, 2FA, recovery codes, passphrase change.
- `platform.test.mjs` — isolation, database, permissions, schema, search,
  insights, exports, seed data, routing.
- `policies.test.mjs` — self-approval, prayer visibility, restricted
  counselling notes, what is never indexed, document expiry.

Core modules never touch `window` at import time, which is what lets the same
files run under Node and in the browser.

## Roadmap the shape already anticipates

- **Server/sync**: the adapter seam above.
- **Native apps**: the modules are data-driven; a native shell needs `core/`
  and a different view layer.
- **Voice, transcription, meeting recording**: new assistant tasks in `ai.js`.
- **Portals (volunteer, visitor, family)**: narrow role sets already exist.
- **Multi-campus**: a tenant per campus today; a `parentTenantId` on the
  registry entry when cross-campus reporting is wanted.
- **API and webhooks**: `Database` is the natural place to emit them; the
  subscription mechanism is already there.
