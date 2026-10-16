import type { CompositionSettings } from '../types';
import { DEFAULT_PERSPECTIVE_CORNERS, DEFAULT_SOFT_EDGE } from '../lib/defaults';
import { defaultIds, findClip, type Clip, type IdFactory, type Layer, type ShowDocument, type Surface } from './showModel';
import type { ScheduledTrigger } from './liveStore';

// ---------------------------------------------------------------------------
// Clip launcher ("deck") operations: layers × columns of clips. Pure
// functions over the show — deckActions.ts applies them to the stores.
// ---------------------------------------------------------------------------

export interface SlotRef {
  layerId: string;
  column: number;
}

const withLayer = (show: ShowDocument, layerId: string, fn: (layer: Layer) => Layer): ShowDocument => {
  let changed = false;
  const layers = show.layers.map(layer => {
    if (layer.id !== layerId) return layer;
    const next = fn(layer);
    if (next !== layer) changed = true;
    return next;
  });
  return changed ? { ...show, layers } : show;
};

// A layer only plays clips that are still in its slots
const keepActiveIfPresent = (layer: Layer): Layer =>
  layer.activeClipId && !findClip(layer, layer.activeClipId) ? { ...layer, activeClipId: null } : layer;

export const clipAt = (show: ShowDocument, { layerId, column }: SlotRef): Clip | null =>
  show.layers.find(l => l.id === layerId)?.slots[column] ?? null;

/** Play a clip on its layer (null clears the layer). */
export const setActiveClip = (show: ShowDocument, layerId: string, clipId: string | null): ShowDocument =>
  withLayer(show, layerId, layer => {
    if (layer.activeClipId === clipId) return layer;
    if (clipId && !findClip(layer, clipId)) return layer;
    return { ...layer, activeClipId: clipId };
  });

/**
 * Trigger a column: every layer plays its clip in that column, layers with an
 * empty cell there are cleared (like Resolume). `started` lists the layers
 * that start a clip.
 */
export const triggerColumn = (show: ShowDocument, column: number): { show: ShowDocument; started: string[] } => {
  const started: string[] = [];
  let changed = false;
  const layers = show.layers.map(layer => {
    const clip = layer.slots[column] ?? null;
    if (clip) started.push(layer.id);
    const activeClipId = clip?.id ?? null;
    if (layer.activeClipId === activeClipId) return layer;
    changed = true;
    return { ...layer, activeClipId };
  });
  return { show: changed ? { ...show, layers } : show, started };
};

/** Put a clip into a slot. Replacing the playing clip keeps the slot playing. */
export const placeClip = (show: ShowDocument, { layerId, column }: SlotRef, clip: Clip): ShowDocument =>
  withLayer(show, layerId, layer => {
    const slots = [...layer.slots];
    while (slots.length <= column) slots.push(null);
    const replaced = slots[column];
    slots[column] = clip;
    const activeClipId = replaced && replaced.id === layer.activeClipId ? clip.id : layer.activeClipId;
    return { ...layer, slots, activeClipId };
  });

export const removeClip = (show: ShowDocument, { layerId, column }: SlotRef): ShowDocument =>
  withLayer(show, layerId, layer => {
    if (!layer.slots[column]) return layer;
    return keepActiveIfPresent({ ...layer, slots: layer.slots.map((c, i) => (i === column ? null : c)) });
  });

/**
 * Drag a clip to another slot. Moving swaps with whatever is there; copying
 * overwrites it. A clip keeps playing only if it stays on its layer.
 */
export const moveClip = (
  show: ShowDocument,
  from: SlotRef,
  to: SlotRef,
  { copy = false, ids = defaultIds }: { copy?: boolean; ids?: IdFactory } = {},
): ShowDocument => {
  if (from.layerId === to.layerId && from.column === to.column) return show;
  const clip = clipAt(show, from);
  if (!clip || !show.layers.some(l => l.id === to.layerId)) return show;
  const moved = copy ? { ...clip, id: ids('clip') } : clip;
  const displaced = copy ? null : clipAt(show, to);

  const layers = show.layers.map(layer => {
    if (layer.id !== from.layerId && layer.id !== to.layerId) return layer;
    const slots = [...layer.slots];
    const columns = Math.max(from.column, to.column);
    while (slots.length <= columns) slots.push(null);
    if (layer.id === from.layerId && !copy) slots[from.column] = displaced;
    if (layer.id === to.layerId) slots[to.column] = moved;
    return keepActiveIfPresent({ ...layer, slots });
  });
  return { ...show, layers };
};

export const updateClip = (show: ShowDocument, clipId: string, patch: Partial<Omit<Clip, 'id'>>): ShowDocument => {
  let changed = false;
  const layers = show.layers.map(layer => {
    if (!layer.slots.some(c => c?.id === clipId)) return layer;
    changed = true;
    return { ...layer, slots: layer.slots.map(c => (c?.id === clipId ? { ...c, ...patch } : c)) };
  });
  return changed ? { ...show, layers } : show;
};

