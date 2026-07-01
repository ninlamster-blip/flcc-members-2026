import { useGameStore } from '@/store/gameStore'

export default function PauseScreen() {
  const { resumeGame, reset } = useGameStore()

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="text-center text-white px-8 py-10 rounded-2xl bg-white/5 border border-white/10 w-72">
        <div className="text-3xl mb-2">⏸</div>
        <h2 className="text-2xl font-bold tracking-widest mb-1">PAUSED</h2>
        <p className="text-xs text-white/40 mb-8 italic">
          "Be still, and know that I am God." — Psalm 46:10
        </p>
        <button
          onClick={resumeGame}
          className="w-full py-3 bg-yellow-400 text-black font-bold rounded-xl tracking-wider mb-3 active:scale-95 transition-transform"
        >
          RESUME
        </button>
        <button
          onClick={reset}
          className="w-full py-3 border border-white/20 text-white/70 rounded-xl tracking-wider active:scale-95 transition-transform"
        >
          MAIN MENU
        </button>
      </div>
    </div>
  )
}
