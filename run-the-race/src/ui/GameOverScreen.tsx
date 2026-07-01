import { useGameStore, VERSES } from '@/store/gameStore'

export default function GameOverScreen() {
  const { score, highScore, distance, verseProgress, startGame, reset } = useGameStore()
  const isNewBest = score >= highScore && score > 0
  const collected = verseProgress.length

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-950 to-black text-white px-6"
      style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}
    >
      <div className="text-4xl mb-3">🏁</div>
      <h2 className="text-3xl font-bold tracking-widest mb-1">RACE ENDED</h2>
      <p className="text-xs text-white/40 mb-6 italic text-center max-w-xs">
        "I have fought the good fight, I have finished the race." — 2 Timothy 4:7
      </p>

      <div className="bg-white/5 rounded-2xl border border-white/10 px-8 py-5 mb-6 text-center w-64">
        <div className="text-3xl font-bold text-yellow-300 tabular-nums">{Math.floor(score).toLocaleString()}</div>
        <div className="text-xs text-white/40 mt-1">{Math.floor(distance)}m completed</div>
        {isNewBest && (
          <div className="mt-2 text-xs text-yellow-400 font-bold tracking-widest animate-pulse">★ NEW BEST ★</div>
        )}
        {!isNewBest && highScore > 0 && (
          <div className="mt-2 text-xs text-white/30">Best: {Math.floor(highScore).toLocaleString()}</div>
        )}
        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/50">
          ✝ {collected}/{VERSES.length} scriptures in journal
        </div>
      </div>

      <button
        onClick={startGame}
        className="w-56 py-4 bg-yellow-400 text-black font-bold text-lg rounded-xl tracking-wider shadow-lg active:scale-95 transition-transform mb-3"
      >
        RUN AGAIN
      </button>
      <button
        onClick={reset}
        className="w-56 py-3 border border-white/20 text-white/60 rounded-xl tracking-wider active:scale-95 transition-transform"
      >
        MAIN MENU
      </button>
    </div>
  )
}
