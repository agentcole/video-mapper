import type { Rect, Screen, Slice } from '../types';
import { projectStore } from './projectStore';
import { screenEditorStore } from './screenEditor';
import {
  createScreen, createSlice, isValidQuad, moveQuad, nextName, rectQuad, resizeScreen, setCorner, splitComposition,
} from './screens';

// ---------------------------------------------------------------------------
// Editing the project's screens and slices (undoable like any mapping edit).
// New screens and slices are selected in the screen editor.
// ---------------------------------------------------------------------------

const setScreens = (fn: (screens: Screen[]) => Screen[]) => projectStore.getState().setScreens(fn);

const mapScreen = (screenId: string, fn: (screen: Screen) => Screen) =>
  setScreens(screens => screens.map(s => (s.id === screenId ? fn(s) : s)));

const select = (screenId: string | null, sliceId: string | null) =>
  screenEditorStore.setState({ screenId, sliceId, corner: null });

/** A new screen the size of the composition, showing all of it. */
export const addScreen = (): string => {
  const { composition, screens } = projectStore.getState();
  const screen = createScreen(composition, nextName('Screen', screens.map(s => s.name)));
  setScreens(list => [...list, screen]);
  select(screen.id, screen.slices[0].id);
  return screen.id;
};

/** Replace the screens with the composition split into columns × rows. */
export const splitIntoScreens = (columns: number, rows: number, overlap: number) => {
  const screens = splitComposition(projectStore.getState().composition, columns, rows, overlap);
  setScreens(() => screens);
  select(screens[0]?.id ?? null, screens[0]?.slices[0]?.id ?? null);
};

export const removeScreen = (screenId: string) => {
  const { screens } = projectStore.getState();
  const index = screens.findIndex(s => s.id === screenId);
  setScreens(list => list.filter(s => s.id !== screenId));
  const next = screens[index + 1] ?? screens[index - 1];
  select(next?.id ?? null, next?.slices[0]?.id ?? null);
};

export const renameScreen = (screenId: string, name: string) =>
  mapScreen(screenId, s => ({ ...s, name: name.trim() || s.name }));

export const setScreenSize = (screenId: string, width: number, height: number) =>
  mapScreen(screenId, s => resizeScreen(s, width, height));

// ---- Slices ---------------------------------------------------------------------------------

/** A new slice in the middle: half of the composition on half of the screen. */
export const addSlice = (screenId: string): string | null => {
  const { composition, screens } = projectStore.getState();
  const screen = screens.find(s => s.id === screenId);
  if (!screen) return null;
  const input: Rect = { x: composition.width / 4, y: composition.height / 4, width: composition.width / 2, height: composition.height / 2 };
  const output = rectQuad({ x: screen.width / 4, y: screen.height / 4, width: screen.width / 2, height: screen.height / 2 });
  const slice = createSlice(input, output, nextName('Slice', screen.slices.map(s => s.name)));
  mapScreen(screenId, s => ({ ...s, slices: [...s.slices, slice] }));
  select(screenId, slice.id);
  return slice.id;
};

export const duplicateSlice = (screenId: string, sliceId: string) => {
  const screen = projectStore.getState().screens.find(s => s.id === screenId);
  const original = screen?.slices.find(s => s.id === sliceId);
  if (!screen || !original) return;
  const copy: Slice = {
    ...createSlice(original.input, moveQuad(original.output, 20, 20), nextName('Slice', screen.slices.map(s => s.name))),
    enabled: original.enabled,
  };
  mapScreen(screenId, s => {
    const slices = [...s.slices];
    slices.splice(slices.findIndex(x => x.id === sliceId) + 1, 0, copy);
    return { ...s, slices };
  });
  select(screenId, copy.id);
};

export const removeSlice = (screenId: string, sliceId: string) => {
  const screen = projectStore.getState().screens.find(s => s.id === screenId);
  if (!screen) return;
  const index = screen.slices.findIndex(s => s.id === sliceId);
  mapScreen(screenId, s => ({ ...s, slices: s.slices.filter(x => x.id !== sliceId) }));
  const next = screen.slices[index + 1] ?? screen.slices[index - 1];
  select(screenId, next?.id ?? null);
};

export const updateSlice = (screenId: string, sliceId: string, updates: Partial<Omit<Slice, 'id'>>) =>
  mapScreen(screenId, s => ({ ...s, slices: s.slices.map(x => (x.id === sliceId ? { ...x, ...updates } : x)) }));

/** Draw order on the screen: later slices cover earlier ones. */
export const moveSlice = (screenId: string, sliceId: string, direction: -1 | 1) =>
  mapScreen(screenId, s => {
    const i = s.slices.findIndex(x => x.id === sliceId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= s.slices.length) return s;
    const slices = [...s.slices];
    [slices[i], slices[j]] = [slices[j], slices[i]];
    return { ...s, slices };
  });

/** Arrow keys: move the selected corner, the selected slice's output, or its input (input view). */
export const nudgeSelection = (dx: number, dy: number): boolean => {
  const { view, screenId, sliceId, corner } = screenEditorStore.getState();
  const slice = projectStore.getState().screens.find(s => s.id === screenId)?.slices.find(s => s.id === sliceId);
  if (!screenId || !slice) return false;
  if (view === 'input') {
    updateSlice(screenId, slice.id, { input: { ...slice.input, x: slice.input.x + dx, y: slice.input.y + dy } });
  } else if (corner !== null) {
    const p = slice.output[corner];
    const output = setCorner(slice.output, corner, { x: p.x + dx, y: p.y + dy });
    if (isValidQuad(output)) updateSlice(screenId, slice.id, { output });
  } else {
    updateSlice(screenId, slice.id, { output: moveQuad(slice.output, dx, dy) });
  }
  return true;
};
