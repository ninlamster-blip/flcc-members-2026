import { useEffect, useRef } from 'react'
import { useGameStore } from '@/store/gameStore'

export default function FaithWalkOverlay() {
  const endFaithWalk = useGameStore((s) => s.endFaithWalk)
  const currentVerse = useGameStore((s) => s.currentVerse)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(endFaithWalk, 5500)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [endFaithWalk])

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
      {/* Radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(250,204,21,0.18) 0%, transparent 70%)',
        }}
      />

      <div className="relative text-center px-8">
        <div className="text-6xl mb-3" style={{ filter: 'drop-shadow(0 0 16px #fbbf24)' }}>✝</div>
        <div
          className="text-3xl font-bold tracking-[0.2em] mb-1 text-yellow-300"
          style={{ textShadow: '0 0 24px #fbbf24, 0 0 48px #f59e0b' }}
        >
          WALK BY FAITH
        </div>
        <div className="text-xs text-yellow-400/70 tracking-widest mb-5">2 Corinthians 5:7</div>

        {currentVerse && (
          <div
            className="bg-black/60 rounded-2xl border border-yellow-300/30 px-6 py-4 max-w-xs mx-auto backdrop-blur-sm"
            style={{ boxShadow: '0 0 30px rgba(251,191,36,0.15)' }}
          >
            <p className="text-white text-sm italic leading-relaxed mb-2">
              "{currentVerse.text}"
            </p>
            <p className="text-yellow-400/80 text-xs tracking-wider">— {currentVerse.ref}</p>
          </div>
        )}

        <div className="mt-5 text-yellow-300/50 text-xs tracking-widest animate-pulse">
          ALL SCROLLS AUTO-COLLECTED
        </div>
      </div>
    </div>
  )
}
