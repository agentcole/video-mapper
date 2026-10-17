import { beforeEach, describe, expect, it } from 'vitest';
import type { Quad, Slice } from '../types';
import { applyHomography } from '../lib/geometry';
import {
  createScreen, isValidQuad, matchInputToOutput, matchOutputToInput, rectQuad, resizeRect, resizeScreen,
  screenToSlice, sliceHomography, sliceZoom, snapShift, splitComposition,
} from './screens';
import { projectStore } from './projectStore';
import { screenEditorStore } from './screenEditor';
import {
  addScreen, addSlice, duplicateSlice, moveSlice, nudgeSelection, removeScreen, removeSlice, splitIntoScreens,
} from './screenActions';

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

const slice = (input: Slice['input'], output: Quad): Slice => ({ id: 's', name: 'S', enabled: true, input, output });

describe('splitting the composition', () => {
  it('puts projectors side by side', () => {
    const screens = splitComposition({ width: 3840, height: 1080 }, 2, 1);
    expect(screens.map(s => [s.name, s.width, s.height])).toEqual([['Screen 1', 1920, 1080], ['Screen 2', 1920, 1080]]);
    expect(screens.map(s => s.slices[0].input)).toEqual([
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: 1920, y: 0, width: 1920, height: 1080 },
    ]);
    expect(screens[1].slices[0].output).toEqual(rectQuad({ x: 0, y: 0, width: 1920, height: 1080 }));
  });

  it('overlaps neighbours for edge blending and ends at the edge', () => {
    const [a, b, c] = splitComposition({ width: 5000, height: 1000 }, 3, 1, 250);
    expect([a.slices[0].input.x, b.slices[0].input.x, c.slices[0].input.x]).toEqual([0, 1583, 3167]);
    expect(a.slices[0].input.width).toBe(1833);
    // Overlaps of 250 (± rounding), the last one ends at the composition's edge
    expect(a.slices[0].input.x + a.slices[0].input.width - b.slices[0].input.x).toBeCloseTo(250, -1);
    expect(c.slices[0].input.x + c.slices[0].input.width).toBe(5000);
  });

  it('splits into rows and columns', () => {
    const screens = splitComposition({ width: 1920, height: 1080 }, 2, 2);
    expect(screens.map(s => s.slices[0].input)).toEqual([
      { x: 0, y: 0, width: 960, height: 540 },
      { x: 960, y: 0, width: 960, height: 540 },
      { x: 0, y: 540, width: 960, height: 540 },
      { x: 960, y: 540, width: 960, height: 540 },
    ]);
  });
});

describe('slice geometry', () => {
  const warped = slice({ x: 100, y: 50, width: 400, height: 200 }, [{ x: 10, y: 20 }, { x: 900, y: 0 }, { x: 800, y: 700 }, { x: 50, y: 600 }]);

  it('maps the input rectangle onto the output corners', () => {
    const h = sliceHomography(warped)!;
    close(applyHomography(h, 0, 0), warped.output[0]);
    close(applyHomography(h, 400, 0), warped.output[1]);
    close(applyHomography(h, 400, 200), warped.output[2]);
    close(applyHomography(h, 0, 200), warped.output[3]);
  });

  it('maps screen pixels back to the slice (what the shader does)', () => {
    const hinv = screenToSlice(warped)!;
    close(applyHomography(hinv, 10, 20), { x: 0, y: 0 });
    close(applyHomography(hinv, 800, 700), { x: 1, y: 1 });
    close(applyHomography(hinv, 50, 600), { x: 0, y: 1 });
  });

  it('rejects folded outputs', () => {
    expect(isValidQuad(warped.output)).toBe(true);
    const folded: Quad = [warped.output[0], warped.output[2], warped.output[1], warped.output[3]];
    expect(isValidQuad(folded)).toBe(false);
  });

  it('matches input and output', () => {
    expect(matchOutputToInput(warped)).toEqual(rectQuad(warped.input));
    expect(matchInputToOutput(warped)).toEqual({ x: 10, y: 0, width: 890, height: 700 });
  });

  it('knows how much a slice magnifies', () => {
    expect(sliceZoom(slice({ x: 0, y: 0, width: 960, height: 540 }, rectQuad({ x: 0, y: 0, width: 1920, height: 1080 })))).toBe(2);
  });

  it('scales the slices with the screen', () => {
    const screen = createScreen({ width: 1000, height: 500 });
    const resized = resizeScreen(screen, 2000, 1000);
    expect(resized.slices[0].output).toEqual(rectQuad({ x: 0, y: 0, width: 2000, height: 1000 }));
    expect(resized.slices[0].input).toEqual(screen.slices[0].input);
  });

  it('resizes rectangles by an edge or corner, never below 1 px', () => {
    const r = { x: 0, y: 0, width: 100, height: 50 };
    expect(resizeRect(r, 'se', 10, 5)).toEqual({ x: 0, y: 0, width: 110, height: 55 });
    expect(resizeRect(r, 'w', 30, 99)).toEqual({ x: 30, y: 0, width: 70, height: 50 });
    expect(resizeRect(r, 'n', 0, 80)).toEqual({ x: 0, y: 49, width: 100, height: 1 });
  });

  it('snaps the closest edge', () => {
    expect(snapShift([95, 195], [0, 100, 200], 8)).toBe(5);
    expect(snapShift([96, 203], [100, 200], 8)).toBe(-3);
    expect(snapShift([50, 150], [100], 8)).toBe(0);
  });
});

