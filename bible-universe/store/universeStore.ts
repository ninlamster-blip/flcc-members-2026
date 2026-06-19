import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import type {
  BibleNode, BibleConnection, BibleEra,
  AppMode, LayerId, SearchResult, StoryStop,
} from '@/types/bible';

// ─── State Shape ──────────────────────────────────────────────────────────────

interface UniverseState {
  // Loaded data
  nodes:       BibleNode[];
  connections: BibleConnection[];
  eras:        BibleEra[];

  // Selection
  selectedNodeId: string | null;
  hoveredNodeId:  string | null;

  // Navigation
  mode: AppMode;

  // Layer visibility
  visibleLayers: Set<LayerId>;

  // Search
  searchQuery:    string;
  searchResults:  SearchResult[];
  isSearchOpen:   boolean;

  // Story Mode
  storyStep:     number;
  isStoryPlaying: boolean;
  storyStops:    StoryStop[];

  // Camera (synced from R3F; used by store subscribers for flyTo)
  cameraTarget:   [number, number, number];
  cameraPosition: [number, number, number];

  // UI
  isDetailPanelOpen: boolean;
  isLoadingComplete: boolean;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

interface UniverseActions {
  initializeData: (
    nodes:       BibleNode[],
    connections: BibleConnection[],
    eras:        BibleEra[],
  ) => void;

  // Selection
  selectNode: (id: string | null) => void;
  hoverNode:  (id: string | null) => void;

  // Mode
  setMode: (mode: AppMode) => void;

  // Layers
  toggleLayer:    (layer: LayerId) => void;
  setLayerVisible:(layer: LayerId, visible: boolean) => void;
  showAllLayers:  () => void;
  hideAllLayers:  () => void;

  // Search
  setSearchQuery:   (query: string)           => void;
  setSearchResults: (results: SearchResult[]) => void;
  openSearch:       () => void;
  closeSearch:      () => void;

  // Story
  startStory:    () => void;
  stopStory:     () => void;
  nextStoryStep: () => void;
  prevStoryStep: () => void;
  setStoryStep:  (step: number) => void;
  setStoryStops: (stops: StoryStop[]) => void;

  // Camera
  setCameraTarget:   (target:   [number, number, number]) => void;
  setCameraPosition: (position: [number, number, number]) => void;

  // UI
  setDetailPanelOpen: (open: boolean) => void;
  setLoadingComplete: () => void;
}

type UniverseStore = UniverseState & UniverseActions;

// ─── Default layers shown on first load ───────────────────────────────────────

const DEFAULT_VISIBLE_LAYERS: LayerId[] = [
  'people', 'places', 'events', 'books', 'prophecies', 'doctrines',
];

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUniverseStore = create<UniverseStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // ── Initial state ──
      nodes:              [],
      connections:        [],
      eras:               [],
      selectedNodeId:     null,
      hoveredNodeId:      null,
      mode:               'explore',
      visibleLayers:      new Set<LayerId>(DEFAULT_VISIBLE_LAYERS),
      searchQuery:        '',
      searchResults:      [],
      isSearchOpen:       false,
      storyStep:          0,
      isStoryPlaying:     false,
      storyStops:         [],
      cameraTarget:       [0, 0, 0],
      cameraPosition:     [0, 300, 3200],
      isDetailPanelOpen:  false,
      isLoadingComplete:  false,

      // ── Data ──
      initializeData: (nodes, connections, eras) =>
        set({ nodes, connections, eras }),

      // ── Selection ──
      selectNode: (id) =>
        set({ selectedNodeId: id, isDetailPanelOpen: id !== null }),
      hoverNode: (id) =>
        set({ hoveredNodeId: id }),

      // ── Mode ──
      setMode: (mode) =>
        set({
          mode,
          isStoryPlaying: mode === 'story',
          // Entering story mode resets to first stop
          storyStep: mode === 'story' ? 0 : get().storyStep,
        }),

      // ── Layers ──
      toggleLayer: (layer) =>
        set((s) => {
          const next = new Set(s.visibleLayers);
          if (next.has(layer)) next.delete(layer);
          else next.add(layer);
          return { visibleLayers: next };
        }),
      setLayerVisible: (layer, visible) =>
        set((s) => {
          const next = new Set(s.visibleLayers);
          if (visible) next.add(layer);
          else next.delete(layer);
          return { visibleLayers: next };
        }),
      showAllLayers: () =>
        set({ visibleLayers: new Set<LayerId>(DEFAULT_VISIBLE_LAYERS) }),
      hideAllLayers: () =>
        set({ visibleLayers: new Set<LayerId>() }),

      // ── Search ──
      setSearchQuery:   (query)   => set({ searchQuery: query }),
      setSearchResults: (results) => set({ searchResults: results }),
      openSearch:  () => set({ isSearchOpen: true }),
      closeSearch: () => set({ isSearchOpen: false, searchQuery: '', searchResults: [] }),

      // ── Story ──
      startStory: () =>
        set({ isStoryPlaying: true, storyStep: 0, mode: 'story' }),
      stopStory: () =>
        set({ isStoryPlaying: false, mode: 'explore' }),
      nextStoryStep: () => {
        const { storyStep, storyStops } = get();
        if (storyStep < storyStops.length - 1) {
          set({ storyStep: storyStep + 1 });
        } else {
          set({ isStoryPlaying: false, mode: 'explore' });
        }
      },
      prevStoryStep: () => {
        const { storyStep } = get();
        if (storyStep > 0) set({ storyStep: storyStep - 1 });
      },
      setStoryStep:  (step)  => set({ storyStep: step }),
      setStoryStops: (stops) => set({ storyStops: stops }),

      // ── Camera ──
      setCameraTarget:   (target)   => set({ cameraTarget: target }),
      setCameraPosition: (position) => set({ cameraPosition: position }),

      // ── UI ──
      setDetailPanelOpen: (open) => set({ isDetailPanelOpen: open }),
      setLoadingComplete: () => set({ isLoadingComplete: true }),
    })),
    { name: 'BibleUniverse' }
  )
);

// ─── Derived selector hooks ───────────────────────────────────────────────────
// Use these instead of raw `useUniverseStore` to avoid unnecessary re-renders.

export const useSelectedNode = (): BibleNode | null => {
  const { selectedNodeId, nodes } = useUniverseStore();
  return nodes.find((n) => n.id === selectedNodeId) ?? null;
};

export const useNodeConnections = (nodeId: string): BibleConnection[] => {
  const connections = useUniverseStore((s) => s.connections);
  return connections.filter((c) => c.fromId === nodeId || c.toId === nodeId);
};

export const useVisibleNodes = (): BibleNode[] => {
  const { nodes, visibleLayers } = useUniverseStore();
  return nodes.filter((n) => visibleLayers.has(n.type as LayerId));
};

export const useConnectedNodeIds = (nodeId: string): Set<string> => {
  const connections = useUniverseStore((s) => s.connections);
  const ids = new Set<string>();
  connections.forEach(({ fromId, toId }) => {
    if (fromId === nodeId) ids.add(toId);
    if (toId === nodeId) ids.add(fromId);
  });
  return ids;
};
