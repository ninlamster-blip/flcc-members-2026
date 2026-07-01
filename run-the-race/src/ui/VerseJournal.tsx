import { useGameStore, VERSES } from '@/store/gameStore'

export default function VerseJournal() {
  const verseProgress = useGameStore((s) => s.verseProgress)
  const setPhase = useGameStore((s) => s.setPhase)
  const collected = verseProgress.length
  const pct = Math.round((collected / VERSES.length) * 100)

  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-indigo-950 to-black text-white flex flex-col"
      style={{
        paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
      }}
    >
      {/* Header */}
      <div className="px-5 pb-4 border-b border-white/10 flex-shrink-0">
        <button
          onClick={() => setPhase('menu')}
          className="text-white/50 text-sm mb-3 tracking-wider active:text-white transition-colors"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-bold tracking-widest">VERSE JOURNAL</h2>
        <p className="text-white/50 text-xs mt-1">
          {collected} of {VERSES.length} scriptures found
        </p>
        <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-400 to-yellow-300 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Verses list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {VERSES.map((verse, i) => {
          const found = verseProgress.includes(i)
          return (
            <div
              key={i}
              className={`rounded-2xl border px-5 py-4 transition-all ${
                found
                  ? 'border-yellow-400/30 bg-yellow-900/20'
                  : 'border-white/8 bg-white/3 opacity-40'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`text-xl flex-shrink-0 mt-0.5 ${found ? 'text-yellow-400' : 'text-white/20'}`}>
                  {found ? '✝' : '○'}
                </span>
                <div>
                  {found ? (
                    <>
                      <p className="text-white text-sm italic leading-relaxed">"{verse.text}"</p>
                      <p className="text-yellow-400/70 text-xs mt-1 tracking-wider">— {verse.ref}</p>
                    </>
                  ) : (
                    <p className="text-white/30 text-sm">Collect a scripture scroll to reveal this verse</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {collected === VERSES.length && (
        <div className="px-5 py-3 text-center flex-shrink-0">
          <div className="text-yellow-300 text-sm font-bold tracking-widest animate-pulse">
            ✝ FULL ARMOR OF FAITH COLLECTED ✝
          </div>
        </div>
      )}
    </div>
  )
}
