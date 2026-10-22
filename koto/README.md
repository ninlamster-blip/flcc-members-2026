# KOTO — Understand Japanese Naturally

The simplest, fastest, most beautiful way to translate and learn Japanese. Built with Next.js, TypeScript, Tailwind CSS, and Framer Motion, powered by Claude.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

- `src/app` — routes (App Router): `/` home, `/translate`, `/conversation`, `/learn`, `/history`, `/favorites`, `/profile`
- `src/app/api/translate` — server route that calls Claude for structured translation
- `src/components` — UI building blocks
- `src/lib/translate.ts` — Anthropic client + translation prompt/schema

## Roadmap

- **Phase 1 (current):** project scaffold, design system, Home, and a working EN↔JA / FIL↔JA text translator (translation, romaji, natural-usage explanation, formal/casual/business register).
- **Phase 2:** word-level detail (furigana, kanji breakdown, JLPT level, pitch accent), history, favorites.
- **Phase 3:** camera/OCR translation, conversation mode, kanji explorer, grammar engine, vocabulary builder.
- **Phase 4:** offline packs, spaced repetition, speaking practice, premium tier, polish.

## Deploy

Any Next.js host (Vercel, Cloudflare, etc.) works. Set `ANTHROPIC_API_KEY` as an environment variable in your deployment.
