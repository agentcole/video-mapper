import { createStore, useStore } from 'zustand';

// ---------------------------------------------------------------------------
// The screen editor (UI state, not saved): whether it is open, which view
// the stage shows — the composition with the slices' input rectangles, or a
// screen with their output corners — and what is selected.
// ---------------------------------------------------------------------------

export type ScreenView = 'input' | 'output';

export interface ScreenEditorState {
  open: boolean;
  view: ScreenView;
  screenId: string | null;
  sliceId: string | null;
  corner: number | null; // output view: the corner arrow keys move (0–3: TL, TR, BR, BL)
}

export const screenEditorStore = createStore<ScreenEditorState>()(() => ({
  open: false,
  view: 'output',
  screenId: null,
  sliceId: null,
  corner: null,
}));

export function useScreenEditor<T>(selector: (state: ScreenEditorState) => T): T {
  return useStore(screenEditorStore, selector);
}

export const openScreenEditor = (open = true) => screenEditorStore.setState({ open, corner: null });

export const setScreenView = (view: ScreenView) => screenEditorStore.setState({ view, corner: null });

export const selectScreen = (screenId: string | null, sliceId: string | null = null) =>
  screenEditorStore.setState({ screenId, sliceId, corner: null });

export const selectSlice = (sliceId: string | null, corner: number | null = null) =>
  screenEditorStore.setState({ sliceId, corner });
