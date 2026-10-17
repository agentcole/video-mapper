import { createStore, useStore } from 'zustand';
import type { RendererKind } from '../render/types';
import { clockNow } from './clock';

// ---------------------------------------------------------------------------
// Live output controls — show state, not part of the project document:
// master fader, blackout, global test card, transport commands, the clock's
// phase and launcher state. Shared by the editor and the output window.
// ---------------------------------------------------------------------------

export type PlaybackCommand = 'play' | 'pause';

// A launcher trigger waiting for its beat (beat snap). `at` is on the clock's
// time base; `beats` is the snap length it waits for, so it can follow the
// beat when the tempo or phase changes.
export type ScheduledTrigger = { at: number; beats: number } & (
  | { kind: 'clip'; layerId: string; clipId: string | null } // null: clear the layer
  | { kind: 'column'; column: number }
  | { kind: 'go' }
);

const RENDERER_KEY = 'video-mapper-renderer';

const storedRenderer = (): RendererKind => {
  try {
    return localStorage.getItem(RENDERER_KEY) === 'gpu' ? 'gpu' : 'css';
  } catch {
    return 'css';
  }
};

export interface LiveState {
  masterOpacity: number;
  blackout: boolean;
  showTestCard: boolean;
  // Transport as an event: `seq` increases with every command so the same
  // command can be sent twice in a row
  playback: { command: PlaybackCommand | null; seq: number };
  // Content renderer: DOM/CSS or the WebGL2 compositor (beta) — per machine
  renderer: RendererKind;
  // Clip launcher: the cued column (preloaded, fired by Go), a clip to
  // preload because it's about to be triggered (under the pointer), and a
  // counter per layer that renderers watch to (re)start its clip from the top
  cuedColumn: number | null;
  preloadClipId: string | null;
  layerTriggers: Record<string, number>;
  // Master clock phase: when beat 0 (a bar start) was, on the clock's time
  // base — the tempo is in the project. Triggers waiting for their beat.
  clockOrigin: number;
  scheduled: ScheduledTrigger[];
  // A/B crossfader: 0 = side A only, 1 = side B only, both full at 0.5
  crossfader: number;
  setRenderer: (renderer: RendererKind) => void;
  setMasterOpacity: (value: number) => void;
  setBlackout: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowTestCard: (value: boolean | ((prev: boolean) => boolean)) => void;
  sendPlayback: (command: PlaybackCommand) => void;
  setCuedColumn: (column: number | null) => void;
  setPreloadClipId: (clipId: string | null) => void;
  restartLayers: (layerIds: string[]) => void;
  setClockOrigin: (origin: number) => void;
  setScheduled: (scheduled: ScheduledTrigger[]) => void;
  setCrossfader: (value: number) => void;
}

export const liveStore = createStore<LiveState>()((set) => ({
  masterOpacity: 1,
  blackout: false,
  showTestCard: false,
  playback: { command: null, seq: 0 },
  renderer: storedRenderer(),
  cuedColumn: null,
  preloadClipId: null,
  layerTriggers: {},
  clockOrigin: clockNow(),
  scheduled: [],
  crossfader: 0.5,
  setRenderer: (renderer) => {
    try {
      localStorage.setItem(RENDERER_KEY, renderer);
    } catch {
      // not persisted — still applies for this session
    }
    set({ renderer });
  },
  setMasterOpacity: (value) => set({ masterOpacity: Math.max(0, Math.min(1, value)) }),
  setBlackout: (value) => set(s => ({ blackout: typeof value === 'function' ? value(s.blackout) : value })),
  setShowTestCard: (value) => set(s => ({ showTestCard: typeof value === 'function' ? value(s.showTestCard) : value })),
  sendPlayback: (command) => set(s => ({ playback: { command, seq: s.playback.seq + 1 } })),
  setCuedColumn: (cuedColumn) => set({ cuedColumn }),
  setPreloadClipId: (preloadClipId) => set(s => (s.preloadClipId === preloadClipId ? s : { preloadClipId })),
  restartLayers: (layerIds) => set(s => {
    if (layerIds.length === 0) return s;
    const layerTriggers = { ...s.layerTriggers };
    for (const id of layerIds) layerTriggers[id] = (layerTriggers[id] ?? 0) + 1;
    return { layerTriggers };
  }),
  setClockOrigin: (clockOrigin) => set({ clockOrigin }),
  setScheduled: (scheduled) => set({ scheduled }),
  setCrossfader: (value) => set({ crossfader: Math.max(0, Math.min(1, value)) }),
}));

export function useLiveStore<T>(selector: (state: LiveState) => T): T {
  return useStore(liveStore, selector);
}

/** Audio/visual output level: the master fader, or 0 during blackout. */
export const outputGainOf = (s: Pick<LiveState, 'masterOpacity' | 'blackout'>): number =>
  s.blackout ? 0 : s.masterOpacity;
