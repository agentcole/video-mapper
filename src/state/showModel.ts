import type {
  BeatSnap, BlendMode, CrossfadeSide, EffectInstance, GeneratorSettings, MediaFrame, MediaType, MeshWarp, ModMap,
  PerspectiveCorners, Point, ShapeType, SoftEdge, Transition,
} from '../types';

// ---------------------------------------------------------------------------
// Show data model (format 5, see docs/design/data-model.md):
//   surfaces (mapping) → layers (mix) → clips in columns (content).
// Frames — what the editor, renderers and output work with — are a derived
// view: surface ⨝ layer ⨝ active clip. `framesFromShow` derives them and
// `showFromFrames` writes frame edits back to where each field lives.
// ---------------------------------------------------------------------------

export interface ClipSource {
  type: MediaType;
  url: string;
  mediaId?: string;
  filename?: string;
}

// How a clip reacts to the launcher: normal (start, again = restart), toggle
// (again = clear the layer) or piano (plays while held, then the previous
// clip comes back)
export type TriggerStyle = 'normal' | 'toggle' | 'piano';

export interface Clip {
  id: string;
  name?: string;
  triggerStyle?: TriggerStyle; // default 'normal'
  beatSnap?: BeatSnap; // default: the composition's beat snap
  transition?: Transition; // default: the layer's transition
  effects?: EffectInstance[]; // ISF effect stack on this clip
  generator?: GeneratorSettings; // an ISF generator instead of media (source: empty image)
  source: ClipSource;
  loop: boolean;
  playbackRate: number;
  muted: boolean;
  flipHorizontal: boolean;
  flipVertical: boolean;
  contentScale: number;
  contentOffsetX: number;
  contentOffsetY: number;
  blur: number;
  brightness: number;
  contrast: number;
  grayscale: number;
  saturate: number;
  hueRotate: number;
  invert: number;
  sepia: number;
}

export interface Layer {
  id: string;
  name: string;
  opacity: number;
  blendMode: BlendMode;
  slots: (Clip | null)[]; // indexed by column
  activeClipId: string | null;
  transition?: Transition; // clip changes and clearing dissolve; unset = cut
  crossfade?: CrossfadeSide; // crossfader side; unset = not on the crossfader
  effects?: EffectInstance[]; // ISF effect stack on whatever the layer plays
  mods?: ModMap; // modulation of layer properties ('opacity')
}

export interface Column {
  id: string;
  name: string;
}

export interface Surface {
  id: string;
  name?: string;
  layerId: string;
  visible: boolean;
  testPattern: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: ShapeType;
  vertices?: Point[];
  lockAspectRatio: boolean;
  perspectiveMode: boolean;
  perspectiveCorners: PerspectiveCorners;
  bilinear?: boolean; // 5.7 — the corner pin interpolates bilinearly
  mesh?: MeshWarp; // 5.7 — grid warp inside the corner pin
  softEdge: SoftEdge;
}

export interface ShowDocument {
  surfaces: Surface[];
  layers: Layer[];
  columns: Column[];
}

export const DEFAULT_COLUMN_COUNT = 8;

export const createColumns = (count = DEFAULT_COLUMN_COUNT): Column[] =>
  Array.from({ length: count }, (_, i) => ({ id: `column-${i + 1}`, name: String(i + 1) }));

export const emptyShow = (): ShowDocument => ({ surfaces: [], layers: [], columns: createColumns() });

const randomId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export type IdFactory = (kind: 'layer' | 'clip' | 'surface' | 'column' | 'effect') => string;
export const defaultIds: IdFactory = kind => randomId(kind);

export const findClip = (layer: Layer | undefined, clipId: string | null): Clip | null => {
  if (!layer || !clipId) return null;
  return layer.slots.find(c => c?.id === clipId) ?? null;
};

/** Every clip in the show (all layers, all slots). */
export const allClips = (show: Pick<ShowDocument, 'layers'>): Clip[] =>
  show.layers.flatMap(l => l.slots.filter((c): c is Clip => c !== null));

/** Rewrite every clip (e.g. to resolve or strip media URLs). */
export const mapClips = <T extends Pick<ShowDocument, 'layers'>>(show: T, fn: (clip: Clip) => Clip): T => ({
  ...show,
  layers: show.layers.map(layer => ({ ...layer, slots: layer.slots.map(c => (c ? fn(c) : c)) })),
});

// ---- Frame ⇄ entity fields ----------------------------------------------------

