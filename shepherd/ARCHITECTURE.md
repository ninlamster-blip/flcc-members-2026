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

`ministry_head` holds `leadership:read`/`write` — running one ministry
includes running its workspace and schedule in the leadership hub, which is
why that role reaches further into `leadership` than its rank alone would
suggest. Ministry-*instance* scoping (a ministry head should only edit their
own ministry's meetings, not every church's) is enforced at the workspace
boundary (`canAccessMinistryWorkspace` in `policies.js`), not at the
permission level — the permission system stays coarse-grained, matching how
every other resource in the app works (a treasurer can edit any finance
record, not one department's). A true per-instance ACL is a deeper change,
not attempted here.

## Intelligence

`ai.js` has two halves that must not be confused:

- `computeInsights(db, user)` and the functions under it — `absentMembers`,
  `attendanceTrend`, `volunteerShortages`, `financeSnapshot`,
  `upcomingCelebrations`, `suggestVolunteers`, `ministryHealthScore`,
  `buildBriefing`, `suggestForRole` — are pure computation over the church's
  own records, permission-filtered, no network. Everything on the
  dashboard's "Shepherd noticed", the AI executive briefing, ministry health
  scores and the worship-schedule assignment suggestions comes from here and
  works offline. `ministryHealthScore` returns its breakdown alongside the
  score deliberately — the UI shows the four factors, not just a number, so
  the heuristic stays inspectable rather than a black box.
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
