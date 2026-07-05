# Daily Blessing

A premium, Apple/Notion-inspired daily devotional experience for the FLCC Abundance Church members app. Every day, members open a gift box to reveal scripture, prayer, encouragement, a devotional, a challenge, or a special Friday/seasonal blessing — plus Grace Coins, Faith XP, and occasional Bible Character Cards.

## Stack

Vanilla HTML/CSS/JS only, no build step, no frameworks — matches the rest of this repo's mini-apps (`faith-match/`, `armor-of-god/`). All sound is synthesized live via the Web Audio API (no audio files shipped). State is stored in `localStorage`. Content pools live in `data/*.json` and cycle through fully before repeating.

## Structure

- `index.html` — app shell, bottom navigation, script loading order
- `css/style.css` — the full design system (tokens, components, animations, reduced-motion, dark mode)
- `js/` — `DateUtils`, `Utils`, `SaveManager`, `Content`, `Season`, `Rewards`, `AudioManager`, `Router`, `App` (engine), `components/` (GiftBox, BlessingCard, CharacterCard, Streak), `pages/` (Home, Journey, Collection, Community, Profile)
- `data/*.json` — editable content pools (scriptures, prayers, encouragements, reflections, challenges, devotionals, pastor messages, announcements, worship songs, historical facts, Bible character cards)
- `manifest.json` / `sw.js` — installable, offline-capable PWA shell

## Editing content

Add or edit entries directly in the JSON files under `data/`. No code changes needed — new items automatically join the non-repeating rotation.

## Adjusting seasonal dates

`js/Season.js` computes Christmas, Holy Week, and Resurrection Sunday automatically. Administrative seasons (Missions Month, Prayer Week, Men's Fellowship) are configured in `SEASON_CONFIG` at the top of that file — update the month/day ranges to match your church calendar each year.

## Community progress

`App.communityProgress()` currently returns a stable-per-day placeholder count (no backend yet). Replace it with a real API call once church-wide attendance data is available; the UI (progress ring on the Community page) will work unchanged as long as the same `{ opened, total, complete }` shape is returned.
