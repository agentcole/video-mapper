import type { StoreApi } from 'zustand';
import type { ProjectState } from './projectStore';
import { projectStore } from './projectStore';
import { onlyActiveClipsChanged } from './deck';
import { findClip, type Layer } from './showModel';

// ---------------------------------------------------------------------------
// Undo / redo over the project store. Changes are snapshotted with a debounce
// so a whole gesture (drag, slider scrub) becomes a single entry. The grid is
// a view setting and deliberately not part of the history. Neither are clip
// triggers and the tempo: undo never changes what is playing or its beat.
// ---------------------------------------------------------------------------

type Snapshot = Pick<ProjectState, 'surfaces' | 'layers' | 'columns' | 'background' | 'composition' | 'effects'>;

export interface HistoryOptions {
  limit?: number;
  debounceMs?: number;
}

export interface ProjectHistory {
  // Start tracking from the current state (call after the initial load)
  reset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const snapshotOf = (s: ProjectState): Snapshot => ({
  surfaces: s.surfaces,
  layers: s.layers,
  columns: s.columns,
  background: s.background,
  composition: s.composition,
  effects: s.effects,
});

export const createHistory = (
  store: StoreApi<ProjectState>,
  { limit = 50, debounceMs = 400 }: HistoryOptions = {}
): ProjectHistory => {
  let past: Snapshot[] = [];
  let future: Snapshot[] = [];
  let last: Snapshot | null = null; // null until reset(): nothing is tracked
  let timer: ReturnType<typeof setTimeout> | null = null;
  let applying = false;

  const push = (snapshot: Snapshot) => {
    past.push(snapshot);
    if (past.length > limit) past.shift();
    future = [];
  };

  // Commit a pending (debounced) change right away so it can be undone
  const flush = () => {
    if (timer === null || last === null) return;
    clearTimeout(timer);
    timer = null;
    push(last);
    last = snapshotOf(store.getState());
  };

  store.subscribe((state, prev) => {
    if (
      state.surfaces === prev.surfaces &&
      state.layers === prev.layers &&
      state.columns === prev.columns &&
      state.background === prev.background &&
      state.composition === prev.composition &&
      state.effects === prev.effects
    ) {
      return;
    }
    if (last === null) return;
    // A trigger (only active clips changed) is a performance action, not an edit
    if (
      !applying &&
      state.surfaces === prev.surfaces && state.columns === prev.columns &&
      state.background === prev.background && state.composition === prev.composition &&
      state.effects === prev.effects && onlyActiveClipsChanged(state.layers, prev.layers)
    ) {
      return;
    }
    if (applying) {
      last = snapshotOf(state);
      return;
    }
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      push(last!);
      last = snapshotOf(store.getState());
    }, debounceMs);
  });

  // Restored layers keep playing what plays now (if that clip still exists)
  const keepPlaying = (layers: Layer[]): Layer[] => {
    const playing = new Map(store.getState().layers.map(l => [l.id, l.activeClipId]));
    return layers.map(layer => {
      const active = playing.get(layer.id);
      if (active === undefined || active === layer.activeClipId) return layer;
      if (active !== null && !findClip(layer, active)) return layer;
      return { ...layer, activeClipId: active };
    });
  };

  const applySnapshot = (snapshot: Snapshot) => {
    applying = true;
    try {
      store.getState().replaceDocument({ ...snapshot, layers: keepPlaying(snapshot.layers) });
    } finally {
      applying = false;
    }
  };

  return {
    reset: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      past = [];
      future = [];
      last = snapshotOf(store.getState());
    },
    undo: () => {
      flush();
      const prev = past.pop();
      if (!prev || last === null) return;
      future.push(last);
      applySnapshot(prev);
    },
    redo: () => {
      flush();
      const next = future.pop();
      if (!next || last === null) return;
      past.push(last);
      if (past.length > limit) past.shift();
      applySnapshot(next);
    },
    canUndo: () => past.length > 0 || timer !== null,
    canRedo: () => future.length > 0,
  };
};

export const projectHistory = createHistory(projectStore);
