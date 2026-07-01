import { useGameStore } from '@/store/gameStore'

export default function HUD() {
  const score = useGameStore((s) => s.score)
  const lives = useGameStore((s) => s.lives)
  const distance = useGameStore((s) => s.distance)
  const faithMeter = useGameStore((s) => s.faithMeter)
  const multiplier = useGameStore((s) => s.multiplier)
  const combo = useGameStore((s) => s.combo)
  const pauseGame = useGameStore((s) => s.pauseGame)

  const hearts = Array.from({ length: 3 }, (_, i) => i < lives)
  const faithReady = faithMeter >= 90
  const faithPct = `${faithMeter}%`

  return (
    <div
      className="fixed inset-x-0 top-0 z-30 flex flex-col gap-1.5 px-4 pointer-events-none"
      style={{ paddingTop: 'max(10px, env(safe-area-inset-top, 10px))' }}
    >
      {/* Top row: lives / score / pause */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {hearts.map((alive, i) => (
            <span key={i} className={`text-xl leading-none ${alive ? 'text-red-400' : 'text-white/20'}`}>
              ♥
            </span>
          ))}
        </div>

        <div className="text-center">
          <div className="text-white font-bold text-2xl tabular-nums leading-none drop-shadow">
            {Math.floor(score).toLocaleString()}
          </div>
          <div className="text-white/40 text-xs tabular-nums">{Math.floor(distance)}m</div>
        </div>

        <button
          className="pointer-events-auto text-white/50 text-xl w-9 h-9 flex items-center justify-center rounded-lg active:bg-white/10"
          onClick={pauseGame}
        >
          ⏸
        </button>
      </div>

      {/* Combo badge */}
      {multiplier > 1 && (
        <div className="self-center">
          <div className={`
            text-xs font-bold tracking-widest px-3 py-0.5 rounded-full border
            ${multiplier >= 4
              ? 'text-yellow-300 border-yellow-300/60 bg-yellow-900/40 animate-pulse'
              : multiplier >= 3
                ? 'text-purple-300 border-purple-300/60 bg-purple-900/40'
                : 'text-blue-300 border-blue-300/40 bg-blue-900/30'}
          `}>
            x{multiplier} COMBO · {combo} scrolls
          </div>
        </div>
      )}

      {/* Faith meter */}
      <div className="flex items-center gap-2">
        <span className="text-white/40 text-xs font-bold tracking-widest w-10">FAITH</span>
        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              faithReady
                ? 'bg-gradient-to-r from-yellow-300 to-white animate-pulse'
                : 'bg-gradient-to-r from-purple-500 to-blue-400'
            }`}
            style={{ width: faithPct }}
          />
        </div>
        {faithReady && (
          <span className="text-yellow-300 text-xs font-bold animate-pulse">↑</span>
        )}
      </div>

      {faithReady && (
        <div className="self-center text-yellow-300/90 text-xs font-bold tracking-widest animate-pulse">
          WALK BY FAITH — SWIPE UP
        </div>
      )}
    </div>
  )
}
