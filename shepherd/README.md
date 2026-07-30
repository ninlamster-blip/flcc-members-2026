# Shepherd

A secure operating system for church leaders in Kuwait, built to travel across
the Gulf.

Shepherd is a **separate application** from the FLCC Members app in this
repository. It shares no code, no data, no storage keys and no links with it —
`church.js`, `FLCC.*` and the `churches/` data files are untouched. It lives
entirely under `shepherd/`.

```
https://<your-site>/shepherd/
```

## What it is for

A pastor in the Gulf spends hours a week on administration that nobody trained
them for: who has stopped coming, who needs a visit, whether the lease is about
to expire, what the council actually decided, who is on the rota, and what the
books say. Shepherd holds all of that in one place and — this is the part that
matters — **notices things**, so the answer to "who needs me this week" is on
the first screen rather than buried in a spreadsheet nobody opens.

## Getting started

1. Serve the repository over HTTP (`python3 -m http.server`, GitHub Pages, or
   the Cloudflare Worker already configured in `wrangler.toml`) and open
   `/shepherd/`.
2. **Set up a church.** You become its first administrator. Choose a passphrase
   you will not lose: it encrypts the church's counselling notes, finances and
   documents, and nobody can reset it for you.
3. Tick **Add example data** the first time. It fills every screen with a
   demonstration congregation so you can see what the app is for. Remove it
   later from **Settings → Data**.

Opening `file://` will not work — ES modules need a real origin.

## The modules

| Module | What it does |
| --- | --- |
| **Dashboard** | Today's schedule, what Shepherd noticed — dismissible and "smart" about coming back only when it changes or a week passes — attendance trend, follow-ups, prayer, coming events, birthdays, finance snapshot, recent activity |
| **People** | Directory, families, ministries, attendance recording, and a profile that gathers everything known about one person — including their Equip training, certificates and leadership readiness |
| **Member care** | Follow-ups and visits, plus who the records say has gone quiet — absences, new believers, the care list, celebrations |
| **Prayer centre** | Wall, leaders-only and private requests, chains, answered prayer, a generated prayer-meeting sheet |
| **Events** | Planning, tasks and volunteers, rota suggestions, budget, and a check-in desk with a QR-friendly code |
| **Worship** | Song library searchable by theme, key, mood, season, language and lyrics; setlists; team and rehearsals |
| **Preaching** | Sermon archive, series planning, illustrations and quotes, and an assistant that drafts the work *around* the sermon |
| **Leadership** | The leadership operating system: committees, minutes, a decision log with review-date insights, ministry workspaces, the annual worship service schedule with smart assignment, a leader's own task centre, computed ministry health with trend and recommendations, a church-wide health overview, succession planning, volunteer well-being, a pastoral care rollup, a private leadership journal, a succession-aware leadership directory, annual planning with quarterly review and inline ministry health, and a permission-filtered activity timeline |
| **Finance** | Giving, expenses, budgets, projects, approvals — encrypted, role-restricted, exportable |
| **Document vault** | Encrypted files with version history, fingerprints and expiry reminders |
| **Knowledge centre** | Ask the church's own minutes, decisions and policies a question |
| **Communications** | Announcements and messages prepared for WhatsApp, email, SMS, bulletin |
| **Reports** | Attendance, growth, volunteers, giving, prayer, events, leadership (church health, ministry health, succession gaps) — PDF, Excel, CSV |
| **Equip** | A learning platform: a course library across sixteen discipleship and ministry categories, structured learning paths, quizzes, an AI learning coach, auto-issued certificates, and a personal growth dashboard with a computed leadership-readiness score |
| **Assistant** | Everything Shepherd noticed, a free-form "ask anything" box, and every drafting task, in one place |
| **Settings** | Church profile, users and roles, security, AI, backup, audit log |
| **Network Overview** | Read-only, for whoever holds the **Lead Pastor** role: a rollup of every church already signed into on this device — members, ministries, open care items, a health score — never finance, counselling, the journal or documents, which stay locked per church |

## The leadership operating system

Signing in shows a dashboard shaped by what you actually lead, not a generic
one:

- **Senior Pastor** and **Finance (treasurer)** get their own layout — a
  church-wide overview with ministry health across every ministry, or a
  finance-specific view with approvals, ministry spending and audit
  reminders.
- Whoever leads a specific **ministry** (Worship, Children, Youth, Evangelism,
  Discipleship, or any other) gets that ministry's own card, task list and
  health score, plus quick actions into its workspace and the worship
  schedule.
- Everyone gets an **AI executive briefing** — "3 upcoming services, 1
  wedding anniversary, 2 finance entries awaiting approval" — computed the
  same way as the rest of the insights layer: on-device, from this church's
  own records, permission-filtered, no model involved.

