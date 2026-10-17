import { createStore, useStore } from 'zustand';

// ---------------------------------------------------------------------------
// Clip start latency in this window: from a launcher trigger to the new clip
// moving on screen. A column trigger starts several layers at once — the
// slowest one counts. Only the window that triggers (the editor) measures;
// output windows have no trigger time to compare with.
// ---------------------------------------------------------------------------

export interface ClipStart {
  ms: number;
  preloaded: boolean; // every started clip was preloaded
}

interface Batch {
  at: number;
  layers: Set<string>;
  worst: ClipStart | null;
}

let batch: Batch | null = null;

export const startStatsStore = createStore<{ last: ClipStart | null }>()(() => ({ last: null }));

export function useLastClipStart(): ClipStart | null {
  return useStore(startStatsStore, s => s.last);
}

/** The launcher (re)started these layers' clips now. */
export const markTriggered = (layerIds: string[]): void => {
  if (layerIds.length === 0) return;
  batch = { at: performance.now(), layers: new Set(layerIds), worst: null };
};

/** A renderer shows the first frames of a layer's new clip. */
export const reportFirstFrame = (layerId: string | undefined, preloaded: boolean, at = performance.now()): void => {
  if (!layerId || !batch?.layers.has(layerId)) return;
  batch.layers.delete(layerId);
  const ms = Math.max(0, at - batch.at);
  const worst = batch.worst;
  batch.worst = {
    ms: Math.max(ms, worst?.ms ?? 0),
    preloaded: preloaded && (worst?.preloaded ?? true),
  };
  startStatsStore.setState({ last: batch.worst });
};
