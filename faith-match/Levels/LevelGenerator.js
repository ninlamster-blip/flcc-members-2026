/**
 * LevelGenerator — deterministically produces all 300 level configs from
 * a handful of difficulty-curve rules, rather than hand-authoring 300
 * JSON blobs. Each level is seeded by its own id, so the same levelId
 * always yields the exact same board-generation seed, objective, move
 * budget, and blocker layout (important for fairness and for the daily
 * leaderboard's "fastest completion" comparisons).
 *
 * A level config has the shape:
 * {
 *   id, worldId, worldName, worldTheme, indexInWorld,
 *   resourceType: 'moves' | 'time',
 *   moveLimit, timeLimit,
 *   objectives: [{ type, pieceType?, target, label }],
 *   pieceTypes: string[],
 *   blockers: [{ row, col, blocker: { type, hp? } }],
 *   starThresholds: [bronzeScore, silverScore, goldScore],
 *   seed: string
 * }
 */
(function (global) {
  'use strict';

  const { WORLDS, PIECE_TYPES, OBJECTIVE_TYPES, GRID } = global.FM_CONST;

  const COLLECT_LABELS = {
    bible: 'Collect Bibles',
    cross: 'Collect Crosses',
    fish: 'Collect Fish',
    lamp: 'Collect Lamps',
    scroll: 'Collect Scrolls',
    bread: 'Collect Bread',
    grapes: 'Collect Grapes',
    dove: 'Collect Doves'
  };

  function getWorldForLevel(levelId) {
    return WORLDS.find((w) => levelId >= w.startLevelId && levelId <= w.endLevelId) || WORLDS[WORLDS.length - 1];
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  /**
   * Chooses how many distinct base piece types are in play. Early levels
   * use fewer types (easier to spot matches); the full 8-type roster
   * unlocks by roughly a third of the way through the campaign.
   */
  function pieceTypeCountForDifficulty(globalDifficulty) {
    if (globalDifficulty < 0.08) return 5;
    if (globalDifficulty < 0.18) return 6;
    if (globalDifficulty < 0.32) return 7;
    return 8;
  }

  function pickPieceTypes(rng, count) {
    return rng.shuffle(PIECE_TYPES).slice(0, count);
  }

  /**
   * Places blocker cells for BREAK_STONE / CLEAR_FOG objectives, spread
   * out so no single row/column gets fully locked (which could make the
   * board unsolvable before Board.generate()'s own deadlock-guard runs).
   */
  function placeBlockers(rng, count, blockerType) {
    const cells = [];
    const used = new Set();
    let guard = 0;
    while (cells.length < count && guard < count * 20) {
      guard++;
      const row = rng.intBetween(0, GRID.ROWS - 1);
      const col = rng.intBetween(0, GRID.COLS - 1);
      const key = row + ',' + col;
      if (used.has(key)) continue;
      // Never fully block the outer edge columns/rows two cells deep in a
      // single band — keeps the board playable for gravity/refill.
      used.add(key);
      cells.push({
        row,
        col,
        blocker: blockerType === 'stone' ? { type: 'stone', hp: 2 } : { type: 'fog' }
      });
    }
    return cells;
  }

  /**
   * Cycles through objective "templates" across a world's levels so the
   * campaign has variety and a gentle onboarding curve: early levels are
   * simple score/collect goals; blockers (and dual objectives) phase in
   * as the player progresses.
   */
  function chooseObjectiveTemplate(levelId, indexInWorld, globalDifficulty, rng) {
    const cyclePos = ((indexInWorld - 1) % 5) + 1;
    const blockersUnlocked = levelId > 6; // ease the player in before introducing blockers

    if (cyclePos === 3 && blockersUnlocked) return 'break_stone';
    if (cyclePos === 4 && blockersUnlocked) return 'clear_fog';
    if (cyclePos === 5 && globalDifficulty > 0.15) return 'dual';
    if (cyclePos === 2) return 'collect';
    return 'score';
  }

  function scoreTarget(globalDifficulty, rng) {
    const base = 700 + globalDifficulty * 4200;
    const jitter = rng.intBetween(-80, 120);
    return Math.round((base + jitter) / 10) * 10;
  }

  function collectTarget(globalDifficulty, rng) {
    const base = 10 + globalDifficulty * 20;
    return Math.round(base + rng.intBetween(-1, 2));
  }

  function blockerTarget(globalDifficulty, rng) {
    const base = 3 + globalDifficulty * 11;
    return clamp(Math.round(base + rng.intBetween(-1, 1)), 3, 16);
  }

  function moveLimitFor(globalDifficulty, rng) {
    const base = 28 - globalDifficulty * 11;
    return clamp(Math.round(base + rng.intBetween(-1, 1)), 15, 28);
  }

  function timeLimitFor(globalDifficulty, rng) {
    const base = 95 - globalDifficulty * 35;
    return clamp(Math.round(base + rng.intBetween(-4, 4)), 45, 95);
  }

  function buildObjectives(template, globalDifficulty, rng, pieceTypes) {
    const objectives = [];
    if (template === 'score') {
      objectives.push({ type: OBJECTIVE_TYPES.SCORE, target: scoreTarget(globalDifficulty, rng), label: 'Reach Score' });
    } else if (template === 'collect') {
      const preferred = ['bread', 'scroll'].filter((t) => pieceTypes.includes(t));
      const pieceType = preferred.length && rng.next() < 0.5 ? rng.pick(preferred) : rng.pick(pieceTypes);
      objectives.push({
        type: OBJECTIVE_TYPES.COLLECT,
        pieceType,
        target: collectTarget(globalDifficulty, rng),
        label: COLLECT_LABELS[pieceType]
      });
    } else if (template === 'break_stone') {
      objectives.push({ type: OBJECTIVE_TYPES.BREAK_STONE, target: blockerTarget(globalDifficulty, rng), label: 'Break Stones' });
    } else if (template === 'clear_fog') {
      objectives.push({ type: OBJECTIVE_TYPES.CLEAR_FOG, target: blockerTarget(globalDifficulty, rng), label: 'Clear Fog' });
    } else if (template === 'dual') {
      const pieceType = rng.pick(pieceTypes);
      objectives.push({
        type: OBJECTIVE_TYPES.COLLECT,
        pieceType,
        target: Math.max(6, Math.round(collectTarget(globalDifficulty, rng) * 0.6)),
        label: COLLECT_LABELS[pieceType]
      });
      objectives.push({
        type: OBJECTIVE_TYPES.SCORE,
        target: Math.round(scoreTarget(globalDifficulty, rng) * 0.75),
        label: 'Reach Score'
      });
    }
    return objectives;
  }

  function generateLevelConfig(levelId) {
    const world = getWorldForLevel(levelId);
    const indexInWorld = levelId - world.startLevelId + 1;
    const globalDifficulty = clamp((levelId - 1) / (global.FM_CONST.TOTAL_LEVEL_COUNT - 1), 0, 1);
    const rng = new global.RNG(`level-${levelId}`);

    const pieceTypeCount = pieceTypeCountForDifficulty(globalDifficulty);
    const pieceTypes = pickPieceTypes(rng, pieceTypeCount);

    const template = chooseObjectiveTemplate(levelId, indexInWorld, globalDifficulty, rng);
    const objectives = buildObjectives(template, globalDifficulty, rng, pieceTypes);

    let blockers = [];
    objectives.forEach((obj) => {
      if (obj.type === OBJECTIVE_TYPES.BREAK_STONE) blockers = blockers.concat(placeBlockers(rng, obj.target, 'stone'));
      if (obj.type === OBJECTIVE_TYPES.CLEAR_FOG) blockers = blockers.concat(placeBlockers(rng, obj.target, 'fog'));
    });

    const isTimedLevel = indexInWorld % 6 === 0;
    const resourceType = isTimedLevel ? 'time' : 'moves';

    const baseScoreTarget = objectives.find((o) => o.type === OBJECTIVE_TYPES.SCORE);
    const starBase = baseScoreTarget ? baseScoreTarget.target : scoreTarget(globalDifficulty, rng);
    const starThresholds = [starBase, Math.round(starBase * 1.4), Math.round(starBase * 1.85)];

    return {
      id: levelId,
      worldId: world.id,
      worldName: world.name,
      worldTheme: world.theme,
      indexInWorld,
      rows: GRID.ROWS,
      cols: GRID.COLS,
      resourceType,
      moveLimit: resourceType === 'moves' ? moveLimitFor(globalDifficulty, rng) : null,
      timeLimit: resourceType === 'time' ? timeLimitFor(globalDifficulty, rng) : null,
      objectives,
      pieceTypes,
      blockers,
      starThresholds,
      globalDifficulty,
      seed: `level-${levelId}-board`
    };
  }

  global.LevelGenerator = { generateLevelConfig, getWorldForLevel };
})(window);
