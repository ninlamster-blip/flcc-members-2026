import { useGameStore, Lane } from '@/store/gameStore'

const btnBase: React.CSSProperties = {
  width: 72, height: 72, borderRadius: 16,
  border: '1.5px solid rgba(255,255,255,0.18)',
  background: 'rgba(0,0,0,0.55)',
  color: 'white', fontSize: '1.6rem', lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
  cursor: 'pointer', userSelect: 'none',
}

export default function TouchControls() {
  const setTargetLane = useGameStore((s) => s.setTargetLane)
  const faithMeter = useGameStore((s) => s.faithMeter)
  const triggerFaithWalk = useGameStore((s) => s.triggerFaithWalk)

  const goLeft = () => {
    const cur = useGameStore.getState().targetLane
    if (cur > -1) setTargetLane((cur - 1) as Lane)
  }
  const goRight = () => {
    const cur = useGameStore.getState().targetLane
    if (cur < 1) setTargetLane((cur + 1) as Lane)
  }
  const faithReady = faithMeter >= 90

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 flex items-end justify-between px-5 pointer-events-none"
      style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}
    >
      <button
        className="pointer-events-auto active:opacity-60 transition-opacity"
        style={btnBase}
        onPointerDown={(e) => { e.preventDefault(); goLeft() }}
        aria-label="Move left"
      >◀</button>

      <button
        className="pointer-events-auto active:opacity-60 transition-opacity"
        style={{
          ...btnBase,
          width: 80, height: 80,
          border: faithReady ? '2px solid rgba(251,191,36,0.8)' : '1.5px solid rgba(255,255,255,0.12)',
          background: faithReady ? 'rgba(120,53,15,0.7)' : 'rgba(0,0,0,0.35)',
          fontSize: '1.1rem',
          flexDirection: 'column',
          gap: 2,
          opacity: faithReady ? 1 : 0.3,
          boxShadow: faithReady ? '0 0 20px rgba(251,191,36,0.4)' : 'none',
        }}
        onPointerDown={(e) => { e.preventDefault(); if (faithReady) triggerFaithWalk() }}
        aria-label="Walk by Faith"
      >
        <span>✝</span>
        <span style={{ fontSize: '0.55rem', letterSpacing: '0.08em', fontWeight: 700 }}>FAITH</span>
      </button>

      <button
        className="pointer-events-auto active:opacity-60 transition-opacity"
        style={btnBase}
        onPointerDown={(e) => { e.preventDefault(); goRight() }}
        aria-label="Move right"
      >▶</button>
    </div>
  )
}
