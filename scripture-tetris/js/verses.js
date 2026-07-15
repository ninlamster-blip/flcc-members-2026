// Verse engine: loads the verse database and hands out verses for the
// various reward moments (line clears, streaks, big clears, game over,
// daily verse, devotional mode) without ever repeating one back-to-back.
const STREAK_MESSAGES = [
  'God is with you. Keep going.',
  "Don't give up. — Galatians 6:9",
  'One step at a time, with Him.',
  'Steady hands, steady heart.',
  'He who began this good work will finish it.',
  'Small victories still count.',
];

const BIG_CLEAR_LINES = {
  2: 'Great!',
  3: 'Amazing!',
  4: 'Incredible!',
};

const GAME_OVER_VERSE = {
  text: 'But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.',
  reference: 'Isaiah 40:31',
  category: 'Hope',
};

function dailySeed(date) {
  const s = date.toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}

export class VerseEngine {
  constructor(verses) {
    this.verses = verses;
    this.recent = [];
    this.categories = [...new Set(verses.map((v) => v.category))];
  }

  static async load() {
    const res = await fetch(new URL('../data/verses.json', import.meta.url));
    const verses = await res.json();
    return new VerseEngine(verses);
  }

  random(preferCategory = null) {
    let pool = this.verses;
    if (preferCategory) {
      const filtered = this.verses.filter((v) => v.category === preferCategory);
      if (filtered.length) pool = filtered;
    }
    const avoidIds = new Set(this.recent.slice(-Math.min(20, Math.floor(this.verses.length / 2))));
    let candidates = pool.filter((v) => !avoidIds.has(v.id));
    if (!candidates.length) candidates = pool;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    this.recent.push(pick.id);
    return pick;
  }

  forLineClear(clearedCount) {
    if (clearedCount >= 3) return this.random('Victory');
    if (clearedCount === 2) return this.random(Math.random() < 0.5 ? 'Victory' : 'Joy');
    return this.random();
  }

  bigClearHeadline(clearedCount) {
    return BIG_CLEAR_LINES[Math.min(clearedCount, 4)] || 'Great!';
  }

  forTSpin() {
    return this.random(Math.random() < 0.5 ? 'Wisdom' : 'Strength');
  }

  streakMessage() {
    return STREAK_MESSAGES[Math.floor(Math.random() * STREAK_MESSAGES.length)];
  }

  gameOverVerse() {
    return GAME_OVER_VERSE;
  }

  dailyVerse(date = new Date()) {
    const seed = dailySeed(date);
    const idx = seed % this.verses.length;
    return this.verses[idx];
  }

  byCategory(category) {
    return this.verses.filter((v) => v.category === category);
  }
}

