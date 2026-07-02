/**
 * Faith Match — global constants shared across the game.
 * Loaded as a plain script (no bundler), so it defines a single
 * global `FM_CONST` namespace object.
 */
(function (global) {
  'use strict';

  const GRID = {
    COLS: 8,
    ROWS: 8,
    TILE_SIZE: 88, // logical px at design resolution, scaled responsively
    BOARD_PADDING: 12
  };

  // Base (non-special) piece types. Each maps to an SVG icon in Assets/icons.
  const PIECE_TYPES = ['bible', 'cross', 'fish', 'lamp', 'scroll', 'bread', 'grapes', 'dove'];

  // Special piece types, created by matching 4/5/L/T shapes.
  const SPECIAL_TYPES = {
    PRAYER_BOMB: 'prayer_bomb', // clears nearby tiles (3x3 radius) — made from L/T match
    LIVING_WATER: 'living_water', // clears entire row — made from horizontal 4-match
    SWORD_OF_SPIRIT: 'sword_of_spirit', // clears entire column — made from vertical 4-match
    PENTECOST_FLAME: 'pentecost_flame', // clears every tile of one type — made from 5-match
    ARMOR_OF_GOD: 'armor_of_god' // explodes surrounding area twice — made by combining two specials
  };

  const PIECE_COLORS = {
    bible: '#2563EB',
    cross: '#DC2626',
    fish: '#0891B2',
    lamp: '#D97706',
    scroll: '#7C3AED',
    bread: '#B45309',
    grapes: '#7E22CE',
    dove: '#64748B'
  };

  const SPECIAL_COLORS = {
    prayer_bomb: '#F59E0B',
    living_water: '#0EA5E9',
    sword_of_spirit: '#DC2626',
    pentecost_flame: '#EA580C',
    armor_of_god: '#1D4ED8'
  };

  const COLORS = {
    BACKGROUND: '#FAFAFA',
    ACCENT: '#2563EB',
    ACCENT_DARK: '#1D4ED8',
    TEXT: '#111827',
    TEXT_MUTED: '#6B7280',
    SURFACE: '#FFFFFF',
    BORDER: '#E5E7EB',
    SUCCESS: '#16A34A',
    WARNING: '#F59E0B',
    DANGER: '#DC2626'
  };

  const WORLDS = [
    { id: 1, name: 'Creation', theme: 'creation', levels: 20 },
    { id: 2, name: 'Noah', theme: 'noah', levels: 20 },
    { id: 3, name: 'Abraham', theme: 'abraham', levels: 20 },
    { id: 4, name: 'Exodus', theme: 'exodus', levels: 20 },
    { id: 5, name: 'Promised Land', theme: 'promised_land', levels: 20 },
    { id: 6, name: 'Kings', theme: 'kings', levels: 20 },
    { id: 7, name: 'Prophets', theme: 'prophets', levels: 20 },
    { id: 8, name: 'Birth of Christ', theme: 'nativity', levels: 20 },
    { id: 9, name: 'Miracles', theme: 'miracles', levels: 20 },
    { id: 10, name: 'Cross', theme: 'cross', levels: 20 },
    { id: 11, name: 'Resurrection', theme: 'resurrection', levels: 20 },
    { id: 12, name: 'Acts', theme: 'acts', levels: 20 },
    { id: 13, name: 'Missionary Journeys', theme: 'missionary', levels: 20 },
    { id: 14, name: 'Revelation', theme: 'revelation', levels: 20 }
  ];

  const TOTAL_LEVELS = WORLDS.reduce((sum, w) => sum + w.levels, 0); // 280 base + bonus below
  const LEVELS_PER_WORLD = 20; // 14 worlds * 20 = 280; +20 bonus levels distributed to reach 300
  const TOTAL_LEVEL_COUNT = 300;

  const OBJECTIVE_TYPES = {
    COLLECT: 'collect', // collect N of a given piece type
    SCORE: 'score', // reach a target score
    MOVES_LIMIT: 'moves_limit', // finish objective within move limit (paired with other objective)
    TIME_LIMIT: 'time_limit', // finish objective within time limit (seconds)
    BREAK_STONE: 'break_stone', // break N blocker tiles
    CLEAR_FOG: 'clear_fog', // clear N fog-covered tiles
    BRING_DOWN: 'bring_down' // bring N special ingredient tiles to bottom row
  };

  const BLOCKER_TYPES = {
    STONE: 'stone', // needs 1 adjacent match to crack, 2 to break
    FOG: 'fog' // covers a tile; cleared when the tile beneath is matched/cleared
  };

  const POWERUP_TYPES = {
    PRAYER: 'prayer', // pre-game booster: start with a random special piece
    EXTRA_MOVES: 'extra_moves',
    HINT: 'hint',
    SHUFFLE: 'shuffle',
    HAMMER: 'hammer', // remove a single tile
    CROSS_BLAST: 'cross_blast' // clear row + column at chosen tile
  };

  const STORAGE_KEY = 'faithMatch.save.v1';

  const EVENTS = {
    MATCH_FOUND: 'match_found',
    CASCADE_STEP: 'cascade_step',
    BOARD_SETTLED: 'board_settled',
    SPECIAL_CREATED: 'special_created',
    SPECIAL_ACTIVATED: 'special_activated',
    OBJECTIVE_UPDATED: 'objective_updated',
    LEVEL_WIN: 'level_win',
    LEVEL_LOSE: 'level_lose',
    MOVES_CHANGED: 'moves_changed',
    SCORE_CHANGED: 'score_changed',
    NO_MOVES: 'no_moves',
    SETTINGS_CHANGED: 'settings_changed',
    SAVE_UPDATED: 'save_updated'
  };

  global.FM_CONST = {
    GRID,
    PIECE_TYPES,
    SPECIAL_TYPES,
    PIECE_COLORS,
    SPECIAL_COLORS,
    COLORS,
    WORLDS,
    LEVELS_PER_WORLD,
    TOTAL_LEVEL_COUNT,
    OBJECTIVE_TYPES,
    BLOCKER_TYPES,
    POWERUP_TYPES,
    STORAGE_KEY,
    EVENTS
  };
})(window);