Behind the dashboard, **Leadership** in the sidebar holds the rest of it:

- **Ministry workspaces** — each ministry's roster, open tasks, annual plan,
  tagged documents and a computed health score, open only to that ministry's
  recorded lead (or church-wide leadership).
- **Annual worship service schedule** — Friday and Sunday services created
  from a template that fills in the title, order of service and a default
  communion checklist, plus **smart defaults**: the top least-recently-served,
  ministry-matched candidate is offered for every empty role rather than left
  blank. One record per service names a combined **Worship & Song Leader**,
  an **Emcee** (whose opening-prayer and tithes-and-offering responsibilities
  are shown automatically, never assigned as separate roles), an
  automatically-scheduled **Communion** section (first Friday and first
  Sunday of the month, overridable for an exception), a combined
  **Children & Youth** section (leader, assistant, classroom, attendance,
  lesson), and the rest of the rota (media, sound, ushers, security,
  hospitality, prayer team, and optional parking/photography). A **List** and
  a color-coded **Calendar** view, a per-service preparation-status readout,
  and PDF/Excel/CSV export.
- **My tasks** — action items, event jobs and care visits assigned to you,
  wherever they came from, in one Today/Overdue/Upcoming/Completed view.
- **Ministry health** — a transparent 0–100 score per ministry from task
  completion, overdue work, volunteer coverage, recent activity, goal
  progress, training completion, member engagement, and — only where a
  budget line actually matches — spending discipline, with the full
  breakdown, a four-month trend, strengths, weaknesses and one-line
  recommendations shown, not hidden behind a single number.
- **Church health overview** — the church-wide counterpart: nine
  independently-scored dimensions (attendance growth, volunteer engagement,
  prayer activity, leadership development, member retention, visitor
  retention, giving trends, training completion, department health) each
  with its own status and detail, recommendations only where genuinely
  needed, and an honest note on what Shepherd does not yet track (small
  groups).
- **Succession planning** — every ministry and committee checked for a named
  deputy and a genuine bench of others serving alongside the lead, flagged
  urgent only when a role has no lead at all or the lead is genuinely alone.
- **Volunteer well-being** — a load signal per serving member (ministries
  served, open and overdue tasks, upcoming worship-service roles), sorted so
  the most stretched volunteers surface first — a cue for a check-in, not a
  verdict.
- **Pastoral care centre** — a leadership rollup of the same care records
  kept in Member care: caseload spread across assignees, priority members
  sorted by longest since last contact, and quietly-absent members who do
  not yet have a follow-up started.
- **Leadership journal** — a private place to reflect, genuinely for your
  eyes only: no role, not even the senior pastor or a church administrator,
  is ever granted write access to another leader's entry.
- **Leadership directory**, now with a succession column per leader so a
  missing deputy is visible at a glance, not just on the Succession tab.
- **Annual planner** (vision, objectives, KPIs, budget, quarterly review per
  ministry per year), each plan showing its ministry's current health score
  for context while planning.
- A **timeline** — a day-grouped feed built from the real audit log, so it
  only ever shows what actually happened, filtered to what the reader may see.
- The **decision log**'s own `reviewOn` date now surfaces as a dashboard
  insight once it passes, more urgently the longer it has waited — the same
  computed-not-drafted pattern as everything else Shepherd notices.

Five of the ministry-specific dashboards (Worship, Children, Youth,
Evangelism, Discipleship) deliberately share one adaptable template rather
than each inventing its own widgets — Shepherd doesn't track a memory-verse
rotation or a discipleship pathway yet, so the shared template shows what is
genuinely backed by data (roster, tasks, health, shortages) instead of
fabricating the rest. A ministry lead needs their user account linked to
their member profile (**Settings → Users & roles**) for their personalised
dashboard, task list and workspace access to resolve.

Shepherd deliberately does **not** treat the FLCC Members app's member data
as a shared database — see "Multi-church" in the repository root's
`CLAUDE.md`. Each product keeps its own storage; nothing here reads or
writes `church.js` or the `churches/` data files.

## Equip

A learning platform, not a document repository — for members and leaders
alike, everyone holds `equip:read` by default.

- **Course library** — ten courses ship with a fresh church, across categories
  from Foundations of the Christian Faith to Church Governance; the schema and
  UI support the full sixteen-category catalogue the product is meant to
  cover, this is a representative starting point, not a ceiling. Each course
  has lessons (video/audio/reading/pdf, with a summary), objectives,
  prerequisites, a discussion guide, and — on some lessons — a short quiz.
- **Learning paths** string courses together in order and track progress
  automatically, showing which course is next.
- **Leader training** — courses like Biblical Leadership, Church Governance
  and Child Protection Essentials are marked `leaderOnly` and gated by
  `policies.canEnrollInCourse`: open to any role holding `leadership:read`
  (every leadership-track role) or `equip:write` (whoever manages the
  catalogue), locked for everyone else.