export const updateLayer = (
  show: ShowDocument,
  layerId: string,
  patch: Partial<Pick<Layer, 'name' | 'opacity' | 'blendMode'>>,
): ShowDocument => {
  const before = show.layers.find(l => l.id === layerId);
  const next = withLayer(show, layerId, layer =>
    (Object.keys(patch) as (keyof typeof patch)[]).every(k => layer[k] === patch[k]) ? layer : { ...layer, ...patch }
  );
  // Surfaces that carried the layer's name follow a rename
  if (!before || patch.name === undefined || patch.name === before.name) return next;
  return {
    ...next,
    surfaces: next.surfaces.map(s =>
      s.layerId === layerId && (!s.name || s.name === before.name) ? { ...s, name: patch.name } : s
    ),
  };
};

export const addColumn = (show: ShowDocument, ids: IdFactory = defaultIds): ShowDocument => {
  const columns = [...show.columns, { id: ids('column'), name: String(show.columns.length + 1) }];
  const layers = show.layers.map(layer =>
    layer.slots.length >= columns.length ? layer : { ...layer, slots: [...layer.slots, ...Array(columns.length - layer.slots.length).fill(null)] }
  );
  return { ...show, columns, layers };
};

export const renameColumn = (show: ShowDocument, column: number, name: string): ShowDocument => {
  if (!show.columns[column] || show.columns[column].name === name) return show;
  return { ...show, columns: show.columns.map((c, i) => (i === column ? { ...c, name } : c)) };
};

/** A new layer on top of the stack, shown on a surface that fills the composition. */
export const addLayer = (
  show: ShowDocument,
  composition: CompositionSettings,
  ids: IdFactory = defaultIds,
): { show: ShowDocument; layerId: string; surfaceId: string } => {
  const layerId = ids('layer');
  const surfaceId = ids('surface');
  const layer: Layer = {
    id: layerId,
    name: `Layer ${show.layers.length + 1}`,
    opacity: 1,
    blendMode: 'normal',
    slots: show.columns.map(() => null),
    activeClipId: null,
  };
  const surface: Surface = {
    id: surfaceId,
    name: layer.name,
    layerId,
    visible: true,
    testPattern: false,
    zIndex: show.surfaces.reduce((max, s) => Math.max(max, s.zIndex + 1), 0),
    x: 0,
    y: 0,
    width: composition.width,
    height: composition.height,
    rotation: 0,
    shape: 'rectangle',
    lockAspectRatio: true,
    perspectiveMode: false,
    perspectiveCorners: DEFAULT_PERSPECTIVE_CORNERS,
    softEdge: DEFAULT_SOFT_EDGE,
  };
  return { show: { ...show, layers: [...show.layers, layer], surfaces: [...show.surfaces, surface] }, layerId, surfaceId };
};

/** Launcher order: top of the stack first (by a layer's highest surface); layers without surfaces last. */
export const layersTopFirst = (show: ShowDocument): Layer[] => {
  const top = new Map<string, number>();
  for (const surface of show.surfaces) {
    top.set(surface.layerId, Math.max(top.get(surface.layerId) ?? -Infinity, surface.zIndex));
  }
  return show.layers
    .map((layer, index) => ({ layer, index, z: top.get(layer.id) ?? -Infinity }))
    .sort((a, b) => b.z - a.z || b.index - a.index)
    .map(({ layer }) => layer);
};

export interface PreloadEntry {
  layerId: string;
  clip: Clip;
}

export interface PreloadTargets {
  columns: readonly number[]; // e.g. the cued column, columns waiting for their beat
  clipIds: readonly string[]; // e.g. the clip under the pointer, clips waiting for their beat
}

/**
 * Clips to keep loaded (but paused) so triggering them is instant. Clips
 * that are already playing need no preload.
 */
export const preloadClips = (show: ShowDocument, targets: PreloadTargets): PreloadEntry[] => {
  const entries: PreloadEntry[] = [];
  for (const layer of show.layers) {
    for (const [column, clip] of layer.slots.entries()) {
      if (!clip || clip.id === layer.activeClipId) continue;
      if (targets.columns.includes(column) || targets.clipIds.includes(clip.id)) entries.push({ layerId: layer.id, clip });
    }
  }
  return entries;
};

/** What the launcher may start next: the cued column, a hovered clip and triggers waiting for their beat. */
export const preloadTargets = (
  cuedColumn: number | null,
  hoveredClipId: string | null,
  scheduled: readonly ScheduledTrigger[],
): PreloadTargets => {
  const columns = cuedColumn !== null ? [cuedColumn] : [];
  const clipIds = hoveredClipId ? [hoveredClipId] : [];
  for (const trigger of scheduled) {
    if (trigger.kind === 'column') columns.push(trigger.column);
    else if (trigger.kind === 'clip' && trigger.clipId) clipIds.push(trigger.clipId);
  }
  return { columns, clipIds };
};

/** Live-only change: the layers differ in what they play, nothing else. */
export const onlyActiveClipsChanged = (a: readonly Layer[], b: readonly Layer[]): boolean => {
  if (a === b || a.length !== b.length) return false;
  return a.every((layer, i) => {
    const other = b[i];
    if (layer === other) return true;
    const { activeClipId: x, ...restA } = layer;
    const { activeClipId: y, ...restB } = other;
    void x;
    void y;
    return (Object.keys(restA) as (keyof typeof restA)[]).every(k => restA[k] === restB[k]) &&
      Object.keys(restA).length === Object.keys(restB).length;
  });
};
