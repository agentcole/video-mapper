import { createStore, useStore } from 'zustand';
import type { MeshWarp, Point } from '../types';
import { projectStore } from './projectStore';
import { screenEditorStore } from './screenEditor';
import { updateSlice } from './screenActions';
import { sliceWarp } from './screens';
import {
  createMesh, moveMeshPoints, prepareWarp, resetMesh, resizeMesh, surfaceWarp, type Warp,
} from '../lib/meshWarp';
import { rotateVector } from '../lib/geometry';

// ---------------------------------------------------------------------------
// Editing mesh warps (roadmap 3.2). The stage edits one mesh at a time — a
// surface's or a slice's — and its selected control points (UI state, not
// saved). The warp settings themselves are project data (undoable).
// ---------------------------------------------------------------------------

export type MeshTarget =
  | { kind: 'surface'; id: string }
  | { kind: 'slice'; screenId: string; id: string };

export interface MeshEditorState {
  target: MeshTarget | null;
  selected: number[]; // control point indices
}

export const meshEditorStore = createStore<MeshEditorState>()(() => ({ target: null, selected: [] }));

export function useMeshEditor<T>(selector: (state: MeshEditorState) => T): T {
  return useStore(meshEditorStore, selector);
}

export const sameTarget = (a: MeshTarget | null, b: MeshTarget | null): boolean =>
  !!a && !!b && a.kind === b.kind && a.id === b.id && (a.kind === 'surface' || (b.kind === 'slice' && a.screenId === b.screenId));

/** Edit this target's mesh on the stage (null: stop). A slice's shows on its screen (output view). */
export const editMesh = (target: MeshTarget | null) => {
  if (target?.kind === 'slice') {
    screenEditorStore.setState({ open: true, view: 'output', screenId: target.screenId, sliceId: target.id, corner: null });
  }
  meshEditorStore.setState({ target, selected: [] });
};

export const selectMeshPoints = (selected: number[]) => meshEditorStore.setState({ selected });

// Leave the slice's mesh when the screen editor moves on (other slice, input view, closed)
screenEditorStore.subscribe(editor => {
  const { target } = meshEditorStore.getState();
  if (target?.kind === 'slice' && (!editor.open || editor.view !== 'output' || editor.sliceId !== target.id)) editMesh(null);
});

// ---- A target's warp ------------------------------------------------------------------------

export interface WarpSettings {
  bilinear?: boolean;
  mesh?: MeshWarp;
}

const findSlice = (target: Extract<MeshTarget, { kind: 'slice' }>) =>
  projectStore.getState().screens.find(s => s.id === target.screenId)?.slices.find(s => s.id === target.id);

/** The target's warp settings and its warp (frame-local px for a surface, screen px for a slice). */
export const targetWarp = (target: MeshTarget): (WarpSettings & { warp: Warp }) | null => {
  if (target.kind === 'surface') {
    const frame = projectStore.getState().frames.find(f => f.id === target.id);
    return frame ? { bilinear: frame.bilinear, mesh: frame.mesh, warp: surfaceWarp(frame) } : null;
  }
  const slice = findSlice(target);
  return slice ? { bilinear: slice.bilinear, mesh: slice.mesh, warp: sliceWarp(slice) } : null;
};

export const setTargetWarp = (target: MeshTarget, settings: WarpSettings) => {
  if (target.kind === 'surface') projectStore.getState().updateFrame(target.id, settings);
  else updateSlice(target.screenId, target.id, settings);
};

const mapMesh = (target: MeshTarget, fn: (mesh: MeshWarp) => MeshWarp) => {
  const mesh = targetWarp(target)?.mesh;
  if (mesh) setTargetWarp(target, { mesh: fn(mesh) });
};

/** A flat mesh (4 × 4 smooth by default), edited right away. */
export const addMesh = (target: MeshTarget, columns = 4, rows = 4) => {
  setTargetWarp(target, { mesh: createMesh(columns, rows, true) });
  editMesh(target);
};

export const removeMesh = (target: MeshTarget) => {
  setTargetWarp(target, { mesh: undefined });
  if (sameTarget(meshEditorStore.getState().target, target)) editMesh(null);
};

export const setMeshSize = (target: MeshTarget, columns: number, rows: number) => {
  mapMesh(target, mesh => resizeMesh(mesh, columns, rows));
  selectMeshPoints([]);
};

export const setMeshSmooth = (target: MeshTarget, smooth: boolean) => mapMesh(target, mesh => ({ ...mesh, smooth }));

/** Back on the grid: the selected points, or all of them. */
export const resetMeshPoints = (target: MeshTarget) => {
  const { selected, target: edited } = meshEditorStore.getState();
  mapMesh(target, mesh => {
    if (!sameTarget(edited, target) || selected.length === 0) return resetMesh(mesh);
    const flat = resetMesh(mesh).points;
    return { ...mesh, points: mesh.points.map((p, k) => (selected.includes(k) ? flat[k] : p)) };
  });
};

/** Move control points by an output delta (screen px; composition px for surfaces). */
export const moveMeshPointsBy = (target: MeshTarget, indices: readonly number[], dx: number, dy: number) => {
  const current = targetWarp(target);
  const prepared = current?.mesh ? prepareWarp(current.warp) : null;
  if (!current?.mesh || !prepared || indices.length === 0) return;
  // A surface's mesh lives in its (rotated) box
  let delta: Point = { x: dx, y: dy };
  if (target.kind === 'surface') {
    const frame = projectStore.getState().frames.find(f => f.id === target.id);
    if (frame) delta = rotateVector(dx, dy, -frame.rotation);
  }
  const mesh = current.mesh;
  const points = mesh.points.map((p, k) => {
    if (!indices.includes(k)) return p;
    const out = prepared.pin(p.x, p.y);
    return prepared.unpin({ x: out.x + delta.x, y: out.y + delta.y }) ?? p;
  });
  setTargetWarp(target, { mesh: { ...mesh, points } });
};

/** Arrow keys while a mesh is edited: move its selected points. False when nothing is selected. */
export const nudgeMeshSelection = (dx: number, dy: number): boolean => {
  const { target, selected } = meshEditorStore.getState();
  if (!target || selected.length === 0) return false;
  moveMeshPointsBy(target, selected, dx, dy);
  return true;
};

/** Drag in pin space: the points as they were plus a delta (no rounding drift over a gesture). */
export const dragMeshPoints = (target: MeshTarget, start: MeshWarp, indices: readonly number[], delta: Point) =>
  setTargetWarp(target, { mesh: moveMeshPoints(start, indices, delta) });
