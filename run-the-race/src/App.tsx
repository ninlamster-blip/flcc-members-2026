import { Suspense, Component, type ReactNode } from 'react'
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

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>✝</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Something went wrong</div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '24px' }}>{String(this.state.error)}</div>
          <button onClick={() => window.location.reload()} style={{ padding: '12px 28px', background: '#FBBF24', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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
    <ErrorBoundary>
      <div className="relative w-full h-full bg-black">
        <Suspense fallback={<LoadingFallback />}>
          {inGame && (
            <ErrorBoundary>
              <>
                <GameScene />
                <HUD />
                <VerseToast />
                {(phase === 'running' || phase === 'faith') && <TouchControls />}
              </>
            </ErrorBoundary>
          )}
          {phase === 'faith' && <FaithWalkOverlay />}
          {phase === 'paused' && <PauseScreen />}
          {phase === 'menu' && <MainMenu />}
          {phase === 'journal' && <VerseJournal />}
          {phase === 'gameover' && <GameOverScreen />}
          {phase === 'victory' && <VictoryScreen />}
        </Suspense>
      </div>
    </ErrorBoundary>
  )
}
