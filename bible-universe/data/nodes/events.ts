import type { BibleNode } from '@/types/bible';

export const EVENTS: BibleNode[] = [
  // ── Creation ──────────────────────────────────────────────────────────────
  {
    id: 'creation-event', label: 'Creation', type: 'event', eraId: 'creation',
    offsetX: 0, offsetY: 80,
    description: 'In the beginning God created the heavens and the earth — speaking light, life, and order from nothing. The world was declared "very good" before the Fall corrupted it.',
    verses: ['Gen 1:1-31', 'John 1:1-3', 'Col 1:16'],
    tags: ['creation', 'ex nihilo', 'seven days', 'very good'],
    isKeyNode: true,
  },
  {
    id: 'the-fall', label: 'The Fall', type: 'event', eraId: 'creation',
    offsetX: 50, offsetY: -50,
    description: 'Adam and Eve\'s disobedience unleashed sin and death into God\'s perfect world — but God immediately announced the protoevangelium: the seed of the woman who would crush the serpent.',
    verses: ['Gen 3:1-24', 'Rom 5:12', 'Gen 3:15'],
    tags: ['fall', 'sin', 'death', 'protoevangelium', 'serpent'],
    isKeyNode: true,
  },

  // ── Early Humanity ────────────────────────────────────────────────────────
  {
    id: 'the-flood', label: 'The Flood', type: 'event', eraId: 'early-humanity',
    offsetX: -60, offsetY: 60,
    description: 'God\'s judgment on a world given to evil, and the salvation of Noah\'s family through the ark — a type of baptism and of salvation through Jesus Christ.',
    verses: ['Gen 6:17-22', 'Gen 9:11', '1 Pet 3:20-21', 'Matt 24:37-39'],
    tags: ['judgment', 'salvation', 'ark', 'covenant', 'Noah'],
  },

  // ── Exodus & Law ──────────────────────────────────────────────────────────
  {
    id: 'the-passover', label: 'The Passover', type: 'event', eraId: 'exodus',
    offsetX: -30, offsetY: -70,
    description: 'The night the blood of a spotless lamb on the doorposts saved Israel from the angel of death — the supreme OT type of Jesus, the Lamb of God who takes away the sin of the world.',
    verses: ['Exod 12:1-28', 'John 1:29', '1 Cor 5:7', '1 Pet 1:18-19'],
    tags: ['lamb', 'blood', 'atonement', 'type of Christ', 'Easter'],
    isKeyNode: true,
  },
  {
    id: 'the-exodus', label: 'The Exodus', type: 'event', eraId: 'exodus',
    offsetX: 40, offsetY: -60,
    description: 'Israel\'s miraculous liberation from 400 years of Egyptian slavery — God\'s mighty arm and outstretched hand. The Exodus became the defining event of OT faith, the lens through which all God\'s saving acts are understood.',
    verses: ['Exod 14:1-31', 'Exod 15:1-18', 'Acts 7:36'],
    tags: ['liberation', 'Red Sea', 'deliverance', 'miracles'],
    isKeyNode: true,
  },
  {
    id: 'ten-commandments', label: 'Ten Commandments', type: 'event', eraId: 'exodus',
    offsetX: 100, offsetY: -30,
    description: 'God\'s moral law given at Sinai — ten words that define righteousness, expose sin, and ultimately drive us to the grace of Christ who alone fulfills them perfectly.',
    verses: ['Exod 20:1-17', 'Deut 5:1-21', 'Matt 5:17-18', 'Rom 3:20'],
    tags: ['law', 'Sinai', 'moral law', 'commandments'],
  },
  {
    id: 'tabernacle', label: 'The Tabernacle', type: 'event', eraId: 'exodus',
    offsetX: -100, offsetY: 30,
    description: 'God\'s portable dwelling place in the wilderness — every detail (the altar, the veil, the ark) pointing forward to the one Mediator through whom sinners approach a holy God.',
    verses: ['Exod 25:8-9', 'Heb 8:5', 'Heb 9:1-14', 'John 1:14'],
    tags: ['tabernacle', 'worship', 'type of Christ', 'presence of God'],
  },

  // ── Conquest & Kingdom ────────────────────────────────────────────────────
  {
    id: 'davidic-covenant', label: 'Davidic Covenant', type: 'event', eraId: 'kingdom',
    offsetX: -60, offsetY: -70,
    description: 'God\'s unconditional promise to David: a son on his throne forever. This covenant shapes all Messianic expectation — Jesus is the Son of David who reigns eternally.',
    verses: ['2 Sam 7:12-16', 'Ps 89:3-4', 'Luke 1:32-33', 'Rev 22:16'],
    tags: ['covenant', 'Messiah', 'throne', 'promise', 'eternal king'],
    isKeyNode: true,
  },
  {
    id: 'temple-built', label: "Solomon's Temple", type: 'event', eraId: 'kingdom',
    offsetX: 60, offsetY: -70,
    description: 'The dwelling place of God\'s glory on earth — seven years of Solomon\'s finest work. Its destruction, exile, rebuilding, and ultimate replacement by Jesus himself ("destroy this temple…") define Israel\'s story.',
    verses: ['1 Kings 6:1', '1 Kings 8:10-11', 'Matt 12:6', 'John 2:19-21'],
    tags: ['temple', 'glory', 'presence', 'type of Christ'],
  },

  // ── Divided Kingdom ───────────────────────────────────────────────────────
  {
    id: 'kingdom-divided', label: 'Kingdom Divided', type: 'event', eraId: 'divided-kingdom',
    offsetX: -70, offsetY: 70,
    description: 'After Solomon\'s death the kingdom split into Israel (north) and Judah (south) — a fracture caused by idolatry and pride that would lead to both kingdoms\' eventual destruction.',
    verses: ['1 Kings 12:1-20', 'Ezek 37:15-22'],
    tags: ['Israel', 'Judah', 'split', 'idolatry', 'judgment'],
  },

  // ── Exile ─────────────────────────────────────────────────────────────────
  {
    id: 'fall-of-jerusalem', label: 'Fall of Jerusalem', type: 'event', eraId: 'exile',
    offsetX: 70, offsetY: 70,
    description: 'Nebuchadnezzar destroys Solomon\'s Temple and takes Judah into Babylonian exile — the darkest hour in Israel\'s history, yet even then Jeremiah announces the New Covenant.',
    verses: ['2 Kings 25:1-21', 'Lam 1:1-3', 'Jer 31:31-34'],
    tags: ['destruction', 'temple', 'exile', 'Babylon', 'judgment'],
    isKeyNode: true,
  },

  // ── Life of Christ ────────────────────────────────────────────────────────
  {
    id: 'incarnation', label: 'The Incarnation', type: 'event', eraId: 'life-of-christ',
    offsetX: -50, offsetY: -60,
    description: 'The eternal Word became flesh and dwelt among us — God himself entered human history as a helpless infant. The hinge of the cosmos: eternity stepping into time.',
    verses: ['John 1:14', 'Phil 2:5-8', 'Gal 4:4-5', 'Isa 7:14'],
    tags: ['incarnation', 'virgin birth', 'Emmanuel', 'God with us'],
    isKeyNode: true,
  },
  {
    id: 'baptism-of-jesus', label: "Jesus' Baptism", type: 'event', eraId: 'life-of-christ',
    offsetX: 80, offsetY: -50,
    description: 'The Father speaks from heaven, the Spirit descends as a dove, and the Son is publicly inaugurated — the Trinity visibly present at the launch of the Kingdom\'s invasion.',
    verses: ['Matt 3:13-17', 'Mark 1:9-11', 'John 1:32-34'],
    tags: ['Trinity', 'inauguration', 'baptism', 'Spirit'],
  },
  {
    id: 'crucifixion', label: 'The Crucifixion', type: 'event', eraId: 'life-of-christ',
    offsetX: -30, offsetY: 80,
    description: 'The Son of God poured out His blood for the sins of the world — bearing the wrath, the curse, and the sting of death so that all who believe might live forever.',
    verses: ['Matt 27:45-56', 'Isa 53:4-6', 'Rom 3:24-26', 'Gal 3:13'],
    tags: ['atonement', 'cross', 'sacrifice', 'sin-bearer'],
    isKeyNode: true,
  },
  {
    id: 'resurrection', label: 'The Resurrection', type: 'event', eraId: 'life-of-christ',
    offsetX: 30, offsetY: 90,
    description: 'On the third day God raised Jesus from the dead — the firstfruits of a new creation, the proof that sin is paid for, and the guarantee of every believer\'s future resurrection.',
    verses: ['Matt 28:1-10', '1 Cor 15:3-8', '1 Cor 15:20', 'Rom 1:4'],
    tags: ['resurrection', 'firstfruits', 'new creation', 'victory'],
    isKeyNode: true,
  },

  // ── Early Church ──────────────────────────────────────────────────────────
  {
    id: 'pentecost', label: 'Pentecost', type: 'event', eraId: 'early-church',
    offsetX: -50, offsetY: 70,
    description: 'The Holy Spirit fell on 120 disciples in Jerusalem and 3,000 were saved in a day — the birth of the Church, the reversal of Babel, and the beginning of the final age.',
    verses: ['Acts 2:1-41', 'Joel 2:28-29', 'Ezek 36:27'],
    tags: ['Holy Spirit', 'church birth', 'tongues', 'Joel', 'harvest'],
    isKeyNode: true,
  },
  {
    id: 'pauls-conversion', label: "Paul's Conversion", type: 'event', eraId: 'early-church',
    offsetX: 80, offsetY: 70,
    description: 'Saul the persecutor was struck blind by the risen Christ on the Damascus Road — the most dramatic reversal in church history, and proof that no one is beyond God\'s grace.',
    verses: ['Acts 9:1-19', 'Gal 1:13-16', '1 Tim 1:12-16'],
    tags: ['conversion', 'Damascus', 'grace', 'persecution', 'Paul'],
  },
];
