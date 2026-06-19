import type { BibleNode } from '@/types/bible';

export const PROPHECIES: BibleNode[] = [
  {
    id: 'proto-evangelium', label: 'Seed of the Woman', type: 'prophecy', eraId: 'creation',
    offsetX: -60, offsetY: -80,
    description: 'The first gospel — God\'s promise in Eden that the seed of the woman will crush the serpent\'s head. Every subsequent prophecy unfolds this one seed planted in Genesis 3:15.',
    verses: ['Gen 3:15', 'Gal 4:4', 'Rev 12:9'],
    tags: ['protoevangelium', 'Messiah', 'serpent', 'seed', 'first gospel'],
    isKeyNode: true,
  },
  {
    id: 'abrahamic-seed', label: "Abraham's Seed", type: 'prophecy', eraId: 'patriarchs',
    offsetX: -120, offsetY: 60,
    description: '"In your seed all nations of the earth shall be blessed" — the Abrahamic covenant culminating in Jesus Christ in whom Jew and Gentile alike become heirs of the promise.',
    verses: ['Gen 22:18', 'Gal 3:16', 'Gal 3:29'],
    tags: ['Abrahamic covenant', 'seed', 'Gentiles', 'nations', 'blessing'],
  },
  {
    id: 'virgin-birth-prophecy', label: 'Born of a Virgin', type: 'prophecy', eraId: 'divided-kingdom',
    offsetX: -90, offsetY: 70,
    description: 'Isaiah\'s sign to Ahaz: "Behold, the virgin shall conceive and bear a son, and shall call his name Immanuel" — fulfilled 700 years later in Bethlehem.',
    verses: ['Isa 7:14', 'Matt 1:18-23'],
    tags: ['virgin birth', 'Immanuel', 'Isaiah', 'incarnation', 'sign'],
    isKeyNode: true,
  },
  {
    id: 'suffering-servant', label: 'Suffering Servant', type: 'prophecy', eraId: 'divided-kingdom',
    offsetX: -110, offsetY: -60,
    description: 'Isaiah 53 — history\'s most precise pre-written account of the cross: despised, rejected, pierced for our transgressions, bearing the iniquity of us all. Written 700 years before Calvary.',
    verses: ['Isa 53:1-12', 'Acts 8:32-35', '1 Pet 2:24'],
    tags: ['atonement', 'cross', 'substitution', 'fulfillment', 'Isaiah'],
    isKeyNode: true,
  },
  {
    id: 'seventy-weeks', label: "Daniel's 70 Weeks", type: 'prophecy', eraId: 'exile',
    offsetX: -60, offsetY: -80,
    description: 'Gabriel\'s countdown to Messiah: 69 weeks of years from the decree to rebuild Jerusalem to the coming of "Messiah the Prince" — a timeline pointing precisely to Jesus\' triumphal entry.',
    verses: ['Dan 9:24-27', 'Luke 19:42'],
    tags: ['apocalyptic', 'timeline', 'Messiah', 'decree', '483 years'],
    isKeyNode: true,
  },
  {
    id: 'new-covenant', label: 'The New Covenant', type: 'prophecy', eraId: 'divided-kingdom',
    offsetX: 110, offsetY: 70,
    description: 'Jeremiah\'s radical promise: not a law written on stone but on hearts, full forgiveness of sin, and direct knowledge of God — inaugurated by Jesus at the Last Supper in His own blood.',
    verses: ['Jer 31:31-34', 'Heb 8:8-12', 'Luke 22:20', '2 Cor 3:6'],
    tags: ['new covenant', 'forgiveness', 'heart', 'Jeremiah', 'fulfillment'],
    isKeyNode: true,
  },
  {
    id: 'second-coming-prophecy', label: 'Return of the King', type: 'prophecy', eraId: 'revelation',
    offsetX: -70, offsetY: 60,
    description: '"Every eye will see Him" — the climax of biblical prophecy. The same Jesus who ascended in clouds will return visibly, gloriously, and finally as King of Kings and Lord of Lords.',
    verses: ['Zech 14:4', 'Matt 24:30', 'Rev 19:11-16', 'Acts 1:11'],
    tags: ['second coming', 'parousia', 'King of Kings', 'judgment', 'glory'],
    isKeyNode: true,
  },
];
