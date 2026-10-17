import type { BackgroundSettings, CompositionSettings, MediaFrame } from '../types';
import type { LiveState } from '../state/liveStore';

// ---------------------------------------------------------------------------
// Renderer abstraction. A scene is everything a renderer needs to draw the
// composition's content (background + frames); editor UI, grid, test card and
// blackout are DOM overlays on top and stay renderer-independent.
// ---------------------------------------------------------------------------

export type RendererKind = 'css' | 'gpu';

export interface RenderScene {
  frames: MediaFrame[]; // visible frames, media URLs playable in this window
  background: BackgroundSettings;
  composition: CompositionSettings;
  masterOpacity: number;
  outputGain: number; // audio volume (master × blackout, 0 when muted)
  playback: LiveState['playback'];
  showPlaceholders: boolean; // editor: tint empty frames so they can be found
}

export interface SceneRenderer {
  readonly kind: RendererKind;
  /** Draw the scene now (call once per animation frame). */
  render(scene: RenderScene): void;
  /** Backing-store size of the output surface in device pixels. */
  resize(width: number, height: number): void;
  dispose(): void;
}
