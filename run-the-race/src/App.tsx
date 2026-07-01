import { Suspense } from 'react'
import { useGameStore } from '@/store/gameStore'
import MainMenu from '@/ui/MainMenu'
import GameOverScreen from '@/ui/GameOverScreen'
import VictoryScreen from '@/ui/VictoryScreen'
import VerseJournal from '@/ui/VerseJournal'
import GameScene from '@/scenes/GameScene'
import HUD from '@/ui/HUD'
import PauseScreen from '@/ui/PauseScreen'
import FaithWalkOverlay from '@/ui/FaithWalkOverlay'
import VerseToast from '@/ui/VerseToast'
import TouchControls from '@/ui/TouchControls'

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
  const inGame = phase === 'running' || phase === 'paused' || phase === 'faith'

  return (
    <div className="relative w-full h-full bg-black">
      <Suspense fallback={<LoadingFallback />}>
        {inGame && (
          <>
            <GameScene />
            <HUD />
            <VerseToast />
            {(phase === 'running' || phase === 'faith') && <TouchControls />}
          </>
        )}
        {phase === 'faith' && <FaithWalkOverlay />}
        {phase === 'paused' && <PauseScreen />}
        {phase === 'menu' && <MainMenu />}
        {phase === 'journal' && <VerseJournal />}
        {phase === 'gameover' && <GameOverScreen />}
        {phase === 'victory' && <VictoryScreen />}
      </Suspense>
    </div>
  )
}
