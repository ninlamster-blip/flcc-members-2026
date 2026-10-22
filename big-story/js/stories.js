/* =============================================================================
   THE STORY BANK — the one place a Bible fact may enter this app.
   -----------------------------------------------------------------------------
   Twenty-two stories, Creation to the church, told three times over: once for a
   seven-year-old, once for a ten-year-old, once for a teenager. Not one text
   with words swapped out — three retellings, because "shorter" is not the same
   as "younger", and a sixteen-year-old given a padded version of a children's
   paragraph can tell immediately.

     young   7-9    Short sentences. One thing happens at a time.
     middle  10-13  The story with its causes and its consequences.
     older   14-18  The story as an adult would tell it, with what it cost.

   `deeper` is shown to `older` only: the question the story raises, rather than
   another summary of it.

   MEMORY VERSES are quoted from the **World English Bible**, which is in the
   public domain — nothing here needs a licence, and it all works offline.
   Where the natural verse for a story renders the divine name as "Yahweh"
   (the WEB's usual practice in the Old Testament), a different verse is chosen
   for that story instead: a teacher reading over a child's shoulder should not
   meet wording their church does not use. Every verse below was picked with
   that rule applied.

   `reference` is the passage the story is actually in — a child who wants to
   go and read it, or a teacher checking, must never be sent to the wrong place.
   ========================================================================== */

export const ERAS = [
  { id: 'beginnings', name: 'Beginnings' },
  { id: 'family',     name: 'One Family' },
  { id: 'rescue',     name: 'The Rescue' },
  { id: 'kingdom',    name: 'The Kingdom' },
  { id: 'exile',      name: 'Far From Home' },
  { id: 'jesus',      name: 'Jesus' },
  { id: 'church',     name: 'The Church Begins' },
];

