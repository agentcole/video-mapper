import type { BlendMode, BeatSnap, CrossfadeSide, Transition } from '../types';
import { projectStore } from './projectStore';
import { liveStore, type ScheduledTrigger } from './liveStore';
import {
  addColumn, addLayer, moveClip, placeClip, removeClip, renameColumn, setActiveClip,
  triggerColumn as triggerColumnOf, updateClip, updateLayer, type SlotRef,
} from './deck';
import { createClip, defaultIds, findClip, type Clip, type ClipSource, type TriggerStyle } from './showModel';
import { beatAt, clockNow, snapBeats, snapTime, timeOfBeat, type Clock } from './clock';
import { markTriggered } from '../render/startStats';
import { setWorkerTimeout } from './workerTimer';

// ---------------------------------------------------------------------------
// Clip launcher actions: apply deck operations to the project store and tell
// the renderers (here and in output windows) which layers start a clip.
//
// With beat snap on, a trigger waits for the next beat / bar of the master
// clock in `liveStore.scheduled` (shown as armed in the launcher, its clips
// preloaded) and fires from a timer. Only the editor schedules and fires;
// output windows just follow. Alt (`now`) skips the wait.
// ---------------------------------------------------------------------------

const { setShow } = projectStore.getState();

const layerOf = (layerId: string) => projectStore.getState().layers.find(l => l.id === layerId);

/** The master clock: tempo from the project, phase from the live state. */
export const currentClock = (): Clock => ({
  bpm: projectStore.getState().tempo.bpm,
  origin: liveStore.getState().clockOrigin,
});

// Piano clips: what the layer played before the held clip took over
const pianoReturn = new Map<string, string | null>();

// `at` (clock time base) is when the trigger was due — a beat-snapped start
// counts its latency from the beat, not from when the timer ran
const restart = (layerIds: string[], at?: number) => {
  liveStore.getState().restartLayers(layerIds);
  markTriggered(layerIds, at !== undefined ? at - performance.timeOrigin : undefined);
};

// ---- Firing (now) -----------------------------------------------------------------

const startNow = (layerId: string, clipId: string, at?: number): void => {
  if (!findClip(layerOf(layerId), clipId)) return; // removed while waiting
  setShow(show => setActiveClip(show, layerId, clipId));
  restart([layerId], at);
};

const clearNow = (layerId: string): void => {
  pianoReturn.delete(layerId);
  setShow(show => setActiveClip(show, layerId, null));
};

const triggerColumnNow = (column: number, at?: number): void => {
  pianoReturn.clear();
  let started: string[] = [];
  setShow(show => {
    const result = triggerColumnOf(show, column);
    started = result.started;
    return result.show;
  });
  restart(started, at);
};

const goNow = (at?: number): void => {
  const { cuedColumn } = liveStore.getState();
  if (cuedColumn === null) return;
  triggerColumnNow(cuedColumn, at);
  const { columns } = projectStore.getState();
  liveStore.getState().setCuedColumn(cuedColumn + 1 < columns.length ? cuedColumn + 1 : null);
};

const run = (trigger: ScheduledTrigger): void => {
  switch (trigger.kind) {
    case 'clip':
      if (trigger.clipId) startNow(trigger.layerId, trigger.clipId, trigger.at);
      else clearNow(trigger.layerId);
      break;
    case 'column':
      triggerColumnNow(trigger.column, trigger.at);
      break;
    case 'go':
      goNow(trigger.at);
      break;
  }
};

// ---- Scheduling (beat snap) -------------------------------------------------------

// A trigger before it gets its time (Omit over each member of the union)
type Trigger = ScheduledTrigger extends infer T ? (T extends unknown ? Omit<T, 'at' | 'beats'> : never) : never;

// A worker timer: keeps the beat while the editor window is hidden
let cancelTimer: (() => void) | null = null;

