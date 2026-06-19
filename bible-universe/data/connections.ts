import type { BibleConnection } from '@/types/bible';

export const CONNECTIONS: BibleConnection[] = [

  // ── FLOW: narrative backbone ───────────────────────────────────────────────

  // Creation arc
  { id: 'fl-creation-fall',      fromId: 'creation-event',    toId: 'the-fall',           type: 'flow', weight: 2 },
  { id: 'fl-fall-flood',         fromId: 'the-fall',          toId: 'the-flood',          type: 'flow', weight: 2 },
  { id: 'fl-flood-noah',         fromId: 'the-flood',         toId: 'noah',               type: 'flow', weight: 1 },
  { id: 'fl-noah-abraham',       fromId: 'noah',              toId: 'abraham',            type: 'flow', weight: 2 },

  // Patriarchs → Exodus
  { id: 'fl-joseph-egypt',       fromId: 'joseph',            toId: 'egypt',              type: 'flow', weight: 1 },
  { id: 'fl-egypt-moses',        fromId: 'egypt',             toId: 'moses',              type: 'flow', weight: 2 },
  { id: 'fl-moses-passover',     fromId: 'moses',             toId: 'the-passover',       type: 'flow', weight: 2 },
  { id: 'fl-passover-exodus',    fromId: 'the-passover',      toId: 'the-exodus',         type: 'flow', weight: 2 },
  { id: 'fl-exodus-sinai',       fromId: 'the-exodus',        toId: 'sinai',              type: 'flow', weight: 1 },
  { id: 'fl-sinai-law',          fromId: 'sinai',             toId: 'ten-commandments',   type: 'flow', weight: 1 },
  { id: 'fl-sinai-tabernacle',   fromId: 'sinai',             toId: 'tabernacle',         type: 'flow', weight: 1 },

  // Exodus → Conquest
  { id: 'fl-moses-joshua',       fromId: 'moses',             toId: 'joshua',             type: 'flow', weight: 2 },
  { id: 'fl-joshua-jericho',     fromId: 'joshua',            toId: 'jericho',            type: 'flow', weight: 1 },
  { id: 'fl-joshua-samuel',      fromId: 'joshua',            toId: 'samuel',             type: 'flow', weight: 1 },

  // Conquest → Kingdom
  { id: 'fl-samuel-david',       fromId: 'samuel',            toId: 'david',              type: 'flow', weight: 2 },
  { id: 'fl-david-covenant',     fromId: 'david',             toId: 'davidic-covenant',   type: 'flow', weight: 1 },
  { id: 'fl-david-temple',       fromId: 'david',             toId: 'temple-built',       type: 'flow', weight: 1 },

  // Kingdom → Divided Kingdom
  { id: 'fl-solomon-divided',    fromId: 'solomon',           toId: 'kingdom-divided',    type: 'flow', weight: 1 },
  { id: 'fl-divided-elijah',     fromId: 'kingdom-divided',   toId: 'elijah',             type: 'flow', weight: 1 },
  { id: 'fl-elijah-isaiah',      fromId: 'elijah',            toId: 'isaiah',             type: 'flow', weight: 1 },
  { id: 'fl-isaiah-jeremiah',    fromId: 'isaiah',            toId: 'jeremiah',           type: 'flow', weight: 1 },

  // Divided Kingdom → Exile
  { id: 'fl-jeremiah-fall',      fromId: 'jeremiah',          toId: 'fall-of-jerusalem',  type: 'flow', weight: 2 },
  { id: 'fl-fall-babylon',       fromId: 'fall-of-jerusalem', toId: 'babylon',            type: 'flow', weight: 1 },
  { id: 'fl-babylon-daniel',     fromId: 'babylon',           toId: 'daniel',             type: 'flow', weight: 1 },
  { id: 'fl-babylon-ezekiel',    fromId: 'babylon',           toId: 'ezekiel',            type: 'flow', weight: 1 },

  // Exile → Restoration
  { id: 'fl-daniel-ezra',        fromId: 'daniel',            toId: 'ezra',               type: 'flow', weight: 1 },
  { id: 'fl-ezra-nehemiah',      fromId: 'ezra',              toId: 'nehemiah',           type: 'flow', weight: 1 },
  { id: 'fl-ezra-esther',        fromId: 'ezra',              toId: 'esther',             type: 'flow', weight: 1 },

  // Restoration → Life of Christ (long gap through intertestamental)
  { id: 'fl-nehemiah-johnbap',   fromId: 'nehemiah',          toId: 'john-the-baptist',   type: 'flow', weight: 1 },
  { id: 'fl-johnbap-jesus',      fromId: 'john-the-baptist',  toId: 'jesus',              type: 'flow', weight: 3, scriptureRef: 'John 1:29' },

  // Life of Christ
  { id: 'fl-incarnation-baptism',fromId: 'incarnation',       toId: 'baptism-of-jesus',   type: 'flow', weight: 1 },
  { id: 'fl-baptism-crucifixion',fromId: 'baptism-of-jesus',  toId: 'crucifixion',        type: 'flow', weight: 2 },
  { id: 'fl-crucifixion-res',    fromId: 'crucifixion',       toId: 'resurrection',       type: 'flow', weight: 3, scriptureRef: '1 Cor 15:3-4' },

  // Early Church
  { id: 'fl-res-pentecost',      fromId: 'resurrection',      toId: 'pentecost',          type: 'flow', weight: 3 },
  { id: 'fl-pentecost-peter',    fromId: 'pentecost',         toId: 'peter',              type: 'flow', weight: 2 },
  { id: 'fl-pentecost-stephen',  fromId: 'pentecost',         toId: 'stephen',            type: 'flow', weight: 1 },
  { id: 'fl-stephen-paul',       fromId: 'stephen',           toId: 'paul',               type: 'flow', weight: 1, scriptureRef: 'Acts 8:1' },
  { id: 'fl-conversion-paul',    fromId: 'pauls-conversion',  toId: 'paul',               type: 'flow', weight: 2 },
  { id: 'fl-paul-antioch',       fromId: 'paul',              toId: 'antioch',            type: 'flow', weight: 1 },
  { id: 'fl-paul-rome',          fromId: 'paul',              toId: 'rome',               type: 'flow', weight: 1 },
  { id: 'fl-paul-john',          fromId: 'paul',              toId: 'john-apostle',       type: 'flow', weight: 1 },

  // ── PROPHECY: OT → NT rainbow arcs ────────────────────────────────────────

  { id: 'pr-protoevangelium',    fromId: 'proto-evangelium',  toId: 'jesus',              type: 'prophecy', weight: 3, label: 'Seed of the Woman',   scriptureRef: 'Gen 3:15 → Gal 4:4' },
  { id: 'pr-abrahamic-seed',     fromId: 'abrahamic-seed',    toId: 'jesus',              type: 'prophecy', weight: 2, label: "Abraham's Seed",       scriptureRef: 'Gen 22:18 → Gal 3:16' },
  { id: 'pr-virgin-birth',       fromId: 'virgin-birth-prophecy', toId: 'incarnation',   type: 'prophecy', weight: 2, label: 'Born of a Virgin',     scriptureRef: 'Isa 7:14 → Matt 1:23' },
  { id: 'pr-suffering-servant',  fromId: 'suffering-servant', toId: 'crucifixion',        type: 'prophecy', weight: 3, label: 'Suffering Servant',    scriptureRef: 'Isa 53 → Matt 27' },
  { id: 'pr-seventy-weeks',      fromId: 'seventy-weeks',     toId: 'jesus',              type: 'prophecy', weight: 2, label: "Daniel's 70 Weeks",    scriptureRef: 'Dan 9:25 → Luke 19:42' },
  { id: 'pr-davidic-covenant',   fromId: 'davidic-covenant',  toId: 'jesus',              type: 'prophecy', weight: 2, label: 'Son of David',         scriptureRef: '2 Sam 7:12 → Luke 1:32' },
  { id: 'pr-new-covenant',       fromId: 'new-covenant',      toId: 'jesus',              type: 'prophecy', weight: 2, label: 'New Covenant',         scriptureRef: 'Jer 31:31 → Luke 22:20' },
  { id: 'pr-second-coming',      fromId: 'second-coming-prophecy', toId: 'jesus',         type: 'prophecy', weight: 1, label: 'Return of the King',  scriptureRef: 'Zech 14:4 → Rev 19:11' },

  // ── FAMILY: genealogical links ─────────────────────────────────────────────

  { id: 'fm-adam-eve',           fromId: 'adam',              toId: 'eve',                type: 'family', weight: 1 },
  { id: 'fm-adam-noah',          fromId: 'adam',              toId: 'noah',               type: 'family', weight: 1, scriptureRef: 'Gen 5 genealogy' },
  { id: 'fm-abraham-isaac',      fromId: 'abraham',           toId: 'isaac',              type: 'family', weight: 2, scriptureRef: 'Gen 21:1-7' },
  { id: 'fm-isaac-jacob',        fromId: 'isaac',             toId: 'jacob',              type: 'family', weight: 2, scriptureRef: 'Gen 25:26' },
  { id: 'fm-jacob-joseph',       fromId: 'jacob',             toId: 'joseph',             type: 'family', weight: 2, scriptureRef: 'Gen 37:3' },
  { id: 'fm-david-solomon',      fromId: 'david',             toId: 'solomon',            type: 'family', weight: 2, scriptureRef: '2 Sam 12:24' },
  { id: 'fm-mary-jesus',         fromId: 'mary',              toId: 'jesus',              type: 'family', weight: 3, scriptureRef: 'Luke 1:31' },

  // ── THEME: motifs across eras ──────────────────────────────────────────────

  { id: 'th-eden-canaan',        fromId: 'garden-of-eden',    toId: 'canaan',             type: 'theme', weight: 1, label: 'Paradise Regained' },
  { id: 'th-passover-cross',     fromId: 'the-passover',      toId: 'crucifixion',        type: 'theme', weight: 2, label: 'Lamb Slain',       scriptureRef: '1 Cor 5:7' },
  { id: 'th-tabernacle-temple',  fromId: 'tabernacle',        toId: 'temple-built',       type: 'theme', weight: 1, label: "God's Dwelling" },
  { id: 'th-tabernacle-jesus',   fromId: 'tabernacle',        toId: 'jesus',              type: 'theme', weight: 2, label: 'True Tabernacle',  scriptureRef: 'John 1:14' },
  { id: 'th-isaac-jesus',        fromId: 'isaac',             toId: 'jesus',              type: 'theme', weight: 1, label: 'Son of Sacrifice' },
  { id: 'th-joseph-jesus',       fromId: 'joseph',            toId: 'jesus',              type: 'theme', weight: 1, label: 'Rejected & Exalted' },
  { id: 'th-fall-incarnation',   fromId: 'the-fall',          toId: 'incarnation',        type: 'theme', weight: 1, label: 'Redemption of the Fall' },
  { id: 'th-flood-resurrection', fromId: 'the-flood',         toId: 'resurrection',       type: 'theme', weight: 1, label: 'Through Water to Life', scriptureRef: '1 Pet 3:21' },
  { id: 'th-joshua-jesus',       fromId: 'joshua',            toId: 'jesus',              type: 'theme', weight: 1, label: 'Yeshua who leads to Rest', scriptureRef: 'Heb 4:8' },

  // ── GEOGRAPHY: shared location ─────────────────────────────────────────────

  { id: 'geo-jerusalem-temple',  fromId: 'jerusalem',         toId: 'temple-built',       type: 'geography', weight: 1 },
  { id: 'geo-jerusalem-cross',   fromId: 'jerusalem',         toId: 'crucifixion',        type: 'geography', weight: 1 },
  { id: 'geo-bethlehem-birth',   fromId: 'bethlehem',         toId: 'incarnation',        type: 'geography', weight: 1 },
  { id: 'geo-calvary-cross',     fromId: 'calvary',           toId: 'crucifixion',        type: 'geography', weight: 2 },
  { id: 'geo-sinai-law',         fromId: 'sinai',             toId: 'ten-commandments',   type: 'geography', weight: 1 },
  { id: 'geo-babylon-exile',     fromId: 'babylon',           toId: 'fall-of-jerusalem',  type: 'geography', weight: 1 },
  { id: 'geo-egypt-exodus',      fromId: 'egypt',             toId: 'the-exodus',         type: 'geography', weight: 1 },
  { id: 'geo-antioch-mission',   fromId: 'antioch',           toId: 'pauls-conversion',   type: 'geography', weight: 1 },
];
