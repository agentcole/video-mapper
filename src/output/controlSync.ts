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
  // Live output windows per screen ('' = the whole composition)
  screens: Record<string, number>;
}

export const outputStatusStore = createStore<OutputStatus>()(() => ({ connected: 0, screens: {} }));

export function useOutputStatus<T>(selector: (state: OutputStatus) => T): T {
  return useStore(outputStatusStore, selector);
}

const stripUrl = <T extends { mediaId?: string; url?: string }>(item: T): T =>
  item.mediaId ? { ...item, url: '' } : item;

export const createSnapshot = (): OutputSnapshot => {
  const { surfaces, layers, columns, background, grid, composition, tempo, effects, macros, screens } = projectStore.getState();
  const {
    masterOpacity, blackout, showTestCard, playback, renderer, cuedColumn, preloadClipId, layerTriggers,
    clockOrigin, scheduled, crossfader, timeOrigin,
  } = liveStore.getState();
  const show = mapClips({ surfaces, layers, columns }, clip => ({ ...clip, source: stripUrl(clip.source) }));
  return {
    doc: { ...show, background: stripUrl(background), grid, composition, tempo, effects, macros, screens },
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
  const lastSeen = new Map<string, { at: number; screenId: string }>();
  let pending = false;

  const updateStatus = () => {
    const screens: Record<string, number> = {};
    for (const { screenId } of lastSeen.values()) screens[screenId] = (screens[screenId] ?? 0) + 1;
    outputStatusStore.setState({ connected: lastSeen.size, screens });
  };

  const send = () => {
    if (lastSeen.size === 0) return;
    ch.postMessage({ type: 'state', snapshot: createSnapshot() } satisfies OutputMessage);
  };
  const post = () => {
    if (!pending) return;
    pending = false;
    send();
  };
  // Coalesce the updates of one event into one message. A microtask, not a
  // timer or rAF: those are throttled while the editor window is hidden,
  // and a MIDI controller may be driving the show from behind the output.
  const schedule = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(post);
  };

  const unsubscribeProject = projectStore.subscribe(schedule);
  const unsubscribeLive = liveStore.subscribe(schedule);

  ch.onmessage = (event: MessageEvent<OutputMessage>) => {
    const message = event.data;
    switch (message.type) {
      case 'hello':
        lastSeen.set(message.outputId, { at: Date.now(), screenId: message.screenId ?? '' });
        updateStatus();
        send();
        break;
      case 'heartbeat':
        if (!lastSeen.has(message.outputId)) {
          // An output that outlived an editor reload — bring it up to date
          lastSeen.set(message.outputId, { at: Date.now(), screenId: message.screenId ?? '' });
          updateStatus();
          send();
        } else {
          lastSeen.set(message.outputId, { at: Date.now(), screenId: message.screenId ?? '' });
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
    for (const [id, { at }] of lastSeen) {
      if (now - at > HEARTBEAT_TIMEOUT_MS) {
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
    pending = false;
    ch.close();
    if (channel === ch) channel = null;
    outputStatusStore.setState({ connected: 0, screens: {} });
  };
}
