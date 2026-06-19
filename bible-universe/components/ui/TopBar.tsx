'use client';
import { useUniverseStore } from '@/store/universeStore';
import type { AppMode } from '@/types/bible';

const MODES: { id: AppMode; label: string; hint: string }[] = [
  { id: 'explore',      label: 'Explore',      hint: 'Free 3D navigation' },
  { id: 'story',        label: 'Story Mode',   hint: 'Cinematic tour from Creation to Revelation' },
  { id: 'learn',        label: 'Learn',        hint: 'Guided tour with teaching notes' },
  { id: 'presentation', label: 'Present',      hint: 'Full-screen church presentation mode' },
];

export default function TopBar() {
  const { mode, setMode, isLoadingComplete } = useUniverseStore();

  if (!isLoadingComplete) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-20 flex items-center px-6 h-14 gap-4"
      style={{ background: 'linear-gradient(180deg, rgba(2,5,16,0.92) 0%, transparent 100%)' }}
    >
      {/* Logo */}
      <div
        className="font-serif text-gold-400 text-lg tracking-wide whitespace-nowrap select-none"
        style={{ textShadow: '0 0 20px rgba(251,191,36,0.45)' }}
      >
        Bible Universe
      </div>

      {/* Search placeholder — Phase 6 */}
      <div className="flex-1 max-w-sm">
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5
                     text-white/30 text-sm font-serif cursor-not-allowed"
        >
          <span className="text-base leading-none">⌕</span>
          <span>Search people, places, events…</span>
          <span className="ml-auto text-xs opacity-50 border border-white/10 rounded px-1">Phase 6</span>
        </div>
      </div>

      <div className="flex-1" />

      {/* Mode buttons */}
      <nav className="flex gap-2">
        {MODES.map(({ id, label, hint }) => (
          <button
            key={id}
            title={hint}
            data-active={mode === id}
            className="mode-button"
            onClick={() => setMode(id)}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
