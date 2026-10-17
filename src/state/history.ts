import type { StoreApi } from 'zustand';
import type { ProjectState } from './projectStore';
import { projectStore } from './projectStore';

// ---------------------------------------------------------------------------
// Undo / redo over the project store. Changes are snapshotted with a debounce
// so a whole gesture (drag, slider scrub) becomes a single entry. The grid is
// a view setting and deliberately not part of the history.
// ---------------------------------------------------------------------------

type Snapshot = Pick<ProjectState, 'frames' | 'background' | 'composition'>;

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
  frames: s.frames,
  background: s.background,
  composition: s.composition,
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
      state.frames === prev.frames &&
      state.background === prev.background &&
      state.composition === prev.composition
    ) {
      return;
    }
    if (last === null) return;
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

  const applySnapshot = (snapshot: Snapshot) => {
    applying = true;
    try {
      store.getState().replaceDocument(snapshot);
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
