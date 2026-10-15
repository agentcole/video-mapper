import { createStore, useStore, type StoreApi } from 'zustand';
import type { MediaFrame, BackgroundSettings, GridSettings, CompositionSettings } from '../types';
import { DEFAULT_BACKGROUND, DEFAULT_GRID, DEFAULT_COMPOSITION } from '../lib/defaults';

// ---------------------------------------------------------------------------
// Project store — the document being edited (frames, background, grid,
// composition). Lives outside React so the output window sync, autosave,
// history and (later) the remote API can read and write it directly.
// ---------------------------------------------------------------------------

type Updater<T> = T | ((prev: T) => T);

const apply = <T>(updater: Updater<T>, prev: T): T =>
  typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;

export interface ProjectDocument {
  frames: MediaFrame[];
  background: BackgroundSettings;
  grid: GridSettings;
  composition: CompositionSettings;
}

export interface ProjectState extends ProjectDocument {
  // Setters accept a value or an updater, like React's setState
  setFrames: (updater: Updater<MediaFrame[]>) => void;
  updateFrame: (id: string, updates: Partial<MediaFrame>) => void;
  setBackground: (updater: Updater<BackgroundSettings>) => void;
  setGrid: (updater: Updater<GridSettings>) => void;
  setComposition: (updater: Updater<CompositionSettings>) => void;
  // Swap in a whole document (load / import / undo) in one update
  replaceDocument: (doc: Partial<ProjectDocument>) => void;
}

export const createProjectStore = (initial?: Partial<ProjectDocument>): StoreApi<ProjectState> =>
  createStore<ProjectState>()((set) => ({
    frames: [],
    background: DEFAULT_BACKGROUND,
    grid: DEFAULT_GRID,
    composition: DEFAULT_COMPOSITION,
    ...initial,
    setFrames: (updater) => set(s => ({ frames: apply(updater, s.frames) })),
    updateFrame: (id, updates) =>
      set(s => ({ frames: s.frames.map(f => (f.id === id ? { ...f, ...updates } : f)) })),
    setBackground: (updater) => set(s => ({ background: apply(updater, s.background) })),
    setGrid: (updater) => set(s => ({ grid: apply(updater, s.grid) })),
    setComposition: (updater) => set(s => ({ composition: apply(updater, s.composition) })),
    replaceDocument: (doc) => set(doc),
  }));

// The app's single project store
export const projectStore = createProjectStore();

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector);
}
