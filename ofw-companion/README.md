# FLCC Kasama 🤍

The digital companion, community, and faith support app of the **Filipino
Language Christian Congregation (FLCC)** for Overseas Filipino Workers —
especially domestic workers who may only get one day off a month and go long
stretches without a real conversation.

Every screen is built to say: **"You are seen. You are heard. You are
remembered. You are not alone."**

## The five tabs

| Tab | What it is |
|---|---|
| **Kaibigan** | An AI companion that listens in warm Taglish, validates before advising, remembers what you share ("Last week you mentioned missing your daughter…"), and understands OFW realities — homesickness, emotional exhaustion, feeling invisible, fear about work and family. Includes a daily "Kumusta ang puso mo?" heart check-in and optional spoken replies. |
| **Journal** | A under-30-second daily wellbeing check-in (mood, energy, loneliness, hope, connection, gratitude), gentle non-clinical insights, and a private free-writing journal with search. |
| **Faith** | Verse and prayer matched to today's heart, AI-personalized prayer, and the FLCC Virtual Church led by **Pastor Anson Dionisio** — services every Sunday and Wednesday 10:30 PM Kuwait time and K.S.A. every Saturday 10:30 AM, "What are you bringing into this week's study?", past teachings with discussion questions. Fully optional — can be switched off. |
| **Kapwa** | The safe community: Women's and Men's Fellowship (every Wednesday, 8:30 PM Kuwait time), community values (no likes, no followers — just kapatiran), and off-day connection ideas. |
| **Tulong** | OFW Support Center: crisis lines, DMW/OWWA, embassy directory, migrant-worker organizations, and church contacts. |

## How the AI works

The app reuses the church-wide **Ask FLCC** connection — the same Cloudflare
Worker proxy in `../ask-proxy/worker.js` and the same localStorage keys
(`flcc-ask-proxy-url-v1`, `flcc-ask-proxy-secret-v1`). Members who already set
up Ask FLCC get the full companion with zero extra configuration; others can
paste the Worker URL in Settings.

**Without any AI connection the app still works**: the companion answers from
a curated pool of compassionate Taglish responses (`data/comfort.json`)
matched to a lightweight emotion classifier, and prayers/verses come from
local data. Connecting simply makes conversations personal and remembered.

The companion's memory is a `<memory>` tag the model appends to replies; it is
stripped before display and stored locally (viewable and deletable one-by-one
in Settings).

## Safety

- Crisis language (English and Filipino) opens a support sheet with real
  hotlines (NCMH 1553, In Touch, findahelpline.com) — drawn from
  `data/resources.json` so numbers are maintained in one place.
- The system prompt forbids judgment/diagnosis and directs persistent despair,
  abuse, or danger to the Tulong tab.
- The companion always presents itself as a friend, never a counselor.

## Privacy

Everything — journal, check-ins, conversations, memories — lives in
`localStorage` on the member's device. No accounts, no analytics, no ads.
Settings include full data export (JSON download) and one-tap erase.
Conversation content leaves the device only to generate AI replies, through
the church's private proxy.

## Editing content

All ministry content is plain JSON in `data/` — no code changes needed:

- `biblestudy.json` — pastor message, schedule, teachings, groups
- `resources.json` — hotlines, agencies, organizations, off-day ideas
- `comfort.json`, `verses.json`, `prayers.json` — offline heart-state content

## Tech

Vanilla ES modules + CSS, no build step — same pattern as `../daily-blessing`.
PWA: installable (`manifest.webmanifest`) and offline-capable (`sw.js` caches
the shell and data). Light/dark via `prefers-color-scheme`, large-text mode,
`prefers-reduced-motion` respected.
