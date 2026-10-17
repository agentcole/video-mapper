import type { BeatSnap } from '../types';
import { projectStore } from '../state/projectStore';
import { liveStore } from '../state/liveStore';
import { layersTopFirst } from '../state/deck';
import { findClip } from '../state/showModel';
import { BEAT_SNAPS } from '../state/clock';
import {
  clearAllLayers, clearLayer, cueColumn, go, pressClip, triggerColumn, updateDeckLayer,
} from '../state/deckActions';
import { resyncBar, scaleTempo, setBeatSnap, startNudge, tapTempo } from '../state/clockActions';
import { setMacroValue } from '../state/modActions';

// ---------------------------------------------------------------------------
// What a controller or a key can drive. Targets are addressed by role and
// position (layer row from the top of the launcher, column), not by id, so a
// controller setup works with every project — like a hardware template.
// Effect parameters are reached through the macros (∿ → macro).
//
// As strings: macro:2, master, crossfader, opacity:0, slot:1:3, column:3,
// cue:3, go, clear:0, clear-all, blackout, test-card, tap, resync, nudge:-1,
// nudge:1, tempo-half, tempo-double, snap
// ---------------------------------------------------------------------------

export type ControlTarget =
  | { kind: 'macro'; index: number }
  | { kind: 'master' }
  | { kind: 'crossfader' }
  | { kind: 'opacity'; row: number }
  | { kind: 'slot'; row: number; column: number }
  | { kind: 'column'; column: number }
  | { kind: 'cue'; column: number }
  | { kind: 'go' }
  | { kind: 'clear'; row: number }
  | { kind: 'clear-all' }
  | { kind: 'blackout' }
  | { kind: 'test-card' }
  | { kind: 'tap' }
  | { kind: 'resync' }
  | { kind: 'nudge'; direction: 1 | -1 }
  | { kind: 'tempo-half' }
  | { kind: 'tempo-double' }
  | { kind: 'snap' };

// What a button's LED shows
export type ButtonState = 'off' | 'available' | 'on' | 'cued' | 'armed' | 'playing';

const int = (s: string | undefined) => (s !== undefined && /^-?\d+$/.test(s) ? Number(s) : NaN);

export const parseTarget = (id: string): ControlTarget | null => {
  const [kind, a, b] = id.split(':');
  const n = int(a);
  switch (kind) {
    case 'macro': return n >= 0 && n < 64 ? { kind, index: n } : null;
    case 'opacity':
    case 'clear': return n >= 0 ? { kind, row: n } : null;
    case 'slot': return n >= 0 && int(b) >= 0 ? { kind, row: n, column: int(b) } : null;
    case 'column':
    case 'cue': return n >= 0 ? { kind, column: n } : null;
    case 'nudge': return n === 1 || n === -1 ? { kind, direction: n } : null;
    case 'master': case 'crossfader': case 'go': case 'clear-all': case 'blackout': case 'test-card':
    case 'tap': case 'resync': case 'tempo-half': case 'tempo-double': case 'snap':
      return a === undefined ? { kind } : null;
    default: return null;
  }
};

export const targetId = (t: ControlTarget): string => {
  switch (t.kind) {
    case 'macro': return `macro:${t.index}`;
    case 'opacity':
    case 'clear': return `${t.kind}:${t.row}`;
    case 'slot': return `slot:${t.row}:${t.column}`;
    case 'column':
    case 'cue': return `${t.kind}:${t.column}`;
    case 'nudge': return `nudge:${t.direction}`;
    default: return t.kind;
  }
};

/** Faders take a value 0..1; everything else is a button (press / release). */
export const isFader = (t: ControlTarget): boolean =>
  t.kind === 'macro' || t.kind === 'master' || t.kind === 'crossfader' || t.kind === 'opacity';

// ---- Resolving positions ----------------------------------------------------------------

const layerAt = (row: number) => layersTopFirst(projectStore.getState())[row];

const columnName = (column: number) => projectStore.getState().columns[column]?.name || String(column + 1);

export const targetLabel = (t: ControlTarget): string => {
  const { macros } = projectStore.getState();
  const layerName = (row: number) => layerAt(row)?.name ?? `Layer row ${row + 1}`;
  switch (t.kind) {
    case 'macro': return macros[t.index]?.name ?? `Macro ${t.index + 1}`;
    case 'master': return 'Master';
    case 'crossfader': return 'Crossfader';
    case 'opacity': return `Opacity · ${layerName(t.row)}`;
    case 'slot': return `Clip · ${layerName(t.row)} / ${columnName(t.column)}`;
    case 'column': return `Column ${columnName(t.column)}`;
    case 'cue': return `Cue column ${columnName(t.column)}`;
    case 'go': return 'Go';
    case 'clear': return `Clear · ${layerName(t.row)}`;
    case 'clear-all': return 'Clear all';
    case 'blackout': return 'Blackout';
    case 'test-card': return 'Test card';
    case 'tap': return 'Tap tempo';
    case 'resync': return 'Resync';
    case 'nudge': return t.direction > 0 ? 'Nudge ahead' : 'Nudge back';
    case 'tempo-half': return 'Tempo ÷2';
    case 'tempo-double': return 'Tempo ×2';
    case 'snap': return 'Beat snap (next)';
  }
};

