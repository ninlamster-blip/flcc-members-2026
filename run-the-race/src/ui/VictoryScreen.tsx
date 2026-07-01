import { useGameStore, VERSES } from '@/store/gameStore'

export default function VictoryScreen() {
  const { score, highScore, distance, verseProgress, startGame, reset } = useGameStore()
  const isNewBest = score >= highScore && score > 0
  const versesThisRun = verseProgress.length

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-yellow-950 via-indigo-950 to-black text-white px-6 overflow-y-auto"
      style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))', paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>

      <div className="text-6xl mb-3" style={{ filter: 'drop-shadow(0 0 20px #fbbf24)' }}>🏆</div>
      <h2 className="text-3xl font-bold tracking-[0.15em] text-yellow-300 mb-1">RACE FINISHED!</h2>

      <div className="bg-black/60 rounded-2xl border border-yellow-400/30 px-6 py-4 max-w-xs w-full text-center mb-5 mt-3">
        <p className="text-white text-sm italic leading-relaxed mb-1">
          "I have fought the good fight, I have finished the race, I have kept the faith."
        </p>
        <p className="text-yellow-400/70 text-xs">— 2 Timothy 4:7</p>
      </div>

      <div className="bg-white/5 rounded-2xl border border-white/10 px-8 py-5 mb-5 text-center w-full max-w-xs">
        <div className="text-4xl font-bold text-yellow-300 tabular-nums">{Math.floor(score).toLocaleString()}</div>
        <div className="text-xs text-white/40 mt-1">{Math.floor(distance)}m completed</div>
        {isNewBest && (
          <div className="mt-2 text-xs text-yellow-400 font-bold tracking-widest animate-pulse">★ NEW BEST ★</div>
        )}
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-sm text-white/70">
            ✝ {versesThisRun} / {VERSES.length} scriptures collected
          </div>
          {versesThisRun === VERSES.length && (
            <div className="text-xs text-yellow-300 mt-1 animate-pulse">FULL ARMOR OF FAITH!</div>
          )}
        </div>
      </div>

      <button
        onClick={startGame}
        className="w-64 py-4 bg-yellow-400 text-black font-bold text-lg rounded-xl tracking-wider shadow-lg active:scale-95 transition-transform mb-3"
      >
        RUN AGAIN
      </button>
      <button
        onClick={reset}
        className="w-64 py-3 border border-white/20 text-white/60 rounded-xl tracking-wider active:scale-95 transition-transform"
      >
        MAIN MENU
      </button>
    </div>
  )
}
