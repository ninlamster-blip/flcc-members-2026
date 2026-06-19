'use client';
import { useUniverseStore } from '@/store/universeStore';
import { NODE_COLORS } from '@/lib/colorSystem';
import type { LayerId } from '@/types/bible';

interface LayerDef {
  id:    LayerId;
  label: string;
  color: string;
  phase: number; // which phase activates this layer
}

const LAYERS: LayerDef[] = [
  { id: 'people',          label: 'People',       color: NODE_COLORS.person,    phase: 3 },
  { id: 'places',          label: 'Places',       color: NODE_COLORS.place,     phase: 3 },
  { id: 'events',          label: 'Events',       color: NODE_COLORS.event,     phase: 3 },
  { id: 'books',           label: 'Books',        color: NODE_COLORS.book,      phase: 3 },
  { id: 'prophecies',      label: 'Prophecies',   color: NODE_COLORS.prophecy,  phase: 9 },
  { id: 'doctrines',       label: 'Doctrines',    color: NODE_COLORS.doctrine,  phase: 3 },
  { id: 'pauls-journeys',  label: "Paul's Map",   color: '#00DDFF',             phase: 8 },
  { id: 'revelation-layer',label: 'Revelation',   color: '#FF44AA',             phase: 10 },
];

export default function LayerToggles() {
  const { visibleLayers, toggleLayer, isLoadingComplete } = useUniverseStore();

  if (!isLoadingComplete) return null;

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 pb-4 px-6"
      style={{ background: 'linear-gradient(0deg, rgba(2,5,16,0.92) 0%, transparent 100%)' }}
    >
      {LAYERS.map(({ id, label, color }) => {
        const active = visibleLayers.has(id);
        return (
          <button
            key={id}
            onClick={() => toggleLayer(id)}
            className="px-3.5 py-1 rounded-full border text-xs font-serif tracking-wide transition-all duration-200 whitespace-nowrap"
            style={{
              borderColor:     color,
              color:           color,
              backgroundColor: active ? `${color}18` : 'transparent',
              opacity:         active ? 1 : 0.30,
              boxShadow:       active ? `0 0 8px ${color}44` : 'none',
            }}
          >
            {label}
          </button>
        );
      })}

      {/* Navigation hint */}
      <span className="ml-4 text-white/20 text-xs hidden md:block whitespace-nowrap select-none">
        Drag · Scroll · Click
      </span>
    </div>
  );
}
