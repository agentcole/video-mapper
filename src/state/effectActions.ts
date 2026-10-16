import type { EffectInstance, EffectParamValue } from '../types';
import { projectStore } from './projectStore';
import { placeClip, updateClip, updateLayer, type SlotRef } from './deck';
import { createClip, defaultIds, findClip, type IdFactory, type ShowDocument } from './showModel';
import { getEffectDef } from '../effects/library';

// ---------------------------------------------------------------------------
// Effect stacks (clip, layer, composition) and generator clips. All of it is
// document editing: undoable, saved, mirrored to output windows.
// ---------------------------------------------------------------------------

export type EffectTarget =
  | { kind: 'clip'; clipId: string }
  | { kind: 'layer'; layerId: string }
  | { kind: 'composition' };

const NO_EFFECTS: EffectInstance[] = [];

const clipIn = (show: ShowDocument, clipId: string) => {
  for (const layer of show.layers) {
    const clip = findClip(layer, clipId);
    if (clip) return clip;
  }
  return null;
};

/** The stack of a target as it is now. */
export const stackOf = (target: EffectTarget, state = projectStore.getState()): EffectInstance[] => {
  switch (target.kind) {
    case 'composition': return state.effects;
    case 'layer': return state.layers.find(l => l.id === target.layerId)?.effects ?? NO_EFFECTS;
    case 'clip': return clipIn(state, target.clipId)?.effects ?? NO_EFFECTS;
  }
};

const setStack = (target: EffectTarget, update: (stack: EffectInstance[]) => EffectInstance[]) => {
  const { setEffects, setShow } = projectStore.getState();
  // Empty stacks are stored as none, like a cut transition
  const stored = (stack: EffectInstance[]) => (stack.length > 0 ? stack : undefined);
  switch (target.kind) {
    case 'composition':
      setEffects(update);
      break;
    case 'layer':
      setShow(show => updateLayer(show, target.layerId, {
        effects: stored(update(show.layers.find(l => l.id === target.layerId)?.effects ?? NO_EFFECTS)),
      }));
      break;
    case 'clip':
      setShow(show => updateClip(show, target.clipId, { effects: stored(update(clipIn(show, target.clipId)?.effects ?? NO_EFFECTS)) }));
      break;
  }
};

const updateInstance = (target: EffectTarget, id: string, patch: (e: EffectInstance) => EffectInstance) =>
  setStack(target, stack => stack.map(e => (e.id === id ? patch(e) : e)));

/** Add an effect at the end of a stack; returns its instance id. */
export const addEffect = (target: EffectTarget, effectId: string, ids: IdFactory = defaultIds): string => {
  const instance: EffectInstance = { id: ids('effect'), effectId, enabled: true, params: {} };
  setStack(target, stack => [...stack, instance]);
  return instance.id;
};

export const removeEffect = (target: EffectTarget, id: string): void =>
  setStack(target, stack => stack.filter(e => e.id !== id));

/** Move an effect up (-1) or down (+1) in its stack. */
export const moveEffect = (target: EffectTarget, id: string, delta: -1 | 1): void =>
  setStack(target, stack => {
    const from = stack.findIndex(e => e.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= stack.length) return stack;
    const next = [...stack];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  });

export const toggleEffect = (target: EffectTarget, id: string): void =>
  updateInstance(target, id, e => ({ ...e, enabled: !e.enabled }));

export const setEffectParam = (target: EffectTarget, id: string, name: string, value: EffectParamValue): void =>
  updateInstance(target, id, e => ({ ...e, params: { ...e.params, [name]: value } }));

/** Back to the shader's defaults. */
export const resetEffect = (target: EffectTarget, id: string): void =>
  updateInstance(target, id, e => ({ ...e, params: {} }));

// ---- Generator clips --------------------------------------------------------------

/** Put a generator into a launcher slot; returns the clip id. */
export const assignGenerator = (ref: SlotRef, effectId: string, ids: IdFactory = defaultIds): string => {
  const clip = {
    ...createClip(ids('clip'), { type: 'image' as const, url: '' }),
    name: getEffectDef(effectId)?.name,
    generator: { effectId, params: {} },
  };
  projectStore.getState().setShow(show => placeClip(show, ref, clip));
  return clip.id;
};

export const setGeneratorParam = (clipId: string, name: string, value: EffectParamValue): void =>
  projectStore.getState().setShow(show => {
    const clip = clipIn(show, clipId);
    if (!clip?.generator) return show;
    return updateClip(show, clipId, { generator: { ...clip.generator, params: { ...clip.generator.params, [name]: value } } });
  });

export const resetGenerator = (clipId: string): void =>
  projectStore.getState().setShow(show => {
    const clip = clipIn(show, clipId);
    return clip?.generator ? updateClip(show, clipId, { generator: { ...clip.generator, params: {} } }) : show;
  });
