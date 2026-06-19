import type { BibleNode } from '@/types/bible';

export const PLACES: BibleNode[] = [
  // ── Creation / Early Humanity ─────────────────────────────────────────────
  {
    id: 'garden-of-eden', label: 'Garden of Eden', type: 'place', eraId: 'creation',
    offsetX: 0, offsetY: -70,
    description: 'Paradise where God walked with humanity in unbroken fellowship. Its loss through the Fall sets the entire biblical drama in motion — and its restoration is the final promise of Revelation.',
    verses: ['Gen 2:8-15', 'Gen 3:23-24', 'Rev 22:1-3'],
    tags: ['paradise', 'fall', 'tree of life', 'restoration'],
    isKeyNode: true,
  },
  {
    id: 'babel', label: 'Tower of Babel', type: 'place', eraId: 'early-humanity',
    offsetX: 60, offsetY: -60,
    description: 'Where humanity\'s pride reached heaven and God scattered the nations by confusing their language — directly reversed at Pentecost when every tongue heard the gospel.',
    verses: ['Gen 11:1-9', 'Acts 2:5-11'],
    tags: ['pride', 'judgment', 'nations', 'Pentecost reversal'],
  },

  // ── Patriarchs ────────────────────────────────────────────────────────────
  {
    id: 'ur-of-chaldees', label: 'Ur of the Chaldeans', type: 'place', eraId: 'patriarchs',
    offsetX: -90, offsetY: -60,
    description: 'Abraham\'s birthplace — a great civilization that God called him to leave behind in an act of radical faith. The beginning of the covenant journey.',
    verses: ['Gen 11:31', 'Gen 15:7', 'Acts 7:2-4', 'Heb 11:8'],
    tags: ['Abraham', 'call', 'departure', 'faith'],
  },
  {
    id: 'canaan', label: 'Canaan / Promised Land', type: 'place', eraId: 'patriarchs',
    offsetX: 120, offsetY: -30,
    description: 'The land God swore to Abraham, Isaac, and Jacob — a foretaste of the eternal inheritance awaiting all who trust God\'s promises.',
    verses: ['Gen 12:7', 'Gen 17:8', 'Heb 11:9-10', 'Heb 11:13-16'],
    tags: ['promise', 'inheritance', 'covenant', 'land'],
    isKeyNode: true,
  },

  // ── Exodus & Law ──────────────────────────────────────────────────────────
  {
    id: 'egypt', label: 'Egypt', type: 'place', eraId: 'exodus',
    offsetX: -80, offsetY: 70,
    description: 'House of bondage from which God redeemed His people with a mighty hand and outstretched arm. Egypt is the Bible\'s great symbol of the world-system enslaving humanity.',
    verses: ['Exod 1:8-14', 'Exod 12:51', 'Hos 11:1', 'Matt 2:15'],
    tags: ['slavery', 'exodus', 'redemption', 'world-system'],
    isKeyNode: true,
  },
  {
    id: 'sinai', label: 'Mount Sinai', type: 'place', eraId: 'exodus',
    offsetX: 80, offsetY: 60,
    description: 'The mountain of God where the Law was given in fire and thunder. Israel met the holy God and trembled; the New Covenant replaces Sinai\'s terror with Zion\'s grace.',
    verses: ['Exod 19:16-20', 'Exod 20:1-17', 'Gal 4:24-25', 'Heb 12:18-24'],
    tags: ['law', 'covenant', 'ten commandments', 'holiness'],
    isKeyNode: true,
  },

  // ── Conquest ──────────────────────────────────────────────────────────────
  {
    id: 'jericho', label: 'Jericho', type: 'place', eraId: 'conquest',
    offsetX: -70, offsetY: 60,
    description: 'The first city conquered in Canaan — its walls fell not by military might but by faith and obedience. A declaration that the battle belongs to the Lord.',
    verses: ['Josh 6:1-27', 'Heb 11:30'],
    tags: ['conquest', 'faith', 'miracle', 'walls'],
  },
  {
    id: 'jerusalem', label: 'Jerusalem', type: 'place', eraId: 'kingdom',
    offsetX: 0, offsetY: -80,
    description: 'The city of the Great King — David\'s capital, Solomon\'s temple, the cross, the empty tomb, Pentecost, and the New Jerusalem to come. No city carries more weight in all of Scripture.',
    verses: ['2 Sam 5:7', 'Ps 48:1-2', 'Luke 13:33-34', 'Rev 21:2'],
    tags: ['holy city', 'temple', 'cross', 'resurrection', 'new Jerusalem'],
    isKeyNode: true,
  },

  // ── Divided Kingdom ───────────────────────────────────────────────────────
  {
    id: 'babylon', label: 'Babylon', type: 'place', eraId: 'exile',
    offsetX: -60, offsetY: 60,
    description: 'The empire of exile that swallowed Judah and became the Bible\'s supreme symbol of human pride, godless empire, and all that opposes God\'s Kingdom.',
    verses: ['2 Kings 25:1-12', 'Dan 1:1-6', 'Rev 17:5', 'Rev 18:2'],
    tags: ['exile', 'empire', 'judgment', 'Babylon the Great'],
    isKeyNode: true,
  },

  // ── Life of Christ ────────────────────────────────────────────────────────
  {
    id: 'bethlehem', label: 'Bethlehem', type: 'place', eraId: 'life-of-christ',
    offsetX: -80, offsetY: 60,
    description: 'The city of David where the eternal King was born in a manger. Micah prophesied it 700 years before — out of small Bethlehem came one whose goings forth are from eternity.',
    verses: ['Mic 5:2', 'Matt 2:1-6', 'Luke 2:4-7'],
    tags: ['nativity', 'incarnation', 'prophecy fulfilled', 'David'],
  },
  {
    id: 'nazareth', label: 'Nazareth', type: 'place', eraId: 'life-of-christ',
    offsetX: 70, offsetY: 80,
    description: 'Where Jesus grew to manhood — "Can anything good come out of Nazareth?" God\'s ways confound the proud, and the Messiah came from this despised Galilean village.',
    verses: ['Luke 2:51-52', 'Luke 4:16-21', 'John 1:46'],
    tags: ['childhood', 'humility', 'Galilee'],
  },
  {
    id: 'calvary', label: 'Golgotha / Calvary', type: 'place', eraId: 'life-of-christ',
    offsetX: 0, offsetY: 100,
    description: 'The Place of the Skull where the Son of God was crucified — the intersection of human sin and divine love. The cross at Calvary is the axis of all history.',
    verses: ['Matt 27:33-54', 'John 19:17-30', 'Col 2:13-15'],
    tags: ['cross', 'atonement', 'crucifixion', 'sacrifice'],
    isKeyNode: true,
  },

  // ── Early Church ──────────────────────────────────────────────────────────
  {
    id: 'antioch', label: 'Antioch', type: 'place', eraId: 'early-church',
    offsetX: -90, offsetY: -70,
    description: 'Where believers were first called Christians and where the Holy Spirit commissioned the first missionary journey. Antioch became the launching pad of Gentile Christianity.',
    verses: ['Acts 11:26', 'Acts 13:1-3'],
    tags: ['missionary', 'Gentiles', 'church', "Paul's journeys"],
  },
  {
    id: 'rome', label: 'Rome', type: 'place', eraId: 'early-church',
    offsetX: 100, offsetY: -80,
    description: 'The seat of the empire Paul addressed in his masterwork epistle and finally reached in chains — the gospel marching from Jerusalem to the center of world power.',
    verses: ['Acts 28:14-31', 'Rom 1:7-17'],
    tags: ['empire', 'gospel', 'Paul', 'epistle'],
  },
];
