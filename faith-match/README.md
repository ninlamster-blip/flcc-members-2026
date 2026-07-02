# Faith Match

A Candy-Crush-style match-3 puzzle game built with [Phaser 3](https://phaser.io), tracing the story of Scripture — from Creation to Revelation — across 300 hand-tuned levels in 14 worlds.

No build step, no backend, no external runtime dependencies. Phaser itself is vendored locally (`Assets/lib/phaser.min.js`) so the game works fully offline after the first load, same as this repo's other static game folders (`snake/`, `spiritual-maze/`, `armor-of-god/`).

## Running it

Just serve the repo root as static files and open `/faith-match/index.html` — there's nothing to build or install.

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000/faith-match/index.html
```

## Gameplay

- 8x8 board, swap-adjacent-tiles match-3 with cascades, gravity, refill, and automatic reshuffle when no move is available.
- 8 base pieces (Bible, Cross, Fish, Lamp, Scroll, Bread, Grapes, Dove) and 5 special pieces created from 4/5-in-a-row and L/T-shaped matches: Living Water (row clear), Sword of the Spirit (column clear), Prayer Bomb (area clear), Pentecost Flame (clear one type board-wide), Armor of God (large area clear). Swapping two specials together combines their effects.
- 6 powerups usable mid-level from the in-game toolbar: Prayer, Extra Moves, Hint, Shuffle, Hammer, Cross Blast.
- 300 levels across 14 worlds (Creation → Revelation), each generated from a deterministic difficulty curve — objectives (score, collect, break stones, clear fog, dual), move/time budgets, blockers, and piece-type variety all scale with progress. See `Levels/LevelGenerator.js`.
- Daily Challenge (resets daily) and Weekly Challenge (resets by ISO week), scored as best-score attempts rather than pass/fail.
- Progression: coins, XP, Faith Level, stars, 13 achievements, daily login streak with a 7-day reward table, local leaderboard.
- A short Scripture verse (KJV, 300-verse bank) with a one-line devotional note after every completed level.
- Fully synthesized audio (Web Audio oscillators, no audio files) with Music/SFX toggles.

## Project structure

```
faith-match/
  index.html / style.css / main.js   Entry point + minimalist Claude/Notion-inspired styling
  Assets/
    icons/                            Hand-authored SVG piece/special/powerup icons
    lib/phaser.min.js                 Vendored Phaser 3 (offline-capable)
  Scenes/                             One class per Phaser scene (Boot, Preload, Menu, WorldMap,
                                       LevelSelect, Game, Challenges, Achievements, Settings,
                                       Credits, Leaderboard)
  Objects/                            Engine-agnostic game logic: Tile, Board (match/gravity/
                                       specials), ObjectiveTracker — no Phaser dependency, unit-testable
  Levels/                             LevelGenerator (deterministic level configs) + LevelManager
                                       (caching, unlock/progress queries)
  UI/                                 Reusable Phaser components: FMButton, FMScrollView, FMProfileStrip
  Utils/                              Constants, EventBus, RNG, SaveManager, Achievements,
                                       DailyRewards, DateUtils, Scripture
  Audio/AudioManager.js               Synthesized SFX/music
```

## Architecture notes

- **`Objects/Board.js`** is the real engine: pure JS, no Phaser references, so match/cascade/special
  logic can be reasoned about and tested independently of rendering. `GameScene` reads the result
  objects it returns (`clearedCells`, `specialsCreated`, `blockersDamaged`, `scoreGained`) to drive
  animation.
- **Levels are generated, not hand-authored.** `LevelGenerator.generateLevelConfig(id)` is a pure,
  deterministic function seeded by the level id — the same id always produces the same board seed,
  objective, and difficulty. This is how 300 levels exist without 300 hand-written JSON files.
- **`SaveManager`** wraps `localStorage` with a versioned, deep-merged schema so new fields added by
  later features never break existing saves.
- **Known Phaser gotcha (worth knowing if you extend the UI):** a `GameObject`'s hit-testing can miss
  entirely when its container is positioned at a fractional pixel (e.g. `height * 0.48`), even though
  the geometry is otherwise correct. `UI/Button.js` and `UI/ScrollView.js` round their `x`/`y` at
  construction time to guard against this — keep doing that for any new interactive container.

## Status

All core systems are implemented and covered by headless-browser smoke tests during development:
match-3 engine and specials, the full 300-level/14-world system, menu/progression/settings,
scripture/powerups/audio/leaderboard. See the PR history on this branch for phase-by-phase detail.
