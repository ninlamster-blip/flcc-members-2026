# Architecture

## Shape

```
longhand/
  index.html            app shell
  sw.js                 service worker (shell + visited modules)
  css/longhand.css      the whole design system
  js/
    app.js              boot, navigation, the things that outlive a screen
    core/
      dom.js            h(), inline icons
      ui.js             the component kit every view builds from
      store.js          StorageAdapter (records) + BlobStore (audio)
      db.js             collections, validation, cascades, export/import
      schema.js         every collection and what a record of it looks like
      recorder.js       MediaRecorder, level meter, live clips
      transcribe.js     providers: endpoint, browser, none
      session.js        a recording in progress
      pipeline.js       what happens after Stop
      intelligence.js   summary, decisions, actions, questions, topics
      retrieval.js      chunking, BM25, query understanding
      memory.js         retrieval → model → verified citations
      ai.js             the model client
      audio.js          playback
      exporters.js      text, Markdown, CSV, print
      router.js         hash routing with per-view dynamic import
      format.js, id.js
    views/              one file per screen
  test/                 node:test suites, no dependencies
```

## Principles

**No build step.** Static files, ES modules, `import()` for code splitting.
The same rule the rest of this repository lives by, for the same reason:
whoever inherits it can read what is actually running.

**One screen, one purpose.** A view returns DOM; the shell swaps it in.
Re-rendering a whole screen is cheap because screens are small, which is why
there is no virtual DOM and no component state to keep in sync.

**Every generated thing carries its evidence.** `segmentIds` is not optional
on a decision, an action item, a topic or an answer's source. The parser drops
what cannot cite; the UI links what can.

## Data flow

```
record    Recorder ──clips──▶ transcriber ──segments──▶ db (live transcript)
stop      audio ──▶ IndexedDB, meeting.status = transcribing
process   full-file transcribe ▶ speakers ▶ analyse ▶ summary   (pipeline.js)
ask       question ▶ understand ▶ retrieve ▶ rank ▶ model ▶ verify ▶ sources
```

Reads from the database are synchronous (a phone scrolling a transcript cannot
await); writes are write-behind on a 250ms debounce. `await db.flush()` forces
persistence — export, delete and every test do this.

Deletes are hard deletes. This application holds recordings of people talking;
a "deleted" meeting still on disk would be a lie told to someone who asked for
it to be gone.

## The two recorders

`recorder.js` runs two `MediaRecorder`s on one microphone stream. The master
records continuously and produces the file that is kept. The slicer restarts
every few seconds, producing small, self-contained clips for live
transcription — necessary because a timeslice chunk is not independently
decodable: only the first carries the container header.

## Grounding

`intelligence.js` numbers the transcript, asks for line numbers back, and
discards any item whose lines do not resolve — counted, not hidden.

`memory.js` never calls the model without evidence. Retrieval runs first; if
it finds nothing, the answer is "I couldn't find that in your recorded
conversations". Citations are verified against the excerpts that were actually
supplied, and an answer with none is flagged as unsupported rather than shown
as though it were sourced.

Two deliberate softenings, both visible in the prompt sent to the model:

- A period or speaker the question named that matches nothing is retried
  without those filters ("nothing matched the period they named").
- A question scoped to one meeting that matches none of its words falls back to
  that meeting's own passages — the user pointed at the evidence themselves.

Retrieval is BM25 over transcript chunks plus a small, explicit thesaurus of
meeting language (`EXPANSIONS`), because people ask "what did we decide?" about
a conversation in which nobody said the word. Expansions score at a fraction of
an exact match. There is no embedding model: a device-local app cannot ship one
honestly, and the corpus is hundreds of chunks, not millions. `Index.search()`
is the only thing that ranks, and is where a vector index would slot in.

## Adding things

**A collection** — describe it in `schema.js` (defaults + validation); `db.js`
needs nothing else. Add it to the cascade in `meetingChildren`/`deleteMeeting`
if it hangs off a meeting.

**A screen** — a module in `views/` exporting `render(app, route)`, plus an
entry in `VIEWS` and `NAV` in `app.js`.

**A transcription provider** — a class with `available`, `live`, `diarizes`,
`name` and `transcribe(blob, {offsetSec, diarize})` returning
`{segments, text}`; then a branch in `chooseProvider`.

**A component** — only if two screens need it. `ui.js` is a kit, not a gallery.

## Design system

`css/longhand.css` is the whole of it: tokens first, thin compositions after.
The rules it holds to are in the file's header comment, and the one that
decides most arguments is the first: type sets the hierarchy, not colour, not
cards, not shadows. Colour carries meaning — red for recording and
destructive, green for completed, amber for attention, one accent for
interactive — and is otherwise absent.
