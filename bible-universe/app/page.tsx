'use client';
import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';

const BibleUniverse = dynamic(
  () => import('@/components/universe/BibleUniverse'),
  {
    ssr: false,
    loading: () => <LoadingFallback />,
  }
);

export default function Home() {
  return (
    <ErrorBoundary>
      <BibleUniverse />
    </ErrorBoundary>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 bg-cosmos-950 flex flex-col items-center justify-center gap-4 p-8">
          <h1 className="text-3xl font-serif text-red-400">Failed to load Bible Universe</h1>
          <pre className="text-xs text-white/50 bg-white/5 p-4 rounded max-w-xl overflow-auto whitespace-pre-wrap">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
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
