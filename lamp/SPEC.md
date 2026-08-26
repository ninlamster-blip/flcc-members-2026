# LAMP — Product Specification

**A Bible & faith companion for ages 7–18.**

> Discover God. Know His Word. Live It.

Version 0.1 · specification only — no code has been written yet.

---

## 1. Vision

LAMP is a Bible and discipleship app designed specifically for children,
pre-teens and teenagers aged 7–18.

It should not feel like a "Sunday School app". It should feel like a
world-class educational and lifestyle app that happens to be deeply Christian.

The experience evolves as the child grows:

| Band | Posture | The app feels |
|------|---------|---------------|
| 7–10 | **Discover** | Playful, illustrated, read to me |
| 11–14 | **Explore** | Curious, interactive, mine to poke at |
| 15–18 | **Own your faith** | Quiet, sophisticated, a real Bible app |

The objective is not merely to get children to read the Bible. It is to help
them **know Scripture → understand Scripture → apply Scripture → develop a
personal relationship with Christ.**

The product loop, on every screen and in every phase:

```
DISCOVER → READ → UNDERSTAND → REFLECT → PRAY → APPLY → GROW
```

**Positioning.** *The Bible app that grows with you. For curious kids,
searching teenagers, growing disciples.*

---

## 2. Principles

These are the rules that settle arguments later. When a feature request
conflicts with one of these, the principle wins.

1. **The Bible is the product; AI is an assistant.** Scripture is always the
   destination, never the footnote.
2. **Age is a first-class dimension of the architecture**, not a stylesheet.
   Content, copy register, type scale and AI depth all read from one age band.
3. **Safety is a product requirement**, specified and tested like any other —
   see §11. This app is used by minors.
4. **Private things stay private.** Journals and prayers never leave the
   device, never reach the AI unprompted, and are never shown to a parent
   automatically.
5. **Quiet, editorial, premium, human.** Not "Christian + kids + AI = cartoon
   interface". See §13.
6. **Honest about hard questions.** Doubt, suffering and science get real
   answers, clearly separating what Scripture says from what Christians
   believe from what is genuinely debated.
7. **It works on a bad connection and an old phone.** Offline-first, no build
   step, no heavy runtime.

**Non-goals.** No social feed, no child-to-child messaging, no public
profiles, no ads, no third-party analytics, no engagement-maximising streak
guilt, no leaderboards between children.

---

## 3. Where LAMP sits in this repository

LAMP is a **third, separate application**, following the precedent Shepherd
set (`shepherd/ARCHITECTURE.md`). It lives entirely under `lamp/` and is
served from the same static host:

```
https://<your-site>/lamp/
```

The boundaries are hard ones:

- LAMP **never** imports `church.js` and never reads the `FLCC.*` global.
- LAMP **never** reads or writes FLCC storage keys or the `churches/` data
  files, and never imports anything from `shepherd/`.
- All LAMP storage lives under the `lamp/v1/…` namespace (§12).
- Church Mode (§10) keeps its **own** church registry — a small list copied
  into `lamp/content/churches.json`, not an import of the BOTR registry.

It inherits the repository's engineering constraints:

- **No build step.** Static files, ES modules, dynamic `import()` for code
  splitting. A parent should be able to read the source of the thing their
  child uses.
- **Tests are `node:test` with no dependencies**, over pure modules
  (`lamp/test/*.test.mjs`).
- **AI goes through the existing Cloudflare Worker** (`ask-proxy/worker.js`,
  `POST /proxy`) so no API key is ever shipped to a device. LAMP adds its own
  system prompt and safety layer on top; it does not modify the Worker's
  proxy behaviour.
- **Scripture text** comes from the same sources the repo already uses
  (`bolls.life`, `bible-api.com`), cached locally — see §6.

Proposed layout:

