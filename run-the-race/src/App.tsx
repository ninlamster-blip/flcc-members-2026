import { Suspense } from 'react'
import { useGameStore } from '@/store/gameStore'
import MainMenu from '@/ui/MainMenu'
import GameOverScreen from '@/ui/GameOverScreen'
import GameScene from '@/scenes/GameScene'
import HUD from '@/ui/HUD'
import PauseScreen from '@/ui/PauseScreen'
import FaithWalkOverlay from '@/ui/FaithWalkOverlay'
import VerseToast from '@/ui/VerseToast'

function LoadingFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div className="text-center text-white">
        <div className="text-4xl mb-4">✝</div>
        <div className="text-lg font-display tracking-widest opacity-70">Loading...</div>
      </div>
    </div>
  )
}

export default function App() {
  const phase = useGameStore((s) => s.phase)

  return (
    <div className="relative w-full h-full bg-black">
      <Suspense fallback={<LoadingFallback />}>
        {(phase === 'running' || phase === 'paused' || phase === 'faith') && (
          <>
            <GameScene />
            <HUD />
            <VerseToast />
          </>
        )}
        {phase === 'faith' && <FaithWalkOverlay />}
        {phase === 'paused' && <PauseScreen />}
        {phase === 'menu' && <MainMenu />}
        {phase === 'gameover' && <GameOverScreen />}
      </Suspense>
    </div>
  )
}
