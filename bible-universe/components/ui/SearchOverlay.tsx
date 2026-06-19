'use client';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUniverseStore } from '@/store/universeStore';
import { searchNodes, matchSnippet } from '@/lib/search';
import { NODE_COLORS, UI } from '@/lib/colorSystem';
import { ERAS } from '@/data/eras';
import { cameraPositionForNode } from '@/lib/graphLayout';
import type { BibleNode, SearchResult } from '@/types/bible';

const TYPE_LABELS: Record<string, string> = {
  person: 'Person', place: 'Place', event: 'Event',
  book: 'Book', prophecy: 'Prophecy', doctrine: 'Doctrine',
};

export default function SearchOverlay() {
  const isOpen = useUniverseStore((s) => s.isSearchOpen);
  const nodes  = useUniverseStore((s) => s.nodes);
  const { closeSearch, selectNode, setCameraPosition, setCameraTarget } =
    useUniverseStore.getState();

  const [query,     setQuery]     = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchNodes(nodes, query), [nodes, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIdx(0);
      // slight delay so AnimatePresence can mount the input first
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => { setActiveIdx(0); }, [results.length]);

  const flyTo = useCallback((node: BibleNode) => {
    const pos = node.position ?? { x: 0, y: 0, z: 0 };
    const cam = cameraPositionForNode(pos, node.isSupernode, node.isKeyNode);
    selectNode(node.id);
    setCameraTarget([pos.x, pos.y, pos.z]);
    setCameraPosition([cam.x, cam.y, cam.z]);
    closeSearch();
  }, [selectNode, setCameraTarget, setCameraPosition, closeSearch]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[activeIdx]) flyTo(results[activeIdx].node);
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="search-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeSearch}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'rgba(2,5,16,0.80)',
              backdropFilter: 'blur(6px)',
            }}
          />

          {/* Panel */}
          <motion.div
            key="search-panel"
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{    opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.20, ease: 'easeOut' }}
            style={{
              position:  'fixed',
              top:       68,
              left:      '50%',
              transform: 'translateX(-50%)',
              width:     'min(580px, calc(100vw - 24px))',
              zIndex:    41,
              background: UI.panelBg,
              border:    `1px solid ${UI.panelBorder}`,
              borderRadius: 16,
              boxShadow: '0 16px 60px rgba(0,0,0,0.8)',
              overflow:  'hidden',
            }}
          >
            {/* Input row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px',
              borderBottom: results.length > 0
                ? `1px solid ${UI.panelBorder}`
                : 'none',
            }}>
              <span style={{ fontSize: 18, color: UI.textMuted, flexShrink: 0 }}>⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search people, places, events, books…"
                style={{
                  flex:        1,
                  background:  'none',
                  border:      'none',
                  outline:     'none',
                  color:       '#ffffff',
                  fontFamily:  'serif',
                  fontSize:    15,
                  letterSpacing: '0.02em',
                }}
              />
              <kbd style={{
                fontFamily:  'monospace',
                fontSize:    11,
                color:       UI.textMuted,
                padding:     '2px 6px',
                borderRadius: 4,
                border:      `1px solid ${UI.panelBorder}`,
                flexShrink:  0,
              }}>
                ESC
              </kbd>
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {results.map((r, i) => (
                  <ResultRow
                    key={r.node.id}
                    result={r}
                    isActive={i === activeIdx}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => flyTo(r.node)}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {query.length > 0 && results.length === 0 && (
              <div style={{
                padding:    '24px 18px',
                fontFamily: 'serif',
                fontSize:   13,
                color:      UI.textMuted,
                textAlign:  'center',
              }}>
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {/* Hint when empty */}
            {query.length === 0 && (
              <div style={{
                padding:    '16px 18px',
                fontFamily: 'serif',
                fontSize:   12,
                color:      UI.textMuted,
                display:    'flex',
                gap:        16,
              }}>
                <span>↑↓ navigate</span>
                <span>↵ select</span>
                <span>Esc close</span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ResultRow({
  result, isActive, onClick, onMouseEnter,
}: {
  result:       SearchResult;
  isActive:     boolean;
  onClick:      () => void;
  onMouseEnter: () => void;
}) {
  const { node, matchedField } = result;
  const color   = NODE_COLORS[node.type as keyof typeof NODE_COLORS] ?? '#ffffff';
  const era     = ERAS.find((e) => e.id === node.eraId);
  const snippet = matchedField !== 'label' ? matchSnippet(result) : null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        display:    'flex',
        alignItems: 'flex-start',
        gap:        12,
        padding:    '12px 18px',
        cursor:     'pointer',
        background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
        borderBottom: `1px solid ${UI.panelBorder}`,
        transition: 'background 0.1s',
      }}
    >
      {/* Type badge */}
      <span style={{
        fontSize:      10,
        fontFamily:    'serif',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color,
        padding:       '2px 8px',
        borderRadius:  9999,
        border:        `1px solid ${color}44`,
        background:    `${color}10`,
        whiteSpace:    'nowrap',
        flexShrink:    0,
        marginTop:     2,
      }}>
        {TYPE_LABELS[node.type] ?? node.type}
      </span>

      {/* Label + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily:  'serif',
          fontSize:    14,
          color:       '#ffffff',
          fontWeight:  node.isKeyNode || node.isSupernode ? 'bold' : 'normal',
          letterSpacing: '0.02em',
        }}>
          {node.label}
        </div>
        <div style={{
          fontFamily: 'serif',
          fontSize:   11,
          color:      UI.textMuted,
          marginTop:  2,
          whiteSpace: 'nowrap',
          overflow:   'hidden',
          textOverflow: 'ellipsis',
        }}>
          {era?.label ?? node.eraId}
          {snippet && ` · ${snippet}`}
        </div>
      </div>

      {/* Arrow hint on active */}
      {isActive && (
        <span style={{ color: UI.textMuted, fontSize: 12, flexShrink: 0, marginTop: 2 }}>↵</span>
      )}
    </div>
  );
}