```
lamp/
  index.html                 app shell
  sw.js                      service worker (shell + visited chapters)
  manifest.webmanifest
  css/lamp.css               the design system (§13)
  js/
    app.js                   boot, onboarding, navigation
    core/
      dom.js                 h(), render, inline icons
      ui.js                  the component kit
      storage.js             namespaced adapter over localStorage/IndexedDB
      profile.js             age band, growth, settings
      age.js                 ageBand(), content resolution by band
      bible.js               fetch, cache, parse, search Scripture
      content.js             load + validate lamp/content/**
      ai.js                  prompt contract, tiering, safety routing (§9)
      safety.js              concern detection, safety cards, disclosures
      progress.js            reading progress, streaks, journey state
      memory.js              memory-verse scheduling + grading
      parent.js              parent mode, PIN, what is and is not visible
      router.js              hash router with per-screen dynamic import
    screens/
      today.js bible.js stories.js discover.js questions.js ask.js
      prayer.js journal.js memory.js challenges.js journey.js me.js
      parent.js church.js
  content/                   all authored content as JSON (§14)
  art/                       commissioned illustration (webp + avif)
  test/                      node:test suites, no dependencies
```

---

## 4. Information architecture

Five destinations. Everything else is reached from inside one of them.

| Tab | Contains |
|-----|----------|
| **TODAY** | The daily spiritual experience — greeting, continue reading, today's word, today's challenge |
| **BIBLE** | The complete Scripture experience — reader, plans, search, audio |
| **DISCOVER** | Stories, people, places, timeline, topics, Big Questions |
| **JOURNEY** | Reading progress, memory verses, challenges, spiritual habits |
| **ME** | Prayer, journal, notes, bookmarks, settings, parent mode |

**Ask** (§9) is not a tab. It is reachable from Today's quick actions, from
any verse, and from any story or question — because it is an assistant, not
the product.

---

## 5. TODAY

The home screen. Extremely clean; one screen, no scroll-to-discover.

```
Good evening, Joshua.

  Continue reading
  Matthew 5 · 60% complete                       [ Continue ]

  TODAY'S WORD
  BE THE LIGHT
  Matthew 5:14–16 · 3 min                        [ Read ]

  TODAY'S CHALLENGE
  Can you remember today's verse?                [ Start ]

  Read Bible · Pray · Journal · Ask
```

**Behaviour**

- Greeting uses the local clock (morning/afternoon/evening) and the profile's
  display name. No name yet → "Good evening."
- "Continue reading" appears only when there is progress to continue; a first
  run shows the day's reading plan entry instead.
- Today's Word is selected deterministically from
  `content/daily/<band>.json` keyed by day-of-year, so every child in a church
  sees the same verse on the same day and the choice is reproducible offline.
- Today's Challenge is one of the five challenge types in §16.
- Nothing else. No cards for things the child has not asked for.

**Done when** — the screen renders correctly offline; it fits one viewport at
every age band's type scale; the same date always yields the same verse and
challenge; a fresh install shows a sensible first-run state with no empty
cards.

---

## 6. BIBLE

Scripture is a first-class experience. The reader should feel closer to Apple
Books than to a typical church application.

**Reader**

- Old Testament / New Testament → book → chapter, plus a jump-to field that
  parses `jn 3`, `john 3:16`, `1 sam 17`.
- Continuous chapter scroll with verse numbers set small and superior; the
  chapter, not the verse, is the unit of reading.
- Font size, line height and theme (day / sepia / night) adjustable, defaults
  from the age band.
- Reading progress is recorded per chapter, at the furthest verse reached.
- Search across the cached text, with book/testament filters.
- Audio: MVP uses the platform speech synthesiser at a slowed rate with a
  paragraph highlight; Phase 2 swaps in recorded audio where licensing allows.

**Verse interaction** — tap any verse:

```
Explain   Listen   Highlight   Remember   Ask   Pray
```

- **Explain** — an age-calibrated plain-language explanation (§9).
- **Highlight** — four colours, stored locally, listed under Me.
- **Remember** — adds the verse to the memory system (§15).
- **Ask** — opens Ask with the verse as context.
- **Pray** — opens Prayer with the verse as the starting Scripture.

**Text source and licensing.** MVP ships **public-domain translations only**
(KJV, WEB, ASV) fetched from `bolls.life` with `bible-api.com` as fallback,
then cached. Modern translations (NIV, ESV, NLT, ICB) require per-publisher
licensing and are explicitly **out of scope until a licence exists** — the
translation list is data (`content/translations.json`), so adding one later
is a content change, not a code change. Default translation per band: WEB for
7–10 (simpler English than KJV), WEB for 11–14, reader's choice for 15–18.

**Caching.** Chapters are cached in IndexedDB under
`lamp/v1/bible/<translation>/<book>/<chapter>`; the service worker serves the
shell and any visited chapter offline. A first run pre-caches the Gospel of
John and the current reading plan's first week.

