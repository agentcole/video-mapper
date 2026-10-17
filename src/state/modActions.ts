import type { Modulation } from '../types';
import { projectStore } from './projectStore';
import { updateLayer } from './deck';
import { withMod } from './effectActions';

// ---------------------------------------------------------------------------
// Modulation of layer properties and the macro faders. Layer modulations
// are document edits (undoable); macro values are performance controls —
// saved with the project like the tempo, but never undone.
// ---------------------------------------------------------------------------

/** Modulate a layer property ('opacity'); null removes the modulation. */
export const setLayerMod = (layerId: string, key: string, mod: Modulation | null): void =>
  projectStore.getState().setShow(show => {
    const layer = show.layers.find(l => l.id === layerId);
    return layer ? updateLayer(show, layerId, { mods: withMod(layer.mods, key, mod) }) : show;
  });

export const setMacroValue = (index: number, value: number): void => {
  const v = Math.min(1, Math.max(0, value));
  projectStore.getState().setMacros(macros =>
    macros[index] && macros[index].value !== v ? macros.map((m, i) => (i === index ? { ...m, value: v } : m)) : macros);
};

export const renameMacro = (index: number, name: string): void => {
  const trimmed = name.trim().slice(0, 40);
  projectStore.getState().setMacros(macros =>
    macros[index] ? macros.map((m, i) => (i === index ? { ...m, name: trimmed || `Macro ${i + 1}` } : m)) : macros);
};
