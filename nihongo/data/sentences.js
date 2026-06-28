// Sentences for the breakdown feature. Each is pre-tokenized with grammatical role.
// tokens: { s: surface, r: reading/romaji, role: label, mean: gloss }

export const SENTENCES = [
  {
    id: 's1', jp: '私は学生です。', romaji: 'Watashi wa gakusei desu.', en: 'I am a student.',
    level: 'N5',
    tokens: [
      { s: '私', r: 'watashi', role: 'Subject', mean: 'I / me' },
      { s: 'は', r: 'wa', role: 'Topic', mean: 'topic marker' },
      { s: '学生', r: 'gakusei', role: 'Noun', mean: 'student' },
      { s: 'です', r: 'desu', role: 'Copula', mean: 'to be (polite)' },
    ],
    note: 'は marks the topic ("As for me…"). です politely links the topic to a noun.',
  },
  {
    id: 's2', jp: '毎朝コーヒーを飲みます。', romaji: 'Maiasa kōhī o nomimasu.', en: 'I drink coffee every morning.',
    level: 'N5',
    tokens: [
      { s: '毎朝', r: 'maiasa', role: 'Adverb', mean: 'every morning' },
      { s: 'コーヒー', r: 'kōhī', role: 'Object', mean: 'coffee' },
      { s: 'を', r: 'o', role: 'Object marker', mean: 'direct object' },
      { s: '飲みます', r: 'nomimasu', role: 'Verb', mean: 'drink (polite)' },
    ],
    note: 'を marks the direct object of the verb. The verb comes at the end.',
  },
  {
    id: 's3', jp: '友達と映画を見ました。', romaji: 'Tomodachi to eiga o mimashita.', en: 'I watched a movie with a friend.',
    level: 'N5',
    tokens: [
      { s: '友達', r: 'tomodachi', role: 'Noun', mean: 'friend' },
      { s: 'と', r: 'to', role: 'Particle', mean: 'with' },
      { s: '映画', r: 'eiga', role: 'Object', mean: 'movie' },
      { s: 'を', r: 'o', role: 'Object marker', mean: 'direct object' },
      { s: '見ました', r: 'mimashita', role: 'Verb (past)', mean: 'watched (polite)' },
    ],
    note: 'と here means "with". ました is the polite past form of a verb.',
  },
  {
    id: 's4', jp: '日本語を勉強しています。', romaji: 'Nihongo o benkyō shite imasu.', en: 'I am studying Japanese.',
    level: 'N5',
    tokens: [
      { s: '日本語', r: 'nihongo', role: 'Object', mean: 'Japanese (language)' },
      { s: 'を', r: 'o', role: 'Object marker', mean: 'direct object' },
      { s: '勉強', r: 'benkyō', role: 'Noun', mean: 'study' },
      { s: 'して', r: 'shite', role: 'Verb (te-form)', mean: 'doing' },
      { s: 'います', r: 'imasu', role: 'Auxiliary', mean: 'progressive (-ing)' },
    ],
    note: 'て-form + います expresses an ongoing action, like English "-ing".',
  },
  {
    id: 's5', jp: '駅はどこですか。', romaji: 'Eki wa doko desu ka.', en: 'Where is the station?',
    level: 'N5',
    tokens: [
      { s: '駅', r: 'eki', role: 'Topic', mean: 'station' },
      { s: 'は', r: 'wa', role: 'Topic marker', mean: 'as for' },
      { s: 'どこ', r: 'doko', role: 'Question word', mean: 'where' },
      { s: 'です', r: 'desu', role: 'Copula', mean: 'to be (polite)' },
      { s: 'か', r: 'ka', role: 'Question particle', mean: 'makes a question' },
    ],
    note: 'か at the end turns a statement into a question — no word order change needed.',
  },
  {
    id: 's6', jp: '明日東京へ行きます。', romaji: 'Ashita Tōkyō e ikimasu.', en: 'I will go to Tokyo tomorrow.',
    level: 'N5',
    tokens: [
      { s: '明日', r: 'ashita', role: 'Adverb', mean: 'tomorrow' },
      { s: '東京', r: 'Tōkyō', role: 'Destination', mean: 'Tokyo' },
      { s: 'へ', r: 'e', role: 'Direction marker', mean: 'to / toward' },
      { s: '行きます', r: 'ikimasu', role: 'Verb', mean: 'go (polite)' },
    ],
    note: 'へ (pronounced "e") marks the direction or destination of movement.',
  },
  {
    id: 's7', jp: 'この本はとても面白いです。', romaji: 'Kono hon wa totemo omoshiroi desu.', en: 'This book is very interesting.',
    level: 'N5',
    tokens: [
      { s: 'この', r: 'kono', role: 'Determiner', mean: 'this' },
      { s: '本', r: 'hon', role: 'Topic', mean: 'book' },
      { s: 'は', r: 'wa', role: 'Topic marker', mean: 'as for' },
      { s: 'とても', r: 'totemo', role: 'Adverb', mean: 'very' },
      { s: '面白い', r: 'omoshiroi', role: 'i-Adjective', mean: 'interesting' },
      { s: 'です', r: 'desu', role: 'Copula', mean: 'politeness' },
    ],
    note: 'i-adjectives like 面白い already mean "is interesting"; です just adds politeness.',
  },
  {
    id: 's8', jp: '水をください。', romaji: 'Mizu o kudasai.', en: 'Water, please.',
    level: 'N5',
    tokens: [
      { s: '水', r: 'mizu', role: 'Object', mean: 'water' },
      { s: 'を', r: 'o', role: 'Object marker', mean: 'direct object' },
      { s: 'ください', r: 'kudasai', role: 'Request', mean: 'please give me' },
    ],
    note: '〜をください is a set pattern for politely requesting an item.',
  },
];

export function sentenceById(id) { return SENTENCES.find(s => s.id === id); }
