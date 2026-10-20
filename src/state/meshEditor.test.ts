import { beforeEach, describe, expect, it } from 'vitest';
import type { MediaFrame, Point, Slice } from '../types';
import { projectStore } from './projectStore';
import { screenEditorStore, selectSlice, setScreenView } from './screenEditor';
import {
  addMesh, editMesh, meshEditorStore, moveMeshPointsBy, nudgeMeshSelection, removeMesh, resetMeshPoints,
  selectMeshPoints, setMeshSize, setMeshSmooth, setTargetWarp, targetWarp,
} from './meshEditor';
import { isFlatMesh, prepareWarp } from '../lib/meshWarp';
import { frameLocalToComp } from '../lib/geometry';

const zero = { x: 0, y: 0 };
const frame = (overrides: Partial<MediaFrame> = {}): MediaFrame => ({
  id: 'f', x: 100, y: 100, width: 400, height: 200, rotation: 0, perspectiveMode: false,
  perspectiveCorners: { tl: zero, tr: zero, br: zero, bl: zero }, ...overrides,
} as MediaFrame);

const slice: Slice = {
  id: 'sl', name: 'S', enabled: true,
  input: { x: 0, y: 0, width: 1920, height: 1080 },
  output: [{ x: 100, y: 50 }, { x: 900, y: 0 }, { x: 960, y: 540 }, { x: 0, y: 500 }],
};

const SURFACE = { kind: 'surface', id: 'f' } as const;
const SLICE = { kind: 'slice', screenId: 'sc', id: 'sl' } as const;

const meshOf = (target: typeof SURFACE | typeof SLICE) => targetWarp(target)!.mesh!;

/** Where control point k lands (screen px for a slice, composition px for a surface). */
const landsAt = (target: typeof SURFACE | typeof SLICE, k: number): Point => {
  const current = targetWarp(target)!;
  const p = current.mesh!.points[k];
  const out = prepareWarp(current.warp)!.pin(p.x, p.y);
  if (target.kind === 'slice') return out;
  return frameLocalToComp(out.x, out.y, projectStore.getState().frames[0]);
};

describe('mesh editing', () => {
  beforeEach(() => {
    projectStore.getState().replaceDocument({
      frames: [frame()],
      screens: [{ id: 'sc', name: 'P', width: 960, height: 540, slices: [slice, { ...slice, id: 'other' }] }],
    });
    screenEditorStore.setState({ open: false, view: 'input', screenId: null, sliceId: null, corner: null });
    editMesh(null);
  });

  it('adds a flat mesh to a surface and edits it; removing it stops', () => {
    addMesh(SURFACE);
    expect(meshOf(SURFACE)).toMatchObject({ columns: 4, rows: 4, smooth: true });
    expect(isFlatMesh(meshOf(SURFACE))).toBe(true);
    expect(meshEditorStore.getState().target).toEqual(SURFACE);
    removeMesh(SURFACE);
    expect(targetWarp(SURFACE)!.mesh).toBeUndefined();
    expect(meshEditorStore.getState().target).toBeNull();
  });

  it("shows a slice's mesh on its screen, and stops when the editor moves on", () => {
    addMesh(SLICE);
    expect(screenEditorStore.getState()).toMatchObject({ open: true, view: 'output', screenId: 'sc', sliceId: 'sl' });
    expect(meshEditorStore.getState().target).toEqual(SLICE);
    selectSlice('other');
    expect(meshEditorStore.getState().target).toBeNull();
    editMesh(SLICE);
    setScreenView('input');
    expect(meshEditorStore.getState().target).toBeNull();
  });

  it('moves points by output px through the corner pin', () => {
    addMesh(SLICE);
    const before = landsAt(SLICE, 5);
    moveMeshPointsBy(SLICE, [5], 12, -7);
    const after = landsAt(SLICE, 5);
    expect(after.x - before.x).toBeCloseTo(12, 6);
    expect(after.y - before.y).toBeCloseTo(-7, 6);
    expect(meshOf(SLICE).points[6]).toEqual({ x: 2 / 3, y: 1 / 3 }); // the others stay
  });

  it("moves a rotated surface's points in composition directions", () => {
    projectStore.getState().updateFrame('f', { rotation: 90, perspectiveMode: true, perspectiveCorners: { tl: { x: 20, y: 10 }, tr: zero, br: zero, bl: zero } });
    addMesh(SURFACE);
    selectMeshPoints([5, 10]);
    const before = [landsAt(SURFACE, 5), landsAt(SURFACE, 10)];
    expect(nudgeMeshSelection(10, 0)).toBe(true);
    [5, 10].forEach((k, i) => {
      const after = landsAt(SURFACE, k);
      expect(after.x - before[i].x).toBeCloseTo(10, 6);
      expect(after.y - before[i].y).toBeCloseTo(0, 6);
    });
  });

  it('arrow keys do nothing without selected points', () => {
    addMesh(SURFACE);
    expect(nudgeMeshSelection(1, 0)).toBe(false);
    expect(isFlatMesh(meshOf(SURFACE))).toBe(true);
  });

  it('resets the selected points, or all of them', () => {
    addMesh(SLICE);
    moveMeshPointsBy(SLICE, [5, 6], 20, 20);
    selectMeshPoints([5]);
    resetMeshPoints(SLICE);
    expect(meshOf(SLICE).points[5]).toEqual({ x: 1 / 3, y: 1 / 3 });
    expect(meshOf(SLICE).points[6]).not.toEqual({ x: 2 / 3, y: 1 / 3 });
    selectMeshPoints([]);
    resetMeshPoints(SLICE);
    expect(isFlatMesh(meshOf(SLICE))).toBe(true);
  });

  it('resizes (clearing the selection), switches curves and pin mode', () => {
    addMesh(SURFACE);
    selectMeshPoints([1, 2]);
    setMeshSize(SURFACE, 7, 3);
    expect(meshOf(SURFACE)).toMatchObject({ columns: 7, rows: 3 });
    expect(meshOf(SURFACE).points).toHaveLength(21);
    expect(meshEditorStore.getState().selected).toEqual([]);
    setMeshSmooth(SURFACE, false);
    expect(meshOf(SURFACE).smooth).toBe(false);
    setTargetWarp(SURFACE, { bilinear: true });
    expect(projectStore.getState().frames[0].bilinear).toBe(true);
    // Surfaces keep it in the show model (saved, undoable)
    expect(projectStore.getState().surfaces[0]).toMatchObject({ bilinear: true, mesh: { columns: 7, rows: 3 } });
  });
});