**Done when** — every book and chapter of a public-domain translation is
reachable and readable offline once visited; verse actions all work from a
long-press and a tap; search returns results from cached text in under 200ms
on a mid-range phone; progress survives a reload.

---

## 7. BIBLE STORIES

For 7–14 especially, though the 15–18 band gets the same stories written as
short narrative studies rather than dropped from the app.

Every story has six parts, in this order:

1. **Story** — beautiful visual storytelling, illustrated.
2. **What happened?** — a simple retelling of the events.
3. **What does it teach me?** — the biblical principle.
4. **Think about it** — one question, written per age band.
5. **Pray** — a short guided prayer.
6. **Challenge** — one interactive question.

Example — *David & Goliath*:

> What looked impossible to David?
> What did David trust?
> What is your "Goliath" today?

This is the point of the section: Bible stories stop being passive reading and
become active discipleship. Every story links to the passage it comes from, so
a child who wants the actual text is one tap away.

**MVP set** — 40 stories: 24 Old Testament, 16 New Testament, covering the
spine of the biblical story (Creation, Fall, Noah, Abraham, Joseph, Moses,
Exodus, Joshua, Gideon, Samuel, David, Solomon, Elijah, Daniel, Esther,
Jonah, Nehemiah, the prophets' promise → Annunciation, Nativity, Baptism,
Temptation, calling the disciples, parables, miracles, the Transfiguration,
the Last Supper, Gethsemane, the Cross, the Resurrection, Pentecost, Paul's
conversion).

**Done when** — all 40 stories exist for all three bands, validated by the
content test (§17); each renders in under a second offline; the challenge
records a result to the journey.

---

## 8. DISCOVER

The exploration area.

**People** — Jesus, Peter, Paul, David, Moses, Esther, Ruth, Daniel, Abraham,
Joseph, Mary and others. Each: who they were, when they lived (links to the
timeline), where (links to the map), key passages, what their life shows about
God, and one question.

**Places** — an interactive Bible map. MVP is a hand-drawn base map with
tappable places (a static image plus a coordinate table), not a live tile
service — it must work offline and must not call a third party from a child's
device.

**Timeline** — Creation → Patriarchs → Exodus → Kingdom → Prophets → Jesus →
Early Church. Scrollable, with stories, people and places pinned to it.

**Topics** — faith, prayer, forgiveness, fear, friendship, courage, identity,
purpose, temptation, love, wisdom, suffering, doubt. Each topic is a short
piece per age band, a set of verses, one story, one prayer and one challenge.

**Big Questions** — particularly important for teenagers:

- Why does God allow suffering?
- Can Christians have doubts?
- How do we know the Bible is true?
- Why did Jesus have to die?
- Why should I believe in God?
- What happens after death?
- How do I know God's will?
- Why do bad things happen to good people?
- What does Christianity say about science?

Answers must be **biblically grounded, age appropriate, theologically
responsible, honest about what is difficult, and never condescending**. Each
answer is authored (not generated), reviewed, and carries the same three-tier
labelling the AI uses (§9): what Scripture says · what Christians commonly
believe · where Christians disagree. An answer that cannot be given honestly
at a given age band says so and points the child to a trusted adult.

---

## 9. ASK — the AI Bible companion

```
Ask
What would you like to understand?

  "Who was Moses?"
  "Why did Jesus wash the disciples' feet?"
  "What does forgiveness mean?"
  "I'm scared. What does the Bible say?"
```

**Age calibration.** The same question gets a different answer by band:

| Band | Answer shape |
|------|--------------|
| 7–10 | Simple vocabulary, 3–5 short sentences, one verse, one picture-thought |
| 11–14 | Context and application, 2–3 short paragraphs, 2–3 verses |
| 15–18 | Theological, historical and apologetic depth, counter-arguments acknowledged, sources named |

**The three-tier contract.** Every answer that goes beyond plain narration
must distinguish:

1. **What Scripture says** — with references, quoted from the child's
   translation.
2. **What Christians commonly believe** — the historic consensus.
3. **Where Christians disagree** — named as disagreement, not resolved for
   the child.

This distinction is not cosmetic; it is the difference between discipling a
child and indoctrinating one. It is rendered visually, not just textually, so
a ten-year-old can see which part is the Bible and which part is commentary.

