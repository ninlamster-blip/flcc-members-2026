'use client';
import { useEffect } from 'react';
import { useUniverseStore } from '@/store/universeStore';
import { ERAS }        from '@/data/eras';
import { ALL_NODES }   from '@/data/allNodes';
import { CONNECTIONS } from '@/data/connections';
import { STORY_STOPS } from '@/data/storyStops';
import { computeLayout } from '@/lib/graphLayout';
import Scene          from './Scene';
import LoadingScreen  from '../ui/LoadingScreen';
import TopBar         from '../ui/TopBar';
import LayerToggles   from '../ui/LayerToggles';
import DetailPanel    from '../ui/DetailPanel';
import StoryMode      from '../modes/StoryMode';
import SearchOverlay  from '../ui/SearchOverlay';

/**
 * BibleUniverse — root client component.
 *
 * Lifecycle:
 *   1. Mount: load era data into store (nodes + connections added in Phase 4).
 *   2. After 1.3s: mark loading complete → LoadingScreen fades out.
 *   3. Keyboard shortcuts registered for global navigation.
 *
 * Layout (z-stacking):
 *   z-0  : Scene (R3F Canvas, full-screen)
 *   z-10  : CSS2D labels (managed by drei Html)
 *   z-20  : TopBar, LayerToggles, DetailPanel
 *   z-50  : LoadingScreen
 */
export default function BibleUniverse() {
  const { initializeData, setLoadingComplete } = useUniverseStore();

  useEffect(() => {
    const nodesWithPositions = computeLayout(ALL_NODES, ERAS);
    initializeData(nodesWithPositions, CONNECTIONS, ERAS);
    useUniverseStore.getState().setStoryStops(STORY_STOPS);

    const t = setTimeout(() => setLoadingComplete(), 1300);
    return () => clearTimeout(t);
  }, [initializeData, setLoadingComplete]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const store = useUniverseStore.getState();
      const tag   = (e.target as HTMLElement).tagName;

      if (e.key === 'Escape') {
        store.selectNode(null);
        store.closeSearch();
        if (store.isStoryPlaying) store.stopStory();
      }

      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        store.openSearch();
      }

      if (e.key === 'f' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        store.setMode('story');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 bg-cosmos-950 overflow-hidden">
      {/* 3D Scene — full-screen canvas */}
      <Scene />

      {/* UI Overlays */}
      <TopBar />
      <LayerToggles />
      <DetailPanel />
      <StoryMode />
      <SearchOverlay />

      {/* Loading screen — fades out on completion */}
      <LoadingScreen />
    </div>
  );
}
