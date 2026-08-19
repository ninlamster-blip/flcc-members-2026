/* =============================================================================
   THE PUZZLE BANK — ten hard 6x6 Bible crosswords.
   -----------------------------------------------------------------------------
   GENERATED FILE. Do not hand-edit: run

     node scripts/build-crossword-puzzles.mjs

   Each puzzle is stored as its solved grid — '#' is a blocked cell, every other
   character is the answer letter that belongs there. js/engine.js derives the
   blocks, the numbering and the across/down entries from this, and looks every
   entry up in js/answers.js for its clue, hint, Scripture reference and
   explanation. That is why a puzzle carries no clue text of its own: there is
   exactly one place a Bible fact can enter this game.

   Answers of four letters and up appear in exactly one puzzle. Three-letter
   answers may serve twice — a grid this small needs connecting tissue, and
   Scripture only offers so many defensible three-letter words.
   ========================================================================== */

export const PUZZLES = [
  {
    id: 'flcc-hard-001',
    category: 'Lesser-Known People',
    difficulty: 'Hard',
    grid: [
      'PHOEBE',
      '#E#L#L',
      'ANNA#O',
      'N#AMON',
      'A#R#N#',
      'KIDRON',
    ],
  },
  {
    id: 'flcc-hard-002',
    category: 'Kings & Kingdoms',
    difficulty: 'Hard',
    grid: [
      'E#AHAZ',
      'T#D#S#',
      'A#AGAG',
      'MARA#O',
      '#R#T#A',
      'ADAH#D',
    ],
  },
  {
    id: 'flcc-hard-003',
    category: 'Bible Geography',
    difficulty: 'Hard',
    grid: [
      'E##HAM',
      'MITE#O',
      'M##NER',
      'ARD##I',
      'U#ARBA',
      'SIN##H',
    ],
  },
  {
    id: 'flcc-hard-004',
    category: 'Prophets',
    difficulty: 'Hard',
    grid: [
      'GAD#S#',
      '#HAMAN',
      'SIN#L#',
      '#J#NOB',
      'NAHUM#',
      '#H#NER',
    ],
  },
  {
    id: 'flcc-hard-005',
    category: 'Women of the Bible',
    difficulty: 'Hard',
    grid: [
      'EUODIA',
      '##D##W',
      '##ELUL',
      'IDDO##',
      'R##I##',
      'ACHSAH',
    ],
  },
  {
    id: 'flcc-hard-006',
    category: 'Objects & Symbols',
    difficulty: 'Hard',
    grid: [
      'CARMEL',
      '#M###O',
      '#O#ROD',
      'ASA#M#',
      'W###E#',
      'LYSTRA',
    ],
  },
  {
    id: 'flcc-hard-007',
    category: 'Places & Cities',
    difficulty: 'Hard',
    grid: [
      'GOSHEN',
      '#N###A',
      'COS##I',
      'A##ZIN',
      'N###R#',
      'AENEAS',
    ],
  },
  {
    id: 'flcc-hard-008',
    category: 'New Testament',
    difficulty: 'Hard',
    grid: [
      'NYMPHA',
      'O#Y###',
      'B#ROD#',
      '#HAM#A',
      '###R#X',
      'LEVITE',
    ],
  },
  {
    id: 'flcc-hard-009',
    category: 'Old Testament',
    difficulty: 'Hard',
    grid: [
      '#ORPAH',
      'A##U##',
      'X#JAEL',
      'ELAH#U',
      '##I##Z',
      'BARAK#',
    ],
  },
  {
    id: 'flcc-hard-010',
    category: 'Bible History',
    difficulty: 'Hard',
    grid: [
      '#TONGS',
      'R#N###',
      'EBAL#L',
      'U#NEBO',
      '###H#D',
      'LYDIA#',
    ],
  },
];
