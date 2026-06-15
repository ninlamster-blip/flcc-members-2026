# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **no-build, serverless church management web app** for FLCC - Abundance Church, a Filipino fellowship in Kuwait. It serves ~48 members with tools for scheduling, attendance, prayer, music ministry, and an AI chatbot. All frontend code runs directly in the browser — no compilation step, no package manager.

## Commands

**There is no build, test, or lint toolchain.** The only deployable artifact is the Cloudflare Worker.

```bash
# Deploy the worker (requires Wrangler CLI and Cloudflare auth)
wrangler deploy

# Set the required Anthropic API key secret
wrangler secret put ANTHROPIC_API_KEY

# Local dev (serves static files + worker locally)
wrangler dev
```

For local development, opening HTML files directly in a browser works without a server — or use `wrangler dev` to get the full worker+static experience.

## Architecture

### Static Frontend + Cloudflare Worker

```
[Browser]
  └── HTML pages load React 18 + Babel via CDN (no bundler)
      └── Babel compiles JSX in-browser at runtime
      └── Pages fetch *.json data files directly
      └── localStorage used for state persistence (prayer map, etc.)

[Cloudflare Edge]
  ├── Static assets: all *.html, *.json, *.js, *.css in repo root
  └── Worker (ask-proxy/worker.js):
        GET  /news   → aggregates 7 RSS feeds via rss2json (5-min cache)
        POST /proxy  → proxies requests to Anthropic API
        GET  /ping   → health check
```

**`wrangler.toml`** configures the worker entry point (`ask-proxy/worker.js`) and serves the repo root as static assets.

### Data Layer

All data lives in **JSON files** in the repo root. There is no database. Pages fetch these files with `fetch('*.json')` and render them. Edits to data are made by directly editing or committing updated JSON files.

| File | Contents |
|------|----------|
| `data.json` | Ministry workers roster, roles, eligibility, birthdays |
| `attendance.json` | Service sessions and per-member attendance records |
| `music.json` | Music ministry workers and role assignments |
| `prayer.json` | Prayer ministry teams and coordinators |
| `worship.json` | Songs library with keys, tempos, chords |
| `botr.json` | FLCC-BOTR 13-church network structure in Kuwait |
| `equip.json` | Discipleship courses and ministry structure |
| `flcc-schedule-2026-05-12.json` | Schedule snapshot |

### Pages

Every HTML page is self-contained — it includes its own `<script type="text/babel">` JSX and inline styles. Each page is independent; there are no shared React components across files.

| Page | Purpose |
|------|---------|
| `index.html` | Main schedule view; tabs for all ministries (~9k lines) |
| `members.html` | Member directory with search/filter (~6k lines) |
| `ask.html` | AI chatbot (calls `/proxy` worker → Claude API) |
| `attendance.html` | Attendance dashboard with charts |
| `prayer.html` | Prayer team schedule |
| `music.html` | Music ministry assignments |
| `schedule-editor.html` | Schedule editing tool |
| `faith-map.html` | Global 147-country prayer map (Leaflet) |
| `flcc-gmpi-prayer-map.html` | Philippines church network map (Leaflet) |
| `flcc-gmpi-admin.html` | Admin panel for the Philippines prayer map |

The two prayer map pages use **vanilla JS** (not React) — logic is split across `flcc-gmpi-app.js` and `flcc-gmpi-data.js`.

### Design System

All React pages share a consistent CSS variable system defined in `<style>` blocks:

```css
--bg: #FAFAF5          /* page background */
--surface: #FFFFFF     /* card/dialog */
--ink: #18181B         /* primary text */
--ink-muted: #52525B
--ink-subtle: #A1A1AA
--border: #E7E5DE
--accent: (varies per page)
  index/schedule → #A33B2A  (terracotta)
  prayer         → #6366F1  (indigo)
  music          → #EA580C  (coral)
  attendance     → #0284C7  (blue)
```

**Fonts**: Fraunces (display serif) + Geist (body sans) + Geist Mono — loaded from Google Fonts CDN.

### Worker (ask-proxy/worker.js)

The worker requires one secret: `ANTHROPIC_API_KEY`, configured via Wrangler or the Cloudflare dashboard. It forwards Claude API calls with CORS headers so browser pages can call it cross-origin. The worker does **not** validate or modify the request body — it passes it straight to `api.anthropic.com/v1/messages`.

## Key Conventions

- **No shared components**: Each HTML file is standalone. When adding UI, copy patterns from the nearest similar page rather than creating shared imports.
- **CDN-only dependencies**: All libraries (React, Tailwind, Leaflet, Marked) are loaded via `<script src="...cdn...">` tags. Do not introduce npm or a bundler.
- **JSON is the source of truth**: Member data, attendance, and schedules live in committed JSON files. Update them directly when data changes.
- **localStorage keys**: The Philippines prayer map persists edits to `flcc_gmpi_churches_v1` in localStorage. Resetting calls `resetChurches()` from `flcc-gmpi-data.js`.
- **Tailwind via CDN**: Uses the Play CDN version (`<script src="https://cdn.tailwindcss.com">`), not a PostCSS build.