**Implementation**

- Requests go to `ask-proxy`'s `POST /proxy` with LAMP's own system prompt,
  the age band, the current screen's context (a verse, a story, a question)
  and **nothing else about the child** — no name, no journal, no prayer, no
  history beyond the current conversation.
- Journal and prayer content is sent **only** when the child explicitly taps
  "Ask about this", and the confirmation says so in words a child understands.
- Responses stream; a hard cap of ~400 tokens (7–10), ~700 (11–14) and
  ~1200 (15–18) keeps answers readable rather than exhausting.
- Every answer carries a persistent disclosure: *"LAMP's helper can make
  mistakes. Always check what the Bible says."* Verse references in an answer
  are resolved against the real text before display; a reference that does not
  resolve is stripped and the answer is marked as needing checking.
- Offline or Worker unavailable → Ask degrades to the authored content:
  search over topics, Big Questions and stories, with an honest banner.
- Conversation history is local, capped (last 20 exchanges), clearable in one
  tap, and cleared by default when the app is closed for 30 days.

**Safety routing.** The AI does not act as a counsellor. Where a message
suggests self-harm, abuse, exploitation, or immediate danger, the response is
a **safety card**, not a conversation: name that this matters, tell the child
it is not their fault and not something to carry alone, name a trusted adult,
and show the region's help line from `content/safety/<region>.json`. This
path is deterministic — detected on-device before the request is sent and
enforced again in the system prompt, so it works even when the model does
something unexpected. The card is never dismissed silently; it stays in the
thread.

**Done when** — a fixture suite of ~60 questions across the three bands
produces answers that pass the tier-labelling and reference-resolution checks;
every safety fixture routes to a safety card without reaching the model;
Ask is fully usable with the Worker switched off.

---

## 10. PRAYER, JOURNAL, PARENT & CHURCH

### Prayer

```
TALK TO GOD
How are you feeling today?

😊 Happy  😔 Sad  😰 Worried  😡 Angry  😴 Tired  🙏 Thankful  😶 Confused
```

Then, in order: **Scripture → Reflection → Prayer → Journal.**

The mood picks the Scripture (from `content/prayer/moods.json`, three verses
per mood per band, rotating). The prayer screen offers a starter — *"God, I'm
worried about…"* — that the child can finish, speak or ignore. Saved prayers
are private by default, listed under Me, and can be marked answered.

### Journal

A beautiful private journal — a spiritual diary, not a form.

```
Today's entry
  What is God teaching me?
  What am I thankful for?
  What do I need God's help with?
  My prayer
  Scripture
```

Prompts are optional scaffolding: an empty page with a date is a valid entry.
Entries are stored locally, never uploaded, never sent to the AI unprompted,
and excluded from parent mode by design (§11).

### Parent mode

A separate, PIN-protected area (PIN hashed with PBKDF2, never stored in
clear). Parents see **activity, not content**:

- reading activity, completed studies, memory verses, challenges
- settings: AI on/off, translation, daily reminder, screen-time boundaries

They do **not** see journal entries or AI conversations. Instead:

```
TALK ABOUT IT
Your child explored forgiveness this week.

Conversation starter:
"Is there someone you find difficult to forgive?"
```

This is a deliberate design decision, stated plainly to both the parent (at
setup) and the child (in Me): the app encourages a real conversation rather
than surveillance. A child who knows they are being read stops writing
honestly — and an app that promises privacy and then breaks it teaches the
wrong lesson about trust.

### Church mode

A church can have its own space inside the app — opt-in, chosen once in
settings, and read-only:

```
FLCC · This week
  Sunday lesson · Memory verse · Youth event
  Bible challenge · Sermon · Announcements
```

Content is a single static JSON file per church
(`lamp/content/churches/<id>/this-week.json`), published the same way the rest
of this repository publishes data — a commit or an admin editor writing the
file. Church administrators can publish content without changing the app.
LAMP keeps its own church list; it does not read the BOTR registry (§3).

---

## 11. SAFETY

For a product involving minors this is a first-class product requirement, not
an afterthought. Every item below is testable and has a test.

**Data**

- No account, no email, no phone number, no login in MVP. A profile is a
  display name (first name or nickname), a birth **year**, and settings.
- No location, ever — not for the map, not for church selection, not for
  help-line region (the region is chosen, not detected).
