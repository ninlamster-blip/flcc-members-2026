import { useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'

export default function FaithWalkOverlay() {
  const { endFaithWalk, currentVerse } = useGameStore()

  useEffect(() => {
    const timer = setTimeout(endFaithWalk, 5000)
    return () => clearTimeout(timer)
  }, [endFaithWalk])

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
      <div className="text-center px-8">
        <div className="text-5xl mb-4 animate-bounce">✝</div>
        <div className="text-2xl font-bold text-yellow-300 tracking-widest mb-4 animate-pulse">WALK BY FAITH</div>
        {currentVerse && (
          <div className="bg-black/60 rounded-2xl border border-yellow-300/30 px-6 py-4 max-w-xs mx-auto">
            <p className="text-white text-sm italic mb-2">"{currentVerse.text}"</p>
            <p className="text-yellow-400 text-xs tracking-wider">— {currentVerse.ref}</p>
          </div>
        )}
      </div>
    </div>
  )
}
