import type { ProjectDocument } from '../state/projectStore';
import type { LiveState } from '../state/liveStore';

// ---------------------------------------------------------------------------
// Editor ⇄ output window protocol (BroadcastChannel, same origin + browser).
// The editor is the source of truth and pushes snapshots; output windows
// announce themselves and keep a heartbeat so the editor knows they exist.
// ---------------------------------------------------------------------------

export const OUTPUT_CHANNEL = 'video-mapper-output';

// Output windows are the same app with this query parameter
export const OUTPUT_QUERY_PARAM = 'output';

export const HEARTBEAT_INTERVAL_MS = 2000;
export const HEARTBEAT_TIMEOUT_MS = 6000;

export type LiveSnapshot = Pick<
  LiveState,
  'masterOpacity' | 'blackout' | 'showTestCard' | 'playback' | 'renderer' | 'cuedColumn' | 'preloadClipId' | 'layerTriggers'
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
  // outputs → editor
  | { type: 'hello'; outputId: string }
  | { type: 'heartbeat'; outputId: string }
  | { type: 'bye'; outputId: string }
  | { type: 'toggle-blackout' };
