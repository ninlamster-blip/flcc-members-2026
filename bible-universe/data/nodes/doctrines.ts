import type { BibleNode } from '@/types/bible';

export const DOCTRINES: BibleNode[] = [
  {
    id: 'doctrine-trinity', label: 'The Trinity', type: 'doctrine', eraId: 'life-of-christ',
    offsetX: 100, offsetY: -90,
    description: 'One God in three eternal Persons — Father, Son, and Spirit — co-equal, co-eternal, and co-essential. The Trinity is not a mystery to avoid but the living heart of all Christian worship.',
    verses: ['Matt 28:19', 'John 14:16-17', '2 Cor 13:14', 'Rev 1:4-5'],
    tags: ['Trinity', 'Father', 'Son', 'Spirit', 'Godhead'],
    isKeyNode: true,
  },
  {
    id: 'doctrine-atonement', label: 'Atonement', type: 'doctrine', eraId: 'life-of-christ',
    offsetX: -100, offsetY: -100,
    description: 'Christ died as our substitute — bearing the penalty our sin deserved, satisfying divine justice, and reconciling enemies to God. The atonement is the center of the Christian faith.',
    verses: ['Rom 3:24-26', 'Heb 9:22', '2 Cor 5:21', '1 Pet 3:18'],
    tags: ['substitution', 'redemption', 'reconciliation', 'propitiation'],
    isKeyNode: true,
  },
  {
    id: 'doctrine-grace', label: 'Grace', type: 'doctrine', eraId: 'early-church',
    offsetX: -60, offsetY: -90,
    description: 'God\'s unmerited favor — salvation given freely to those who deserve judgment. Grace cannot be earned, bartered, or lost; it is the very character of God poured out in Christ.',
    verses: ['Eph 2:8-9', 'Tit 2:11', 'Rom 5:20-21', 'John 1:16-17'],
    tags: ['salvation', 'faith', 'unmerited', 'election', 'gift'],
    isKeyNode: true,
  },
  {
    id: 'doctrine-resurrection-hope', label: 'Resurrection', type: 'doctrine', eraId: 'early-church',
    offsetX: 60, offsetY: -90,
    description: 'Bodily resurrection is not optional for Christianity — it is its very foundation. Christ\'s resurrection is the firstfruits guaranteeing that every believer will rise to immortal, glorified life.',
    verses: ['1 Cor 15:12-22', '1 Cor 15:42-44', 'Rom 8:11', 'John 11:25-26'],
    tags: ['resurrection', 'immortality', 'new creation', 'firstfruits', 'hope'],
    isKeyNode: true,
  },
  {
    id: 'doctrine-kingdom', label: 'Kingdom of God', type: 'doctrine', eraId: 'life-of-christ',
    offsetX: 110, offsetY: 90,
    description: 'God\'s sovereign reign — already inaugurated in Jesus\' first coming ("the Kingdom of God is at hand") yet still awaited in full ("Thy Kingdom come"). Christians live in the "already and not yet."',
    verses: ['Mark 1:15', 'Luke 17:20-21', 'Matt 6:10', 'Rev 11:15'],
    tags: ['Kingdom', 'already not yet', 'reign', 'eschatology', 'shalom'],
  },
  {
    id: 'doctrine-covenant', label: 'Covenant Theology', type: 'doctrine', eraId: 'patriarchs',
    offsetX: -130, offsetY: -50,
    description: 'The Bible is a covenantal book — God consistently initiates binding, gracious commitments to His people. From Noahic to Abrahamic to Mosaic to Davidic to New, each covenant builds toward Christ.',
    verses: ['Heb 8:6', 'Gen 9:11', 'Gen 17:7', '2 Sam 7:12-13', 'Jer 31:31'],
    tags: ['covenant', 'Noahic', 'Abrahamic', 'Mosaic', 'Davidic', 'New Covenant'],
  },
];
