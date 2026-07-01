import { useGameStore } from '@/store/gameStore'

export default function MainMenu() {
  const { startGame, highScore } = useGameStore()

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-indigo-950 via-blue-950 to-black text-white px-6">
      <a
        href="../"
        className="fixed top-safe-top left-safe-left z-50 px-3 py-1 bg-black/50 border border-white/20 rounded text-xs tracking-wider"
        style={{ top: 'max(10px, env(safe-area-inset-top, 10px))', left: 'max(12px, env(safe-area-inset-left, 12px))' }}
      >
        ← App
      </a>

      <div className="text-5xl mb-2">✝</div>
      <h1 className="text-4xl font-display font-bold tracking-[0.15em] mb-1 text-yellow-300">RUN THE RACE</h1>
      <p className="text-sm text-blue-300 tracking-widest mb-1">Hebrews 12:1</p>
      <p className="text-xs text-white/50 mb-8 text-center max-w-xs">
        "Let us run with perseverance the race marked out for us."
      </p>

      {highScore > 0 && (
        <p className="text-xs text-yellow-400/70 mb-4 tracking-wider">BEST: {highScore.toLocaleString()}</p>
      )}

      <button
        onClick={startGame}
        className="w-56 py-4 bg-yellow-400 text-black font-bold text-lg rounded-xl tracking-wider shadow-lg active:scale-95 transition-transform mb-3"
      >
        BEGIN RACE
      </button>

      <div className="mt-8 text-center text-white/30 text-xs leading-6">
        <div>Swipe left / right to change lanes</div>
        <div>Collect ✝ scrolls · Dodge obstacles</div>
      </div>
    </div>
  )
}
