import type { BackgroundSettings, CompositionSettings, EffectInstance, MediaFrame, MediaType } from '../types';
import type { LiveState } from '../state/liveStore';

// ---------------------------------------------------------------------------
// Renderer abstraction. A scene is everything a renderer needs to draw the
// composition's content (background + frames); editor UI, grid, test card and
// blackout are DOM overlays on top and stay renderer-independent.
// ---------------------------------------------------------------------------

export type RendererKind = 'css' | 'gpu';

export interface RenderScene {
  frames: MediaFrame[]; // visible frames (crossfader applied), media URLs playable in this window
  bpm: number; // master tempo, for transitions measured in beats
  clockOrigin: number; // master clock phase (beat 0), clock time base
  timeOrigin: number; // session start, clock time base: TIME of effects and generators
  effects: EffectInstance[]; // composition effect stack
  background: BackgroundSettings;
  composition: CompositionSettings;
  masterOpacity: number;
  outputGain: number; // audio volume (master × blackout, 0 when muted)
  playback: LiveState['playback'];
  showPlaceholders: boolean; // editor: tint empty frames so they can be found
  // Clip launcher: clips to keep loaded (paused) for an instant start, and
  // per-layer trigger counters — a change restarts that layer's clip
  preload: PreloadMedia[];
  layerTriggers: LiveState['layerTriggers'];
}

/** A clip that isn't playing yet but should start without delay when triggered. */
export interface PreloadMedia {
  clipId: string;
  layerId: string;
  url: string; // playable in this window
  type: MediaType;
  loop: boolean;
  muted: boolean;
  playbackRate: number;
}

export interface SceneRenderer {
  readonly kind: RendererKind;
  /** Draw the scene now (call once per animation frame). */
  render(scene: RenderScene): void;
  /** Backing-store size of the output surface in device pixels. */
  resize(width: number, height: number): void;
  dispose(): void;
}