- No third-party analytics, no advertising SDKs, no social SDKs.
- Everything personal is local. The only network calls are: Scripture text,
  the AI proxy, and church content JSON — all listed in Me → Privacy in plain
  language a twelve-year-old can read.
- Retention: journals and prayers persist until the child deletes them;
  AI conversations are capped and expire (§9); "Delete everything" in Me wipes
  the `lamp/v1/…` namespace and says exactly what was removed.

**Interaction**

- No public profiles, no messaging between minors, no user-generated content
  visible to any other user. There is no mechanism by which one child's words
  reach another child.
- Age-appropriate AI responses with content filtering on both the request and
  the rendered response.
- Clear AI disclosure wherever a model wrote the words.
- A **"Tell someone"** affordance on every screen of Ask, Prayer and Journal —
  one tap to the help-line card and to guidance on speaking to a trusted adult.
- A reporting path for content the child finds wrong or upsetting (authored
  content and AI answers alike), which records the item locally and shows the
  parent/guardian route; nothing about the child is transmitted.

**Guardrails on the model**

The system prompt fixes: the age band, the refusal set (sexual content,
self-harm method detail, violence detail, contempt for the child's family or
church, medical/legal/psychiatric advice), the three-tier labelling rule, the
"never claim to be a person, a pastor or a counsellor" rule, and the safety
routing in §9. Prompt-injection from fetched content is not a theoretical
concern here: authored content is the only content the model is given, and it
is treated as data.

---

## 12. Data model

All keys live under `lamp/v1/`. Small records in `localStorage`, Scripture
cache and illustration cache in IndexedDB.

| Key | Shape |
|-----|-------|
| `lamp/v1/profile` | `{ id, name, birthYear, band, createdAt, translation }` |
| `lamp/v1/settings` | `{ theme, fontScale, audio, aiEnabled, reminderAt, region, churchId }` |
| `lamp/v1/progress` | `{ chapters: { "JHN.3": { verse, at } }, streak: { count, lastDay }, plans: {…} }` |
| `lamp/v1/memory` | `{ verses: [ { ref, translation, state, due, attempts } ] }` |
| `lamp/v1/journal` | `{ entries: [ { id, date, body, prompts, verseRef } ] }` |
| `lamp/v1/prayers` | `{ items: [ { id, date, mood, body, answeredAt } ] }` |
| `lamp/v1/challenges` | `{ log: { "2026-08-25": { type, result } } }` |
| `lamp/v1/journey` | `{ stage, milestones: [ … ] }` |
| `lamp/v1/highlights` | `{ items: [ { ref, colour, at } ] }` |
| `lamp/v1/notes` | `{ items: [ { ref, body, at } ] }` |
| `lamp/v1/ask` | `{ thread: [ … ], updatedAt }` (capped, expiring) |
| `lamp/v1/parent` | `{ pinHash, salt, iterations, visibility, setAt }` |
| `lamp/v1/bible/*` | IndexedDB — cached chapters by translation |

`storage.js` is the only module that touches the browser's storage APIs, and
it refuses any key that does not start with `lamp/v1/`. That single guard is
what keeps the app's promise in §3 mechanically true rather than merely
intended.

---

## 13. Design system

**Philosophy: quiet, editorial, premium, human.**

Explicitly avoid: excessive gradients, rainbow colour, oversized emoji,
floating blobs, generic AI-looking illustration, heavy glassmorphism,
card-everything layouts, unnecessary animation, fake gamification, badge
spam.

**Typography.** A clean sans for interface, a beautiful serif for Scripture —
the serif is how the app says "this part is the Bible" without a label. Base
size and line height come from the age band: 19px/1.7 (7–10), 17.5px/1.65
(11–14), 16.5px/1.6 (15–18). Measure 60–72 characters.

**Colour.** A warm neutral foundation with one recognisable accent — lamp
amber. Light: paper `#FCFAF7`, ink `#16130F`, muted `#6B635A`, rule
`#E8E1D7`, accent `#B45B22`. Dark: paper `#141210`, ink `#F2EDE6`, muted
`#A29A90`, rule `#2A251F`, accent `#E08A45`. Every colour is a token defined
in both themes; nothing is defined only inside a media query.

**Layout.** Generous whitespace. One idea per screen.