export const STORIES = [
  {
    id: 'creation',
    title: 'In the Beginning',
    era: 'beginnings',
    reference: 'Genesis 1-2',
    text: {
      young:
        'At the very start there was nothing at all. Then God spoke, and there was light. ' +
        'He made the sky and the sea, the land and the trees, the sun and the stars, and every animal. ' +
        'Last of all he made people. God looked at everything he had made, and he was very pleased.',
      middle:
        'Before anything existed, God was there. He spoke, and the world came into being — light and dark, sky and sea, ' +
        'dry land, growing things, the sun and moon, birds and fish and animals. Each time he looked at what he had made ' +
        'and called it good. Then he made human beings, and he made them like himself, to look after everything else he had made. ' +
        'On the seventh day he stopped, and made that day special.',
      older:
        'Genesis opens with no argument and no proof — only God, already there, speaking. What he speaks becomes real: ' +
        'light, sky, sea, land, plants, sun and moon, every living creature. Six times the account pauses to say that what he made was good. ' +
        'People come last, and they come differently: made in God\'s own image, given the job of caring for the world rather than owning it. ' +
        'Then God rests, not because he is tired, but to mark the seventh day as belonging to him.',
    },
    deeper:
      'Every other creation story known in the ancient world began with a fight between gods. Genesis has no fight in it. ' +
      'One God speaks and it is so — and the people he makes are not slaves built to do the gods\' work, but his own image, trusted with his world. ' +
      'Almost everything the Bible later says about human dignity starts here.',
    verse: {
      reference: 'Genesis 1:1',
      text: 'In the beginning, God created the heavens and the earth.',
    },
  },

  {
    id: 'the-fall',
    title: 'The Choice in the Garden',
    era: 'beginnings',
    reference: 'Genesis 3',
    text: {
      young:
        'God gave the first people a beautiful garden. They could eat from any tree but one. ' +
        'A snake told them to eat from that one tree, and they did. ' +
        'Then everything felt wrong, and they hid from God. But God came looking for them.',
      middle:
        'God gave Adam and Eve a garden and one rule: not to eat from one particular tree. ' +
        'The serpent told Eve that God was holding something back from her, and that eating would make her wise. ' +
        'She ate, and gave some to Adam, and he ate too. Straight away they felt ashamed and hid. ' +
        'God came looking for them, and asked, "Where are you?" — not because he did not know, but because he wanted them to answer.',
      older:
        'The first sin was not really about fruit. The serpent\'s move was to suggest that God could not be trusted — that the rule ' +
        'existed to keep them small. Eve took it, Adam took it, and the world changed shape: shame, blame, and a distance between ' +
        'people and God that neither of them could close from their side. God still came into the garden looking for them, and the ' +
        'first thing he said was a question rather than a sentence.',
    },
    deeper:
      'Read Genesis 3:15 carefully. In the middle of the consequences, God says something about the woman\'s offspring that has nothing ' +
      'to do with punishment: one day one of her descendants will crush the serpent. The rescue plan starts on the same page as the disaster.',
    verse: {
      reference: 'Romans 3:23',
      text: 'for all have sinned, and fall short of the glory of God.',
    },
  },

  {
    id: 'noah',
    title: 'Noah and the Flood',
    era: 'beginnings',
    reference: 'Genesis 6-9',
    text: {
      young:
        'People became cruel to each other, and it made God very sad. ' +
        'But Noah loved God. God told him to build an enormous boat and to fill it with animals, two of every kind. ' +
        'Rain fell until water covered everything. Noah and his family were safe. ' +
        'Afterwards God put a rainbow in the sky as a promise.',
      middle:
        'The world had become so violent that God grieved that he had made it. Noah was the one man who still walked with God, ' +
        'so God warned him and told him to build an ark — a boat the size of a ship — and to bring his family and the animals aboard. ' +
        'The flood came, and everything outside the ark was lost. When the water went down, Noah\'s first act on dry ground was to worship. ' +
        'God promised never to destroy the earth this way again, and gave the rainbow as the sign of that promise.',
      older:
        'Genesis 6 says God saw that human wickedness was total, and that it grieved him to his heart. The flood is not God losing his temper; ' +
        'it is God grieving. Noah is called a righteous man in his generation, which is a comment on his generation as much as on him. ' +
        'He builds for years with no rain in sight. When it is over, God makes a one-sided promise — no conditions attached to Noah at all — ' +
        'and hangs a warrior\'s bow in the sky, pointed away from the earth.',
    },
    deeper:
      'The covenant after the flood is the first in the Bible, and it is made with "every living creature", not only with people. ' +
      'Whatever else Genesis 9 is doing, it is telling you that God\'s commitment runs wider than the human race.',
    verse: {
      reference: 'Hebrews 11:7',
      text: 'By faith, Noah, being warned about things not yet seen, moved with godly fear, prepared a ship for the saving of his house.',
    },
  },

  {
    id: 'abraham',
    title: 'A Promise to Abraham',
    era: 'family',
    reference: 'Genesis 12, 15, 17',
    text: {
      young:
        'God told a man named Abraham to leave his home and go to a new land. ' +
        'Abraham did not know the way, but he went. ' +
        'God promised him a family bigger than he could count — as many as the stars. ' +
        'Abraham was very old and had no children yet, but he believed God.',
      middle:
        'God told Abram to leave his country, his relatives and his father\'s house, and go to a land God would show him — ' +
        'and he went, without being told where he was going. God promised him land, a great family, and that through him ' +
        'every family on earth would be blessed. Years passed and he still had no son. One night God took him outside, ' +
        'showed him the stars, and told him his descendants would be like that. Abram believed him.',
      older:
        'Abram was seventy-five, settled, and childless when God told him to leave everything that made him who he was. ' +
        'The promise was absurd on its face: a nation, from a man with no children, in a land he did not own a metre of. ' +
        'He believed it anyway, and Genesis 15:6 says that his believing was counted to him as righteousness — a line Paul builds ' +
        'an entire argument on centuries later. He also doubted, argued, and tried to arrange the promise himself. Both things are in the text.',
    },
    deeper:
      'When God formalised the promise, Abram slept through it. In Genesis 15 the burning torch passes between the pieces alone. ' +
      'In that culture both parties walked the path, effectively saying "may this happen to me if I break my word". Only God walked it.',
    verse: {
      reference: 'Genesis 15:6',
      text: 'He believed in God, who credited it to him for righteousness.',
    },
  },

  {
    id: 'joseph',
    title: 'Joseph and His Brothers',
    era: 'family',
    reference: 'Genesis 37-50',
    text: {
      young:
        'Joseph\'s brothers were jealous of him, so they sold him to strangers who took him far away to Egypt. ' +
        'Life was hard, and he was even put in prison for something he did not do. ' +
        'But God was with Joseph. In the end the king put him in charge of all the food in Egypt, ' +
        'and Joseph saved his whole family from starving — even the brothers who had hurt him.',
      middle:
        'Joseph was his father\'s favourite, and his brothers hated him for it. They sold him to traders bound for Egypt ' +
        'and told their father he was dead. In Egypt he was a slave, then a prisoner, accused of something he had not done. ' +
        'Years later he explained the king\'s dreams, warned of a famine coming, and was put in charge of the whole country. ' +
        'When his brothers arrived begging for food, they did not recognise him. He wept, and he fed them.',
      older:
        'Joseph\'s story takes thirteen years to turn, and most of it is spent in a pit, a household and a prison. ' +
        'The text keeps repeating one line: the LORD was with Joseph. It never says the wrong was not wrong. ' +
        'When he finally faces his brothers, he does not pretend it was fine — he says plainly that they meant evil against him. ' +
        'What he adds is that God meant it for good, to keep many people alive. Both halves of that sentence are load-bearing.',
    },
    deeper:
      'Genesis 50:20 is not a claim that everything happens for a reason, and it is not something you may say to somebody else about their suffering. ' +
      'It is Joseph\'s testimony about his own life, spoken decades later, by the one person who had the standing to say it.',
    verse: {
      reference: 'Genesis 50:20',
      text: 'As for you, you meant evil against me, but God meant it for good, to save many people alive.',
    },
  },

  {
    id: 'moses-exodus',
    title: 'Let My People Go',
    era: 'rescue',
    reference: 'Exodus 1-14',
    text: {
      young:
        'God\'s people were slaves in Egypt and they cried out for help. ' +
        'God spoke to Moses from a bush that was burning but did not burn up. ' +
        'He sent Moses to tell the king, "Let my people go!" The king said no, again and again. ' +
        'At last the people walked out, and God opened a path for them straight through the sea.',
      middle:
        'The Israelites had been slaves in Egypt for generations, and God heard them crying out. ' +
        'He called Moses from a bush that burned without burning up, and sent him back to the most powerful man in the world ' +
        'with a message: let my people go. Pharaoh refused, and refused again, through plague after plague. ' +
        'When Israel finally left, Pharaoh\'s army chased them to the edge of the sea — and God opened the water and brought them through.',
      older:
        'Exodus begins with a scream. God\'s answer is to appear to an eighty-year-old fugitive shepherd in a burning bush and send him ' +
        'back to the empire he ran away from. The plagues are not random cruelty: each one confronts something Egypt worshipped — the Nile, ' +
        'the sun, Pharaoh\'s own son. At the sea, with the army behind and the water in front, Moses tells the people to stand still and watch. ' +
        'The rescue is not something they achieve. It is something done for them.',
    },
    deeper:
      'When Moses asks for God\'s name, the answer is "I AM WHO I AM" — a name that refuses to be defined by anything outside itself. ' +
      'Every later "I am" that Jesus says in John\'s Gospel is standing on this sentence, and his listeners knew it.',
    verse: {
      reference: 'Psalm 46:1',
      text: 'God is our refuge and strength, a very present help in trouble.',
    },
  },

  {
    id: 'ten-commandments',
    title: 'Ten Words on the Mountain',
    era: 'rescue',
    reference: 'Exodus 19-20',
    text: {
      young:
        'God brought his people to a big mountain. There was thunder and smoke and a loud trumpet sound. ' +
        'God gave them ten rules to live by — how to love him, and how to treat other people. ' +
        'They were not there to make the people miserable. They showed them how to live free.',
      middle:
        'Three months out of Egypt, Israel camped at Mount Sinai. The mountain shook and smoked, and God gave them ten commandments: ' +
        'four about how to treat God, six about how to treat each other. Notice the order — God rescued them first, ' +
        'and gave them the rules afterwards. The commandments were not how they earned their freedom. They were how free people were to live.',
      older:
        'The Ten Commandments open with a statement rather than a command: God introduces himself as the one who brought them ' +
        'out of Egypt, out of the house of slavery. Everything after that is the shape of a life lived by rescued people. ' +
        'They are strikingly ordinary — do not lie, do not steal, do not take what is not yours, give one day in seven to rest — and strikingly hard. ' +
        'Jesus later summarises the whole set in two sentences, and does not soften either one.',
    },
    deeper:
      'The fourth commandment is the longest, and its reason is a social one: your son, your daughter, your servant and even your animals rest too. ' +
      'A nation of former slaves is being told that nobody under their roof may be worked the way they were worked.',
    verse: {
      reference: 'Matthew 22:37-39',
      text: 'You shall love the Lord your God with all your heart, with all your soul, and with all your mind. ' +
            'This is the first and great commandment. A second likewise is this, "You shall love your neighbor as yourself."',
    },
  },

  {
    id: 'jericho',
    title: 'The Walls of Jericho',
    era: 'rescue',
    reference: 'Joshua 1-6',
    text: {
      young:
        'After Moses, Joshua led God\'s people into their new land. ' +
        'First they came to a city with enormous walls called Jericho. ' +
        'God told them to walk around it once a day for six days, and seven times on the seventh day, and then to shout. ' +
        'They did — and the walls fell down flat.',
      middle:
        'Joshua took over from Moses and led Israel across the Jordan into the land God had promised. ' +
        'Jericho stood in the way, walled and shut tight. God\'s battle plan was to march around it once a day for six days, ' +
        'seven times on the seventh, with the priests carrying the ark and blowing trumpets — and then everybody shouts. ' +
        'It is not a plan any general would choose. They followed it, and the walls came down.',
      older:
        'Before a single wall falls, God tells Joshua three times to be strong and courageous, and once to keep the book of the law on his lips. ' +
        'The strategy at Jericho is deliberately useless as military tactics: six days of walking in silence in front of an armed city, ' +
        'watched from the walls. It is designed so that nobody afterwards can claim the credit. ' +
        'And when the city falls, the one household spared is Rahab\'s — an outsider, and a woman with a past, who ends up in Jesus\' family tree.',
    },
    deeper:
      'Rahab appears in Matthew 1, in Hebrews 11 and in James 2. The Bible keeps bringing her up. ' +
      'Whatever a "clean" family line is supposed to look like, the Bible seems uninterested in producing one.',
    verse: {
      reference: 'Hebrews 11:30',
      text: 'By faith, the walls of Jericho fell down, after they had been encircled for seven days.',
    },
  },

  {
    id: 'gideon',
    title: 'Gideon and the Three Hundred',
    era: 'rescue',
    reference: 'Judges 6-7',
    text: {
      young:
        'Enemies kept stealing Israel\'s food, so Gideon was hiding when an angel called him a mighty warrior. ' +
        'Gideon did not feel mighty at all. He was afraid, and he asked God to prove it — twice. ' +
        'God did. Then God said Gideon had too many soldiers, and sent most of them home. ' +
        'With only three hundred men, God won the battle.',
      middle:
        'Israel was being raided every harvest, and Gideon was threshing wheat in a winepress to hide it when the angel greeted him ' +
        'as a mighty warrior. Gideon\'s reply was a list of objections: his clan was the weakest, he was the least in his family. ' +
        'He asked for a sign, then asked for the opposite sign the next night. God gave him both. ' +
        'Then God shrank his army from thirty-two thousand to three hundred — and gave them the victory.',
      older:
        'God\'s stated reason for cutting the army down is blunt: so that Israel could not boast that their own hand had saved them. ' +
        'Gideon himself is not a hero in the ordinary sense. He is frightened, he bargains, he demands proof twice, ' +
        'and he does the one thing God asked of him at night rather than in daylight because he was afraid. God works with him anyway. ' +
        'His later life is a warning as much as an example — read what he does with the gold afterwards.',
    },
    deeper:
      'The angel calls Gideon "mighty warrior" before Gideon has done anything at all. God addresses him by what he will become, ' +
      'not by what he is managing at the time. That is worth noticing if you are somebody who mostly notices your own objections.',
    verse: {
      reference: '2 Corinthians 12:9',
      text: 'He has said to me, "My grace is sufficient for you, for my power is made perfect in weakness."',
    },
  },

  {
    id: 'ruth',
    title: 'Ruth Stays',
    era: 'kingdom',
    reference: 'Ruth 1-4',
    text: {
      young:
        'Ruth\'s husband died, and so did Naomi\'s. Naomi decided to go home to her own country. ' +
        'Ruth was not from that country, but she would not leave Naomi alone. ' +
        'She went with her, and worked in the fields to feed them both. ' +
        'A kind man named Boaz noticed her, and they were married. Ruth became King David\'s great-grandmother.',
      middle:
        'Naomi lost her husband and both her sons in a foreign country, and told her two daughters-in-law to go home to their families. ' +
        'One did. Ruth refused: "Where you go, I will go." She was a Moabite — a foreigner — and she followed Naomi back to Bethlehem ' +
        'and worked in the barley fields to keep them both alive. Boaz, a relative of Naomi\'s, protected her, and married her. ' +
        'Their great-grandson was David.',
      older:
        'Ruth is set in the time of the judges, which the Bible describes as the worst period in Israel\'s history, and it is a story ' +
        'in which nothing miraculous happens at all. There is no plague, no parted sea, no voice from heaven. There is a grieving widow, ' +
        'a foreign woman who will not leave her, and a landowner who obeys an obscure law about leaving grain at the edges of a field for the poor. ' +
        'Out of that ordinary decency comes the line that produces David, and eventually Jesus.',
    },
    deeper:
      'Naomi tells the town to stop calling her Naomi ("pleasant") and call her Mara ("bitter"), because the Almighty has dealt bitterly with her. ' +
      'The book does not correct her or tell her to cheer up. It lets her say it, and keeps going.',
    verse: {
      reference: 'Ruth 1:16',
      text: 'Where you go, I will go; and where you stay, I will stay. Your people will be my people, and your God my God.',
    },
  },

  {
    id: 'david-goliath',
    title: 'David and Goliath',
    era: 'kingdom',
    reference: '1 Samuel 17',
    text: {
      young:
        'A giant named Goliath shouted at God\'s army every day, and every soldier was afraid of him. ' +
        'David was a boy who looked after sheep. He came to bring his brothers some food and heard the giant shouting. ' +
        'David said he would fight him. He took five smooth stones and his sling — and God gave him the victory.',
      middle:
        'For forty days Goliath came out and challenged Israel, and the whole army, including King Saul, was terrified. ' +
        'David was a shepherd, too young to be a soldier, delivering bread and cheese to his brothers. He was not impressed by the giant ' +
        'so much as offended on God\'s behalf. Saul offered him armour; it did not fit and he took it off. ' +
        'He went out with a sling and five stones, and said the battle belonged to the LORD.',
      older:
        'Everybody in the valley was doing the same arithmetic — Goliath against a man — and only David was doing different arithmetic: ' +
        'Goliath against God. His confidence was not in his aim. He argues it from experience: he had killed a lion and a bear protecting sheep, ' +
        'and this was the same God. Note also that his own brother accuses him of showing off, and Saul tells him he is too young. ' +
        'The opposition in this story is not only the giant.',
    },
    deeper:
      'David refused Saul\'s armour because he had not tested it. There is a quiet lesson in that: borrowed equipment, borrowed arguments ' +
      'and borrowed faith all fail at the worst possible moment. He went with what he had actually used.',
    verse: {
      reference: '1 John 4:4',
      text: 'greater is he who is in you than he who is in the world.',
    },
  },

  {
    id: 'solomon',
    title: 'Solomon Asks for Wisdom',
    era: 'kingdom',
    reference: '1 Kings 3',
    text: {
      young:
        'God said to young King Solomon, "Ask me for anything you want." ' +
        'Solomon did not ask to be rich, or to live a long time. He asked to be wise, so he could look after people well. ' +
        'God was very pleased, and gave him wisdom — and riches too, which he had not even asked for.',
      middle:
        'Solomon became king while he was still young, and God appeared to him in a dream and offered him anything he asked for. ' +
        'He asked for an understanding heart to govern the people and to tell right from wrong. ' +
        'God told him that because he had not asked for long life, or wealth, or the death of his enemies, he would have wisdom — ' +
        'and the things he had not asked for as well.',
      older:
        'Solomon\'s prayer starts by admitting he does not know what he is doing: "I am but a little child. I don\'t know how to go out or come in." ' +
        'What he asks for is a listening heart. God\'s pleasure in the request is about what it reveals — the man is thinking about the people ' +
        'he is responsible for rather than about himself. It is worth reading the rest of his life alongside this chapter. ' +
        'Being given wisdom and continuing to live by it turn out to be two different things.',
    },
    deeper:
      'Ecclesiastes is traditionally read as Solomon looking back. Wisdom, wealth, projects, pleasure — he says he tried all of it and calls it vapour. ' +
      'The book is in the Bible on purpose. Faith that cannot hold a disillusioned person is not the faith of the Bible.',
    verse: {
      reference: 'James 1:5',
      text: 'But if any of you lacks wisdom, let him ask of God, who gives to all liberally and without reproach, and it will be given to him.',
    },
  },

  {
    id: 'elijah-carmel',
    title: 'Fire on Mount Carmel',
    era: 'kingdom',
    reference: '1 Kings 18',
    text: {
      young:
        'Many people had stopped following God and were praying to a statue called Baal. ' +
        'Elijah said, "Let us find out who is really God." Baal\'s prophets shouted all day and nothing happened. ' +
        'Then Elijah poured water all over his altar and prayed one short prayer. ' +
        'Fire came down from heaven, and everyone fell on their faces and said, "The LORD, he is God!"',
      middle:
        'Israel had been trying to follow God and Baal at once, and Elijah put the question to them plainly: ' +
        'how long will you keep limping between two opinions? He set up a contest on Mount Carmel. ' +
        'Baal\'s four hundred and fifty prophets called on their god from morning until evening — nothing. ' +
        'Elijah soaked his altar with water, prayed a prayer of about sixty words, and fire fell.',
      older:
        'Elijah\'s challenge is not really "is Baal real". It is "stop trying to have both". The contrast is deliberate and almost comic: ' +
        'hours of shouting and self-harm on one side, one short prayer on the other, offered at the time of the evening sacrifice. ' +
        'And then read what happens next. One threat from Jezebel and Elijah runs into the desert and asks to die. ' +
        'God\'s response is not a rebuke. It is food, sleep, and a question asked gently, twice.',
    },
    deeper:
      'After the fire, God speaks to Elijah not in the wind or the earthquake or the fire, but in a low whisper. ' +
      'The prophet who had just called down fire needed to be met quietly. Both are God.',
    verse: {
      reference: 'Matthew 6:24',
      text: 'No one can serve two masters, for either he will hate the one and love the other, ' +
            'or else he will be devoted to one and despise the other.',
    },
  },

  {
    id: 'daniel-lions',
    title: 'Daniel and the Lions',
    era: 'exile',
    reference: 'Daniel 6',
    text: {
      young:
        'Daniel prayed to God three times every day. Some jealous men tricked the king into making a law: ' +
        'nobody may pray to anyone except the king. Daniel went home, opened his window, and prayed as usual. ' +
        'They threw him into a den of lions — and God shut the lions\' mouths. In the morning Daniel was completely safe.',
      middle:
        'Daniel was a foreigner who had risen to the top of the Persian government, and the officials under him were looking for something to use against him. ' +
        'They could find nothing, so they went after his faith, persuading the king to ban prayer to anyone but himself for thirty days. ' +
        'Daniel knew about the law. He went home, opened his windows towards Jerusalem, and prayed three times a day as he always had. ' +
        'The king, trapped by his own decree, had him thrown to the lions, and could not sleep all night.',
      older:
        'The detail that carries the story is that Daniel did not change anything. He did not pray more loudly to make a point, ' +
        'or more quietly to stay safe. He carried on exactly as before, with the windows open, at eighty-something years old, ' +
        'in the service of an empire that had taken him from his home as a boy. His accusers openly admit they will find nothing against him ' +
        'unless it concerns the law of his God. That is a striking thing for enemies to say about somebody.',
    },
    deeper:
      'Daniel spent his whole career serving governments that did not share his faith, and he served them well. ' +
      'He is not a model of withdrawal from public life, and not a model of going along with everything either. He drew very few lines — and did not move them.',
    verse: {
      reference: 'Daniel 6:10',
      text: 'He went into his house and, his windows being open toward Jerusalem, he kneeled on his knees three times a day, ' +
            'and prayed, and gave thanks before his God, as he did before.',
    },
  },

  {
    id: 'jonah',
    title: 'Jonah Runs Away',
    era: 'exile',
    reference: 'Jonah 1-4',
    text: {
      young:
        'God told Jonah to go to a city called Nineveh. Jonah did not want to, so he got on a boat going the other way. ' +
        'A huge storm came, and Jonah ended up in the sea — and a great fish swallowed him. ' +
        'Inside the fish he prayed, and God rescued him. This time Jonah went to Nineveh, and the whole city listened.',
      middle:
        'God sent Jonah to Nineveh, the capital of the empire that terrified his people, to warn them. Jonah went to the docks ' +
        'and bought a ticket in the opposite direction. A storm nearly sank the ship; Jonah told the sailors to throw him overboard, ' +
        'and a great fish swallowed him. He prayed, was put ashore, and finally went and preached — eight words of it — ' +
        'and the entire city turned to God. And then Jonah sat down outside the city and sulked.',
      older:
        'The strange thing about Jonah is that he is a prophet who succeeds completely and is furious about it. ' +
        'His complaint in chapter 4 is the key to the book: he says he ran away in the first place because he knew God was gracious ' +
        'and merciful and would relent — and he did not want Nineveh forgiven. The book ends on a question from God about whether ' +
        'he should have pity on a city of a hundred and twenty thousand people. Jonah never answers. The reader has to.',
    },
    deeper:
      'Nineveh were not innocent; they were the Assyrians, and their cruelty was famous. Jonah\'s anger is not petty, it is political and personal. ' +
      'The book does not dismiss that. It just asks him — and you — whether God is allowed to forgive people you have good reason to hate.',
    verse: {
      reference: 'Ephesians 2:4-5',
      text: 'But God, being rich in mercy, for his great love with which he loved us, ' +
            'even when we were dead through our trespasses, made us alive together with Christ.',
    },
  },

  {
    id: 'esther',
    title: 'Esther Speaks Up',
    era: 'exile',
    reference: 'Esther 2-9',
    text: {
      young:
        'Esther was a young Jewish girl who became queen of a huge empire. ' +
        'A powerful man made a plan to hurt all her people. Esther was frightened, ' +
        'because going to the king without being invited could cost her life. ' +
        'She went anyway — and she saved her whole nation.',
      middle:
        'Esther was an orphan, raised by her cousin Mordecai, and she became queen of Persia without telling anyone she was Jewish. ' +
        'Haman, the king\'s highest official, obtained a decree to destroy every Jew in the empire. Mordecai sent word to Esther. ' +
        'Approaching the king uninvited could mean death, and she knew it. She asked her people to fast for three days, ' +
        'then said, "If I perish, I perish," and went in. Haman\'s plot collapsed, and her people were saved.',
      older:
        'God is never mentioned in the book of Esther — not once. There are no miracles, no prophets and no visions. ' +
        'There is a beauty contest that is closer to a round-up, a genocidal decree, a series of coincidences, and a young woman ' +
        'with everything to lose deciding to speak. Mordecai\'s argument to her is not that she is safe: it is that she will not escape either, ' +
        'and that she may have come to her position for exactly this moment. She weighs it, and goes.',
    },
    deeper:
      'The absence of God\'s name is almost certainly deliberate. This is a book about what faith looks like when heaven appears to be silent ' +
      'and no one is going to tell you what to do — which is the situation most people are actually in most of the time.',
    verse: {
      reference: 'Esther 4:14',
      text: 'Who knows if you haven\'t come to the kingdom for such a time as this?',
    },
  },

  {
    id: 'birth-of-jesus',
    title: 'The Birth of Jesus',
    era: 'jesus',
    reference: 'Luke 1-2',
    text: {
      young:
        'An angel told a young woman named Mary that she was going to have a very special baby — God\'s own Son. ' +
        'When he was born there was no room for them, so he was laid in a manger where the animals ate. ' +
        'Angels told some shepherds first, and they ran to see him. His name was Jesus.',
      middle:
        'The angel Gabriel told Mary, a teenager in a small town, that she would have a son and that he would be called the Son of the Most High. ' +
        'She asked how, and then said, "Let it be to me according to your word." Joseph was told in a dream to take her as his wife. ' +
        'A census sent them to Bethlehem, where there was no room, and Jesus was born and laid in a feeding trough. ' +
        'The first people told were shepherds — men whose word was not even accepted in court.',
      older:
        'Luke dates the birth by emperors and governors, because he is making a claim about history rather than telling a legend. ' +
        'Everything about the arrangement is upside down. God enters the world through an unmarried young woman in an occupied province, ' +
        'is born in a stable because the town is full, and the birth announcement is delivered to shepherds on a night shift. ' +
        'Mary\'s song, the Magnificat, is not sentimental: it is about rulers being pulled off thrones and the hungry being fed.',
    },
    deeper:
      'The name Immanuel means "God with us". Christianity\'s central claim is not that God sent advice or rules or a rescue party, ' +
      'but that he came himself, as a baby who had to be fed and carried. Whatever else you make of it, it is not a claim anybody would invent.',
    verse: {
      reference: 'Luke 2:11',
      text: 'For there is born to you today, in David\'s city, a Savior, who is Christ the Lord.',
    },
  },

  {
    id: 'sermon-on-the-mount',
    title: 'Jesus Teaches on the Hillside',
    era: 'jesus',
    reference: 'Matthew 5-7',
    text: {
      young:
        'Crowds followed Jesus up a hillside to listen to him. ' +
        'He told them that God blesses people the world forgets — the sad, the gentle, the ones who are treated unfairly. ' +
        'He said to love your enemies, and to forgive, and to be kind in secret. ' +
        'He taught them how to pray, and we still pray those words today.',
      middle:
        'Jesus sat down on a hillside and taught the crowds what life in God\'s kingdom looks like. ' +
        'He began by calling blessed the very people nobody envies: the poor in spirit, the mourners, the meek, the persecuted. ' +
        'He said anger is the root of murder and that hating your enemy is not permitted — you are to love them and pray for them. ' +
        'He warned against doing good things to be seen doing them, and taught the prayer that begins "Our Father in heaven."',
      older:
        'The Sermon on the Mount is the most admired and least obeyed teaching in history, and Jesus knew what he was asking. ' +
        'He does not lower the law; he pushes it inward — from murder to contempt, from adultery to the look, from oath-keeping ' +
        'to simply being the kind of person whose yes means yes. He forbids revenge and commands love of enemies, ' +
        'and finishes with two builders, two houses and one storm, saying the difference is not hearing this but doing it.',
    },
    deeper:
      'Read the Beatitudes as a description rather than a set of entry requirements. Jesus is not saying "become poor in spirit and you will qualify". ' +
      'He is looking at the people in front of him — the ones everybody else has written off — and announcing that they are the blessed ones.',
    verse: {
      reference: 'Matthew 5:16',
      text: 'Even so, let your light shine before men, that they may see your good works and glorify your Father who is in heaven.',
    },
  },

  {
    id: 'lost-son',
    title: 'The Son Who Came Home',
    era: 'jesus',
    reference: 'Luke 15',
    text: {
      young:
        'Jesus told a story about a boy who took his father\'s money and went far away and wasted it all. ' +
        'When he had nothing left, he decided to go home and say sorry. ' +
        'While he was still a long way off, his father saw him — and ran to him, and hugged him, and threw a party. ' +
        'That is what God is like.',
      middle:
        'Jesus told this story to people who were complaining that he ate with the wrong sort of person. ' +
        'A younger son asked for his inheritance early — effectively wishing his father dead — and spent it all. ' +
        'Starving, he rehearsed an apology and started home. His father saw him a long way off, ran to him (which dignified men did not do), ' +
        'and threw a feast before the son could finish his speech. The older brother refused to come in, and the father went out to him too.',
      older:
        'There are two lost sons in this parable, and only one of them left home. The younger one\'s sin is obvious. ' +
        'The elder\'s is harder to see and is the one Jesus aims at his audience: he has done everything right, and he is furious that grace ' +
        'is being given to somebody who has not earned it. He will not go in. The story deliberately does not end — ' +
        'we never find out whether he does. The people listening were the elder brother, and they were the ones who had to finish it.',
    },
    deeper:
      'The father runs. In that culture an older man gathering up his robes and running was humiliating, and he does it in full view ' +
      'of a village that had every right to shame the returning son. He takes the shame himself before the boy reaches the gate.',
    verse: {
      reference: 'Luke 15:20',
      text: 'But while he was still far off, his father saw him, and was moved with compassion, and ran, and fell on his neck, and kissed him.',
    },
  },

  {
    id: 'the-cross',
    title: 'The Cross',
    era: 'jesus',
    reference: 'Luke 22-23, John 19',
    text: {
      young:
        'Jesus never did anything wrong, but people who hated him had him arrested. ' +
        'He was hurt very badly, and he was put on a cross to die, between two robbers. ' +
        'Even then he prayed for the people who were hurting him. ' +
        'He did it for us, because he loves us. The whole sky went dark.',
      middle:
        'Jesus was arrested at night, tried by people who had already decided, and handed to the Romans. ' +
        'Pilate said three times that he found no fault in him, and sentenced him anyway. He was flogged, mocked and crucified ' +
        'between two criminals, and from the cross he prayed, "Father, forgive them; for they don\'t know what they are doing." ' +
        'One of the criminals asked to be remembered, and Jesus promised him paradise that same day. Then the sky went dark.',
      older:
        'Crucifixion was designed to be slow, public and shameful, and Rome used it on slaves and rebels so that everybody could see. ' +
        'The Gospels report it with almost no commentary. What they do record is what Jesus said: forgiveness for his executioners, ' +
        'care for his mother, a promise to a dying thief, a cry of abandonment quoted from Psalm 22, and finally "It is finished" — ' +
        'a word used for a debt paid in full. The temple curtain, which shut people out of the holiest place, tore from the top down.',
    },
    deeper:
      'Christians disagree about how to explain what the cross accomplished, and the New Testament uses several pictures for it — ' +
      'a ransom, a sacrifice, a victory, a reconciliation. What none of the writers do is treat it as a tragedy that God failed to prevent. ' +
      'They treat it as the thing he came to do.',
    verse: {
      reference: 'John 3:16',
      text: 'For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.',
    },
  },

  {
    id: 'resurrection',
    title: 'He Is Risen',
    era: 'jesus',
    reference: 'Luke 24, John 20',
    text: {
      young:
        'Jesus\' friends were very sad. They had put his body in a tomb and rolled a big stone across the door. ' +
        'Early on Sunday morning some women went there — and the stone was rolled away and the tomb was empty! ' +
        'Jesus was alive. He talked with them and ate with them. Death could not keep him.',
      middle:
        'Jesus was buried on Friday in a borrowed tomb with a stone across the entrance and a guard outside. ' +
        'Early on Sunday, women came with spices to finish the burial and found the stone rolled back and the tomb empty. ' +
        'Mary Magdalene mistook Jesus for the gardener until he said her name. Over the following weeks he appeared to the disciples, ' +
        'ate with them, and let Thomas — who had said he would not believe without touching the wounds — touch them.',
      older:
        'Every Gospel names women as the first witnesses, in a culture where a woman\'s testimony carried little weight in court. ' +
        'If you were inventing a story to convince first-century people, that is not the detail you would invent. ' +
        'The disciples are not portrayed as expecting it either — they are hiding, they think it is nonsense, and one of them refuses ' +
        'to believe his closest friends. Something turned that group of frightened people into a movement that would not stop talking, ' +
        'under threat of death, within weeks.',
    },
    deeper:
      'Paul stakes everything on this in 1 Corinthians 15: if Christ has not been raised, he says, our preaching is worthless, ' +
      'your faith is worthless, and Christians are to be pitied more than anyone. He does not offer the resurrection as a helpful metaphor. ' +
      'He offers it as a fact that can be falsified.',
    verse: {
      reference: 'Luke 24:6',
      text: 'He isn\'t here, but is risen.',
    },
  },

  {
    id: 'pentecost',
    title: 'The Church Begins',
    era: 'church',
    reference: 'Acts 2',
    text: {
      young:
        'Jesus went back to heaven, but he promised to send a Helper. ' +
        'His friends were all together when a sound like a great wind filled the house, ' +
        'and they began to speak languages they had never learned. ' +
        'Peter stood up and told the crowd about Jesus, and three thousand people believed that day. That was the very first church.',
      middle:
        'Jesus told his followers to wait in Jerusalem for the Holy Spirit. At Pentecost, with the city full of pilgrims from everywhere, ' +
        'a sound like a rushing wind filled the house and they began speaking in other languages — and visitors from a dozen countries ' +
        'each heard their own. Peter, who had denied knowing Jesus a few weeks earlier, stood up and preached, and three thousand were baptised. ' +
        'They shared meals, shared money, and looked after each other.',
      older:
        'The list in Acts 2 of who was in the crowd is a list of nations, and the point is that the message arrives in each person\'s own language ' +
        'rather than requiring them to learn somebody else\'s. It is Babel run backwards. The same Peter who had denied Jesus three times ' +
        'to a servant girl now says the same thing to thousands of people. And the first description of the church is almost entirely ' +
        'about ordinary life together: teaching, bread, prayer, and nobody among them in need.',
    },
    deeper:
      'Acts 2:44-45 says they sold property to meet each other\'s needs. Christians have argued ever since about how literally to take that. ' +
      'What is not arguable is that Luke thought it was the natural result of what had just happened to them, and wrote it down without comment.',
    verse: {
      reference: 'Acts 1:8',
      text: 'But you will receive power when the Holy Spirit has come upon you. You will be witnesses to me... to the uttermost parts of the earth.',
    },
  },

  {
    id: 'paul',
    title: 'The Man Who Changed Sides',
    era: 'church',
    reference: 'Acts 9',
    text: {
      young:
        'Saul hated the Christians and wanted to put them in prison. ' +
        'One day, on the road to Damascus, a bright light shone around him and he heard Jesus speaking to him. ' +
        'For three days he could not see. Then God sent a man named Ananias to help him. ' +
        'Saul became Paul, and he spent the rest of his life telling people about Jesus.',
      middle:
        'Saul was the most effective enemy the early church had, travelling from city to city to arrest believers. ' +
        'On the road to Damascus a light knocked him to the ground and a voice said, "Saul, Saul, why do you persecute me?" — ' +
        'and identified itself as Jesus. Blind for three days, he waited. God sent Ananias, who was understandably reluctant, ' +
        'to lay hands on the man who had come to arrest him. Saul was baptised, and immediately began preaching the faith he had tried to destroy.',
      older:
        'Paul never softens what he had been. He calls himself the chief of sinners and says he is unworthy to be called an apostle ' +
        'because he persecuted the church. Notice what Jesus says on the road: not "why do you persecute my followers" but "why do you persecute me". ' +
        'And notice Ananias, who argues with God about the assignment and goes anyway, and whose first word to the man is "Brother Saul". ' +
        'Two-thirds of the New Testament\'s letters come from the man he walked in to see.',
    },
    deeper:
      'The church in Jerusalem did not believe Paul for years, and had good reason not to. Barnabas vouched for him when nobody else would. ' +
      'Most conversions in the New Testament need somebody willing to take a risk on the person afterwards.',
    verse: {
      reference: '2 Corinthians 5:17',
      text: 'Therefore if anyone is in Christ, he is a new creation. The old things have passed away. Behold, all things have become new.',
    },
  },
];

export const TIERS = ['young', 'middle', 'older'];

/** The age bands a profile can be set to, and the tier each one reads. */
export const AGE_BANDS = [
  { id: 'young',  label: '7 to 9',   tier: 'young' },
  { id: 'middle', label: '10 to 13', tier: 'middle' },
  { id: 'older',  label: '14 to 18', tier: 'older' },
];
