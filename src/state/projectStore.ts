import { createStore, useStore, type StoreApi } from 'zustand';
import type { MediaFrame, BackgroundSettings, GridSettings, CompositionSettings } from '../types';
import { DEFAULT_BACKGROUND, DEFAULT_GRID, DEFAULT_COMPOSITION } from '../lib/defaults';
import { emptyShow, framesFromShow, showFromFrames, type ShowDocument } from './showModel';

// ---------------------------------------------------------------------------
// Project store — the document being edited. Lives outside React so the
// output window sync, autosave, history and (later) the remote API can read
// and write it directly.
//
// The document is surfaces + layers + columns (see showModel.ts); `frames`
// is the derived view (surface ⨝ layer ⨝ active clip) that the editor and
// renderers work with. Frame edits are written back through the model.
// ---------------------------------------------------------------------------

type Updater<T> = T | ((prev: T) => T);

const apply = <T>(updater: Updater<T>, prev: T): T =>
  typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater;

export interface ProjectDocument extends ShowDocument {
  background: BackgroundSettings;
  grid: GridSettings;
  composition: CompositionSettings;
}

/** What renderers and output windows need: frames instead of the model. */
export interface RenderDocument {
  frames: MediaFrame[];
  background: BackgroundSettings;
  grid: GridSettings;
  composition: CompositionSettings;
}

// A document given either as the model or (output windows, tests) as frames
export type DocumentInput = Partial<ProjectDocument> & { frames?: MediaFrame[] };

export interface ProjectState extends ProjectDocument {
  frames: MediaFrame[]; // derived — write through setFrames / updateFrame
  // Setters accept a value or an updater, like React's setState
  setFrames: (updater: Updater<MediaFrame[]>) => void;
  updateFrame: (id: string, updates: Partial<MediaFrame>) => void;
  setBackground: (updater: Updater<BackgroundSettings>) => void;
  setGrid: (updater: Updater<GridSettings>) => void;
  setComposition: (updater: Updater<CompositionSettings>) => void;
  // Swap in a whole document (load / import / undo) in one update
  replaceDocument: (doc: DocumentInput) => void;
}

const showOf = (s: ShowDocument): ShowDocument => ({ surfaces: s.surfaces, layers: s.layers, columns: s.columns });

/** Resolve a document input against the current show (frames are written through the model). */
const resolveShow = (current: ShowDocument, input: DocumentInput): ShowDocument =>
  input.frames
    ? showFromFrames(current, input.frames)
    : {
        surfaces: input.surfaces ?? current.surfaces,
        layers: input.layers ?? current.layers,
        columns: input.columns ?? current.columns,
      };

export const createProjectStore = (initial: DocumentInput = {}): StoreApi<ProjectState> =>
  createStore<ProjectState>()((set) => {
    const show = resolveShow(emptyShow(), initial);
    return {
      background: initial.background ?? DEFAULT_BACKGROUND,
      grid: initial.grid ?? DEFAULT_GRID,
      composition: initial.composition ?? DEFAULT_COMPOSITION,
      ...show,
      frames: framesFromShow(show),
      setFrames: (updater) => set(s => {
        const next = apply(updater, s.frames);
        const nextShow = showFromFrames(showOf(s), next);
        return { ...nextShow, frames: framesFromShow(nextShow, next) };
      }),
      updateFrame: (id, updates) => set(s => {
        const next = s.frames.map(f => (f.id === id ? { ...f, ...updates } : f));
        const nextShow = showFromFrames(showOf(s), next);
        return { ...nextShow, frames: framesFromShow(nextShow, next) };
      }),
      setBackground: (updater) => set(s => ({ background: apply(updater, s.background) })),
      setGrid: (updater) => set(s => ({ grid: apply(updater, s.grid) })),
      setComposition: (updater) => set(s => ({ composition: apply(updater, s.composition) })),
      replaceDocument: (doc) => set(s => {
        const nextShow = resolveShow(showOf(s), doc);
        return {
          ...(doc.background ? { background: doc.background } : {}),
          ...(doc.grid ? { grid: doc.grid } : {}),
          ...(doc.composition ? { composition: doc.composition } : {}),
          ...nextShow,
          frames: framesFromShow(nextShow, s.frames),
        };
      }),
    };
  });

// The app's single project store
export const projectStore = createProjectStore();

export function useProjectStore<T>(selector: (state: ProjectState) => T): T {
  return useStore(projectStore, selector);
}
