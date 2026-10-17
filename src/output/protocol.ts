import type { ProjectDocument } from '../state/projectStore';
import type { LiveState } from '../state/liveStore';
import type { AudioSnapshot } from '../audio/audioBus';

// ---------------------------------------------------------------------------
// Editor ⇄ output window protocol (BroadcastChannel, same origin + browser).
// The editor is the source of truth and pushes snapshots; output windows
// announce themselves and keep a heartbeat so the editor knows they exist.
// ---------------------------------------------------------------------------

export const OUTPUT_CHANNEL = 'video-mapper-output';

// Output windows are the same app with this query parameter; its value is
// the screen the window shows (empty: the whole composition)
export const OUTPUT_QUERY_PARAM = 'output';

export const HEARTBEAT_INTERVAL_MS = 2000;
export const HEARTBEAT_TIMEOUT_MS = 6000;

export type LiveSnapshot = Pick<
  LiveState,
  | 'masterOpacity' | 'blackout' | 'showTestCard' | 'playback' | 'renderer'
  | 'cuedColumn' | 'preloadClipId' | 'layerTriggers' | 'clockOrigin' | 'scheduled' | 'crossfader' | 'timeOrigin'
>;

export interface OutputSnapshot {
  // The whole show (every clip, so outputs can preload what comes next).
  // Clips/background with a mediaId carry no URL: blob URLs belong to the
  // window that created them, so each output resolves media from IndexedDB
  doc: ProjectDocument;
  live: LiveSnapshot;
}

export type OutputMessage =
  // editor → outputs
  | { type: 'state'; snapshot: OutputSnapshot }
  | { type: 'control-ready' }
  | { type: 'close-outputs' }
  | { type: 'audio'; snapshot: AudioSnapshot } // the editor's audio analysis, ~94 per second
  // outputs → editor
  | { type: 'hello'; outputId: string; screenId: string | null }
  | { type: 'heartbeat'; outputId: string; screenId: string | null }
  | { type: 'bye'; outputId: string }
  | { type: 'toggle-blackout' };
