import type { BlendMode } from '../types';
import { projectStore } from './projectStore';
import { liveStore } from './liveStore';
import {
  addColumn, addLayer, moveClip, placeClip, removeClip, renameColumn, setActiveClip,
  triggerColumn as triggerColumnOf, updateClip, updateLayer, type SlotRef,
} from './deck';
import { createClip, defaultIds, findClip, type ClipSource, type TriggerStyle } from './showModel';
import { markTriggered } from '../render/startStats';

// ---------------------------------------------------------------------------
// Clip launcher actions: apply deck operations to the project store and tell
// the renderers (here and in output windows) which layers start a clip.
// ---------------------------------------------------------------------------

const { setShow } = projectStore.getState();

const layerOf = (layerId: string) => projectStore.getState().layers.find(l => l.id === layerId);

// Piano clips: what the layer played before the held clip took over
const pianoReturn = new Map<string, string | null>();

const restart = (layerIds: string[]) => {
  liveStore.getState().restartLayers(layerIds);
  markTriggered(layerIds);
};

/** Play a clip from the top (again, if it is already playing). */
export const startClip = (layerId: string, clipId: string): void => {
  setShow(show => setActiveClip(show, layerId, clipId));
  restart([layerId]);
};

export const clearLayer = (layerId: string): void => {
  pianoReturn.delete(layerId);
  setShow(show => setActiveClip(show, layerId, null));
};

export const clearAllLayers = (): void => {
  pianoReturn.clear();
  setShow(show => show.layers.reduce((s, layer) => setActiveClip(s, layer.id, null), show));
};

/**
 * A press on a clip in the launcher, by the clip's trigger style. Returns the
 * release handler for piano clips (the previous clip comes back).
 */
export const pressClip = (layerId: string, clipId: string): (() => void) | null => {
  const layer = layerOf(layerId);
  const clip = findClip(layer, clipId);
  if (!layer || !clip) return null;
  const style = clip.triggerStyle ?? 'normal';

  if (style === 'toggle' && layer.activeClipId === clipId) {
    clearLayer(layerId);
    return null;
  }
  if (style === 'piano') {
    if (!pianoReturn.has(layerId)) pianoReturn.set(layerId, layer.activeClipId === clipId ? null : layer.activeClipId);
    startClip(layerId, clipId);
    return () => {
      const back = pianoReturn.get(layerId) ?? null;
      pianoReturn.delete(layerId);
      // Something else was triggered while held — leave it
      if (layerOf(layerId)?.activeClipId !== clipId) return;
      if (back && findClip(layerOf(layerId), back)) startClip(layerId, back);
      else setShow(show => setActiveClip(show, layerId, null));
    };
  }
  startClip(layerId, clipId);
  return null;
};

/** Every layer plays its clip in this column; layers with an empty cell are cleared. */
export const triggerColumn = (column: number): void => {
  pianoReturn.clear();
  let started: string[] = [];
  setShow(show => {
    const result = triggerColumnOf(show, column);
    started = result.started;
    return result.show;
  });
  restart(started);
};

export const cueColumn = (column: number | null): void => {
  const { columns } = projectStore.getState();
  liveStore.getState().setCuedColumn(column !== null && column >= 0 && column < columns.length ? column : null);
};

/** Fire the cued column and cue the next one (a cue list). */
export const go = (): void => {
  const { cuedColumn } = liveStore.getState();
  if (cuedColumn === null) return;
  triggerColumn(cuedColumn);
  const { columns } = projectStore.getState();
  liveStore.getState().setCuedColumn(cuedColumn + 1 < columns.length ? cuedColumn + 1 : null);
};

export const preloadClip = (clipId: string | null): void => liveStore.getState().setPreloadClipId(clipId);

// ---- Editing the deck (undoable) -------------------------------------------------

const nameOf = (source: ClipSource) => source.filename?.replace(/\.[^.]+$/, '');

/** Put media into a slot (replacing what's there). */
export const assignMedia = (ref: SlotRef, source: ClipSource): string => {
  const clip = { ...createClip(defaultIds('clip'), source), name: nameOf(source) };
  setShow(show => placeClip(show, ref, clip));
  return clip.id;
};

export const removeClipAt = (ref: SlotRef): void => setShow(show => removeClip(show, ref));

export const moveClipTo = (from: SlotRef, to: SlotRef, copy: boolean): void =>
  setShow(show => moveClip(show, from, to, { copy }));

export const setTriggerStyle = (clipId: string, triggerStyle: TriggerStyle): void =>
  setShow(show => updateClip(show, clipId, { triggerStyle }));

export const renameClip = (clipId: string, name: string): void =>
  setShow(show => updateClip(show, clipId, { name: name.trim() || undefined }));

export const addDeckColumn = (): void => setShow(show => addColumn(show));

export const renameDeckColumn = (column: number, name: string): void =>
  setShow(show => renameColumn(show, column, name.trim()));

/** A new full-composition layer on top; returns its surface id. */
export const addDeckLayer = (): string => {
  let surfaceId = '';
  setShow(show => {
    const result = addLayer(show, projectStore.getState().composition);
    surfaceId = result.surfaceId;
    return result.show;
  });
  return surfaceId;
};

export const updateDeckLayer = (layerId: string, patch: { name?: string; opacity?: number; blendMode?: BlendMode }): void =>
  setShow(show => updateLayer(show, layerId, patch));
