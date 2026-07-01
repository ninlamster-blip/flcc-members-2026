import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'

export default function VerseToast() {
  const currentVerse = useGameStore((s) => s.currentVerse)
  const [visible, setVisible] = useState(false)
  const [displayed, setDisplayed] = useState(currentVerse)

  useEffect(() => {
    if (!currentVerse) return
    setDisplayed(currentVerse)
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 3200)
    return () => clearTimeout(t)
  }, [currentVerse])

  if (!visible || !displayed) return null

  return (
    <div
      className="fixed bottom-24 inset-x-4 z-20 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="bg-black/75 border border-yellow-400/40 rounded-2xl px-5 py-3 max-w-sm text-center backdrop-blur-sm">
        <div className="text-yellow-400 text-xs font-bold tracking-widest mb-1">✝ SCRIPTURE COLLECTED</div>
        <p className="text-white text-xs italic leading-relaxed">"{displayed.text}"</p>
        <p className="text-yellow-300/70 text-xs mt-1">— {displayed.ref}</p>
      </div>
    </div>
  )
}
