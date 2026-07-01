import { create } from 'zustand'

export type GamePhase = 'menu' | 'journal' | 'running' | 'paused' | 'faith' | 'gameover' | 'victory'
export type Lane = -1 | 0 | 1

export interface ScriptureVerse {
  text: string
  ref: string
}

export const VERSES: ScriptureVerse[] = [
  { text: 'Let us run with perseverance the race marked out for us.', ref: 'Hebrews 12:1' },
  { text: 'I can do all things through Christ who strengthens me.', ref: 'Philippians 4:13' },
  { text: 'Be strong and courageous. Do not be afraid.', ref: 'Joshua 1:9' },
  { text: 'I have fought the good fight, I have finished the race.', ref: '2 Timothy 4:7' },
  { text: 'Those who hope in the Lord will renew their strength.', ref: 'Isaiah 40:31' },
  { text: 'Run in such a way as to get the prize.', ref: '1 Corinthians 9:24' },
  { text: 'Do not grow weary in doing good.', ref: 'Galatians 6:9' },
  { text: 'The Lord himself goes before you.', ref: 'Deuteronomy 31:8' },
]

const VICTORY_DISTANCE = 2000

function loadVerseProgress(): number[] {
  try { return JSON.parse(localStorage.getItem('rtr-verses') ?? '[]') } catch { return [] }
}
function saveVerseProgress(v: number[]) {
  localStorage.setItem('rtr-verses', JSON.stringify(v))
}
function saveHighScore(score: number) {
  localStorage.setItem('rtr-highscore', String(score))
}

interface GameState {
  phase: GamePhase
  score: number
  distance: number
  lives: number
  speed: number
  lane: Lane
  targetLane: Lane
  faithMeter: number
  isInvincible: boolean
  highScore: number
  currentVerse: ScriptureVerse | null
  verseProgress: number[]
  combo: number
  multiplier: number

  setPhase: (phase: GamePhase) => void
  startGame: () => void
  pauseGame: () => void
  resumeGame: () => void
  addScore: (points: number) => void
  updateDistance: (delta: number) => void
  loseLife: () => void
  setLane: (lane: Lane) => void
  setTargetLane: (lane: Lane) => void
  updateSpeed: (speed: number) => void
  addFaith: (amount: number) => void
  triggerFaithWalk: () => void
  endFaithWalk: () => void
  setInvincible: (v: boolean) => void
  collectVerse: (idx: number) => void
  incrementCombo: () => void
  resetCombo: () => void
  reset: () => void
}

const INITIAL_SPEED = 8
const INITIAL_LIVES = 3

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  score: 0,
  distance: 0,
  lives: INITIAL_LIVES,
  speed: INITIAL_SPEED,
  lane: 0,
  targetLane: 0,
  faithMeter: 0,
  isInvincible: false,
  highScore: parseInt(localStorage.getItem('rtr-highscore') ?? '0'),
  currentVerse: null,
  // Verse progress persists across runs so the journal fills over time
  verseProgress: loadVerseProgress(),
  combo: 0,
  multiplier: 1,

  setPhase: (phase) => set({ phase }),

  startGame: () =>
    set((s) => ({
      phase: 'running',
      score: 0,
      distance: 0,
      lives: INITIAL_LIVES,
      speed: INITIAL_SPEED,
      lane: 0,
      targetLane: 0,
      faithMeter: 0,
      isInvincible: false,
      currentVerse: null,
      combo: 0,
      multiplier: 1,
      // verseProgress preserved across runs
      verseProgress: s.verseProgress,
    })),

  pauseGame: () => {
    if (get().phase === 'running') set({ phase: 'paused' })
  },

  resumeGame: () => {
    if (get().phase === 'paused') set({ phase: 'running' })
  },

  addScore: (points) =>
    set((s) => {
      const score = s.score + points
      const highScore = Math.max(score, s.highScore)
      if (highScore > s.highScore) saveHighScore(highScore)
      return { score, highScore }
    }),

  updateDistance: (delta) =>
    set((s) => {
      const distance = s.distance + delta
      const speed = Math.min(INITIAL_SPEED + distance * 0.003, 28)
      const score = s.score + delta
      const highScore = Math.max(score, s.highScore)
      if (highScore > s.highScore) saveHighScore(highScore)

      if (distance >= VICTORY_DISTANCE && s.phase === 'running') {
        return { distance, speed, score, highScore, phase: 'victory' }
      }
      return { distance, speed, score, highScore }
    }),

  loseLife: () =>
    set((s) => {
      const lives = s.lives - 1
      if (lives <= 0) return { lives: 0, phase: 'gameover', combo: 0, multiplier: 1 }
      return { lives, isInvincible: true, combo: 0, multiplier: 1 }
    }),

  setLane: (lane) => set({ lane }),
  setTargetLane: (lane) => set({ targetLane: lane }),
  updateSpeed: (speed) => set({ speed }),

  addFaith: (amount) =>
    set((s) => ({ faithMeter: Math.min(s.faithMeter + amount, 100) })),

  triggerFaithWalk: () =>
    set((s) => {
      // Show most recently collected verse during faith walk
      const lastIdx = s.verseProgress[s.verseProgress.length - 1]
      const currentVerse = lastIdx !== undefined ? VERSES[lastIdx] : s.currentVerse
      return { phase: 'faith', isInvincible: true, currentVerse }
    }),

  endFaithWalk: () => set({ phase: 'running', faithMeter: 0, isInvincible: false }),

  setInvincible: (v) => set({ isInvincible: v }),

  collectVerse: (idx) =>
    set((s) => {
      if (s.verseProgress.includes(idx)) return {}
      const verseProgress = [...s.verseProgress, idx]
      saveVerseProgress(verseProgress)
      const currentVerse = VERSES[idx]
      return { verseProgress, currentVerse }
    }),

  incrementCombo: () =>
    set((s) => {
      const combo = s.combo + 1
      const multiplier = Math.min(1 + Math.floor(combo / 3), 4)
      return { combo, multiplier }
    }),

  resetCombo: () => set({ combo: 0, multiplier: 1 }),

  reset: () =>
    set((s) => ({
      phase: 'menu',
      score: 0,
      distance: 0,
      lives: INITIAL_LIVES,
      speed: INITIAL_SPEED,
      lane: 0,
      targetLane: 0,
      faithMeter: 0,
      isInvincible: false,
      currentVerse: null,
      combo: 0,
      multiplier: 1,
      verseProgress: s.verseProgress,
    })),
}))
