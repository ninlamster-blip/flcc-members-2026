'use client';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useUniverseStore } from '@/store/universeStore';
import { ERAS } from '@/data/eras';
import { UI } from '@/lib/colorSystem';

const PANEL_W = 192;

/** Camera position used when flying to an era disc — pulled back enough to see the whole cluster. */
function eraCamPosition(eraZ: number): [number, number, number] {
  return [0, 220, eraZ + 680];
}

export default function EraNavigator() {
  const [isOpen, setIsOpen] = useState(false);

  const isLoadingComplete = useUniverseStore((s) => s.isLoadingComplete);
  const cameraTarget      = useUniverseStore((s) => s.cameraTarget);
  const { setCameraPosition, setCameraTarget } = useUniverseStore.getState();

  // Highlight whichever era the camera is currently aimed at.
  const activeEraId = useMemo(() => {
    const camZ = cameraTarget[2];
    let bestId  = ERAS[0].id;
    let minDist = Infinity;
    for (const era of ERAS) {
      const d = Math.abs(era.zPosition - camZ);
      if (d < minDist) { minDist = d; bestId = era.id; }
    }
    return bestId;
  }, [cameraTarget]);

  if (!isLoadingComplete) return null;

  const flyTo = (eraZ: number) => {
    setCameraTarget([0, 0, eraZ]);
    setCameraPosition(eraCamPosition(eraZ));
  };

  return (
    <div
      style={{
        position:  'fixed',
        left:       0,
        top:       '50%',
        transform: 'translateY(-50%)',
        zIndex:     20,
        display:   'flex',
        alignItems: 'stretch',
        pointerEvents: 'none',
      }}
    >
      {/* ── Collapsible panel ─────────────────────────────────────── */}
      <motion.div
        animate={{ width: isOpen ? PANEL_W : 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{
          overflow:   'hidden',
          flexShrink: 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <div
          style={{
            width:      PANEL_W,
            maxHeight:  'calc(100vh - 130px)',
            overflowY:  'auto',
            background: UI.panelBg,
            borderTop:    `1px solid ${UI.panelBorder}`,
            borderRight:  `1px solid ${UI.panelBorder}`,
            borderBottom: `1px solid ${UI.panelBorder}`,
            borderRadius: '0 10px 10px 0',
            paddingBottom: 8,
          }}
        >
          {/* Header */}
          <div style={{
            padding:       '10px 14px 8px',
            fontFamily:    'serif',
            fontSize:      9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color:          UI.textMuted,
            borderBottom:  `1px solid ${UI.panelBorder}`,
            marginBottom:   4,
          }}>
            Biblical Timeline
          </div>

          {/* Era rows */}
          {ERAS.map((era) => {
            const isActive = era.id === activeEraId;
            return (
              <button
                key={era.id}
                onClick={() => flyTo(era.zPosition)}
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:         10,
                  width:      '100%',
                  padding:    '7px 14px',
                  background:  isActive ? `${era.color}16` : 'transparent',
                  border:     'none',
                  cursor:     'pointer',
                  textAlign:  'left',
                  transition: 'background 0.15s',
                }}
              >
                {/* Era color dot */}
                <div style={{
                  width:           7,
                  height:          7,
                  borderRadius:   '50%',
                  backgroundColor: era.color,
                  flexShrink:      0,
                  boxShadow:       isActive ? `0 0 7px ${era.color}` : 'none',
                  transition:      'box-shadow 0.2s',
                }} />

                {/* Label + period */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily:   'serif',
                    fontSize:      12,
                    color:         isActive ? '#ffffff' : UI.textSecondary,
                    fontWeight:    isActive ? 'bold' : 'normal',
                    letterSpacing: '0.02em',
                    whiteSpace:   'nowrap',
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {era.label}
                  </div>
                  <div style={{
                    fontFamily:   'serif',
                    fontSize:      9,
                    color:         UI.textMuted,
                    letterSpacing: '0.03em',
                    marginTop:     1,
                  }}>
                    {era.period}
                  </div>
                </div>

                {/* Active indicator arrow */}
                {isActive && (
                  <span style={{ fontSize: 9, color: era.color, flexShrink: 0 }}>▶</span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Toggle tab ────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        style={{
          pointerEvents: 'auto',
          width:          26,
          alignSelf:     'center',
          height:         92,
          background:     UI.panelBg,
          border:        `1px solid ${UI.panelBorder}`,
          borderLeft:    'none',
          borderRadius:  '0 8px 8px 0',
          cursor:        'pointer',
          display:       'flex',
          alignItems:    'center',
          justifyContent: 'center',
          flexShrink:     0,
        }}
      >
        <span style={{
          writingMode:    'vertical-rl',
          textOrientation: 'mixed',
          fontFamily:     'serif',
          fontSize:        9,
          letterSpacing:  '0.14em',
          textTransform:  'uppercase',
          color:           UI.textMuted,
          userSelect:     'none',
          transform:      isOpen ? 'rotate(180deg)' : 'none',
          transition:     'transform 0.22s ease',
        }}>
          Eras
        </span>
      </button>
    </div>
  );
}