describe('screen actions', () => {
  beforeEach(() => {
    projectStore.getState().replaceDocument({ screens: [], composition: { width: 1920, height: 1080 } });
    screenEditorStore.setState({ open: true, view: 'output', screenId: null, sliceId: null, corner: null });
  });

  const screens = () => projectStore.getState().screens;

  it('adds screens and slices and selects them', () => {
    const id = addScreen();
    expect(screens()).toHaveLength(1);
    expect(screens()[0]).toMatchObject({ id, name: 'Screen 1', width: 1920, height: 1080 });
    expect(screenEditorStore.getState()).toMatchObject({ screenId: id, sliceId: screens()[0].slices[0].id });
    const sliceId = addSlice(id)!;
    expect(screens()[0].slices.map(s => s.name)).toEqual(['Slice 1', 'Slice 2']);
    expect(screens()[0].slices[1].input).toEqual({ x: 480, y: 270, width: 960, height: 540 });
    expect(screenEditorStore.getState().sliceId).toBe(sliceId);
    expect(addScreen()).not.toBe(id);
    expect(screens()[1].name).toBe('Screen 2');
  });

  it('duplicates, reorders and removes slices', () => {
    const id = addScreen();
    const first = screens()[0].slices[0].id;
    duplicateSlice(id, first);
    const [, copy] = screens()[0].slices;
    expect(copy.output[0]).toEqual({ x: 20, y: 20 });
    moveSlice(id, copy.id, -1);
    expect(screens()[0].slices.map(s => s.id)).toEqual([copy.id, first]);
    removeSlice(id, copy.id);
    expect(screens()[0].slices.map(s => s.id)).toEqual([first]);
    expect(screenEditorStore.getState().sliceId).toBe(first);
  });

  it('nudges the selected corner, the output or the input', () => {
    const id = addScreen();
    const sliceId = screens()[0].slices[0].id;
    nudgeSelection(5, 0);
    expect(screens()[0].slices[0].output[0]).toEqual({ x: 5, y: 0 });
    screenEditorStore.setState({ corner: 2 });
    nudgeSelection(-10, -10);
    expect(screens()[0].slices[0].output[2]).toEqual({ x: 1915, y: 1070 });
    expect(screens()[0].slices[0].output[0]).toEqual({ x: 5, y: 0 });
    screenEditorStore.setState({ view: 'input', corner: null });
    nudgeSelection(0, 1);
    expect(screens()[0].slices[0].input.y).toBe(1);
    expect(screenEditorStore.getState()).toMatchObject({ screenId: id, sliceId });
  });

  it('replaces the screens with a split, and selects the next screen after a delete', () => {
    addScreen();
    splitIntoScreens(3, 1, 0);
    expect(screens().map(s => s.width)).toEqual([640, 640, 640]);
    const [a, b] = screens();
    screenEditorStore.setState({ screenId: a.id });
    removeScreen(a.id);
    expect(screens()).toHaveLength(2);
    expect(screenEditorStore.getState().screenId).toBe(b.id);
  });
});
