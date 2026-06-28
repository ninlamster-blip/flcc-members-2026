// Achievements — evaluated against live State. Earned ones are timestamped.
import { State, save, toast, level } from './core.js';
import { flatKana } from '../data/kana.js';

export const ACHIEVEMENTS = [
  { id: 'first-step', icon: '🌱', name: 'First Step', desc: 'Open the app and start learning.',
    test: () => State.xp > 0 },
  { id: 'kana-10', icon: 'あ', name: 'Kana Beginner', desc: 'Learn 10 kana characters.',
    test: () => Object.keys(State.learnedKana).length >= 10 },
  { id: 'hiragana-master', icon: '🎌', name: 'Hiragana Master', desc: 'Learn every basic hiragana.',
    test: () => flatKana('hiragana').slice(0, 46).every(x => State.learnedKana[x.k]) },
  { id: 'words-25', icon: '📚', name: 'Word Collector', desc: 'Learn 25 vocabulary words.',
    test: () => (State.stats.wordsLearned || 0) >= 25 },
  { id: 'kanji-10', icon: '漢', name: 'Kanji Curious', desc: 'Explore 10 kanji.',
    test: () => Object.keys(State.kanjiSeen).length >= 10 },
  { id: 'streak-3', icon: '🔥', name: 'On a Roll', desc: 'Reach a 3-day streak.',
    test: () => (State.streak || 0) >= 3 },
  { id: 'streak-7', icon: '⚡', name: 'Week Warrior', desc: 'Reach a 7-day streak.',
    test: () => (State.streak || 0) >= 7 },
  { id: 'speak-5', icon: '🎙️', name: 'Speak Up', desc: 'Practice pronunciation 5 times.',
    test: () => (State.stats.speakReps || 0) >= 5 },
  { id: 'level-5', icon: '🏅', name: 'Rising Star', desc: 'Reach level 5.',
    test: () => level() >= 5 },
  { id: 'sentences-10', icon: '🧩', name: 'Sentence Surgeon', desc: 'Read 10 sentences.',
    test: () => (State.stats.sentencesRead || 0) >= 10 },
];

export function evaluateAchievements() {
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (!State.achievements[a.id] && a.test()) {
      State.achievements[a.id] = Date.now();
      newly.push(a);
    }
  }
  if (newly.length) {
    save();
    setTimeout(() => toast(`🏆 Achievement: ${newly[0].name}`), 60);
  }
  return newly;
}
