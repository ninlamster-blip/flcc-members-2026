# 訳 Nihongo — Japanese ⇄ English Translator

A small, fast, **installable** web app that translates between English and Japanese and teaches as it goes: it returns the translation with **romaji**, a **word-by-word breakdown**, **politeness / register notes**, and **alternative phrasings** — plus native **text-to-speech** and a saved **phrasebook**.

It's a single static page (no build step) powered by Claude, and it installs to your phone or desktop as a standalone app (PWA).

![Nihongo translating “Nice to meet you.” into Japanese with romaji, a word breakdown and register notes](screenshot.png)

## Features

- **Auto / EN→JA / JA→EN** direction
- **Romaji** (Hepburn) for every Japanese result
- **Word-by-word breakdown** with readings and glosses
- **Nuance & register** notes (polite / casual / keigo)
- **Alternative phrasings** at different politeness levels
- **Listen** — native browser text-to-speech (`ja-JP`), no extra service
- **Phrasebook** — save phrases locally, with listen / copy / remove
- **Fast / Best** model toggle (Haiku / Sonnet)
- **Installable PWA** — Add to Home Screen, launches full-screen, works offline for the shell

## Run it locally

It's just static files — serve the folder with anything:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (free) on GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick `main` / root.
3. Your app is live at `https://<user>.github.io/<repo>/`.

The `.nojekyll` file is included so Pages serves everything as-is.

## Connecting to Claude

Open the app and press **Connect**. Two options:

### Option A — Shared Proxy (recommended for groups)
Deploy the included Cloudflare Worker once; everyone uses the app with no key of their own, and the key never touches the browser.

1. Open [`proxy/worker.js`](proxy/worker.js) and follow the header comment (about 5 minutes).
2. In short: create a Worker, paste the file, add an `ANTHROPIC_API_KEY` secret (and an optional `PROXY_SECRET` password), deploy.
3. In the app: **Connect → Shared Proxy →** paste the Worker URL (and secret).

### Option B — Your own API key
**Connect → My API Key →** paste an `sk-ant-...` key from [console.anthropic.com](https://console.anthropic.com). It's stored only in your browser and used directly from your device.

## How it works

- `index.html` — the whole app (React via CDN, Google Fonts, vanilla JS)
- `manifest.webmanifest`, `sw.js`, `icon-*.png` — PWA install + offline shell
- `proxy/worker.js` — optional Cloudflare Worker that holds the API key

No server of your own is required beyond (optionally) the Worker. All settings live in `localStorage`.

## Privacy

Text you translate is sent to the Anthropic API (directly, or via your Worker) to produce the translation. Nothing is stored server-side by this app; your phrasebook and connection settings stay in your browser.

## License

MIT — see [LICENSE](LICENSE).
