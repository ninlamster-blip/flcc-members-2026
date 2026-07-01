import { useGameStore } from '@/store/gameStore'

export default function HUD() {
  const { score, lives, distance, faithMeter, pauseGame } = useGameStore()

  const hearts = Array.from({ length: 3 }, (_, i) => i < lives)

  return (
    <div
      className="fixed inset-x-0 top-0 z-30 flex flex-col gap-1 px-4 pt-2 pointer-events-none"
      style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {hearts.map((alive, i) => (
            <span key={i} className={`text-xl ${alive ? 'text-red-400' : 'text-white/20'}`}>♥</span>
          ))}
        </div>
        <div className="text-center">
          <div className="text-white font-bold text-xl tabular-nums">{score.toLocaleString()}</div>
          <div className="text-white/40 text-xs">{Math.floor(distance)}m</div>
        </div>
        <button
          className="pointer-events-auto text-white/60 text-xl w-8 h-8 flex items-center justify-center"
          onClick={pauseGame}
        >
          ⏸
        </button>
      </div>

      {/* Faith meter */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-purple-400 to-yellow-300 rounded-full transition-all duration-300"
          style={{ width: `${faithMeter}%` }}
        />
      </div>
      {faithMeter >= 90 && (
        <div className="text-center text-xs text-yellow-300 animate-pulse">FAITH WALK READY — Swipe Up!</div>
      )}
    </div>
  )
}