const surfaceFromFrame = (frame: MediaFrame, layerId: string): Surface => ({
  id: frame.id,
  name: frame.name,
  layerId,
  visible: frame.visible,
  testPattern: frame.testPattern,
  zIndex: frame.zIndex,
  x: frame.x,
  y: frame.y,
  width: frame.width,
  height: frame.height,
  rotation: frame.rotation,
  shape: frame.shape,
  vertices: frame.vertices,
  lockAspectRatio: frame.lockAspectRatio,
  perspectiveMode: frame.perspectiveMode,
  perspectiveCorners: frame.perspectiveCorners,
  bilinear: frame.bilinear,
  mesh: frame.mesh,
  softEdge: frame.softEdge,
});

// Identity, launcher and effect settings of a clip — frames don't write them back
type LaunchField = 'id' | 'name' | 'triggerStyle' | 'beatSnap' | 'transition' | 'effects' | 'generator';

const clipFieldsFromFrame = (frame: MediaFrame): Omit<Clip, LaunchField> => ({
  source: { type: frame.type, url: frame.url, mediaId: frame.mediaId, filename: frame.filename },
  loop: frame.loop,
  playbackRate: frame.playbackRate,
  muted: frame.muted,
  flipHorizontal: frame.flipHorizontal,
  flipVertical: frame.flipVertical,
  contentScale: frame.contentScale,
  contentOffsetX: frame.contentOffsetX,
  contentOffsetY: frame.contentOffsetY,
  blur: frame.blur,
  brightness: frame.brightness,
  contrast: frame.contrast,
  grayscale: frame.grayscale,
  saturate: frame.saturate,
  hueRotate: frame.hueRotate,
  invert: frame.invert,
  sepia: frame.sepia,
});

const EMPTY_CLIP_FIELDS: Omit<Clip, LaunchField> = {
  source: { type: 'image', url: '' },
  loop: true,
  playbackRate: 1,
  muted: false,
  flipHorizontal: false,
  flipVertical: false,
  contentScale: 1,
  contentOffsetX: 0,
  contentOffsetY: 0,
  blur: 0,
  brightness: 100,
  contrast: 100,
  grayscale: 0,
  saturate: 100,
  hueRotate: 0,
  invert: 0,
  sepia: 0,
};

/** A new clip playing a media source, with neutral settings. */
export const createClip = (id: string, source: ClipSource): Clip => ({ ...EMPTY_CLIP_FIELDS, id, source });

const frameFrom = (surface: Surface, layer: Layer | undefined, clip: Clip | null): MediaFrame => {
  const c = clip ?? { ...EMPTY_CLIP_FIELDS, id: '' };
  return {
    id: surface.id,
    name: surface.name,
    layerId: surface.layerId,
    clipId: clip?.id,
    layerHasClips: layer ? layer.slots.some(c => c !== null) : false,
    transition: clip?.transition ?? layer?.transition,
    crossfade: layer?.crossfade,
    clipEffects: clip?.effects,
    layerEffects: layer?.effects,
    layerMods: layer?.mods,
    generator: clip?.generator,
    visible: surface.visible,
    testPattern: surface.testPattern,
    zIndex: surface.zIndex,
    x: surface.x,
    y: surface.y,
    width: surface.width,
    height: surface.height,
    rotation: surface.rotation,
    shape: surface.shape,
    vertices: surface.vertices,
    textureMode: 'clip',
    lockAspectRatio: surface.lockAspectRatio,
    perspectiveMode: surface.perspectiveMode,
    perspectiveCorners: surface.perspectiveCorners,
    bilinear: surface.bilinear,
    mesh: surface.mesh,
    softEdge: surface.softEdge,
    opacity: layer?.opacity ?? 1,
    blendMode: layer?.blendMode ?? 'normal',
    type: c.source.type,
    url: c.source.url,
    mediaId: c.source.mediaId,
    filename: c.source.filename,
    loop: c.loop,
    playbackRate: c.playbackRate,
    muted: c.muted,
    flipHorizontal: c.flipHorizontal,
    flipVertical: c.flipVertical,
    contentScale: c.contentScale,
    contentOffsetX: c.contentOffsetX,
    contentOffsetY: c.contentOffsetY,
    blur: c.blur,
    brightness: c.brightness,
    contrast: c.contrast,
    grayscale: c.grayscale,
    saturate: c.saturate,
    hueRotate: c.hueRotate,
    invert: c.invert,
    sepia: c.sepia,
  };
};

