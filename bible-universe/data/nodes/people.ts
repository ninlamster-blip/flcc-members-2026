import type { BibleNode } from '@/types/bible';

export const PEOPLE: BibleNode[] = [
  // ── Creation ──────────────────────────────────────────────────────────────
  {
    id: 'adam', label: 'Adam', type: 'person', eraId: 'creation',
    offsetX: -85, offsetY: 35,
    description: 'The first man, formed from the dust of the ground and given the breath of life by God. Father of the human race and a type of the Last Adam, Jesus Christ.',
    verses: ['Gen 2:7', 'Rom 5:14', '1 Cor 15:45'],
    tags: ['creation', 'first man', 'fall'],
  },
  {
    id: 'eve', label: 'Eve', type: 'person', eraId: 'creation',
    offsetX: 85, offsetY: 35,
    description: 'The first woman, formed from Adam\'s rib as his perfect counterpart. She bore the first children and is called the mother of all living.',
    verses: ['Gen 2:22', 'Gen 3:20', '2 Cor 11:3'],
    tags: ['creation', 'fall', 'first woman'],
  },

  // ── Early Humanity ────────────────────────────────────────────────────────
  {
    id: 'noah', label: 'Noah', type: 'person', eraId: 'early-humanity',
    offsetX: 0, offsetY: 0,
    description: 'A righteous man who found grace in God\'s eyes, built the ark by faith, and survived the flood that judged the world. A picture of salvation through Christ.',
    verses: ['Gen 6:9', 'Heb 11:7', '1 Pet 3:20-21'],
    tags: ['flood', 'covenant', 'grace', 'faith'],
    isKeyNode: true,
  },

  // ── Patriarchs ────────────────────────────────────────────────────────────
  {
    id: 'abraham', label: 'Abraham', type: 'person', eraId: 'patriarchs',
    offsetX: -10, offsetY: 0,
    description: 'Father of faith. God called him from Ur to Canaan, promising a great nation, a land, and that in his seed all nations would be blessed — fulfilled in Jesus Christ.',
    verses: ['Gen 12:1-3', 'Rom 4:11', 'Gal 3:9', 'Heb 11:8-10'],
    tags: ['covenant', 'faith', 'promise', 'father of faith'],
    isKeyNode: true,
  },
  {
    id: 'isaac', label: 'Isaac', type: 'person', eraId: 'patriarchs',
    offsetX: 80, offsetY: -50,
    description: 'Son of promise, born miraculously to Abraham and Sarah in old age. His near-sacrifice on Mount Moriah is the most powerful foreshadowing of the cross in all Scripture.',
    verses: ['Gen 21:1-7', 'Gen 22', 'Heb 11:17-19', 'Gal 4:28'],
    tags: ['promise', 'sacrifice', 'type of Christ'],
  },
  {
    id: 'jacob', label: 'Jacob / Israel', type: 'person', eraId: 'patriarchs',
    offsetX: 100, offsetY: 45,
    description: 'The wrestler — he strove with God and prevailed. His 12 sons became the 12 tribes of Israel, forming the nation through whom the Messiah would come.',
    verses: ['Gen 25:26', 'Gen 32:28', 'Hos 12:3-4', 'Rom 9:13'],
    tags: ['Israel', '12 tribes', 'wrestling', 'blessing'],
  },
  {
    id: 'joseph', label: 'Joseph', type: 'person', eraId: 'patriarchs',
    offsetX: 60, offsetY: 100,
    description: 'Sold into slavery by his brothers, falsely imprisoned, then raised to second in all Egypt. The most detailed type of Christ in Genesis: rejected, exalted, savior of many.',
    verses: ['Gen 37:3-4', 'Gen 41:41-44', 'Acts 7:9-16', 'Ps 105:17-21'],
    tags: ['type of Christ', 'Egypt', 'suffering', 'exaltation'],
  },

  // ── Exodus & Law ──────────────────────────────────────────────────────────
  {
    id: 'moses', label: 'Moses', type: 'person', eraId: 'exodus',
    offsetX: -10, offsetY: 0,
    description: 'Prophet, lawgiver, and liberator. He led Israel out of 400 years of slavery through mighty signs and received the Law at Sinai. He is the prophet who foretold the Greater Prophet to come.',
    verses: ['Exod 3:10', 'Deut 18:15', 'Acts 7:20-44', 'Heb 3:5-6'],
    tags: ['exodus', 'law', 'prophet', 'deliverer', 'Sinai'],
    isKeyNode: true,
  },
  {
    id: 'aaron', label: 'Aaron', type: 'person', eraId: 'exodus',
    offsetX: 70, offsetY: -55,
    description: 'Moses\'s brother and the first high priest of Israel. His priesthood pointed forward to Jesus, our eternal High Priest after the order of Melchizedek.',
    verses: ['Exod 4:14', 'Lev 8', 'Heb 5:4-5'],
    tags: ['high priest', 'priesthood', 'type of Christ'],
  },

  // ── Conquest & Judges ─────────────────────────────────────────────────────
  {
    id: 'joshua', label: 'Joshua', type: 'person', eraId: 'conquest',
    offsetX: 0, offsetY: 0,
    description: 'Led Israel into the Promised Land after 40 years of wandering. His name (Yeshua) is the Hebrew form of Jesus. He is a type of Christ leading God\'s people into their eternal rest.',
    verses: ['Josh 1:1-9', 'Heb 4:8-9'],
    tags: ['Canaan', 'promised land', 'type of Christ', 'rest'],
    isKeyNode: true,
  },
  {
    id: 'deborah', label: 'Deborah', type: 'person', eraId: 'conquest',
    offsetX: -80, offsetY: -60,
    description: 'Prophet and judge of Israel who led the nation to decisive military victory. A remarkable figure of strength and wisdom in a patriarchal era.',
    verses: ['Judg 4:4-5', 'Judg 5:1-31'],
    tags: ['judge', 'prophet', 'woman of faith'],
  },
  {
    id: 'samson', label: 'Samson', type: 'person', eraId: 'conquest',
    offsetX: 80, offsetY: -60,
    description: 'Judge with supernatural strength from the Spirit. His death — arms outstretched, defeating enemies through his own sacrifice — whispers of the cross.',
    verses: ['Judg 13-16', 'Heb 11:32'],
    tags: ['judge', 'Nazirite', 'strength', 'type of Christ'],
  },
  {
    id: 'samuel', label: 'Samuel', type: 'person', eraId: 'conquest',
    offsetX: 0, offsetY: -100,
    description: 'Last judge, first prophet of the new era. He anointed both Saul and David, bridging the age of judges and the age of kings. A prophet from childhood.',
    verses: ['1 Sam 1-3', 'Acts 3:24', 'Heb 11:32'],
    tags: ['judge', 'prophet', 'anointing'],
  },

  // ── United Kingdom ────────────────────────────────────────────────────────
  {
    id: 'david', label: 'David', type: 'person', eraId: 'kingdom',
    offsetX: -30, offsetY: 0,
    description: 'King, poet, warrior, and man after God\'s own heart. God\'s covenant with David promises an eternal king from his line — fulfilled only in Jesus Christ, the Son of David.',
    verses: ['1 Sam 16:13', '2 Sam 7:12-16', 'Ps 22', 'Luke 1:32-33', 'Rev 22:16'],
    tags: ['king', 'covenant', 'psalms', 'Son of David', 'Messiah'],
    isKeyNode: true,
  },
  {
    id: 'solomon', label: 'Solomon', type: 'person', eraId: 'kingdom',
    offsetX: 80, offsetY: 35,
    description: 'Wisest king who built the Temple and whose reign of peace and prosperity pictures the coming Kingdom of God. His wisdom was surpassed only by one greater than Solomon.',
    verses: ['1 Kings 3:12', '1 Kings 6:1', 'Matt 12:42'],
    tags: ['wisdom', 'temple', 'kingdom', 'peace'],
    isKeyNode: true,
  },

  // ── Divided Kingdom & Prophets ────────────────────────────────────────────
  {
    id: 'elijah', label: 'Elijah', type: 'person', eraId: 'divided-kingdom',
    offsetX: -80, offsetY: 0,
    description: 'The fiery prophet who called Israel back from Baal worship with fire from heaven. He will return before the great Day of the Lord — John the Baptist came in his spirit and power.',
    verses: ['1 Kings 18:36-39', 'Mal 4:5', 'Matt 11:14', 'Luke 1:17'],
    tags: ['prophet', 'fire', 'John the Baptist', 'Elijah to come'],
    isKeyNode: true,
  },
  {
    id: 'isaiah', label: 'Isaiah', type: 'person', eraId: 'divided-kingdom',
    offsetX: 60, offsetY: -60,
    description: '"The evangelical prophet" — foretold the virgin birth, the Suffering Servant, and the new creation with stunning clarity 700 years before their fulfillment in Jesus.',
    verses: ['Isa 7:14', 'Isa 53', 'Isa 61:1-2', 'Luke 4:17-19'],
    tags: ['prophet', 'Messianic', 'Suffering Servant', 'virgin birth'],
    isKeyNode: true,
  },
  {
    id: 'jeremiah', label: 'Jeremiah', type: 'person', eraId: 'divided-kingdom',
    offsetX: 100, offsetY: 65,
    description: 'The weeping prophet who mourned Jerusalem\'s sin and fall, yet announced the greatest OT promise: a New Covenant written not on stone but on human hearts.',
    verses: ['Jer 1:5', 'Jer 31:31-34', 'Heb 8:8-12'],
    tags: ['prophet', 'new covenant', 'suffering', 'judgment'],
  },
  {
    id: 'ezekiel', label: 'Ezekiel', type: 'person', eraId: 'exile',
    offsetX: -60, offsetY: -70,
    description: 'Prophesied to Israel in Babylonian exile with vivid visions — the valley of dry bones, the river from the Temple, the glory of God departing and returning.',
    verses: ['Ezek 1', 'Ezek 36:26-27', 'Ezek 37:1-14', 'Ezek 47'],
    tags: ['prophet', 'exile', 'resurrection', 'new heart', 'visions'],
  },

  // ── Exile ─────────────────────────────────────────────────────────────────
  {
    id: 'daniel', label: 'Daniel', type: 'person', eraId: 'exile',
    offsetX: 20, offsetY: 0,
    description: 'Prophet in Babylon who remained faithful through the lions\' den and received history\'s most precise prophetic timeline: the Seventy Weeks pointing to the coming of Messiah the Prince.',
    verses: ['Dan 1:8', 'Dan 9:24-27', 'Dan 7:13-14', 'Matt 24:15'],
    tags: ['prophet', 'Babylon', 'Messiah', '70 weeks', 'Son of Man'],
    isKeyNode: true,
  },

  // ── Restoration ───────────────────────────────────────────────────────────
  {
    id: 'ezra', label: 'Ezra', type: 'person', eraId: 'restoration',
    offsetX: -60, offsetY: 0,
    description: 'Scribe and priest who led the second wave of exiles back from Babylon, restoring the Law and the worship of God in the rebuilt Jerusalem.',
    verses: ['Ezra 7:10', 'Ezra 9:5-15'],
    tags: ['return', 'scribe', 'law', 'restoration'],
  },
  {
    id: 'nehemiah', label: 'Nehemiah', type: 'person', eraId: 'restoration',
    offsetX: 60, offsetY: 0,
    description: 'Cupbearer to Artaxerxes who led the rebuilding of Jerusalem\'s walls in 52 days against fierce opposition. A model of prayer-fueled leadership.',
    verses: ['Neh 1:4-11', 'Neh 6:15-16'],
    tags: ['return', 'wall', 'leadership', 'prayer', 'restoration'],
  },
  {
    id: 'esther', label: 'Esther', type: 'person', eraId: 'restoration',
    offsetX: 0, offsetY: 80,
    description: 'Courageous Jewish queen who risked her life to save her people from genocide. "For such a time as this" — a picture of providential grace.',
    verses: ['Esth 4:14', 'Esth 8:11-14'],
    tags: ['courage', 'providence', 'woman of faith', 'salvation'],
  },

  // ── Life of Christ ────────────────────────────────────────────────────────
  {
    id: 'mary', label: 'Mary', type: 'person', eraId: 'life-of-christ',
    offsetX: -100, offsetY: -80,
    description: 'Chosen vessel of the incarnation — "Blessed are you among women." By faith she said "Let it be to me according to your word," and the eternal Word became flesh in her womb.',
    verses: ['Luke 1:28-38', 'Isa 7:14', 'Luke 2:19'],
    tags: ['virgin birth', 'incarnation', 'faith', 'mother of Jesus'],
  },
  {
    id: 'john-the-baptist', label: 'John the Baptist', type: 'person', eraId: 'life-of-christ',
    offsetX: -135, offsetY: 45,
    description: 'The voice in the wilderness — the last and greatest OT prophet. He came in the spirit and power of Elijah to prepare the way of the Lord, pointing to the Lamb of God.',
    verses: ['Matt 3:1-3', 'Luke 1:17', 'John 1:29-30', 'Mal 3:1'],
    tags: ['forerunner', 'Elijah', 'baptism', 'Lamb of God', 'prophet'],
  },
  {
    id: 'jesus', label: 'Jesus Christ', type: 'person', eraId: 'life-of-christ',
    offsetX: 0, offsetY: 0,
    description: 'The eternal Son of God incarnate — the Alpha and Omega, the Way, the Truth, and the Life. All Scripture points to Him; all history is interpreted by Him. In Him every promise of God finds its Yes and Amen.',
    verses: ['John 1:1-14', 'Col 1:15-20', '2 Cor 1:20', 'Rev 1:8', 'Rev 22:13'],
    tags: ['messiah', 'savior', 'lord', 'incarnation', 'resurrection', 'second coming'],
    isKeyNode: true,
    isSupernode: true,
  },

  // ── Early Church ──────────────────────────────────────────────────────────
  {
    id: 'peter', label: 'Peter', type: 'person', eraId: 'early-church',
    offsetX: -80, offsetY: 0,
    description: 'Fisherman turned apostle and rock of the Church. He preached the first Pentecost sermon, opened the door to the Gentiles with Cornelius, and authored two epistles.',
    verses: ['Matt 16:18', 'Acts 2:14-41', 'Acts 10:34-48', '1 Pet 1:1'],
    tags: ['apostle', 'preaching', 'Pentecost', 'Gentiles'],
    isKeyNode: true,
  },
  {
    id: 'paul', label: 'Paul', type: 'person', eraId: 'early-church',
    offsetX: 60, offsetY: -55,
    description: 'Apostle to the Gentiles — formerly Saul the persecutor, transformed by a Damascus Road encounter. He planted churches from Jerusalem to Rome and authored 13 epistles defining Christian theology.',
    verses: ['Acts 9:1-19', 'Gal 1:15-16', 'Phil 3:4-14', 'Rom 1:1-7'],
    tags: ['apostle', 'Gentiles', 'missionary', 'epistles', 'grace'],
    isKeyNode: true,
  },
  {
    id: 'stephen', label: 'Stephen', type: 'person', eraId: 'early-church',
    offsetX: -120, offsetY: -70,
    description: 'The first Christian martyr. Full of faith and the Holy Spirit, he saw Jesus standing at the right hand of God as he was stoned — forgiving his killers as he died.',
    verses: ['Acts 6:5', 'Acts 7:54-60'],
    tags: ['martyr', 'faith', 'deacon', 'first martyr'],
  },
  {
    id: 'john-apostle', label: 'John', type: 'person', eraId: 'early-church',
    offsetX: 120, offsetY: 70,
    description: 'The beloved disciple who leaned on Jesus at the Last Supper. He wrote the Gospel, three epistles, and Revelation. Exiled to Patmos, he saw the full panorama of eternity.',
    verses: ['John 21:20-24', '1 John 4:8', 'Rev 1:9'],
    tags: ['apostle', 'beloved', 'revelation', 'Patmos', 'love'],
  },
];
