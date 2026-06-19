'use client';
import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useUniverseStore } from '@/store/universeStore';
import { UI } from '@/lib/colorSystem';

const CAMERA_FLY_MS = 1500; // matches CameraRig duration

export default function StoryMode() {
  const nodes        = useUniverseStore((s) => s.nodes);
  const storyStops   = useUniverseStore((s) => s.storyStops);
  const storyStep    = useUniverseStore((s) => s.storyStep);
  const isPlaying    = useUniverseStore((s) => s.isStoryPlaying);
  const {
    stopStory, nextStoryStep, prevStoryStep,
    selectNode, setCameraPosition, setCameraTarget,
  } = useUniverseStore.getState();

  const [paused, setPaused] = useState(false);

  const stop   = storyStops[storyStep];
  const total  = storyStops.length;

  // Fly camera to current stop whenever step changes
  useEffect(() => {
    if (!isPlaying || !stop) return;
    const node = nodes.find((n) => n.id === stop.nodeId);
    const pos  = node?.position ?? { x: 0, y: 0, z: 0 };

    selectNode(stop.nodeId);
    setCameraTarget([pos.x, pos.y, pos.z]);
    setCameraPosition([
      pos.x + stop.cameraOffset[0],
      pos.y + stop.cameraOffset[1],
      pos.z + stop.cameraOffset[2],
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyStep, isPlaying]);

  // Auto-advance timer
  useEffect(() => {
    if (!isPlaying || paused || !stop) return;
    const ms = CAMERA_FLY_MS + stop.duration;
    const t  = setTimeout(() => nextStoryStep(), ms);
    return () => clearTimeout(t);
  }, [storyStep, isPlaying, paused, stop, nextStoryStep]);

  // Reset pause when story starts fresh
  useEffect(() => {
    if (isPlaying && storyStep === 0) setPaused(false);
  }, [isPlaying, storyStep]);

  const handleExit = useCallback(() => {
    stopStory();
    selectNode(null);
    setPaused(false);
  }, [stopStory, selectNode]);

  return (
    <AnimatePresence>
      {isPlaying && stop && (
        <motion.div
          key="story-overlay"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            position:   'fixed',
            bottom:     52,          // above layer toggles
            left:       '50%',
            transform:  'translateX(-50%)',
            width:      'min(720px, calc(100vw - 32px))',
            zIndex:     25,
            background: 'linear-gradient(135deg, rgba(4,8,24,0.96) 0%, rgba(8,4,24,0.94) 100%)',
            border:     '1px solid rgba(255,255,255,0.10)',
            borderRadius: 16,
            boxShadow:  '0 8px 40px rgba(0,0,0,0.7)',
            backdropFilter: 'blur(12px)',
            padding:    '20px 24px 16px',
          }}
        >
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 14 }}>
            {storyStops.map((_, i) => (
              <div
                key={i}
                onClick={() => {
                  useUniverseStore.getState().setStoryStep(i);
                  setPaused(false);
                }}
                style={{
                  width:        i === storyStep ? 18 : 6,
                  height:       6,
                  borderRadius: 3,
                  background:   i === storyStep
                    ? UI.goldPrimary
                    : i < storyStep ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.18)',
                  transition:   'all 0.3s',
                  cursor:       'pointer',
                }}
              />
            ))}
          </div>

          {/* Narration text */}
          <AnimatePresence mode="wait">
            <motion.p
              key={storyStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              style={{
                margin:        0,
                fontFamily:    'serif',
                fontSize:      15,
                lineHeight:    1.75,
                color:         UI.textSecondary,
                textAlign:     'center',
                letterSpacing: '0.015em',
                minHeight:     '3.5em',
              }}
            >
              {stop.narration}
            </motion.p>
          </AnimatePresence>

          {/* Controls */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            8,
            marginTop:      18,
          }}>
            {/* Prev */}
            <ControlBtn
              onClick={() => { prevStoryStep(); setPaused(false); }}
              disabled={storyStep === 0}
              title="Previous"
            >
              ←
            </ControlBtn>

            {/* Pause / Resume */}
            <ControlBtn
              onClick={() => setPaused((p) => !p)}
              title={paused ? 'Resume' : 'Pause'}
              gold
            >
              {paused ? '▶' : '⏸'}
            </ControlBtn>

            {/* Next */}
            <ControlBtn
              onClick={() => { nextStoryStep(); setPaused(false); }}
              disabled={storyStep === total - 1}
              title="Next"
            >
              →
            </ControlBtn>

            {/* Counter */}
            <span style={{
              marginLeft: 12,
              fontFamily: 'monospace',
              fontSize:   12,
              color:      UI.textMuted,
              letterSpacing: '0.05em',
            }}>
              {storyStep + 1} / {total}
            </span>

            {/* Exit */}
            <ControlBtn onClick={handleExit} title="Exit story" style={{ marginLeft: 8 }}>
              ✕
            </ControlBtn>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ControlBtnProps {
  onClick:   () => void;
  children:  React.ReactNode;
  disabled?: boolean;
  title?:    string;
  gold?:     boolean;
  style?:    React.CSSProperties;
}

function ControlBtn({ onClick, children, disabled, title, gold, style }: ControlBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background:    gold ? `${UI.goldPrimary}18` : 'rgba(255,255,255,0.06)',
        border:        `1px solid ${gold ? UI.goldPrimary + '55' : 'rgba(255,255,255,0.12)'}`,
        color:         gold ? UI.goldPrimary : disabled ? 'rgba(255,255,255,0.2)' : UI.textSecondary,
        borderRadius:  8,
        padding:       '6px 14px',
        fontSize:      13,
        cursor:        disabled ? 'default' : 'pointer',
        fontFamily:    'serif',
        letterSpacing: '0.04em',
        transition:    'all 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
