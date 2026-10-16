import type {
  BackgroundSettings, GridSettings, CompositionSettings, PerspectiveCorners, SoftEdge, TempoSettings,
} from '../types';

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  type: 'color',
  color: '#1e293b', // slate-800
};

export const DEFAULT_GRID: GridSettings = {
  show: false,
  snap: false,
  size: 32,
  showInPresentation: false,
};

export const DEFAULT_COMPOSITION: CompositionSettings = {
  width: 1920,
  height: 1080,
};

export const DEFAULT_TEMPO: TempoSettings = {
  bpm: 120,
  beatsPerBar: 4,
  beatSnap: 'off',
};

export const DEFAULT_PERSPECTIVE_CORNERS: PerspectiveCorners = {
  tl: { x: 0, y: 0 },
  tr: { x: 0, y: 0 },
  br: { x: 0, y: 0 },
  bl: { x: 0, y: 0 },
};

export const DEFAULT_SOFT_EDGE: SoftEdge = { left: 0, right: 0, top: 0, bottom: 0 };
