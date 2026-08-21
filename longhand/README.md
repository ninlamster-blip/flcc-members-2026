# Longhand

Record a conversation. Get a transcript with the speakers separated and every
line timestamped. Ask your own past meetings what was decided, what you agreed
to, and when something first came up — and see the passage each answer came
from.

Longhand runs entirely in the browser. There is no account and no server
holding your meetings: recordings live in this device's IndexedDB, everything
else in its localStorage. It is a separate application from FLCC Members and
from Shepherd, sharing no code, no data and no storage with either.

```
longhand/index.html
```

## What it does

| | |
| --- | --- |
| **Record** | A focused recording screen — timer, level meter, live transcript, pause and stop. Recording never happens silently. |
| **Transcribe** | Live, in short clips, while you talk; then the whole recording again when you stop, more accurately and with speakers separated. |
| **Understand** | Summary, key points, decisions, action items, open questions, topics and key moments — each one linked to the transcript lines it came from. |
| **Search** | Every word anyone said, plus titles, tasks, decisions and people. Works with no endpoint configured, offline. |
| **AI Memory** | A question across every meeting, answered only from the passages retrieval actually found, with the sources attached. |
| **Tasks / People** | Action items and speakers, both derived from the meetings rather than typed in. |
| **Folders** | One flat level of filing, created by moving a meeting into one. Deleting a folder never deletes a meeting. |
| **Export** | Markdown notes, full Markdown, plain-text transcript, CSV of action items, and print/save-as-PDF. |

## Setting it up

Longhand holds no API keys. It talks to two endpoints, and the keys live there:

| Setting | Default | What it is |
| --- | --- | --- |
| Model endpoint | `<this site>/proxy` | Takes an Anthropic Messages request, returns the reply. |
| Transcription endpoint | `<this site>/stt` | Takes audio, returns text with word timings and speaker ids. |
| Shared secret | empty | Sent as `x-proxy-secret` if your endpoint checks one. |

This repository already ships an endpoint that does both: `ask-proxy/worker.js`,
the Cloudflare Worker that serves the site. Give it the secrets it documents
(`ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`) and Longhand works with no further
configuration, because the defaults point at the site it is served from.
Settings → Endpoints → **Check both endpoints** tells you, in words, whether
each one actually answers.

Without a transcription endpoint, Longhand offers the browser's own speech
recognition instead: live, free, no upload from this app — but no speaker
separation and lower accuracy, and it says so where you choose it. Without
either, it still records and stores; the meeting waits at "Needs attention"
with a Transcribe button.

Without a model endpoint there are no summaries and no AI Memory. Recording,
transcription, playback, editing, Search and export all still work.

## Privacy

- Everything is stored in this browser on this device. No account, no server
  copy, nothing synced.
- Audio leaves the device only when a transcription endpoint is configured,
  and then only the clip being transcribed.
- Transcript text is sent to the model endpoint when a meeting is processed or
  a question is asked. Audio never is.
- Longhand does not encrypt what it stores. Anyone who can open this browser
  profile can read these meetings, and Settings says so plainly.
- Delete the audio of one meeting, the whole meeting, every recording at once,
  or everything — all four are in the app, and all four are real deletes.

## What it will not do

- It will not answer from outside your recordings. If retrieval finds nothing,
  the model is never called and the app says the recordings do not contain it.
- It will not show a decision, action item or answer that cannot be traced to a
  transcript line. Untraceable items are discarded before they reach the
  screen, which is why a meeting sometimes shows fewer items than were
  discussed.
- It will not turn "Friday" into a due date. Only an explicit date becomes one;
  everything else stays in the task's own words.

## What is deliberately absent

**Sharing.** There is no server, so there is nobody to share through and no
link to hand out. Export is the honest version of it: Markdown, plain text,
CSV or a printed PDF, sent however you already send things.

**Dark mode.** One theme, designed properly, rather than an inverted second
one. The light palette is the product's face.

**Encryption at rest.** Storing a key next to the data it protects, in the
same browser profile, would look like security without being it. Settings
says as much where someone might otherwise assume otherwise.

## Tests

```bash
node --test 'longhand/test/*.test.mjs'
```

No dependencies and no build step, the same as the rest of this repository.
The suites cover retrieval and query understanding, the grounding rules,
meeting analysis, the processing pipeline's failure paths, the store's delete
guarantees, transcription assembly, exports, and the list logic behind
Meetings, Tasks and Search.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how it is put together and where to
add things.