**Illustration.** One visual language across all stories: flat paper-cut
shapes, a fixed twelve-colour palette, and a single grain texture over the
top — printed picture-book, not gradient mesh. The scenes are drawn in code
(`js/core/art.js`) from a shared kit of shapes, which is why fourteen pictures
look like fourteen pictures by the same hand, weigh a few kilobytes in total,
need no network, and can be tested: `test/art.test.mjs` fails if a scene uses
a colour outside the palette or reaches outside itself. Commissioned artwork
can replace the kit later without touching a screen.

**Animation.** Subtle and purposeful, ≤200ms for chrome, ease-out, and fully
disabled under `prefers-reduced-motion`. Motion is used in exactly three
places: sections fade up as they arrive, a right answer pops with a short
burst of sparks, and a wrong one nudges. There is no confetti, no falling
stars, and nothing loops.

**Interaction.** Haptics, transitions and micro-interactions polished to the
point of being almost invisible.

**The design grows with the user.** At 7 LAMP feels playful; at 12
exploratory; at 16 sophisticated; at 18 a premium Bible app. The brand does
not change — the type scale, illustration density, copy register, chrome and
default screen do. One band token on `<html>` drives all of it through CSS
custom properties, so the maturing is a property of the system rather than
three apps in a trench coat:

| | 7–10 | 11–14 | 15–18 |
|---|---|---|---|
| Today opens with | a picture of the time of day | a slimmer band of it | the greeting |
| Stories are | a shelf of illustrated cards | a list with thumbnails | a plain index |
| Cards carry | a 5px colour rail | a 3px rail | no rail |
| Tap targets | 52px | 48px | 44px |
| Type / measure | 19px / 30rem | 17.5px / 33rem | 16.5px / 36rem |

Nothing is hidden from the youngest band and nothing is withheld from the
oldest: the same screens, the same content, a different register.

**Accessibility.** WCAG 2.2 AA: 4.5:1 text contrast in both themes, 44px
targets, full keyboard operation, visible focus, labelled controls, correct
heading order, and screen-reader text for every illustration.

---

## 14. Content pipeline

All authored content is JSON under `lamp/content/`, committed to the
repository, versioned with the app, and validated by a test.

```
content/
  daily/<band>.json           366 entries — verse, title, reading, challenge
  stories/index.json          the 40-story manifest
  stories/<slug>.json         one file per story, all bands
  people/<slug>.json
  places.json  timeline.json
  topics/<slug>.json
  questions/<slug>.json       Big Questions
  plans/<slug>.json           reading plans
  memory-verses.json
  challenges/<type>.json
  prayer/moods.json
  safety/<region>.json        help lines, per region, chosen not detected
  churches/<id>/this-week.json
  translations.json
```

Every band-varying field is an object keyed by band, and the content test
fails the build if a required band is missing:

```json
{
  "slug": "david-and-goliath",
  "title": "David & Goliath",
  "reference": "1SA.17",
  "art": "art/david-goliath.avif",
  "story":        { "7-10": ["…"], "11-14": ["…"], "15-18": ["…"] },
  "whatHappened": { "7-10": "…", "11-14": "…", "15-18": "…" },
  "whatItTeaches":{ "7-10": "…", "11-14": "…", "15-18": "…" },
  "thinkAboutIt": { "7-10": "…", "11-14": "…", "15-18": "…" },
  "pray":         { "7-10": "…", "11-14": "…", "15-18": "…" },
  "challenge":    { "type": "choice", "prompt": "…", "options": ["…"],
                    "answer": 0, "explain": "…" }
}
```

Content is **authored and reviewed by people**, not generated at runtime. A
model may draft; a human reviews every line that a child will read, and the
review is recorded in the file (`"reviewedBy"`, `"reviewedAt"`).

---

## 15. MEMORY VERSES

A real memorisation system, not a flashcard toy. Five states:

**Learn** (read it) → **Listen** (hear it) → **Practice** (fill in missing
words) → **Challenge** (complete the verse) → **Master** (recite unaided).

```
"I can ___ things through Christ…"

Learning → Practicing → Almost there → Mastered
```

Scheduling is a simple, legible spaced repetition: 1 day, 3 days, 7, 16, 35.
A missed review moves back one state, never to zero — the system should feel
like patience, not punishment. Grading for Practice and Challenge is
whitespace- and punctuation-insensitive and forgives one character per ten.
"Master" is self-attested (the child says they recited it); the app does not
listen to a child's microphone to check.