// ---- Faders ----------------------------------------------------------------------------

/** A fader target's value now (null: it doesn't exist in this project). */
export const faderValue = (t: ControlTarget): number | null => {
  switch (t.kind) {
    case 'macro': return projectStore.getState().macros[t.index]?.value ?? null;
    case 'master': return liveStore.getState().masterOpacity;
    case 'crossfader': return liveStore.getState().crossfader;
    case 'opacity': return layerAt(t.row)?.opacity ?? null;
    default: return null;
  }
};

export const setFader = (t: ControlTarget, value: number): void => {
  const v = Math.min(1, Math.max(0, value));
  switch (t.kind) {
    case 'macro': setMacroValue(t.index, v); break;
    case 'master': liveStore.getState().setMasterOpacity(v); break;
    case 'crossfader': liveStore.getState().setCrossfader(v); break;
    case 'opacity': {
      const layer = layerAt(t.row);
      if (layer && layer.opacity !== v) updateDeckLayer(layer.id, { opacity: v });
      break;
    }
  }
};

// ---- Buttons ---------------------------------------------------------------------------

const nextSnap = (snap: BeatSnap): BeatSnap => {
  const i = BEAT_SNAPS.findIndex(s => s.snap === snap);
  return BEAT_SNAPS[(i + 1) % BEAT_SNAPS.length].snap;
};

/** Press a button target; returns what to do on release (piano clips, nudge), if anything. */
export const pressTarget = (t: ControlTarget): (() => void) | null => {
  const live = liveStore.getState();
  switch (t.kind) {
    case 'slot': {
      const layer = layerAt(t.row);
      const clip = layer?.slots[t.column];
      return layer && clip ? pressClip(layer.id, clip.id) : null;
    }
    case 'column': triggerColumn(t.column); return null;
    case 'cue': cueColumn(live.cuedColumn === t.column ? null : t.column); return null;
    case 'go': go(); return null;
    case 'clear': {
      const layer = layerAt(t.row);
      if (layer) clearLayer(layer.id);
      return null;
    }
    case 'clear-all': clearAllLayers(); return null;
    case 'blackout': live.setBlackout(b => !b); return null;
    case 'test-card': live.setShowTestCard(v => !v); return null;
    case 'tap': tapTempo(); return null;
    case 'resync': resyncBar(); return null;
    case 'nudge': return startNudge(t.direction);
    case 'tempo-half': scaleTempo(0.5); return null;
    case 'tempo-double': scaleTempo(2); return null;
    case 'snap': setBeatSnap(nextSnap(projectStore.getState().tempo.beatSnap)); return null;
    default: return null; // faders
  }
};

/** What a button's LED should show now. */
export const buttonState = (t: ControlTarget): ButtonState => {
  const { scheduled, cuedColumn, blackout, showTestCard } = liveStore.getState();
  const show = projectStore.getState();
  switch (t.kind) {
    case 'slot': {
      const layer = layerAt(t.row);
      const clip = layer?.slots[t.column];
      if (!layer || !clip) return 'off';
      const waiting = scheduled.some(s =>
        (s.kind === 'clip' && s.layerId === layer.id && s.clipId === clip.id) ||
        (s.kind === 'column' && s.column === t.column) ||
        (s.kind === 'go' && cuedColumn === t.column));
      if (waiting) return 'armed';
      if (findClip(layer, layer.activeClipId)?.id === clip.id) return 'playing';
      return cuedColumn === t.column ? 'cued' : 'available';
    }
    case 'column': {
      if (scheduled.some(s => (s.kind === 'column' && s.column === t.column) || (s.kind === 'go' && cuedColumn === t.column))) return 'armed';
      if (cuedColumn === t.column) return 'cued';
      return show.layers.some(l => l.slots[t.column]) ? 'available' : 'off';
    }
    case 'cue': return cuedColumn === t.column ? 'cued' : 'off';
    case 'go': return scheduled.some(s => s.kind === 'go') ? 'armed' : cuedColumn !== null ? 'available' : 'off';
    case 'clear': return layerAt(t.row)?.activeClipId ? 'available' : 'off';
    case 'clear-all': return show.layers.some(l => l.activeClipId) ? 'available' : 'off';
    case 'blackout': return blackout ? 'on' : 'off';
    case 'test-card': return showTestCard ? 'on' : 'off';
    case 'snap': return show.tempo.beatSnap !== 'off' ? 'on' : 'off';
    default: return 'off';
  }
};
