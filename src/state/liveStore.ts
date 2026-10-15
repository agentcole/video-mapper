import { createStore, useStore } from 'zustand';

// ---------------------------------------------------------------------------
// Live output controls — show state, not part of the project document:
// master fader, blackout, global test card and transport commands. Shared by
// the editor and the output window.
// ---------------------------------------------------------------------------

export type PlaybackCommand = 'play' | 'pause';

export interface LiveState {
  masterOpacity: number;
  blackout: boolean;
  showTestCard: boolean;
  // Transport as an event: `seq` increases with every command so the same
  // command can be sent twice in a row
  playback: { command: PlaybackCommand | null; seq: number };
  setMasterOpacity: (value: number) => void;
  setBlackout: (value: boolean | ((prev: boolean) => boolean)) => void;
  setShowTestCard: (value: boolean | ((prev: boolean) => boolean)) => void;
  sendPlayback: (command: PlaybackCommand) => void;
}

export const liveStore = createStore<LiveState>()((set) => ({
  masterOpacity: 1,
  blackout: false,
  showTestCard: false,
  playback: { command: null, seq: 0 },
  setMasterOpacity: (value) => set({ masterOpacity: Math.max(0, Math.min(1, value)) }),
  setBlackout: (value) => set(s => ({ blackout: typeof value === 'function' ? value(s.blackout) : value })),
  setShowTestCard: (value) => set(s => ({ showTestCard: typeof value === 'function' ? value(s.showTestCard) : value })),
  sendPlayback: (command) => set(s => ({ playback: { command, seq: s.playback.seq + 1 } })),
}));

export function useLiveStore<T>(selector: (state: LiveState) => T): T {
  return useStore(liveStore, selector);
}

/** Audio/visual output level: the master fader, or 0 during blackout. */
export const outputGainOf = (s: Pick<LiveState, 'masterOpacity' | 'blackout'>): number =>
  s.blackout ? 0 : s.masterOpacity;