const scheduled = () => liveStore.getState().scheduled;
const setScheduled = (next: ScheduledTrigger[]) => liveStore.getState().setScheduled(next);

const armTimer = () => {
  cancelTimer?.();
  cancelTimer = null;
  const pending = scheduled();
  if (pending.length === 0) return;
  const next = Math.min(...pending.map(t => t.at));
  cancelTimer = setWorkerTimeout(fireDue, Math.max(0, next - clockNow()));
};

// Same moment: columns before clips, so a clip pressed after a column wins on its layer
const order = (t: ScheduledTrigger) => (t.kind === 'clip' ? 1 : 0);

function fireDue() {
  cancelTimer = null;
  const now = clockNow();
  const pending = scheduled();
  const due = pending.filter(t => t.at <= now + 1);
  if (due.length > 0) {
    setScheduled(pending.filter(t => !due.includes(t)));
    due.sort((a, b) => a.at - b.at || order(a) - order(b)).forEach(run);
  }
  armTimer();
}

// The later press wins: a column (or Go) replaces everything that waits, a
// clip replaces what waits on its layer
const withoutConflicts = (pending: ScheduledTrigger[], trigger: Trigger) =>
  trigger.kind === 'clip'
    ? pending.filter(t => !(t.kind === 'clip' && t.layerId === trigger.layerId))
    : [];

/** Fire now, or wait for the next boundary `beats` long. */
const fire = (trigger: Trigger, beats: number): void => {
  const now = clockNow();
  const at = snapTime(currentClock(), now, beats);
  const rest = withoutConflicts(scheduled(), trigger);
  if (at <= now) {
    if (rest.length !== scheduled().length) setScheduled(rest);
    run({ ...trigger, at: now, beats: 0 } as ScheduledTrigger);
  } else {
    setScheduled([...rest, { ...trigger, at, beats } as ScheduledTrigger]);
  }
  armTimer();
};

const cancel = (keep: (t: ScheduledTrigger) => boolean) => {
  const pending = scheduled();
  const next = pending.filter(keep);
  if (next.length === pending.length) return;
  setScheduled(next);
  armTimer();
};

/**
 * The clock changed (tempo, phase): waiting triggers move to the nearest
 * boundary on the new grid, and fire right away if that already went by.
 */
export const retargetScheduled = (): void => {
  const pending = scheduled();
  if (pending.length === 0) return;
  const clock = currentClock();
  const now = clockNow();
  setScheduled(pending.map(t => {
    const beat = Math.round(beatAt(clock, t.at) / t.beats) * t.beats;
    return { ...t, at: Math.max(now, timeOfBeat(clock, beat)) };
  }));
  fireDue();
};

/** A clip's snap length in beats: its own beat snap or the composition's (0 = off). */
const snapOf = (clip: Clip | undefined, now: boolean): number => {
  if (now) return 0;
  const { tempo } = projectStore.getState();
  return snapBeats(clip?.beatSnap ?? tempo.beatSnap, tempo.beatsPerBar);
};

const pendingOn = (layerId: string) =>
  scheduled().find((t): t is Extract<ScheduledTrigger, { kind: 'clip' }> => t.kind === 'clip' && t.layerId === layerId);

// ---- Triggers -------------------------------------------------------------------------

export interface TriggerOptions {
  now?: boolean; // ignore beat snap (Alt)
}

/** Stop a layer's clip right away (and whatever waits on it). */
export const clearLayer = (layerId: string): void => {
  cancel(t => !(t.kind === 'clip' && t.layerId === layerId));
  clearNow(layerId);
};

export const clearAllLayers = (): void => {
  cancel(() => false);
  pianoReturn.clear();
  setShow(show => show.layers.reduce((s, layer) => setActiveClip(s, layer.id, null), show));
};

/**
 * A press on a clip in the launcher, by the clip's trigger style and beat
 * snap. Returns the release handler for piano clips (the previous clip comes
 * back). Piano clips are a gesture and never wait for the beat.
 */