- **The AI learning coach** explains a passage, summarises a lesson, drafts
  more study questions and a memory-verse challenge, and turns a computed
  recommendation into two encouraging sentences — the same insights/drafting
  split as the rest of the app: what course to take next is computed, not
  guessed; the encouragement around it is drafted and labelled.
- **Certificates** are issued automatically on completion (church name,
  student, course, instructor, date, a certificate number and a verification
  ID) and download as a printable PDF.
- **My Learning** — a personal growth dashboard: courses completed, hours,
  certificates, skills acquired (the categories of what you've finished), a
  transparent **leadership readiness** score (leader-restricted courses
  completed, out of how many exist — a count, not an opinion), and an annual
  learning goal a church administrator can set.
- Every enrollment belongs to one member the same way a ministry-scoped
  action item does: `policies.canWriteEnrollment` is the identical
  per-instance ACL shape as `canWriteActionItem`, so an ordinary member
  tracks their own progress without holding the catalogue-authoring
  `equip:write` permission.
- A member's completed courses, certificates and leadership readiness surface
  on their **People** profile, so whoever is assigning a volunteer or
  identifying a future leader sees training history in the same place as
  everything else known about that person.

Not attempted this pass, and worth naming rather than faking: a rich
video-upload/drag-and-drop lesson-authoring UI (lessons are structured data,
edited as JSON through the course editor, or seeded); a live class-scheduling
system ("Upcoming Classes"); and a full daily Bible reading plan ("Reading
Plan Progress") — Equip has a rotating set of daily verses, not a year-long
plan, because Shepherd does not track reading-plan data yet and a real one
deserves more than a placeholder.

## Import

**Settings → Data → Import from a spreadsheet.** A church coming to Shepherd
already has a roster and a worker's schedule somewhere — usually a Google
Form response sheet and a worker's-schedule spreadsheet, not a blank
product. Two importers turn a CSV export of either into real records,
entirely on the device doing the import:

- **Import members** reads either the reduced per-church-sheet shape
  (Complete Name, Sex, Civil Status, Date of Birth, Address, Mobile
  Number/Email Address) or the richer form-response shape (adds Ministry
  Interest/s, Satellite Church, Joining Year, Spouse Name, Wedding
  Anniversary) — whatever columns are present get used, nothing else is
  required. An optional "satellite church" filter scopes a multi-church
  export down to the one church being imported into. Members whose name
  already matches an existing record are skipped, not duplicated.
- **Import worship schedule** reads Date, Service (Friday/Sunday), Theme,
  Presider, Song Leader, Preacher, Pastoral Prayer, Food-in-Charge and
  Communion Assistants. Names are matched against People — stripping common
  titles (Bro./Sis./Ptr./Pastor/Elder) and tolerating reordering — and
  anyone not found is left unassigned rather than guessed at or silently
  auto-created; the preview lists exactly which names didn't match before
  anything is written. A date with no year of its own (a worker's schedule
  headed "AUGUST 2026" listing "07-Aug") uses a year supplied once for the
  whole file.

Both importers only read CSV (`core/csv.js`, no dependency) — a real .xlsx
parser means inflating a zip and walking its XML, a meaningful chunk of code
for a format every spreadsheet tool already exports to CSV in one click, so
the import screen asks for that instead. `core/importers.js` (`parseMembersCSV`,
`parseScheduleCSV`, `matchMemberByName`) is pure and covered directly by
`test/import.test.mjs` — no browser, no fixtures with anyone's real data in
them.

**Every byte of this stays on the device doing the import.** Nothing is
uploaded anywhere; the file is read with the browser's own File API, parsed
in memory, shown in a preview so the admin sees exactly what will be
created, and only written to that church's own local database when they
confirm. This repository never seeds or commits real names, phone numbers,
or addresses from any real congregation — the demonstration data everyone
sees on first login (`core/seed.js`) is entirely invented.

## Roles

Twelve roles, from Super Admin down to Member, each with a plain-English
description in **Settings → Users & roles**. Permissions are `resource:action`
pairs; a user's role can be topped up or trimmed individually. Checks happen in
the navigation, in the router and — the one that counts — in the database,
which refuses a write the acting user may not make.

Three rules are worth knowing:

- A **church administrator does not hold counselling permission.** Running the
  platform and reading a pastor's counselling file are different jobs.
- **Nobody approves their own spending.** An expense over the church's
  threshold enters as pending and needs someone who did not record it.
- **No one reads another leader's journal — not even the senior pastor.**
  Unlike a restricted counselling note, the leadership journal has no
  override role. No role is ever granted write access to another leader's
  entry; only its author can.

**Lead Pastor** sits one rank above Senior Pastor: the same full pastoral
standing within whichever church they are signed into, plus `network:read` —
the one permission that unlocks the Network Overview module. It is added per
church, the same as any other role, to whoever oversees the network as a
whole rather than leading a single congregation. See "Network Overview"
below for what that module can and cannot see.

## Network Overview

A rollup for the Lead Pastor role, not a new kind of access to any one
church's data. It lists every church already present in this device's local
registry and, for each, opens a `Database` exactly the way a signed-out
session would — with no vault key. Ordinary, unencrypted operational records
(members, ministries, attendance, care) load and get aggregated into a
per-church row: member count, ministry count, open care items, a health
score. Finance, counselling notes, the leadership journal and the document
vault stay encrypted and simply do not decrypt without a key, so they never
appear.

It can only ever see a church that this browser has already signed into at
least once — there is no server, so there is no reaching a church nobody has
opened here before. A Lead Pastor is added to each church they oversee the
same way any other user is added, one church at a time; the network view
does not create a login that spans churches.

## Security, honestly

**What is protected**

- Counselling notes, the leadership journal, finance, budgets, projects and
  the document vault are encrypted with AES-GCM before anything is written.
  Each church has a random 256-bit vault key, wrapped per user with a key
  derived from their passphrase (PBKDF2-SHA-256, 310 000 iterations).
- Churches are isolated structurally: a database is bound to one tenant and
  handed storage locked to that tenant's key prefix.
- Optional TOTP two-factor (RFC 6238) with single-use recovery codes.
- An append-only audit log of every create, update, delete, sign-in and export.
- Sessions live in `sessionStorage` — a reload keeps you in, closing the tab
  does not — plus a 45-minute idle lock.
- Counselling, journal, finance and account records are never added to the
  search index and never reach the knowledge centre, for any role.

**What is not**

- A lost passphrase means lost encrypted records. There is no recovery, by
  design; write it down and keep it somewhere physically safe.
- Anything already running on the device with the browser is out of scope.
- Exports are ordinary files. Once a CSV leaves the app, it is as safe as the
  device it lands on.
- Backups are manual. Take one from **Settings → Data**, regularly.
- Browser notifications for urgent insights (an opt-in bell toggle on the
  dashboard) only fire while the tab is open. Shepherd has no server, so
  there is no push when the app is closed — the toggle says as much rather
  than promising a notification that cannot arrive.

## AI

Two different things share the word:

- **Insights** — absences, overdue follow-ups, expiring documents, budget
  overruns, volunteer shortages, attendance trends — are computed on the device
  from the church's own records. No model, no network. This works offline.
- **Drafting** — sermon assets, meeting summaries, announcements, translations,
  knowledge answers, and free-form questions asked through **Assistant → Ask
  Shepherd** — uses a language model when the church configures an endpoint in
  **Settings → AI**, and falls back to structured local drafts when it does
  not. "Ask Shepherd" is deliberately not confined to the church's own
  paperwork the way the Knowledge Centre's document search is: it draws on
  scripture, theology, ministry practice and general knowledge too, pulling in
  whatever of the church's own records are relevant as extra context. The one
  thing it will never do is invent a specific fact *about this church* that
  was not given to it.

Everything generated carries `aiGenerated`, the model and the time, and is
shown behind a visible badge. Counselling notes, finance and the vault are
never included in an AI request.

The endpoint contract is deliberately small — any proxy that accepts

```http
POST <endpoint>
x-proxy-secret: <optional>
{ "model": "...", "system": "...", "messages": [{ "role": "user", "content": "..." }] }
```

and answers with Anthropic-style `{ content: [{ type: "text", text }] }` or a
plain `{ text }` will work.

## Offline and mobile

A service worker caches the shell and each module the first time it is opened,
so the app keeps working on a bad connection. The mobile layout is its own
layout — bottom navigation, full-width sheets, 44px targets — not a squeezed
desktop. Add it to the home screen and it runs standalone.

## Development

No build step, no dependencies. Edit a file, reload the page.

```bash
python3 -m http.server 8787          # then open /shepherd/
node --test shepherd/test/*.test.mjs # 152 tests, no dependencies
```

The test suite covers tenant isolation, permissions, the crypto (including the
RFC 6238 test vectors), sign-in and two-factor, search, insights, exports, the
policy rules and the seed data. It runs in Node against the same modules the
browser loads.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how it is put together and where to
add things.

## Compliance

Shepherd keeps your records, their versions and an audit trail so you can
answer questions about them. It does not give legal advice. What a church must
register, retain or report differs across Kuwait, Bahrain, Qatar, the UAE, Oman
and Saudi Arabia — verify your own obligations with the relevant authorities or
a local adviser.