// A missing key equals an undefined one (optional fields of loaded projects)
const shallowEqual = (a: object, b: object): boolean => {
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  return Object.keys(x).every(k => x[k] === y[k]) && Object.keys(y).every(k => x[k] === y[k]);
};

// Only the fields a frame carries — clip-only settings (name, trigger style)
// don't make a clip "changed"
const sameClipFields = (clip: Clip, fields: ReturnType<typeof clipFieldsFromFrame>): boolean => {
  const { source, ...rest } = fields;
  return clip.source.type === source.type && clip.source.url === source.url &&
    clip.source.mediaId === source.mediaId && clip.source.filename === source.filename &&
    (Object.keys(rest) as (keyof typeof rest)[]).every(k => clip[k] === rest[k]);
};

// ---- The lens ------------------------------------------------------------------

/**
 * Derive frames (surface ⨝ layer ⨝ active clip), in surface order. Frames
 * equal to one in `previous` (same id) keep that object, so memoized
 * consumers only see what really changed.
 */
export function framesFromShow(show: ShowDocument, previous: readonly MediaFrame[] = []): MediaFrame[] {
  const layers = new Map(show.layers.map(l => [l.id, l]));
  const prevById = new Map(previous.map(f => [f.id, f]));
  return show.surfaces.map(surface => {
    const layer = layers.get(surface.layerId);
    const frame = frameFrom(surface, layer, findClip(layer, layer?.activeClipId ?? null));
    const prev = prevById.get(frame.id);
    return prev && shallowEqual(prev, frame) ? prev : frame;
  });
}

/**
 * Write frames back: geometry → surfaces, opacity/blend → layers, content →
 * the active clip. New frames get a new layer with a clip in column 1; a
 * layer goes with its last surface (layers without surfaces stay).
 */
export function showFromFrames(show: ShowDocument, frames: readonly MediaFrame[], ids: IdFactory = defaultIds): ShowDocument {
  const columns = show.columns.length > 0 ? show.columns : createColumns();
  const layersById = new Map(show.layers.map(l => [l.id, l]));
  const surfacesById = new Map(show.surfaces.map(s => [s.id, s]));
  const touched = new Map<string, Layer>();
  const surfaces: Surface[] = [];

  for (const frame of frames) {
    const existing = surfacesById.get(frame.id);
    let layer = existing ? touched.get(existing.layerId) ?? layersById.get(existing.layerId) : undefined;
    layer ??= {
      id: ids('layer'),
      name: frame.name || frame.filename || `Layer ${show.layers.length + touched.size + 1}`,
      opacity: 1,
      blendMode: 'normal',
      slots: columns.map(() => null),
      activeClipId: null,
    };

    // Mix
    if (layer.opacity !== frame.opacity || layer.blendMode !== frame.blendMode) {
      layer = { ...layer, opacity: frame.opacity, blendMode: frame.blendMode };
    }

    // Content: update the active clip, or create one in the first free slot
    const fields = clipFieldsFromFrame(frame);
    const active = findClip(layer, layer.activeClipId);
    if (active) {
      if (!sameClipFields(active, fields)) {
        const updated: Clip = { ...active, ...fields };
        layer = { ...layer, slots: layer.slots.map(c => (c?.id === active.id ? updated : c)) };
      }
    } else {
      const clip: Clip = { id: ids('clip'), ...fields };
      const slots = layer.slots.length > 0 ? [...layer.slots] : columns.map(() => null as Clip | null);
      const free = slots.findIndex(c => c === null);
      if (free >= 0) slots[free] = clip;
      else slots.push(clip);
      layer = { ...layer, slots, activeClipId: clip.id };
    }

    touched.set(layer.id, layer);
    const surface = surfaceFromFrame(frame, layer.id);
    surfaces.push(existing && shallowEqual(existing, surface) ? existing : surface);
  }

  const referenced = new Set(surfaces.map(s => s.layerId));
  const previouslyReferenced = new Set(show.surfaces.map(s => s.layerId));
  const layers = show.layers
    .filter(l => referenced.has(l.id) || !previouslyReferenced.has(l.id))
    .map(l => touched.get(l.id) ?? l);
  for (const layer of touched.values()) {
    if (!layersById.has(layer.id)) layers.push(layer);
  }

  // Unchanged lists stay the same objects (history and memoization rely on it)
  const sameItems = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  return {
    surfaces: sameItems(surfaces, show.surfaces) ? show.surfaces : surfaces,
    layers: sameItems(layers, show.layers) ? show.layers : layers,
    columns,
  };
}
