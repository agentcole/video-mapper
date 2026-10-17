import { createStore, useStore } from 'zustand';
import { projectStore } from '../state/projectStore';
import { liveStore } from '../state/liveStore';
import { mapClips } from '../state/showModel';
import type { AudioSnapshot } from '../audio/audioBus';
import {
  OUTPUT_CHANNEL, HEARTBEAT_TIMEOUT_MS,
  type OutputMessage, type OutputSnapshot,
} from './protocol';

// ---------------------------------------------------------------------------
// Editor side of the output sync: pushes the project + live state to every
// output window and tracks which outputs are alive.
// ---------------------------------------------------------------------------

interface OutputStatus {
  connected: number; // output windows with a recent heartbeat
}

export const outputStatusStore = createStore<OutputStatus>()(() => ({ connected: 0 }));

export function useOutputStatus<T>(selector: (state: OutputStatus) => T): T {
  return useStore(outputStatusStore, selector);
}

const stripUrl = <T extends { mediaId?: string; url?: string }>(item: T): T =>
  item.mediaId ? { ...item, url: '' } : item;

export const createSnapshot = (): OutputSnapshot => {
  const { surfaces, layers, columns, background, grid, composition, tempo, effects, macros } = projectStore.getState();
  const {
    masterOpacity, blackout, showTestCard, playback, renderer, cuedColumn, preloadClipId, layerTriggers,
    clockOrigin, scheduled, crossfader, timeOrigin,
  } = liveStore.getState();
  const show = mapClips({ surfaces, layers, columns }, clip => ({ ...clip, source: stripUrl(clip.source) }));
  return {
    doc: { ...show, background: stripUrl(background), grid, composition, tempo, effects, macros },
    live: {
      masterOpacity, blackout, showTestCard, playback, renderer, cuedColumn, preloadClipId, layerTriggers,
      clockOrigin, scheduled, crossfader, timeOrigin,
    },
  };
};

let channel: BroadcastChannel | null = null;

/** Forward the audio analysis to the output windows (only while there are some). */
export const postAudio = (snapshot: AudioSnapshot) => {
  if (outputStatusStore.getState().connected > 0) channel?.postMessage({ type: 'audio', snapshot } satisfies OutputMessage);
};

/** Ask all output windows to close (they were opened by script, so they can). */
export const closeOutputs = () => {
  channel?.postMessage({ type: 'close-outputs' } satisfies OutputMessage);
};

/** Start syncing; returns a cleanup function. */
export function startControlSync(): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(OUTPUT_CHANNEL);
  channel = ch;
  const lastSeen = new Map<string, number>();
  let pending: ReturnType<typeof setTimeout> | null = null;

  const updateStatus = () => outputStatusStore.setState({ connected: lastSeen.size });

  const post = () => {
    pending = null;
    if (lastSeen.size === 0) return;
    ch.postMessage({ type: 'state', snapshot: createSnapshot() } satisfies OutputMessage);
  };
  // Coalesce bursts (a drag fires many updates per frame) into one message.
  // A timer rather than rAF so updates still flow while the editor is hidden.
  const schedule = () => {
    if (pending === null) pending = setTimeout(post, 0);
  };

  const unsubscribeProject = projectStore.subscribe(schedule);
  const unsubscribeLive = liveStore.subscribe(schedule);

  ch.onmessage = (event: MessageEvent<OutputMessage>) => {
    const message = event.data;
    switch (message.type) {
      case 'hello':
        lastSeen.set(message.outputId, Date.now());
        updateStatus();
        post();
        break;
      case 'heartbeat':
        if (!lastSeen.has(message.outputId)) {
          // An output that outlived an editor reload — bring it up to date
          lastSeen.set(message.outputId, Date.now());
          updateStatus();
          post();
        } else {
          lastSeen.set(message.outputId, Date.now());
        }
        break;
      case 'bye':
        lastSeen.delete(message.outputId);
        updateStatus();
        break;
      case 'toggle-blackout':
        liveStore.getState().setBlackout(prev => !prev);
        break;
    }
  };

  // Outputs that crashed or were killed never say bye
  const expiry = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, seen] of lastSeen) {
      if (now - seen > HEARTBEAT_TIMEOUT_MS) {
        lastSeen.delete(id);
        changed = true;
      }
    }
    if (changed) updateStatus();
  }, HEARTBEAT_TIMEOUT_MS / 2);

  ch.postMessage({ type: 'control-ready' } satisfies OutputMessage);

  return () => {
    unsubscribeProject();
    unsubscribeLive();
    clearInterval(expiry);
    if (pending !== null) clearTimeout(pending);
    ch.close();
    if (channel === ch) channel = null;
    outputStatusStore.setState({ connected: 0 });
  };
}
