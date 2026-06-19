'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useUniverseStore } from '@/store/universeStore';

export default function LoadingScreen() {
  const isComplete = useUniverseStore((s) => s.isLoadingComplete);

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          className="fixed inset-0 z-50 bg-cosmos-950 flex flex-col items-center justify-center gap-4"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.0, ease: 'easeInOut' }}
        >
          {/* Title */}
          <motion.h1
            className="text-5xl font-serif text-gold-400 tracking-wide"
            style={{ textShadow: '0 0 50px rgba(251,191,36,0.7)' }}
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            Bible Universe
          </motion.h1>

          <p className="text-sm text-white/40 italic tracking-[0.2em] uppercase">
            From Creation to Revelation
          </p>

          {/* Progress bar */}
          <div className="w-56 h-px bg-white/10 rounded-full overflow-hidden mt-4">
            <motion.div
              className="h-full bg-gradient-to-r from-gold-600 to-gold-300"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 1.0, ease: 'easeInOut' }}
            />
          </div>

          <p className="text-white/20 text-xs tracking-widest uppercase mt-2">
            Initialising universe
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
