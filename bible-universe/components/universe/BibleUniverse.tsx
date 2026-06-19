'use client';
/**
 * BibleUniverse — root client component.
 *
 * Orchestration responsibilities:
 *   1. Initialize node/connection/era data into the Zustand store.
 *   2. Render the R3F <Scene /> (3D canvas).
 *   3. Render all 2D UI overlays (TopBar, DetailPanel, LayerToggles, etc.).
 *   4. Register global keyboard shortcuts (Escape = deselect, / = search, F = story).
 *   5. Manage loading state and transition to the live scene.
 *
 * Phase 2 will implement the Scene + data initialization.
 * Phase 3 will add node rendering inside the Scene.
 */

// ─── Placeholder until Phase 2 ───────────────────────────────────────────────

export default function BibleUniverse() {
  return (
    <div className="fixed inset-0 bg-cosmos-950 flex flex-col items-center justify-center gap-3">
      <h2 className="text-gold-400 font-serif text-3xl tracking-wide"
          style={{ textShadow: '0 0 30px rgba(251,191,36,0.5)' }}>
        Bible Universe
      </h2>
      <p className="text-white/30 text-sm font-serif italic">
        Architecture complete — Phase 2 will add the 3D scene.
      </p>
      <div className="mt-6 text-white/20 text-xs tracking-widest uppercase">
        Phase 1 · Architecture
      </div>
    </div>
  );
}