export const pressClip = (layerId: string, clipId: string, { now = false }: TriggerOptions = {}): (() => void) | null => {
  const layer = layerOf(layerId);
  const clip = findClip(layer, clipId);
  if (!layer || !clip) return null;
  const style = clip.triggerStyle ?? 'normal';
  const pending = pendingOn(layerId);

  if (style === 'piano') {
    if (pending) cancel(t => t !== pending);
    if (!pianoReturn.has(layerId)) pianoReturn.set(layerId, layer.activeClipId === clipId ? null : layer.activeClipId);
    startNow(layerId, clipId);
    return () => {
      const back = pianoReturn.get(layerId) ?? null;
      pianoReturn.delete(layerId);
      // Something else was triggered while held — leave it
      if (layerOf(layerId)?.activeClipId !== clipId) return;
      if (back && findClip(layerOf(layerId), back)) startNow(layerId, back);
      else setShow(show => setActiveClip(show, layerId, null));
    };
  }

  const beats = snapOf(clip, now);
  if (style === 'toggle') {
    // Pressing again while it waits takes the press back
    if (pending && (pending.clipId === clipId || (pending.clipId === null && layer.activeClipId === clipId))) {
      cancel(t => t !== pending);
      return null;
    }
    if (layer.activeClipId === clipId) {
      fire({ kind: 'clip', layerId, clipId: null }, beats);
      return null;
    }
  } else if (pending?.clipId === clipId && !now) {
    return null; // already waiting for its beat
  }
  fire({ kind: 'clip', layerId, clipId }, beats);
  return null;
};

const compositionSnap = (now: boolean): number => {
  if (now) return 0;
  const { tempo } = projectStore.getState();
  return snapBeats(tempo.beatSnap, tempo.beatsPerBar);
};

/** Every layer plays its clip in this column; layers with an empty cell are cleared. */
export const triggerColumn = (column: number, { now = false }: TriggerOptions = {}): void => {
  const waiting = scheduled().find(t => t.kind === 'column');
  if (!now && waiting?.kind === 'column' && waiting.column === column) return;
  fire({ kind: 'column', column }, compositionSnap(now));
};

export const cueColumn = (column: number | null): void => {
  const { columns } = projectStore.getState();
  liveStore.getState().setCuedColumn(column !== null && column >= 0 && column < columns.length ? column : null);
};

/** Fire the cued column and cue the next one (a cue list). */
export const go = ({ now = false }: TriggerOptions = {}): void => {
  if (liveStore.getState().cuedColumn === null) return;
  if (!now && scheduled().some(t => t.kind === 'go')) return;
  fire({ kind: 'go' }, compositionSnap(now));
};

/** Set the composition's beat snap, or a clip's own (null: follow the composition). */
export const setClipBeatSnap = (clipId: string, beatSnap: BeatSnap | null): void =>
  setShow(show => updateClip(show, clipId, { beatSnap: beatSnap ?? undefined }));

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

// A cut is stored as no transition
const storedTransition = (transition: Transition | null): Transition | undefined =>
  transition && transition.duration > 0 ? transition : undefined;

/** How the layer changes clips and fades out when cleared. */
export const setLayerTransition = (layerId: string, transition: Transition | null): void =>
  setShow(show => updateLayer(show, layerId, { transition: storedTransition(transition) }));

/**
 * A clip's own transition, used when it starts: a transition (a cut is
 * {duration 0}), or null to follow the layer.
 */
export const setClipTransition = (clipId: string, transition: Transition | null): void =>
  setShow(show => updateClip(show, clipId, { transition: transition ?? undefined }));

/** Put a layer on a crossfader side (null: off the crossfader). */
export const setLayerCrossfade = (layerId: string, side: CrossfadeSide | null): void =>
  setShow(show => updateLayer(show, layerId, { crossfade: side ?? undefined }));
