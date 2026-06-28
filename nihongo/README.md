# 桜 Nihongo Journey

A clean, premium Japanese-learning web app — built to feel like a blend of
Duolingo, LingoDeer, and Anki, with an Apple/Notion-inspired interface.

**Open:** [`index.html`](./index.html)

## Why it's built this way

This repo is a static GitHub Pages site (served via a Cloudflare Worker), so
Nihongo Journey is a **fully client-side** app — no backend, no API keys, no
build step. It uses:

- **Vanilla JS + ES modules** — lazy-loaded views, hash router
- **`localStorage`** — all progress (kana, vocab, SRS, XP, streak, achievements)
- **Web Speech API** — Japanese text-to-speech and pronunciation scoring
- **Service worker** — offline caching of the app shell and data

Everything runs offline after the first load, and works on desktop, tablet,
and mobile (slide-out navigation on small screens).

## Features

| Area | What it does |
|------|--------------|
| **Hiragana / Katakana** | Full gojūon, dakuten & yōon charts, tap-to-hear, learned-tracking, multiple-choice quiz |
| **Word Cards** | 8 categories / 80 words with kana, rōmaji, English, example sentences, audio, favorites |
| **Sentence Breakdown** | Pre-tokenized sentences showing each word's grammatical role + meaning, with grammar notes |
| **Kanji Explorer** | On/kun readings, meanings, stroke counts, common-word examples, trace-in animation |
| **Flashcards** | SM-2 spaced repetition with Again/Hard/Good/Easy grading and interval previews |
| **AI Conversation** | Offline rule-based tutor that replies in Japanese with rōmaji, meaning & grammar tips |
| **Pronunciation** | Speak a phrase, get an accuracy estimate via speech recognition (with self-rate fallback) |
| **Writing Practice** | Canvas tracing (mouse/touch) over a faint guide glyph for kana & kanji |
| **JLPT Prep** | N5–N1 overview + mixed recognition quizzes generated from app data |
| **Progress** | Level/XP, streak, per-area progress, 10 achievements, daily missions |

## Architecture

```
nihongo/
├── index.html          # entry — registers service worker, boots app
├── styles.css          # design system (light theme, tokens, components)
├── sw.js               # offline cache
├── data/               # kana, vocabulary, sentences, kanji datasets
└── js/
    ├── app.js          # shell: sidebar nav + hash router (fresh-node swap)
    ├── core.js         # state, storage, TTS, XP/streak, helpers
    ├── srs.js          # SM-2 spaced-repetition scheduler
    ├── missions.js     # daily missions
    ├── achievements.js # achievement definitions + evaluation
    └── views/          # one module per screen, exporting render()
```

State is namespaced under the `nihongo-journey-v1` localStorage key and can be
cleared from the **Progress → Reset** control.
