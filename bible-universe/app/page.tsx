/**
 * Root page — renders the full-screen Bible Universe application.
 *
 * BibleUniverse is dynamically imported (ssr: false) because:
 *   1. Three.js / WebGL cannot run on the server.
 *   2. @react-three/fiber uses browser-only APIs.
 *   3. Zustand store initialization expects browser globals.
 */
import dynamic from 'next/dynamic';

const BibleUniverse = dynamic(
  () => import('@/components/universe/BibleUniverse'),
  {
    ssr: false,
    loading: () => <LoadingFallback />,
  }
);

export default function Home() {
  return <BibleUniverse />;
}

function LoadingFallback() {
  return (
    <div className="fixed inset-0 bg-cosmos-950 flex flex-col items-center justify-center gap-4">
      <h1
        className="text-5xl font-serif text-gold-400 tracking-wide"
        style={{ textShadow: '0 0 40px rgba(251,191,36,0.6)' }}
      >
        Bible Universe
      </h1>
      <p className="text-sm text-white/40 italic tracking-widest">
        From Creation to Revelation
      </p>
      <div className="w-64 h-px bg-white/10 rounded-full overflow-hidden mt-3">
        <div className="h-full w-1/2 bg-gradient-to-r from-gold-500 to-gold-300 animate-pulse" />
      </div>
    </div>
  );
}
