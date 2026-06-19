'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useUniverseStore, useSelectedNode } from '@/store/universeStore';
import { NODE_COLORS, UI } from '@/lib/colorSystem';
import { ERAS } from '@/data/eras';

const TYPE_LABELS: Record<string, string> = {
  person:    'Person',
  place:     'Place',
  event:     'Event',
  book:      'Book',
  prophecy:  'Prophecy',
  doctrine:  'Doctrine',
};

export default function DetailPanel() {
  const node       = useSelectedNode();
  const selectNode = useUniverseStore((s) => s.selectNode);

  const era = node ? ERAS.find((e) => e.id === node.eraId) : null;

  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          key={node.id}
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0,   opacity: 1 }}
          exit={{    x: 360, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          style={{
            position:    'fixed',
            top:         56,
            right:       0,
            bottom:      0,
            width:       340,
            zIndex:      20,
            background:  UI.panelBg,
            borderLeft:  `1px solid ${UI.panelBorder}`,
            display:     'flex',
            flexDirection: 'column',
            overflow:    'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding:      '20px 20px 0',
            borderBottom: `1px solid ${UI.panelBorder}`,
            paddingBottom: 16,
          }}>
            {/* Type badge + close */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{
                fontSize:      11,
                fontFamily:    'serif',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color:         NODE_COLORS[node.type as keyof typeof NODE_COLORS],
                padding:       '2px 10px',
                borderRadius:  9999,
                border:        `1px solid ${NODE_COLORS[node.type as keyof typeof NODE_COLORS]}55`,
                background:    `${NODE_COLORS[node.type as keyof typeof NODE_COLORS]}12`,
              }}>
                {TYPE_LABELS[node.type] ?? node.type}
              </span>

              <button
                onClick={() => selectNode(null)}
                style={{
                  background: 'none',
                  border:     'none',
                  color:      UI.textMuted,
                  fontSize:   20,
                  cursor:     'pointer',
                  lineHeight: 1,
                  padding:    '2px 6px',
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Title */}
            <h2 style={{
              margin:        0,
              fontFamily:    'serif',
              fontSize:      22,
              fontWeight:    'normal',
              color:         '#ffffff',
              lineHeight:    1.25,
              textShadow:    `0 0 20px ${NODE_COLORS[node.type as keyof typeof NODE_COLORS]}66`,
            }}>
              {node.label}
            </h2>

            {/* Era */}
            {era && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: UI.textMuted, fontFamily: 'serif' }}>
                {era.label} · {era.period}
              </p>
            )}
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 32px' }}>
            {/* Description */}
            <p style={{
              margin:     '0 0 20px',
              fontFamily: 'serif',
              fontSize:   14,
              lineHeight: 1.7,
              color:      UI.textSecondary,
            }}>
              {node.description}
            </p>

            {/* Scripture references */}
            {node.verses.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <h3 style={{
                  margin:        '0 0 10px',
                  fontFamily:    'serif',
                  fontSize:      11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color:         UI.textMuted,
                }}>
                  Key Scriptures
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {node.verses.map((v) => (
                    <span key={v} style={{
                      fontFamily:  'monospace',
                      fontSize:    11,
                      color:       UI.goldPrimary,
                      padding:     '3px 9px',
                      borderRadius: 4,
                      background:  'rgba(251,191,36,0.08)',
                      border:      '1px solid rgba(251,191,36,0.2)',
                    }}>
                      {v}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Tags */}
            {node.tags && node.tags.length > 0 && (
              <section>
                <h3 style={{
                  margin:        '0 0 10px',
                  fontFamily:    'serif',
                  fontSize:      11,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color:         UI.textMuted,
                }}>
                  Themes
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {node.tags.map((tag) => (
                    <span key={tag} style={{
                      fontFamily:  'serif',
                      fontSize:    11,
                      color:       UI.textSecondary,
                      padding:     '3px 9px',
                      borderRadius: 4,
                      background:  'rgba(255,255,255,0.05)',
                      border:      '1px solid rgba(255,255,255,0.10)',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
