import { useGameStore, VERSES } from '@/store/gameStore'

export default function MainMenu() {
  const { startGame, highScore, verseProgress, setPhase } = useGameStore()
  const collected = verseProgress.length
  const total = VERSES.length

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-blue-950 to-black text-white px-6"
      style={{
        paddingTop: 'max(10px, env(safe-area-inset-top, 10px))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
      }}
    >
      <a
        href="../../"
        className="fixed z-50 px-3 py-1 bg-black/50 border border-white/20 rounded text-xs tracking-wider text-white no-underline"
        style={{ top: 'max(10px, env(safe-area-inset-top, 10px))', left: 'max(12px, env(safe-area-inset-left, 12px))' }}
      >
        ← App
      </a>

      <div className="text-5xl mb-2" style={{ filter: 'drop-shadow(0 0 12px #818cf8)' }}>✝</div>
      <h1 className="text-4xl font-display font-bold tracking-[0.15em] mb-1 text-yellow-300">RUN THE RACE</h1>
      <p className="text-sm text-blue-300 tracking-widest mb-1">Hebrews 12:1</p>
      <p className="text-xs text-white/40 mb-6 text-center max-w-xs italic">
        "Let us run with perseverance the race marked out for us."
      </p>

      {highScore > 0 && (
        <p className="text-xs text-yellow-400/70 mb-1 tracking-wider">
          BEST: {Math.floor(highScore).toLocaleString()}
        </p>
      )}

      {/* Verse progress */}
      {collected > 0 && (
        <div className="mb-5 text-center">
          <div className="text-xs text-white/40 mb-1">✝ {collected}/{total} scriptures collected</div>
          <div className="w-40 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
            <div
              className="h-full bg-gradient-to-r from-purple-400 to-yellow-300 rounded-full"
              style={{ width: `${(collected / total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={startGame}
        className="w-56 py-4 bg-yellow-400 text-black font-bold text-lg rounded-xl tracking-wider shadow-lg active:scale-95 transition-transform mb-3"
      >
        BEGIN RACE
      </button>

      <button
        onClick={() => setPhase('journal')}
        className="w-56 py-3 border border-white/20 text-white/60 rounded-xl tracking-wider text-sm active:scale-95 transition-transform"
      >
        ✝ Verse Journal {collected > 0 ? `(${collected}/${total})` : ''}
      </button>

      <div className="mt-8 text-center text-white/25 text-xs leading-7">
        <div>Swipe ← → or tap buttons to change lanes</div>
        <div>Collect ✝ scripture scrolls</div>
        <div>Fill faith meter → Walk by Faith</div>
        <div>Finish 2000m to complete the race</div>
      </div>
    </div>
  )
}