---

## 16. DAILY CHALLENGES & FAITH JOURNEY

**One small challenge a day.** Five types:

| Type | What it asks |
|------|--------------|
| **Find it** | Locate a particular verse |
| **Remember it** | A memory-verse challenge |
| **Know it** | Bible trivia |
| **Think about it** | A reflection question |
| **Live it** | Real-life application |

```
LIVE IT
Encourage someone today without expecting anything back.
Inspired by Philippians 2:3–4.
```

This matters because the app must move **Bible → life**. "Live it" is never
auto-verified; the child marks it done, and the app takes their word for it.

**Faith journey.** Not childish levels — a visible path of understanding:

```
DISCOVER   Creation · Abraham · Moses · David
KNOW       Jesus · Gospels · Holy Spirit
GROW       Prayer · Faith · Wisdom · Character
LIVE       Serving · Forgiveness · Leadership · Mission
SHARE      Evangelism · Discipleship · Calling
```

A child is not levelling up. They are growing in understanding, and the
journey screen is written to say so. Milestones unlock by what has actually
been read, memorised and reflected on — never by time spent in the app.

---

## 17. Non-functional requirements

- **Offline.** Shell, all authored content, cached chapters and every local
  record work with no network. Ask and new chapters degrade honestly.
- **Performance.** First contentful paint under 1.5s on a mid-range Android
  over 3G; screens code-split by route; illustration lazy-loaded; the shell
  under 150KB before content.
- **Browser support.** Evergreen Chrome, Safari, Firefox, Edge; iOS Safari 16+
  and Chrome on Android 10+ specifically, because that is what the children in
  these churches actually hold.
- **Installable.** PWA with a manifest and a service worker.
- **Internationalisation.** Copy lives in one place from day one. English at
  launch; Tagalog and Arabic are the first candidates given where these
  churches are, and Arabic makes RTL a layout requirement rather than a
  retrofit.
- **Testing.** `node --test 'lamp/test/*.test.mjs'`, no dependencies, over
  pure modules: age-band resolution, content schema validation across every
  file, reference parsing and resolution, memory scheduling and grading,
  storage namespace enforcement, safety routing fixtures, AI tier labelling
  and reference checking.

---

## 18. Roadmap

Do not build everything at once.

**Phase 1 — Core (MVP)**
Onboarding · age profile · Today · Bible reader · daily verse · Bible stories ·
prayer · journal · memory verses · daily challenges · basic AI companion ·
progress.

*MVP is done when:* a nine-year-old and a sixteen-year-old can each open the
app cold, be reading Scripture within 30 seconds, complete a story, memorise a
verse over a week, keep a private journal, ask a question and get an
age-appropriate answer — all of it working offline except Ask, with the safety
requirements in §11 tested and passing.

**Phase 2 — Discovery**
Bible characters · Bible map · timeline · topics · Big Questions · reading
plans · audio Bible.

**Phase 3 — Family & church**
Parent mode · church mode · church content · family discussion prompts ·
church challenges.

**Phase 4 — Advanced**
Personalised learning · AI Bible tutor · advanced Bible study · apologetics ·
faith journey · advanced recommendations.

---

## 19. Open questions

1. **Translations.** MVP is public domain only. Is a licence for a modern
   child-readable translation (ICB, NIrV, NLT) worth pursuing before launch?
   It materially changes the 7–10 experience.
2. **Illustration.** 40 stories at commissioned quality is the single largest
   cost in Phase 1. Budget, illustrator, and how many stories ship illustrated
   at launch?
3. **Audio.** Speech synthesis is free and mediocre; recorded audio is good
   and expensive. Which for launch, and in whose voice?
4. **One device, many children.** Do siblings share an install (multiple
   profiles behind a picker) or not? This changes the storage model, so it
   should be decided before Phase 1 ships, not after.
5. **Church mode and the BOTR churches.** Which churches publish content at
   launch, and who edits `this-week.json` — a commit, or an admin editor page?
6. **Regions for help lines.** Kuwait and the Philippines at minimum, given
   these churches. Which others at launch?
7. **Ages below 7 and above 18.** Out of scope by design — worth confirming
   nobody expects a 5-year-old mode later.