// Simple category-aware devotional templates: real hand-written devotionals
// for 177 verses would be a book, so we compose a short, honest reflection
// from a small set of templates per category plus the verse itself.
const DEVOTIONAL_TEMPLATES = {
  Encouragement: {
    body: (v) => `Some days feel heavier than others, and this verse meets you right there. ${v.reference} reminds you that you were never meant to carry today alone — God's presence goes with you into whatever this day holds.`,
    prayer: 'Lord, thank You for staying close on the hard days. Give me courage for what is ahead, and help me remember I do not face it alone. Amen.',
    question: 'Where do you need a reminder today that you are not facing things alone?',
  },
  Hope: {
    body: (v) => `Hope isn't wishful thinking — in ${v.reference}, it's a steady confidence that God keeps His word, even when the timeline isn't clear yet. Let this verse anchor you while you wait.`,
    prayer: 'Father, renew my hope today. Where I am tired of waiting, help me trust Your timing. Amen.',
    question: 'What is one thing you are waiting on God for right now?',
  },
  Faith: {
    body: (v) => `Faith grows in small, repeated choices to trust — and ${v.reference} invites you to take the next one. You don't need to see the whole path, just the next step.`,
    prayer: 'Lord, grow my faith. Help me trust You even when I cannot see the outcome. Amen.',
    question: 'What would it look like to take one faith-filled step today?',
  },
  Strength: {
    body: (v) => `${v.reference} is a reminder that strength for today isn't something you have to manufacture yourself — it's offered to you. You're not meant to do this in your own power.`,
    prayer: 'God, I am tired. Thank You for offering Your strength when mine runs out. Amen.',
    question: 'Where do you feel weak right now — and what would it mean to lean on God there?',
  },
  Peace: {
    body: (v) => `Peace, in ${v.reference}, isn't the absence of noise around you — it's a steadiness underneath it. That kind of peace is available to you today, whatever is going on.`,
    prayer: 'Prince of Peace, quiet my anxious thoughts. Let Your peace guard my heart today. Amen.',
    question: 'What is stealing your peace today, and can you hand it to God for a moment?',
  },
  Joy: {
    body: (v) => `${v.reference} points to a joy that isn't dependent on circumstances lining up perfectly. It's rooted in who God is, which means it's available even on ordinary or difficult days.`,
    prayer: "Lord, thank You for joy that doesn't depend on my circumstances. Help me notice it today. Amen.",
    question: 'What is one small thing today you can genuinely be joyful about?',
  },
  Wisdom: {
    body: (v) => `${v.reference} is an invitation to stop leaning entirely on your own reasoning and ask God for wisdom instead — He offers it generously, not grudgingly.`,
    prayer: 'Father, I need wisdom for a decision I am facing. Thank You for offering it freely. Amen.',
    question: 'What decision could use a little more prayer and a little less overthinking?',
  },
  Love: {
    body: (v) => `${v.reference} is a picture of love that acted first, before you had anything figured out. That's the love this verse is describing — steady, generous, and already given.`,
    prayer: 'Lord, thank You for loving me first. Help me love the people around me the same way today. Amen.',
    question: 'Who in your life could use a small, tangible act of love from you today?',
  },
  Prayer: {
    body: (v) => `${v.reference} treats prayer less like a formality and more like an open door. You're invited to actually bring what's on your mind, not just what sounds spiritual enough.`,
    prayer: 'God, thank You for listening. Here is what is actually on my mind today... (take a moment). Amen.',
    question: 'What is something honest you have been holding back from bringing to God?',
  },
  Perseverance: {
    body: (v) => `${v.reference} is for the middle of things — after the excitement has worn off but before the finish line. It says the effort is not wasted, even when progress is slow.`,
    prayer: 'Lord, give me endurance for the long stretch. Remind me that faithful effort matters, even unseen. Amen.',
    question: 'What is something you are tempted to give up on that God might be asking you to keep going with?',
  },
  Grace: {
    body: (v) => `${v.reference} describes grace as a gift, not a reward for good behavior. Whatever today looks like, this is still true for you.`,
    prayer: 'Father, thank You for grace I did not earn. Help me extend that same grace to myself and others today. Amen.',
    question: 'Where do you need to receive grace instead of pushing through on your own effort?',
  },
  Anxiety: {
    body: (v) => `${v.reference} doesn't pretend your worries aren't real — it just offers somewhere to put them down instead of carrying them alone.`,
    prayer: 'God, I hand You what is worrying me right now. Help me trust You with it instead of holding on so tightly. Amen.',
    question: 'What is one worry you can consciously hand over to God today?',
  },
  Fear: {
    body: (v) => `${v.reference} speaks directly to fear — not by denying that scary things exist, but by reminding you who is with you in the middle of them.`,
    prayer: 'Lord, You know what I am afraid of. Thank You for being present in it rather than removed from it. Amen.',
    question: 'What fear would feel smaller if you remembered God is present in it?',
  },
  Forgiveness: {
    body: (v) => `${v.reference} is about a clean slate that's fully given, not partially earned. It's also an invitation to extend that same kind of forgiveness to others.`,
    prayer: 'Father, thank You for forgiving me completely. Help me forgive someone I have been holding something against. Amen.',
    question: 'Is there someone — including yourself — you need to forgive today?',
  },
  Purpose: {
    body: (v) => `${v.reference} suggests your life isn't a series of accidents — there's intention behind it, even in ordinary days that don't feel especially significant.`,
    prayer: 'Lord, help me see today as part of something You are doing, even the small, unremarkable parts. Amen.',
    question: 'What is one ordinary part of your day that might matter more than it seems?',
  },
  Victory: {
    body: (v) => `${v.reference} is written from the other side of a struggle — it doesn't ignore the fight, it just insists the fight isn't the end of the story.`,
    prayer: 'God, thank You that the struggle I am in is not the final word. Help me hold onto that today. Amen.',
    question: 'What situation in your life needs to be reframed with "this isn\'t the end of the story"?',
  },
};

export function generateDevotional(verse) {
  const t = DEVOTIONAL_TEMPLATES[verse.category] || DEVOTIONAL_TEMPLATES.Encouragement;
  return {
    verse,
    body: t.body(verse),
    prayer: t.prayer,
    question: t.question,
  };
}
