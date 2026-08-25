# Sermon Notes

Notes from the service, on the service they belong to. Open it and the right
note is already there — the date, the service and the preacher filled in from
the church's published schedule — because a member reaching for this has about
four seconds before they miss the next sentence.

Standalone, like the other apps under this repository: open
`sermon-notes/index.html`, reached from the **Sermon notes** card on the app's
Home tab. Plain ES modules, no dependencies and no build step. It installs to a
phone as its own app and, once it has loaded here once, it opens and saves with
no signal at all.

## What it is not

The members app has had a sermon-notes screen for a while, and it grew a camera
that scans a page with AI, a microphone that transcribes the preaching, and a
rich-text body. This app deliberately has none of that. It makes no network
call except reading the schedule, sends nothing anywhere, and stores plain text.

A sermon note is a member listening. The whole job here is to keep up with them
and then get out of the way.

## Where things live

| File | What it holds |
| --- | --- |
| `js/scripture.js` | Book names and the abbreviations people actually type. Turns `1 cor 13` into `1 Corinthians 13`, and refuses to guess at `jo`. |
| `js/notes.js` | Pure functions: which service a note belongs to, which one to open on, how an old HTML body reads as text, the list, the search, the shared text. No DOM, no storage. |
| `js/storage.js` | The one localStorage key, and the schedule slice kept for the next time there is no signal. |
| `js/app.js` | The screen: the header, the fields, the two panels, autosave. |
| `style.css` | The FLCC design tokens, applied to a page you write on. |

`test/sermon-notes.test.mjs` covers the parser, the service rules, the bodies
written by the older app, and the two promises below.

## One set of notes, two doors

This app and `index.html` read and write **the same notes**: the same key,
`flcc-sermon-notes-v1`, namespaced per church by `FLCC.key()`, and the same note
id, `2026-08-30|Sunday`. A note taken in one opens in the other. There is no
migration and nothing to export.

Two things make that safe, and the test suite holds both:

- **Neither app flattens the other's fields.** Both spread the stored note
  before saving, so the passage, verses and takeaway this app adds survive a
  later edit in the members app, which has never heard of them.
- **An old body is only rewritten once it is edited.** The members app writes
  its body as contentEditable HTML. This app reads it as text and shows it as
  text, but writes the body back only when the member has actually typed in it.
  Opening a note from last year and closing it again leaves it byte for byte as
  it was; editing the title saves the title and leaves the body alone.

## Which service it opens on

In order: today's service, then a service inside the last three days, then the
next one coming, then the most recent there was.

The middle rule is the one that matters. Somebody opening this on a Monday is
almost always finishing Sunday's notes rather than starting Friday's, so the
service just gone beats the next one until that window has passed. The
switcher — the whole header is the button — offers roughly four months back and
a month ahead, plus any service already written on, however old.

The service is in the address (`#2026-08-30|Sunday`), so a reload, a bookmark
or the back button all land on the same note.

## What is remembered

One key, on the member's own device:

```
flcc-sermon-notes-v1        date|Service -> { title, passage, body, verses[], takeaway, createdAt, updatedAt }
flcc-sermon-notes-schedule-v1   the last schedule this device saw, so it opens with no signal
```

Both are namespaced per church by `FLCC.key()`: notes belong to the church whose
service they were taken at, and a phone that has looked at two churches keeps
two separate sets (see "Storage on a shared device" in
[CHURCHES.md](../CHURCHES.md)).

Nothing is uploaded, there is no account, and the only thing that ever leaves
the phone is what the member taps **Share** on.

## Verses

The verse field takes what a preacher says out loud. `1 cor 13`, `1co13`,
`first corinthians 13` and `I Corinthians 13` all become `1 Corinthians 13`;
each saved verse is a link into `verse-lookup.html`, which now opens on a
passage given as `?ref=`.

Two rules keep it honest. Anything that does not resolve is stored **exactly as
typed** — losing what somebody wrote during a sermon is far worse than storing
an untidy line. And an ambiguous abbreviation resolves to nothing rather than to
a guess: `jo` is John, Jonah, Joel, Job and Joshua, and picking one would send a
member to the wrong passage while looking certain about it.

## A church with no schedule yet

Thirteen of the fourteen churches have not published a service schedule. The app
says so in its own words rather than reporting a failure — there is nothing
wrong, there is just nothing to hang a note on yet, and it starts working by
itself the day the leaders publish.
